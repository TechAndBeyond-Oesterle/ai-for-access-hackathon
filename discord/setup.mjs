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
  // Skill-Tags (Selbstvergabe via #rollen-waehlen) — nur Matching, keine Rechte
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
  { name: '📢 START-HIER', readonly: true, channels: [
    { name: 'willkommen',        type: 'text', topic: 'Willkommen beim AI for Access Hackathon! Start hier: Regeln lesen, Rolle wählen, vorstellen.' },
    { name: 'verhaltenskodex',   type: 'text', topic: 'Code of Conduct — kurz & verbindlich.' },
    { name: 'rollen-waehlen',    type: 'text', topic: 'Wähle deine Skill-Tags: Dev / Design / Domain-Expert / Newcomer / PM.' },
    { name: 'ankuendigungen',    type: 'announcement', topic: 'Offizielle Ansagen der Orga.' }, // braucht Community-Modus
    { name: 'zeitplan',          type: 'text', topic: 'Programm Fr 20.11. (Warm-up) + Sa 21.11. (10h Hack). Details auch als Discord-Events.' },
    { name: 'faq',               type: 'text', topic: 'Häufige Fragen. EN as common language.' },
    { name: 'tools-und-credits', type: 'text', topic: 'AI-Tools, API-Credits, Lizenzen der Tool-Partner.' },
    { name: 'crashkurs-videos',  type: 'text', topic: 'Eröffnungs-Talk + 30-Min Tool-Crashkurs als Video (extern gehostet, hier verlinkt).' },
  ]},

  { name: '🤝 TEAMFINDUNG', channels: [
    { name: 'challenges',       type: 'forum', readonly: true, post: ['challenge'], topic: '1 Post je Firmen-Challenge: Problem, Zielgruppe, Ressourcen, Owner.' },
    { name: 'ideen-marktplatz', type: 'forum', topic: '1 Post = 1 Idee. Der Thread wird euer Team-Chat-in-spe. Tags: Challenge / eigene Idee.' },
    { name: 'team-suche',       type: 'text',  topic: 'Suche/biete Skill: "Suche Designer" / "Biete Legal-Domain".' },
  ]},

  { name: '💬 ALLGEMEIN', channels: [
    { name: 'vorstellung',         type: 'text' },
    { name: 'smalltalk',           type: 'text' },
    { name: 'hilfe-und-support',   type: 'text' },
    { name: 'verpflegung-logistik', type: 'text' },
    { name: 'Lounge',       type: 'voice' },
    { name: 'Networking-1',  type: 'voice' },
    { name: 'Networking-2',  type: 'voice' },
  ]},

  // Teams werden per Bot-Command /team create angelegt — hier nur die leere Kategorie
  { name: '🛠️ TEAMS', channels: [] },

  { name: '🧑‍🏫 MENTORING', channels: [
    { name: 'mentor-anfragen', type: 'forum', topic: 'Stellt hier eure Mentoring-Anfrage (1 Post je Anliegen). Mentor:innen greifen sich Threads.' },
    { name: 'Mentoring-1', type: 'voice' },
    { name: 'Mentoring-2', type: 'voice' },
    { name: 'Mentoring-3', type: 'voice' },
  ]},

  { name: '🎤 BÜHNE & PITCHES', channels: [
    { name: 'Bühne',        type: 'stage' }, // braucht Community-Modus (kein Topic: Stage/Voice-Topics werden streng gefiltert)
    { name: 'projekte',     type: 'forum', topic: '1 Post je Team = Projekt: Team, Repo/Demo, Pitch-Video (≤2 min, als EXTERNER Link!), 2-Satz-Beschreibung. Ab Code-Freeze read-only.' },
    { name: 'pitch-fragen', type: 'text',  topic: 'Fragen ans pitchende Team.' },
    { name: 'voting',       type: 'text',  topic: 'Native Polls: Speedrun-Top-10-Auswahl & Publikumspreis.' },
  ]},

  { name: '📸 DOKU & PRESSE', private: ['media'], channels: [
    { name: 'doku-und-presse', type: 'text', topic: 'Fotos/Video-Sammlung (Samir), Social-Media-Freigaben. Einwilligung Bild/Ton beachten.' },
  ]},

  { name: '🏆 JURY', private: ['jury'], channels: [
    { name: 'jury-intern', type: 'text' },
    { name: 'bewertung',   type: 'text', topic: 'Scoring-Sheet (5 Kriterien: Impact/AI/Prototyp/Teamwork/Pitch) — Link hier.' },
  ]},

  { name: '🏢 SPONSOREN', private: ['challenge'], channels: [
    { name: 'sponsoren-koordination', type: 'text' },
  ]},

  { name: '🔧 ORGA', private: [], channels: [ // private:[] = nur Orga (Admin)
    { name: 'orga-intern', type: 'text' },
    { name: 'logistik',    type: 'text' },
    { name: 'notfall',     type: 'text' },
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

async function ensureStructure(guild, roleMap) {
  const channels = await guild.channels.fetch();
  const findByName = (name, type, parentId = null) =>
    channels.find((c) => c && c.name === name && c.type === type
      && (parentId === null || c.parentId === parentId));

  for (const cat of CATEGORIES) {
    log(`\n▸ ${cat.name}`);
    let category = findByName(cat.name, ChannelType.GuildCategory);
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
      const existing = findByName(ch.name, type, parentId)
        || findByName(ch.name, type); // evtl. noch ohne Parent
      // Channel erbt Sichtbarkeit der Kategorie; readonly/post nur auf Channel-Ebene nötig
      const chOw = overwrites(guild, roleMap, { readonly: ch.readonly, post: ch.post });
      if (existing) {
        step(`  ✓ ${ch.type.padEnd(12)} #${ch.name}`);
        if (!DRY && chOw.length) await existing.permissionOverwrites.set(chOw);
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
