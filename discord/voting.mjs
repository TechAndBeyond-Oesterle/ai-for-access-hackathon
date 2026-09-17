#!/usr/bin/env node
/**
 * AI for Access — Publikumspreis als native Discord-Umfrage
 * ---------------------------------------------------------
 * Die Optionen tippt am Samstagabend niemand von Hand ab: Jedes Team postet sein
 * Projekt als Thread in #projekte, dieses Skript macht daraus die Umfrage in #voting.
 *
 *   node voting.mjs --poll --dry-run    # zeigt die Optionen, postet nichts
 *   node voting.mjs --poll              # Umfrage in #voting (Default: 2 Stunden Laufzeit)
 *   node voting.mjs --poll --nominated  # nur die von der Jury mit 🏅 markierten Projekte
 *   node voting.mjs --poll --duration 1 --channel orga-intern   # Probelauf im Orga-Kanal
 *   node voting.mjs --result            # Zwischenstand oder Endergebnis als Markdown
 *   node voting.mjs --end               # Umfrage vorzeitig schließen
 *
 * Grenzen der nativen Umfrage (Discord, nicht wir):
 *   - höchstens 10 Optionen, also 10 Teams. Bei mehr braucht es vorher eine
 *     Speedrun-Auswahl, deshalb bricht das Skript ab statt stillschweigend zu kürzen.
 *   - eine Stimme pro Discord-Account, nicht pro Person im Raum.
 *   - Laufzeit in ganzen Stunden, Minimum 1.
 */

import 'dotenv/config';
import { Client, GatewayIntentBits, Events, ChannelType } from 'discord.js';

const { DISCORD_TOKEN, GUILD_ID } = process.env;
const has = (flag) => process.argv.includes(flag);
const argOf = (flag) => {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : null;
};

const DRY_RUN = has('--dry-run');
const MODE = ['--poll', '--result', '--end'].find(has)?.slice(2);
const DURATION = Number(argOf('--duration') ?? 2);
const NOMINATED = has('--nominated');
const TARGET = argOf('--channel') ?? 'voting';

const PROJECTS = 'projekte';
const QUESTION = '🏆 Audience award: which project won you over?';
const NOMINEE = '🏅'; // setzt die Jury beim Speedrun (18:45) auf den Startpost in #projekte
const MAX_ANSWERS = 10;
const ANSWER_LIMIT = 55;

if (!MODE) {
  console.error('❌ Modus fehlt: --poll [--nominated] [--duration <h>] [--channel <name>] '
    + '| --result | --end');
  process.exit(1);
}
if (!DISCORD_TOKEN || !GUILD_ID) {
  console.error('❌ DISCORD_TOKEN und GUILD_ID müssen in .env gesetzt sein.');
  process.exit(1);
}

const channelByName = (guild, name, type = ChannelType.GuildText) =>
  guild.channels.cache.find((c) => c.type === type && c.name.toLowerCase() === name.toLowerCase());

/**
 * Thread-Titel zu einer Antwort-Option. Führendes Emoji wandert ins emoji-Feld,
 * damit im Text mehr von den 55 erlaubten Zeichen für den Namen bleibt.
 */
function answerFrom(thread) {
  const m = thread.name.match(/^(\p{Extended_Pictographic}️?)\s*(.*)$/u);
  const emoji = m?.[1];
  let text = (m?.[2] ?? thread.name).trim() || thread.name;
  if (text.length > ANSWER_LIMIT) text = `${text.slice(0, ANSWER_LIMIT - 1).trimEnd()}…`;
  return emoji ? { text, emoji } : { text };
}

