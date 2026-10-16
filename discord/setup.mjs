#!/usr/bin/env node
/**
 * AI for Access — Discord Server Setup
 * ------------------------------------
 * Legt die komplette Server-Struktur (Rollen, Kategorien, Channels, Rechte)
 * idempotent an. Basiert auf dem Spike-Blueprint (docs/2026-07-28_discord-spike.html).
 *
 * Nutzung:
 *   1) Leeren Discord-Server erstellen, Bot im Developer-Portal anlegen
 *   2) Bot einladen (Scopes: bot + applications.commands, Permission: Administrator)
 *   3) discord/setup/.env füllen (DISCORD_TOKEN, GUILD_ID)  -> siehe .env.example
 *   4) node setup.mjs --dry-run     # zeigt nur, was es täte
 *      node setup.mjs               # legt an / gleicht ab (idempotent)
 *
 * Idempotent: existierende Rollen/Kategorien/Channels (per Name) werden
 * wiederverwendet, nur Fehlendes wird erstellt und Rechte werden nachgezogen.
 */

import 'dotenv/config';
import {
  Client, GatewayIntentBits, ChannelType, PermissionsBitField, Events,
} from 'discord.js';

const DRY = process.argv.includes('--dry-run');
const { DISCORD_TOKEN, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !GUILD_ID) {
  console.error('❌ DISCORD_TOKEN und GUILD_ID müssen in discord/setup/.env gesetzt sein.');
  console.error('   Vorlage: discord/setup/.env.example');
  process.exit(1);
}

const F = PermissionsBitField.Flags;
const TYPE = {
  text: ChannelType.GuildText,
  voice: ChannelType.GuildVoice,
  announcement: ChannelType.GuildAnnouncement,
  stage: ChannelType.GuildStageVoice,
  forum: ChannelType.GuildForum,
};

// ---------------------------------------------------------------------------
// ROLLEN  (Reihenfolge = Hierarchie, oben = höher)
// ---------------------------------------------------------------------------
const ROLES = [
  { key: 'orga',        name: 'Orga',              color: 0xF85149, admin: true, hoist: true },
  { key: 'jury',        name: 'Jury',              color: 0xD29922, hoist: true },
  { key: 'mentor',      name: 'Mentor:in',         color: 0x22D3EE, hoist: true },
  { key: 'challenge',   name: 'Challenge-Owner',   color: 0x7C5CFF, hoist: true },
  { key: 'media',       name: 'Media / Doku',      color: 0xEC4899, hoist: true },
  { key: 'participant', name: 'Teilnehmer:in',     color: 0x2EA043, hoist: true },
  // Skill-Tags (Selbstvergabe via #choose-your-role) — nur Matching, keine Rechte
  { key: 't_dev',       name: 'Dev',               color: 0x58A6FF },
  { key: 't_design',    name: 'Design',            color: 0xBC8CFF },
  { key: 't_domain',    name: 'Domain-Expert',     color: 0x3FB950 },
  { key: 't_newcomer',  name: 'Newcomer',          color: 0xF778BA },
  { key: 't_pm',        name: 'PM / Business',      color: 0xE3B341 },
];

