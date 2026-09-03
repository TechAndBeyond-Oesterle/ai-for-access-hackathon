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
  ['🚪 Fr · Doors Open & Networking',       '2026-11-20T18:00:00', '2026-11-20T18:30:00',
    '📍 Stadtkloster Frieden, Bern. Ankommen, Namensschild schnappen, erstes Essen & Kennenlernen. Neu hier? Sag Hallo in #vorstellung — und ein 🧭 Discord-Lotse hilft dir beim Onboarding.'],
  ['🎤 Fr · Eröffnung & Keynote',            '2026-11-20T18:30:00', '2026-11-20T19:15:00',
    'Auf der 🎙️ Bühne: 10 Jahre Powercoders, die These „AI for Access" (du musst nicht coden können!) und die Vorstellung der Firmen-Challenges. Danach weißt du, worum es geht.'],
  ['💡 Fr · Ideen-Pitches & Teamfindung',    '2026-11-20T19:15:00', '2026-11-20T20:30:00',
    '60-Sekunden-Pitches, dann Marktplatz: Teams bilden sich. → Stöbere in #challenges & #ideen-marktplatz, poste in #team-suche, und legt euren Raum mit /team create an. Ziel: 3–5 Leute, gemischte Skills.'],
  ['✏️ Fr · Konzeptphase',                    '2026-11-20T20:30:00', '2026-11-20T21:00:00',
    'Idee schärfen: EIN Problem, EINE Zielgruppe, EIN Prototyp-Ziel für morgen. Erste Skizzen im Team-Channel. Weniger ist mehr — der Tag ist kurz.'],
  // Samstag 21.11.2026 — Hack Day
  ['☕ Sa · Doors Open & Kaffee',             '2026-11-21T09:00:00', '2026-11-21T09:30:00',
    'Kaffee, Setup, Laptops auf. Tool-Credits & Codes findet ihr in #tools-und-credits.'],
  ['🚀 Sa · Hack-Start (10h-Countdown)',      '2026-11-21T09:30:00', '2026-11-21T12:30:00',
    'Der 10-Stunden-Countdown läuft! Baut mit AI-Tools (Claude, Cursor, v0, Lovable …). Steckt ihr fest? → #mentor-anfragen. Optionaler Crash-Kurs in #crashkurs-videos.'],
  ['🍽️ Sa · Mittagessen',                     '2026-11-21T12:30:00', '2026-11-21T13:30:00',
    'Verpflegung vor Ort (Infos in #verpflegung-logistik). Weiterarbeiten erlaubt — aber gönnt euch die Pause.'],
  ['🧘 Sa · Yoga & Pause (14:00)',            '2026-11-21T14:00:00', '2026-11-21T14:45:00',
    'Kurze Yoga-Einheit zum Durchatmen und Kopf freikriegen. Kein Muss — aber tut gut.'],
  ['🧑‍🏫 Sa · Mentor-Check-in',                '2026-11-21T15:00:00', '2026-11-21T16:00:00',
    'Mentor:innen gehen von Team zu Team: Standortbestimmung, Scope-Check, Deploy-Hilfe. Anfragen bündeln in #mentor-anfragen.'],
  ['🧘 Sa · Yoga & Pause (17:00)',            '2026-11-21T17:00:00', '2026-11-21T17:45:00',
    'Zweite Yoga-Runde vor dem Endspurt. Nochmal Kraft tanken für Code Freeze & Pitches.'],
  ['🔒 Sa · Code Freeze & Einreichung',       '2026-11-21T18:30:00', '2026-11-21T19:00:00',
    'Tools runter! Reicht euer Projekt in #projekte ein: 1 Post mit Team, Repo/Demo-Link, 2-Satz-Beschreibung und **Pitch-Video ≤2 min als externer Link** (YouTube unlisted / Drive — nicht direkt hochladen!).'],
  ['🏆 Sa · Pitch-Speedrun → Top 10 Live',    '2026-11-21T19:00:00', '2026-11-21T20:30:00',
    'Digitaler Speedrun: Jury sichtet alle Pitch-Videos in #projekte, das Publikum votet in #voting → die Top 10 pitchen live auf der 🎙️ Bühne (3 min + 2 min Q&A). Spannung pur!'],
  ['🎉 Sa · Awards & Apéro',                  '2026-11-21T20:30:00', '2026-11-21T21:30:00',
    'Preisverleihung: Hauptpreis, „Best Newcomer Impact", Firmenpreise & Publikumspreis (Preispool bis CHF 8\'000). Danach Apéro, Networking, feiern — ihr habt in 10h etwas Echtes gebaut. 👏'],
];

const iso = (s) => new Date(`${remap(s)}${TZ}`);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const full = await guild.fetch();
    console.log(`\n📅 Events für: ${full.name}  (${DRY ? 'DRY-RUN' : 'LIVE'})`);

    const existing = await full.scheduledEvents.fetch();
    const wantNames = new Set(SCHEDULE.map((s) => s[0]));

    // Orphans entfernen (z.B. alte gleichnamige Yoga-Dubletten oder umbenannte Events)
    for (const [, ev] of existing) {
      if (!wantNames.has(ev.name)) {
        console.log(`│ - Orphan löschen: ${ev.name}`);
        if (!DRY) await ev.delete().catch(() => {});
      }
    }
    const byName = new Map();
    for (const [, ev] of existing) if (wantNames.has(ev.name) && !byName.has(ev.name)) byName.set(ev.name, ev);

    for (const [name, start, end, description] of SCHEDULE) {
      const startAt = iso(start);
      const endAt = iso(end);
      const ev = byName.get(name);
      if (ev) {
        const timeChanged = ev.scheduledStartTimestamp !== startAt.getTime() || ev.scheduledEndTimestamp !== endAt.getTime();
        const descChanged = ev.description !== description;
        if (!timeChanged && !descChanged) { console.log(`│ ✓ aktuell: ${name}`); continue; }
        console.log(`│ ~ aktualisieren: ${name}${timeChanged ? ' (Zeit)' : ''}${descChanged ? ' (Text)' : ''}`);
        if (!DRY) await ev.edit({ description, scheduledStartTime: startAt, scheduledEndTime: endAt });
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
