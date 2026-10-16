#!/usr/bin/env node
/**
 * AI for Access — Scheduled Events
 * --------------------------------
 * Legt die Fr/Sa-Timeline als Discord "Scheduled Events" an (mit Ort = Stadtkloster Frieden).
 * Jeder Eintrag erzeugt Reminder für alle, die auf "Interessiert" klicken.
 *
 *   node events.mjs --dry-run   # zeigt nur, was es täte
 *   node events.mjs             # legt an (idempotent: gleicher Name wird übersprungen)
 *
 * Hinweis: Discord-EXTERNAL-Events brauchen Start UND Ende und müssen in der Zukunft liegen.
 * Zeiten in Europe/Zurich (November = CET, UTC+1).
 */

import 'dotenv/config';
import {
  Client, GatewayIntentBits, Events,
  GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel,
} from 'discord.js';

const DRY = process.argv.includes('--dry-run');
const { DISCORD_TOKEN, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !GUILD_ID) {
  console.error('❌ DISCORD_TOKEN und GUILD_ID müssen in .env gesetzt sein.');
  process.exit(1);
}

const LOCATION = 'Stadtkloster Frieden, Friedensstrasse 9, 3007 Bern';
const TZ = '+01:00'; // CET

// --demo: Event-Termine für den Spike auf das kommende Wochenende schieben
// (echtes Event: 20.–21.11.2026). Zurück auf echt: einfach ohne --demo laufen lassen.
const DEMO = process.argv.includes('--demo');
const DEMO_MAP = { '2026-11-20': '2026-07-31', '2026-11-21': '2026-08-01' };
const remap = (s) => { if (!DEMO) return s; const [d, t] = s.split('T'); return `${DEMO_MAP[d] || d}T${t}`; };

// name, start, end (Europe/Zurich). Ende = nächster Slot bzw. +Puffer.
const SCHEDULE = [
  // Freitag 20.11.2026 — Warm-up
  ['🚪 Fri · Doors Open & Networking',      '2026-11-20T18:00:00', '2026-11-20T18:30:00',
    '📍 Stadtkloster Frieden, Bern. Arrive, grab your name tag, first food & getting to know each other. New here? Say hi in #vorstellung, and a 🧭 Discord guide will help you get started.'],
  ['🎤 Fri · Opening & Keynote',             '2026-11-20T18:30:00', '2026-11-20T19:15:00',
    'On the 🎙️ stage: 10 years of Powercoders, the idea behind "AI for Access" (you don\'t need to code!) and the company challenges. Afterwards you know what it\'s all about.'],
  ['💡 Fri · Idea Pitches & Team Building',  '2026-11-20T19:15:00', '2026-11-20T20:30:00',
    '60-second pitches, then the marketplace: teams form. Browse #challenges & #ideen-marktplatz, post in #team-suche, and create your room with /team create. Goal: 3 to 5 people, mixed skills.'],
  ['✏️ Fri · Concept Phase',                  '2026-11-20T20:30:00', '2026-11-20T21:00:00',
    'Sharpen your idea: ONE problem, ONE target group, ONE prototype goal for tomorrow. First sketches in your team channel. Less is more, the day is short.'],
  // Samstag 21.11.2026 — Hack Day
  ['☕ Sat · Doors Open & Coffee',            '2026-11-21T09:00:00', '2026-11-21T09:30:00',
    'Coffee, setup, laptops open. Tool credits & codes are in #tools-und-credits.'],
  ['🚀 Sat · Hack Start (10h countdown)',     '2026-11-21T09:30:00', '2026-11-21T12:30:00',
    'The 10-hour countdown is on! Build with AI tools (Claude, Cursor, v0, Lovable …). Stuck? Go to #mentor-anfragen. Optional crash course in #crashkurs-videos.'],
  ['🍽️ Sat · Lunch',                          '2026-11-21T12:30:00', '2026-11-21T13:30:00',
    'Food on site (info in #verpflegung-logistik). You can keep working, but treat yourself to the break.'],
  ['🧘 Sat · Yoga & Break (14:00)',           '2026-11-21T14:00:00', '2026-11-21T14:45:00',
    'Short yoga session to breathe and clear your head. Optional, but it helps.'],
  ['🧑‍🏫 Sat · Mentor Check-in',               '2026-11-21T15:00:00', '2026-11-21T16:00:00',
    'Mentors go from team to team: status check, scope check, deploy help. Collect your requests in #mentor-anfragen.'],
  ['🧘 Sat · Yoga & Break (17:00)',           '2026-11-21T17:00:00', '2026-11-21T17:45:00',
    'Second yoga round before the final sprint. Recharge for code freeze & pitches.'],
  ['🔒 Sat · Code Freeze & Submission',       '2026-11-21T18:30:00', '2026-11-21T19:00:00',
    'Tools down! Submit your project in #projekte: 1 post with team, repo/demo link, 2-sentence description and **pitch video ≤2 min as an external link** (YouTube unlisted / Drive, don\'t upload directly!).'],
  ['🏆 Sat · Pitch Speedrun → Top 10 Live',   '2026-11-21T19:00:00', '2026-11-21T20:30:00',
    'Digital speedrun: the jury watches all pitch videos in #projekte, the audience votes in #voting, then the top 10 pitch live on the 🎙️ stage (3 min + 2 min Q&A).'],
  ['🎉 Sat · Awards & Apéro',                 '2026-11-21T20:30:00', '2026-11-21T21:30:00',
    'Award ceremony: main prize, "Best Newcomer Impact", company prizes & audience award (prize pool up to CHF 8\'000). Then apéro, networking, celebrating: you built something real in 10h. 👏'],
];