// ---------------------------------------------------------------------------
// STRUKTUR
//   readonly:true      -> @everyone darf lesen, aber nicht posten (Info-Broadcast)
//   post:[roleKeys]    -> zusätzlich dürfen diese Rollen posten (z.B. Challenge-Owner)
//   private:[roleKeys] -> nur diese Rollen (+ Orga via Admin) sehen die Kategorie/Channel
// ---------------------------------------------------------------------------
const CATEGORIES = [
  { name: '📢 START HERE', readonly: true, channels: [
    { name: 'welcome',        type: 'text', topic: 'Welcome to the AI for Access Hackathon! Start here: read the rules, pick your role, introduce yourself.' },
    { name: 'code-of-conduct',   type: 'text', topic: 'Code of Conduct: short & binding.' },
    { name: 'choose-your-role',    type: 'text', topic: 'Pick your skill tags: Dev / Design / Domain Expert / Newcomer / PM.' },
    { name: 'announcements',    type: 'announcement', topic: 'Official announcements from the organizers.' }, // braucht Community-Modus
    { name: 'schedule',          type: 'text', topic: 'Programme Fri 20 Nov (warm-up) + Sat 21 Nov (10h hack). Details also as Discord events.' },
    { name: 'faq',               type: 'text', topic: 'Frequently asked questions. English is our common language.' },
    { name: 'tools-and-credits', type: 'text', topic: 'AI tools, API credits, licences from our tool partners.' },
    { name: 'crash-course-videos',  type: 'text', topic: 'Opening talk + 30-min tool crash course as video (hosted externally, linked here).' },
  ]},

  { name: '🤝 TEAM FINDING', channels: [
    // Bewusst ohne Forum-Tags (17.09.): bei einer einstelligen Zahl an Challenges ist eine
    // Filterleiste mehr Bedienoberflaeche als Nutzen. challenges.mjs setzt Tags, falls doch welche da sind.
    { name: 'challenges',       type: 'forum', readonly: true, post: ['challenge'], topic: '1 post per company challenge: problem, target group, resources, owner.' },
    { name: 'idea-marketplace', type: 'forum', topic: '1 post = 1 idea. The thread becomes your future team chat.' },
    { name: 'team-search',       type: 'text',  topic: 'Looking for / offering skills: "Looking for a designer" / "Offering legal domain knowledge".' },
  ]},

  { name: '💬 GENERAL', channels: [
    { name: 'introductions',         type: 'text' },
    { name: 'small-talk',           type: 'text' },
    { name: 'help-and-support',   type: 'text' },
    { name: 'food-and-logistics', type: 'text' },
    { name: 'Lounge',       type: 'voice' },
    { name: 'Networking-1',  type: 'voice' },
    { name: 'Networking-2',  type: 'voice' },
  ]},

  // Teams werden per Bot-Command /team create angelegt — hier nur die leere Kategorie
  { name: '🛠️ TEAMS', channels: [] },

  { name: '🧑‍🏫 MENTORING', channels: [
    { name: 'mentor-requests', type: 'forum', topic: 'Post your mentoring request here (1 post per request). Mentors pick up threads.' },
    { name: 'Mentoring-1', type: 'voice' },
    { name: 'Mentoring-2', type: 'voice' },
    { name: 'Mentoring-3', type: 'voice' },
  ]},

  { name: '🎤 STAGE & PITCHES', channels: [
    { name: 'Stage',        type: 'stage' }, // braucht Community-Modus (kein Topic: Stage/Voice-Topics werden streng gefiltert)
    { name: 'projects',     type: 'forum', topic: '1 post per team = project: team, repo/demo, pitch video (≤2 min, as an EXTERNAL link!), 2-sentence description. Read-only after code freeze.' },
    { name: 'pitch-questions', type: 'text',  topic: 'Questions for the team that is pitching.' },
    { name: 'voting',       type: 'text',  topic: 'Native polls: speedrun top 10 selection & audience award.' },
  ]},

  { name: '📸 DOCS & PRESS', private: ['media'], channels: [
    { name: 'docs-and-press', type: 'text', topic: 'Photo/video collection (Samir), social media approvals. Respect consent for images/audio.' },
  ]},

  { name: '🏆 JURY', private: ['jury'], channels: [
    { name: 'jury-internal', type: 'text' },
    { name: 'scoring',   type: 'text', topic: 'Scoring sheet (4 criteria: Impact/AI/Prototype/Pitch), link here.' },
  ]},

  { name: '🏢 SPONSORS', private: ['challenge'], channels: [
    { name: 'sponsor-coordination', type: 'text' },
  ]},

  { name: '🔧 ORGA', private: [], channels: [ // private:[] = nur Orga (Admin)
    { name: 'organizers-internal', type: 'text' },
    { name: 'logistics',    type: 'text' },
    { name: 'emergency',     type: 'text' },
    { name: 'bot-logs',    type: 'text' },
  ]},
];

// ---------------------------------------------------------------------------
const log  = (...a) => console.log(...a);
const step = (...a) => console.log(`${DRY ? '│ [dry]' : '│'}`, ...a);


function overwrites(guild, roleMap, spec) {
  const everyone = guild.roles.everyone.id;
  const ow = [];
  if (spec.private) {
    // Kategorie/Channel unsichtbar für @everyone, sichtbar für gelistete Rollen
    ow.push({ id: everyone, deny: [F.ViewChannel] });
    for (const key of spec.private) {
      const r = roleMap.get(key);
      if (r) ow.push({ id: r.id, allow: [F.ViewChannel, F.SendMessages, F.Connect, F.Speak] });
    }
  }
  if (spec.readonly) {
    ow.push({ id: everyone, deny: [F.SendMessages, F.SendMessagesInThreads, F.CreatePublicThreads, F.CreatePrivateThreads, F.AddReactions] });
    for (const key of (spec.post || [])) {
      const r = roleMap.get(key);
      if (r) ow.push({ id: r.id, allow: [F.SendMessages, F.SendMessagesInThreads, F.CreatePublicThreads] });
    }
  }
  return ow;
}

async function ensureRoles(guild) {
  log('\n▸ Rollen');
  const existing = await guild.roles.fetch();
  const map = new Map();
  for (const spec of ROLES) {
    let role = existing.find((r) => r.name === spec.name);
    if (role) { step(`✓ Rolle vorhanden: ${spec.name}`); }
    else {
      step(`+ Rolle anlegen: ${spec.name}`);
      if (!DRY) role = await guild.roles.create({
        name: spec.name, color: spec.color, hoist: !!spec.hoist,
        permissions: spec.admin ? [F.Administrator] : [],
        reason: 'AI for Access setup',
      });
    }
    if (role) map.set(spec.key, role);
  }
  return map;
}

