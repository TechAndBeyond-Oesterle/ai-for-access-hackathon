#!/usr/bin/env node
/**
 * AI for Access — Challenges aus Airtable nach Discord
 * ----------------------------------------------------
 * Kein Dauer-Feature im Bot: ein Einmal-Skript, damit am Event-Tag nichts
 * Zusätzliches laufen muss. Alles läuft über REST, also ohne privilegierte
 * Intents und ohne Partials (die brauchte nur ein Live-Listener).
 *
 *   node challenges.mjs --preview         # Textabnahme in der Konsole, ganz ohne Discord
 *   node challenges.mjs --post            # Teaser-Fassung ins (unsichtbare) Forum
 *   node challenges.mjs --post --full     # dieselben Threads auf Vollfassung heben
 *   node challenges.mjs --hide            # Forum für @everyone unsichtbar
 *   node challenges.mjs --reveal          # Forum freischalten (Samstagmorgen)
 *   node challenges.mjs --report          # ✋-Reaktionen → "Challenge → Teams"
 *   node challenges.mjs --report --post-summary   # Übersicht zusätzlich nach #orga-intern
 *
 * Jeder Modus versteht --dry-run.
 *
 * Zwei getrennte Gates, beide bewusst manuell:
 *   1. Inhaltliche Freigabe passiert in Airtable (Status = "Accepted").
 *      Alles andere wird nie gepostet — es gibt keine zweite Wahrheit.
 *   2. Sichtbarkeit passiert hier (--reveal). Die Threads liegen vorher fertig
 *      im Forum, der Reveal ist ein Rechte-Flip und kein Massen-Posting.
 *
 * Wiedererkennung wie in posts.mjs: ein Marker im Subtext des Startposts
 * (`-# ⟨challenge:<recordId>⟩`). Kein State-File, die Wahrheit steht in Discord.
 */

import 'dotenv/config';
import { Client, GatewayIntentBits, Events, ChannelType, PermissionsBitField } from 'discord.js';
import { TEAM_ROLE_PREFIX, teamName } from './team-rules.mjs';

const {
  DISCORD_TOKEN,
  GUILD_ID,
  AIRTABLE_PAT,
  AIRTABLE_BASE_ID = 'appapD55EOTAiqT0I',
  AIRTABLE_CHALLENGES_TABLE = 'tbluAK4cJ5wfSdnnz',
} = process.env;

const has = (flag) => process.argv.includes(flag);
const DRY_RUN = has('--dry-run');
const MODE = ['--post', '--reveal', '--hide', '--report', '--preview'].find(has)?.slice(2);
const FULL = has('--full');
const POST_SUMMARY = has('--post-summary');
const ANY_STATUS = has('--any-status');

const FORUM = 'challenges';
const SUMMARY_CHANNEL = 'orga-intern';
const CLAIM = '✋';
const DISCORD_LIMIT = 2000;
const THREAD_NAME_LIMIT = 100;