const iso = (s) => new Date(`${remap(s)}${TZ}`);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const full = await guild.fetch();
    console.log(`\n📅 Events für: ${full.name}  (${DRY ? 'DRY-RUN' : 'LIVE'})`);

    const existing = await full.scheduledEvents.fetch();

    // Zuordnung per Name, sonst per Startzeit: so wird ein umbenanntes Event (z.B. DE → EN)
    // editiert statt neu angelegt, und die "Interessiert"-Klicks bleiben erhalten.
    const matched = new Map();
    const used = new Set();
    for (const pass of [(ev, [n]) => ev.name === n, (ev, [, s]) => ev.scheduledStartTimestamp === iso(s).getTime()]) {
      for (const entry of SCHEDULE) {
        if (matched.has(entry[0])) continue;
        const ev = existing.find((e) => !used.has(e.id) && pass(e, entry));
        if (ev) { matched.set(entry[0], ev); used.add(ev.id); }
      }
    }

    // Orphans entfernen (z.B. alte Yoga-Dubletten oder gestrichene Events)
    for (const [, ev] of existing) {
      if (!used.has(ev.id)) {
        console.log(`│ - Orphan löschen: ${ev.name}`);
        if (!DRY) await ev.delete().catch(() => {});
      }
    }

    for (const [name, start, end, description] of SCHEDULE) {
      const startAt = iso(start);
      const endAt = iso(end);
      const ev = matched.get(name);
      if (ev) {
        const timeChanged = ev.scheduledStartTimestamp !== startAt.getTime() || ev.scheduledEndTimestamp !== endAt.getTime();
        const descChanged = ev.description !== description;
        const nameChanged = ev.name !== name;
        if (!timeChanged && !descChanged && !nameChanged) { console.log(`│ ✓ aktuell: ${name}`); continue; }
        console.log(`│ ~ aktualisieren: ${name}${nameChanged ? ` (Name, war: ${ev.name})` : ''}`
          + `${timeChanged ? ' (Zeit)' : ''}${descChanged ? ' (Text)' : ''}`);
        if (!DRY) await ev.edit({ name, description, scheduledStartTime: startAt, scheduledEndTime: endAt });
        continue;
      }
      if (startAt.getTime() < Date.now()) {
        console.log(`│ ⏭️  übersprungen (liegt in der Vergangenheit): ${name}`);
        continue;
      }
      console.log(`│ + anlegen: ${name}  (${remap(start)} → ${remap(end)})`);
      if (!DRY) {
        await full.scheduledEvents.create({
          name,
          scheduledStartTime: startAt,
          scheduledEndTime: endAt,
          privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
          entityType: GuildScheduledEventEntityType.External,
          entityMetadata: { location: LOCATION },
          description,
        });
      }
    }
    console.log(`\n✅ ${DRY ? 'Dry-Run fertig.' : 'Events angelegt.'}`);
  } catch (err) {
    console.error('\n❌ Fehler:', err?.message || err);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(DISCORD_TOKEN);