// Alte deutsche Namen -> aktuelle. Beim erneuten Lauf wird umbenannt statt neu angelegt.
const LEGACY_NAMES = {
  'willkommen': 'welcome', 'verhaltenskodex': 'code-of-conduct', 'rollen-waehlen': 'choose-your-role',
  'ankuendigungen': 'announcements', 'zeitplan': 'schedule', 'tools-und-credits': 'tools-and-credits',
  'crashkurs-videos': 'crash-course-videos', 'ideen-marktplatz': 'idea-marketplace', 'team-suche': 'team-search',
  'vorstellung': 'introductions', 'smalltalk': 'small-talk', 'hilfe-und-support': 'help-and-support',
  'verpflegung-logistik': 'food-and-logistics', 'mentor-anfragen': 'mentor-requests', 'Bühne': 'Stage',
  'projekte': 'projects', 'pitch-fragen': 'pitch-questions', 'doku-und-presse': 'docs-and-press',
  'jury-intern': 'jury-internal', 'bewertung': 'scoring', 'sponsoren-koordination': 'sponsor-coordination',
  'orga-intern': 'organizers-internal', 'logistik': 'logistics', 'notfall': 'emergency',
  '📢 START-HIER': '📢 START HERE', '🤝 TEAMFINDUNG': '🤝 TEAM FINDING', '💬 ALLGEMEIN': '💬 GENERAL',
  '🎤 BÜHNE & PITCHES': '🎤 STAGE & PITCHES', '📸 DOKU & PRESSE': '📸 DOCS & PRESS', '🏢 SPONSOREN': '🏢 SPONSORS',
};
const legacyOf = (name) => Object.keys(LEGACY_NAMES).find((k) => LEGACY_NAMES[k] === name);

async function ensureStructure(guild, roleMap) {
  const channels = await guild.channels.fetch();
  const findByName = (name, type, parentId = null) =>
    channels.find((c) => c && c.name === name && c.type === type
      && (parentId === null || c.parentId === parentId));

  for (const cat of CATEGORIES) {
    log(`\n▸ ${cat.name}`);
    let category = findByName(cat.name, ChannelType.GuildCategory);
    const oldCat = !category && legacyOf(cat.name) && findByName(legacyOf(cat.name), ChannelType.GuildCategory);
    if (oldCat) {
      step(`~ Kategorie umbenennen: ${oldCat.name} -> ${cat.name}`);
      if (!DRY) await oldCat.setName(cat.name);
      category = oldCat;
    }
    const catOw = overwrites(guild, roleMap, cat);
    if (category) {
      step(`✓ Kategorie vorhanden: ${cat.name}`);
      if (!DRY && catOw.length) await category.permissionOverwrites.set(catOw);
    } else {
      step(`+ Kategorie anlegen: ${cat.name}`);
      if (!DRY) category = await guild.channels.create({
        name: cat.name, type: ChannelType.GuildCategory,
        permissionOverwrites: catOw, reason: 'AI for Access setup',
      });
    }

    for (const ch of cat.channels) {
      const type = TYPE[ch.type];
      const parentId = category ? category.id : null;
      let existing = findByName(ch.name, type, parentId)
        || findByName(ch.name, type); // evtl. noch ohne Parent
      const old = !existing && legacyOf(ch.name) && findByName(legacyOf(ch.name), type);
      if (old) {
        step(`  ~ umbenennen: #${old.name} -> #${ch.name}`);
        if (!DRY) await old.setName(ch.name);
        existing = old;
      }
      // Channel erbt Sichtbarkeit der Kategorie; readonly/post nur auf Channel-Ebene nötig
      const chOw = overwrites(guild, roleMap, { readonly: ch.readonly, post: ch.post });
      if (existing) {
        step(`  ✓ ${ch.type.padEnd(12)} #${ch.name}`);
        if (!DRY && chOw.length) await existing.permissionOverwrites.set(chOw);
        if (ch.topic && existing.topic !== ch.topic) {
          step(`    ~ Topic aktualisieren`);
          if (!DRY) await existing.setTopic(ch.topic);
        }
      } else {
        step(`  + ${ch.type.padEnd(12)} #${ch.name}`);
        if (!DRY) await guild.channels.create({
          name: ch.name, type, parent: parentId, topic: ch.topic,
          permissionOverwrites: chOw.length ? chOw : undefined,
          reason: 'AI for Access setup',
        });
      }
    }
  }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const full = await guild.fetch();
    log(`\n🏛️  Server: ${full.name}  (${DRY ? 'DRY-RUN — es wird NICHTS geändert' : 'LIVE — legt an / gleicht ab'})`);
    const roleMap = await ensureRoles(full);
    await ensureStructure(full, roleMap);
    log(`\n✅ ${DRY ? 'Dry-Run fertig. Ohne --dry-run erneut ausführen zum Anlegen.' : 'Setup abgeschlossen.'}`);
  } catch (err) {
    console.error('\n❌ Fehler:', err?.message || err);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(DISCORD_TOKEN);