if (!MODE) {
  console.error('❌ Modus fehlt: --preview | --post [--full] | --reveal | --hide | --report [--post-summary]');
  process.exit(1);
}
if (MODE !== 'preview' && (!DISCORD_TOKEN || !GUILD_ID)) {
  console.error('❌ DISCORD_TOKEN und GUILD_ID müssen in .env gesetzt sein.');
  process.exit(1);
}
if ((MODE === 'post' || MODE === 'preview') && !AIRTABLE_PAT) {
  console.error('❌ AIRTABLE_PAT fehlt — ohne den kommen wir nicht an die freigegebenen Challenges.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// AIRTABLE
// ---------------------------------------------------------------------------

/** KI-Felder (aiText) liefern ein Objekt {state, value}, normale Felder einen Wert. */
const plain = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v.value : v);

/** Holt alle Records mit Status "Accepted" — das ist die Freigabe der Orga. */
async function fetchAccepted() {
  const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_CHALLENGES_TABLE}`);
  if (!ANY_STATUS) url.searchParams.set('filterByFormula', "{Status}='Accepted'");
  url.searchParams.set('pageSize', '100');

  const records = [];
  let offset;
  do {
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } });
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
    const page = await res.json();
    records.push(...page.records);
    offset = page.offset;
  } while (offset);

  return records.map((r) => ({ id: r.id, f: r.fields }));
}

// ---------------------------------------------------------------------------
// POST-TEXTE (englisch — der Bot spricht Englisch, siehe HCK-5)
// ---------------------------------------------------------------------------

const markerOf = (id) => `-# ⟨challenge:${id}⟩`;

/**
 * Der Anreiz, der Freitagabend bei der Team-Bildung den Unterschied macht:
 * Eine Sponsor-Challenge kommt von einer Organisation mit akutem Bedarf, der Bedarf ist
 * damit belegt. Die Jury setzt dafür 5/10 auf der Problem-Achse (Desire) als **Mindestwert**
 * an, Matrix Desire · Viable · Feasible · Ethical. Eine eigene Idee muss diesen Wert im
 * Pitch erst erarbeiten.
 *
 * Gilt nur für Challenges mit „Company Challenge" = true. Persönliche Einreichungen
 * bekommen den Absatz nicht, sonst wäre der Vorteil keiner.
 * Skala (1-10) und Achsen-Zuordnung: offener Punkt in HCK-27.
 */
const JURY_TEASER = '**Head start with the jury:** this challenge comes from an organisation '
  + 'facing the problem right now, so the need is proven. The jury scores it **at least 5/10 '
  + 'on Desire** (matrix: Desire · Viable · Feasible · Ethical). Bring your own idea and you '
  + 'argue that score from scratch.';

/**
 * Titel eines Records. Airtable-Zeilen können unvollständig sein (früh abgebrochene
 * Einreichung, von Hand angelegt), deshalb die Kette Title → KI-Headline → nichts.
 * Ein Record ganz ohne Titel wird nicht gepostet, statt „undefined" in Discord zu schreiben.
 */
const titleOf = ({ f }) => f.Title || plain(f['Headline (Problem Statement)']) || null;

/** Thread-Titel: Firmen-Challenge und eigene Idee sind auf einen Blick unterscheidbar. */
function threadTitle(rec) {
  const { f } = rec;
  const company = f['Company Challenge'] ? f['Company or Organisation'] : null;
  const name = `${f['Company Challenge'] ? '🏢' : '💡'} ${titleOf(rec) ?? '(ohne Titel)'}`
    + `${company ? ` · ${company}` : ''}`;
  return name.length > THREAD_NAME_LIMIT ? `${name.slice(0, THREAD_NAME_LIMIT - 1)}…` : name;
}

/** Kürzt einen Block, statt am Event-Tag am 2000-Zeichen-Limit zu scheitern. */
const clip = (text, max) => (text && text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

function body(rec, full) {
  const { id, f } = rec;
  const lines = [];
  const meta = [];
  if (f['Company Challenge'] && f['Company or Organisation']) meta.push(`**By:** ${f['Company or Organisation']}`);
  if (f.Category?.length) meta.push(`**Focus:** ${f.Category.join(', ')}`);
  if (meta.length) lines.push(meta.join(' · '));

  const teaser = f.Teaser
    || (f.Title ? plain(f['Headline (Problem Statement)']) : null)
    || clip(plain(f['Summary (Problem Statement)']), 300);
  if (teaser) lines.push('', teaser);

  if (f['Company Challenge']) lines.push('', JURY_TEASER);

  if (!full) {
    lines.push('', '_Full brief goes live on Saturday morning._');
  } else {
    if (f.Context) lines.push('', '**Context**', clip(f.Context, 600));
    if (f['Problem Statement']) lines.push('', '**Problem**', clip(f['Problem Statement'], 600));
    if (f.Resources) lines.push('', '**What you get**', clip(f.Resources, 400));
    const contact = [];
    if (f['Contact Name']) contact.push(`**Contact:** ${f['Contact Name']}`);
    if (f.Availability?.length) contact.push(`**On site:** ${f.Availability.join(', ')}`);
    if (contact.length) lines.push('', contact.join(' · '));
    lines.push('', `React with ${CLAIM} if your team is working on this. Several teams may pick the same challenge.`);
  }

  lines.push('', markerOf(id));
  const content = lines.join('\n');
  if (content.length > DISCORD_LIMIT) {
    console.warn(`  ⚠️  „${f.Title}": ${content.length} Zeichen, wird auf ${DISCORD_LIMIT} gekürzt.`);
    return `${content.slice(0, DISCORD_LIMIT - markerOf(id).length - 4).trimEnd()}…\n\n${markerOf(id)}`;
  }
  return content;
}

// ---------------------------------------------------------------------------
// DISCORD-HELFER
// ---------------------------------------------------------------------------

function forumOf(guild) {
  const ch = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildForum && c.name.toLowerCase() === FORUM,
  );
  if (!ch) throw new Error(`Forum #${FORUM} nicht gefunden — lief setup.mjs auf diesem Server?`);
  return ch;
}

/** Aktive und archivierte Threads, damit ein archivierter Thread kein Duplikat erzeugt. */
async function allThreads(forum) {
  const active = await forum.threads.fetchActive().catch(() => null);
  const archived = await forum.threads.fetchArchived({ limit: 100 }).catch(() => null);
  return [...(active?.threads.values() ?? []), ...(archived?.threads.values() ?? [])];
}

/** Startpost eines Threads, samt seiner Reaktionen (REST, kein Intent nötig). */
async function starterOf(thread) {
  return thread.fetchStarterMessage().catch(() => null);
}

/** Ordnet jedem Thread seine Airtable-Record-ID zu (über den Marker im Startpost). */
async function indexThreads(forum) {
  const index = new Map();
  for (const thread of await allThreads(forum)) {
    const starter = await starterOf(thread);
    const id = starter?.content.match(/⟨challenge:(rec[\w]+)⟩/)?.[1];
    if (id) index.set(id, { thread, starter });
  }
  return index;
}

/** Forum-Tags aus dem Category-Feld — nur was es im Forum schon gibt. */
function tagIdsFor(forum, categories = []) {
  if (!forum.availableTags.length) return { ids: [], missing: [] }; // Forum führt bewusst keine Tags
  const wanted = categories.map((c) => c.toLowerCase());
  const hits = forum.availableTags.filter((t) => wanted.includes(t.name.toLowerCase()));
  const missing = categories.filter(
    (c) => !forum.availableTags.some((t) => t.name.toLowerCase() === c.toLowerCase()),
  );
  return { ids: hits.map((t) => t.id).slice(0, 5), missing };
}

// ---------------------------------------------------------------------------
// MODUS: --post
// ---------------------------------------------------------------------------

async function runPost(guild) {
  const forum = forumOf(guild);
  const records = await fetchAccepted();
  console.log(`\nAirtable: ${records.length} Challenge(s) mit Status „Accepted".`);
  if (!records.length) {
    console.log('Nichts zu posten. (Freigabe passiert in Airtable, nicht hier.)');
    return 0;
  }

  const index = await indexThreads(forum);
  const missingTags = new Set();
  let failed = 0;

  for (const rec of records) {
    if (!titleOf(rec)) {
      console.error(`❌ ${rec.id}: kein Titel in Airtable — übersprungen.`);
      failed++;
      continue;
    }
    const title = threadTitle(rec);
    const content = body(rec, FULL);
    const existing = index.get(rec.id);

    try {
      if (existing) {
        const sameText = existing.starter?.content === content;
        const sameName = existing.thread.name === title;
        if (sameText && sameName) {
          console.log(`✓ ${title}: unverändert`);
          continue;
        }
        if (DRY_RUN) {
          console.log(`[dry-run] ${title}: würde AKTUALISIEREN${FULL ? ' (Vollfassung)' : ''}`);
          continue;
        }
        if (!sameName) await existing.thread.setName(title);
        if (!sameText) await existing.starter?.edit(content);
        console.log(`↻ ${title}: aktualisiert${FULL ? ' (Vollfassung)' : ''}`);
        continue;
      }

      const { ids, missing } = tagIdsFor(forum, rec.f.Category);
      missing.forEach((m) => missingTags.add(m));
      if (DRY_RUN) {
        console.log(`[dry-run] ${title}: würde NEU ANLEGEN (${content.length} Z.)`);
        continue;
      }
      const thread = await forum.threads.create({
        name: title,
        message: { content },
        appliedTags: ids,
      });
      const starter = await starterOf(thread);
      await starter?.react(CLAIM);
      console.log(`✚ ${title}: angelegt`);
    } catch (err) {
      console.error(`❌ ${title}: ${err?.message || err}`);
      failed++;
    }
  }

  if (missingTags.size) {
    console.log(`\nℹ️  Forum-Tags fehlen, Posts wurden ohne angelegt: ${[...missingTags].join(', ')}`);
  }
  const overwrite = forum.permissionOverwrites.cache.get(guild.roles.everyone.id);
  const visible = overwrite?.deny.has(PermissionsBitField.Flags.ViewChannel) !== true;
  console.log(visible
    ? `\n⚠️  #${FORUM} ist für @everyone SICHTBAR — vor dem Vorbereiten besser: node challenges.mjs --hide`
    : `\n🔒 #${FORUM} ist versteckt. Freischalten am Samstagmorgen: node challenges.mjs --reveal`);
  return failed;
}

// ---------------------------------------------------------------------------
// MODUS: --reveal / --hide
// ---------------------------------------------------------------------------

async function runVisibility(guild, reveal) {
  const forum = forumOf(guild);
  const threads = await allThreads(forum);
  const what = reveal ? 'SICHTBAR' : 'VERSTECKT';

  if (DRY_RUN) {
    console.log(`[dry-run] #${FORUM} würde für @everyone ${what} (${threads.length} Thread(s)).`);
    return 0;
  }
  await forum.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: reveal });
  console.log(`${reveal ? '🔓' : '🔒'} #${FORUM} ist jetzt ${what} — ${threads.length} Challenge(s).`);
  if (reveal) console.log('   Ansage in #ankuendigungen nicht vergessen.');
  return 0;
}