async function runPoll(guild) {
  const forum = channelByName(guild, PROJECTS, ChannelType.GuildForum);
  if (!forum) throw new Error(`Forum #${PROJECTS} nicht gefunden.`);
  const target = channelByName(guild, TARGET);
  if (!target) throw new Error(`Kanal #${TARGET} nicht gefunden.`);

  const active = await forum.threads.fetchActive().catch(() => null);
  const archived = await forum.threads.fetchArchived({ limit: 100 }).catch(() => null);
  const threads = [...(active?.threads.values() ?? []), ...(archived?.threads.values() ?? [])]
    .sort((a, b) => (a.createdTimestamp ?? 0) - (b.createdTimestamp ?? 0));

  if (!threads.length) throw new Error(`#${PROJECTS} ist leer — erst müssen die Teams ihre Projekte posten.`);

  // Speedrun 18:45: Die Jury markiert die nominierten Projekte mit 🏅 auf dem Startpost.
  // Dieselbe Mechanik wie das ✋ bei den Challenges: ein Klick, kein Befehl, und der
  // Zustand überlebt einen Bot-Neustart.
  let selected = threads;
  if (NOMINATED) {
    selected = [];
    for (const thread of threads) {
      const starter = await thread.fetchStarterMessage().catch(() => null);
      if (starter?.reactions.cache.some((r) => r.emoji.name === NOMINEE)) selected.push(thread);
    }
    if (!selected.length) {
      throw new Error(`Kein Projekt mit ${NOMINEE} markiert. Die Jury markiert die Nominierten `
        + `im Startpost des Threads in #${PROJECTS}.`);
    }
    console.log(`\nNominiert (${NOMINEE}): ${selected.length} von ${threads.length} Projekten.`);
  }

  if (selected.length > MAX_ANSWERS) {
    throw new Error(
      `${selected.length} Projekte, aber eine Discord-Umfrage fasst nur ${MAX_ANSWERS}. `
      + `Erst den Speedrun abschließen und mit --nominated erneut ausführen `
      + `(die Jury markiert die Top ${MAX_ANSWERS} mit ${NOMINEE}).`,
    );
  }

  const answers = selected.map(answerFrom);
  console.log(`\n#${PROJECTS}: ${selected.length} Projekt(e) → Umfrage in #${target.name}`
    + ` (${DURATION} h${DRY_RUN ? ', DRY-RUN' : ''})\n`);
  answers.forEach((a, i) => console.log(`  ${i + 1}. ${a.emoji ?? ' '} ${a.text}`));

  if (DRY_RUN) {
    console.log('\n[dry-run] Es wurde nichts gepostet.');
    return 0;
  }
  const msg = await target.send({
    poll: { question: { text: QUESTION }, answers, allowMultiselect: false, duration: DURATION },
  });
  console.log(`\n✚ Umfrage läuft: ${msg.url}`);
  console.log('   Ergebnis später: node voting.mjs --result');
  return 0;
}

/** Jüngste Umfrage des Bots im Zielkanal. */
async function findPoll(guild, botId) {
  const target = channelByName(guild, TARGET);
  if (!target) throw new Error(`Kanal #${TARGET} nicht gefunden.`);
  const recent = await target.messages.fetch({ limit: 50 });
  const msg = recent.find((m) => m.author.id === botId && m.poll);
  if (!msg) throw new Error(`Keine Umfrage von uns in #${TARGET} gefunden.`);
  return msg;
}

async function runResult(guild, botId) {
  const msg = await findPoll(guild, botId);
  const poll = msg.poll;
  const rows = [...poll.answers.values()]
    .map((a) => ({ text: a.text ?? '(ohne Text)', votes: a.voteCount }))
    .sort((a, b) => b.votes - a.votes);
  const total = rows.reduce((sum, r) => sum + r.votes, 0);
  const top = rows[0]?.votes ?? 0;
  const tie = rows.filter((r) => r.votes === top && top > 0).length > 1;

  console.log(`\n**Publikumspreis** (${poll.resultsFinalized ? 'Endergebnis' : 'Zwischenstand, läuft noch'})\n`);
  for (const r of rows) {
    const share = total ? Math.round((r.votes / total) * 100) : 0;
    const bar = '█'.repeat(Math.round(share / 5)).padEnd(20, '·');
    const crown = r.votes === top && top > 0 ? ' 👑' : '';
    console.log(`  ${bar} ${String(r.votes).padStart(3)} (${String(share).padStart(3)} %)  ${r.text}${crown}`);
  }
  console.log(`\n  Stimmen gesamt: ${total}`);
  if (tie) console.log('  ⚠️  Gleichstand an der Spitze — Stichentscheid nötig.');
  if (!poll.resultsFinalized) console.log(`  Umfrage läuft noch: ${msg.url}`);
  return 0;
}

async function runEnd(guild, botId) {
  const msg = await findPoll(guild, botId);
  if (msg.poll.resultsFinalized) {
    console.log('✓ Umfrage ist bereits beendet.');
    return 0;
  }
  if (DRY_RUN) {
    console.log(`[dry-run] würde die Umfrage schließen: ${msg.url}`);
    return 0;
  }
  await msg.poll.end();
  console.log(`🔒 Umfrage geschlossen: ${msg.url}`);
  console.log('   Ergebnis: node voting.mjs --result');
  return 0;
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async () => {
  let failed = 0;
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.channels.fetch();
    if (MODE === 'poll') failed = await runPoll(guild);
    else if (MODE === 'result') failed = await runResult(guild, client.user.id);
    else if (MODE === 'end') failed = await runEnd(guild, client.user.id);
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