// ---------------------------------------------------------------------------
// MODUS: --report
// ---------------------------------------------------------------------------

/**
 * Alle Personen hinter einer Reaktion. Discord liefert höchstens 100 pro Abruf,
 * deshalb blättern statt still abzuschneiden.
 */
async function claimUsers(reaction) {
  const users = [];
  let after;
  for (;;) {
    const page = await reaction.users
      .fetch({ limit: 100, ...(after ? { after } : {}) })
      .catch(() => null);
    if (!page?.size) break;
    users.push(...page.values());
    if (page.size < 100) break;
    after = page.lastKey();
  }
  return users;
}

/** Team-Namen einer Person; Skill-Tags bleiben außen vor. */
async function teamsOfUser(guild, userId, cache) {
  if (cache.has(userId)) return cache.get(userId);
  const member = await guild.members.fetch(userId).catch(() => null);
  const names = member
    ? member.roles.cache.filter((r) => r.name.startsWith(TEAM_ROLE_PREFIX)).map(teamName)
    : [];
  cache.set(userId, names);
  return names;
}

async function runReport(guild) {
  const forum = forumOf(guild);
  const threads = await allThreads(forum);
  const cache = new Map();
  const rows = [];

  for (const thread of threads) {
    const starter = await starterOf(thread);
    const reaction = starter?.reactions.cache.find((r) => r.emoji.name === CLAIM);
    const users = reaction ? await claimUsers(reaction) : [];

    const teams = new Set();
    const solo = [];
    for (const user of users) {
      if (user.bot) continue;
      const names = await teamsOfUser(guild, user.id, cache);
      if (names.length) names.forEach((n) => teams.add(n));
      else solo.push(user.username);
    }
    rows.push({
      title: thread.name,
      company: thread.name.startsWith('🏢'),
      url: `https://discord.com/channels/${guild.id}/${thread.id}`,
      teams: [...teams].sort(),
      solo,
    });
  }

  rows.sort((a, b) => Number(b.company) - Number(a.company) || a.title.localeCompare(b.title));

  const lines = ['**Challenge → Teams**', ''];
  for (const r of rows) {
    const mark = r.teams.length ? '' : r.company ? ' ⚠️ **noch kein Team**' : ' (noch kein Team)';
    lines.push(`- ${r.title}: ${r.teams.length ? r.teams.join(', ') : '—'}${mark}`);
    if (r.solo.length) lines.push(`  - ohne Team-Rolle: ${r.solo.join(', ')}`);
  }

  const orphans = rows.filter((r) => r.company && !r.teams.length);
  if (orphans.length) {
    lines.push('', `⚠️ ${orphans.length} Sponsor-Challenge(s) ohne Team — bitte am Challenge-Markt ansprechen.`);
  }

  const report = lines.join('\n');
  console.log(`\n${report}\n`);

  if (POST_SUMMARY) {
    const ch = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildText && c.name === SUMMARY_CHANNEL,
    );
    if (!ch) {
      console.error(`❌ #${SUMMARY_CHANNEL} nicht gefunden — Übersicht nicht gepostet.`);
      return 1;
    }
    if (DRY_RUN) console.log(`[dry-run] würde die Übersicht nach #${SUMMARY_CHANNEL} posten.`);
    else {
      await ch.send(report.slice(0, DISCORD_LIMIT));
      console.log(`✚ Übersicht nach #${SUMMARY_CHANNEL} gepostet.`);
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// MODUS: --preview (ohne Discord — zur Textabnahme)
// ---------------------------------------------------------------------------

async function runPreview() {
  const records = await fetchAccepted();
  console.log(`\nAirtable: ${records.length} Challenge(s)`
    + `${ANY_STATUS ? ' (alle Status, --any-status)' : ' mit Status „Accepted"'}.`);
  if (!records.length) {
    console.log('Nichts zu zeigen. Zum Gegenlesen von Entwürfen: --preview --any-status');
    return 0;
  }
  for (const rec of records) {
    const content = body(rec, FULL);
    console.log(`\n${'─'.repeat(72)}\n${threadTitle(rec)}`
      + `${ANY_STATUS ? `   [Status: ${rec.f.Status ?? '—'}]` : ''}\n${'─'.repeat(72)}`);
    console.log(content);
    console.log(`\n(${content.length}/${DISCORD_LIMIT} Zeichen`
      + `${rec.f.Category?.length ? `, Tags: ${rec.f.Category.join(', ')}` : ''})`);
  }
  console.log(`\n${FULL ? 'Vollfassung' : 'Teaser-Fassung'} — die andere zeigt `
    + `${FULL ? '--preview' : '--preview --full'}.`);
  return 0;
}

// ---------------------------------------------------------------------------

if (MODE === 'preview') {
  try {
    process.exit(await runPreview());
  } catch (err) {
    console.error('❌ Fehler:', err?.message || err);
    process.exit(1);
  }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async () => {
  let failed = 0;
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.channels.fetch();
    await guild.roles.fetch();

    if (MODE === 'post') failed = await runPost(guild);
    else if (MODE === 'reveal') failed = await runVisibility(guild, true);
    else if (MODE === 'hide') failed = await runVisibility(guild, false);
    else if (MODE === 'report') failed = await runReport(guild);
  } catch (err) {
    console.error('❌ Fehler:', err?.message || err);
    failed++;
  } finally {
    await client.destroy();
    process.exit(failed ? 1 : 0);
  }
});

client.login(DISCORD_TOKEN).catch((err) => {
  console.error('❌ Login fehlgeschlagen:', err?.message || err);
  process.exit(1);
});
