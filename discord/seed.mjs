#!/usr/bin/env node
/**
 * AI for Access — Seed / Beispiel-Inhalte
 * ---------------------------------------
 * Füllt den Server mit realistischen Beispiel-Nachrichten, damit das Team den kompletten
 * Event-Flow "lebendig" reviewen kann: Willkommen, Regeln, Ansage, Zeitplan, FAQ, Tools,
 * Firmen-Challenges & Ideen (Forum), eingereichte Beispiel-Projekte (mit Pitch-Video ≤2 min),
 * Mentor-Anfragen und eine native Voting-Umfrage.
 *
 *   node seed.mjs --dry-run
 *   node seed.mjs
 *
 * Idempotent: Text-Channels, in denen der Bot schon gepostet hat, werden übersprungen;
 * Forum-Threads mit gleichem Namen werden nicht doppelt angelegt.
 * (Alle Inhalte sind BEISPIELE — mit [Beispiel] markiert, Links sind Platzhalter.)
 */

import 'dotenv/config';
import { Client, GatewayIntentBits, ChannelType, Events } from 'discord.js';

const DRY = process.argv.includes('--dry-run');
const REFRESH = process.argv.includes('--refresh'); // alte Bot-Posts löschen + neu posten (z.B. für aktualisierte Kanal-Links)
const { DISCORD_TOKEN, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !GUILD_ID) {
  console.error('❌ DISCORD_TOKEN und GUILD_ID müssen in .env gesetzt sein.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// TEXT-/ANNOUNCEMENT-CHANNELS: Liste von Nachrichten (nacheinander gepostet)
// ---------------------------------------------------------------------------
const TEXT_SEED = {
  willkommen: [
`👋 **Willkommen beim AI for Access Hackathon 2026!**
🗓️ **20.–21. November 2026** · 📍 **Stadtkloster Frieden**, Friedensstrasse 9, Bern
🤝 Powercoders × Tech & Beyond

**Du musst nicht coden können. Du musst ein Problem verstehen.** In interdisziplinären Teams baut ihr mit AI-Tools in ~10 Stunden echte Prototypen zum Thema **Access** — Zugang zu Gesundheit, Recht, Bildung, Arbeit und Gemeinschaft.`,
`**So startest du:**
1️⃣ Lies den 👉 {#verhaltenskodex}
2️⃣ Wähle deine Skill-Tags in 👉 {#rollen-waehlen}
3️⃣ Stell dich kurz vor in 👉 {#vorstellung}
4️⃣ Stöbere in {#challenges} & {#ideen-marktplatz} und finde dein Team.

*EN as our common language — schreib gern auf Deutsch oder Englisch.* 🇩🇪🇬🇧`,
  ],
  verhaltenskodex: [
`📜 **Code of Conduct — kurz & verbindlich**

Wir wollen einen sicheren, offenen Raum für **alle** — besonders für Newcomer und Menschen ohne Coding-Hintergrund.

• **Respekt** — keine Belästigung, Diskriminierung oder abwertende Sprache.
• **Hilfsbereitschaft** — Fragen sind willkommen, niemand ist "zu Anfänger:in".
• **Fairness** — AI-Tools ja, aber ehrlich; keine fertigen Projekte "recyceln".
• **Einwilligung** — Fotos/Videos nur mit OK der abgebildeten Personen (→ #doku-und-presse).

Verstoß? → DM an ein **@Orga**-Mitglied. Danke, dass ihr diesen Space tragt. 💜`,
  ],
  'rollen-waehlen': [
`🎭 **Wähle deine Skill-Tags** — damit Teams sich leichter finden.

Reagiere auf diese Nachricht (im echten Betrieb via Reaction-Roles):
💻 **Dev** — Entwicklung / Engineering
🎨 **Design** — UX / UI / Product
🧠 **Domain-Expert** — Medizin, Recht, Bildung, Soziales …
📊 **PM / Business** — Produkt, Strategie, Pitch
✨ **Newcomer** — neu in Tech / im Hackathon-Format — herzlich willkommen!

Mehrfachauswahl ist ok. *(Setup-Hinweis: Reaction-Roles werden später verknüpft.)*`,
  ],
  ankuendigungen: [
`📢 **[Beispiel] T-14 · Registrierung ist offen!**
Die Anmeldung läuft — teilt den Link in euren Netzwerken. Ziel: ~100 Teilnehmende, davon ≥30 % ohne Coding-Hintergrund. 🚀`,
`📢 **[Beispiel] Programm steht — schaut in die Event-Übersicht!**
Der komplette Fr/Sa-Ablauf ist als **Discord-Events** hinterlegt (oben unter „Events" auf „Interessiert" klicken → ihr bekommt Reminder). Highlights: Crash-Kurs, Mentor-Check-in, Pitch-Speedrun → Top-10-Live. 🏆`,
  ],
  zeitplan: [
`🗓️ **Programm** (Details + Reminder unter „Events")

**Freitag, 20.11.**
18:00 Doors Open & Networking
18:30 Eröffnung & Keynote
19:15 Ideen-Pitches & Teamfindung
20:30 Konzeptphase · 21:00 Ende

**Samstag, 21.11.**
09:00 Doors & Kaffee · 09:30 **Hack-Start (10h)**
12:30 Lunch · 14:00 Yoga
15:00 Mentor-Check-in · 17:00 Yoga
18:30 **Code Freeze** → Einreichung in {#projekte}
19:00 **Pitch-Speedrun → Top 10 Live** (Bühne)
20:30 🎉 Awards & Apéro`,
  ],
  faq: [
`❓ **FAQ**

**Muss ich programmieren können?** Nein! Domain-Wissen, Design, Moderation, Pitch — alles zählt.
**Was brauche ich?** Laptop, Ladegerät, gute Laune. AI-Tool-Zugänge stellen wir (→ {#tools-und-credits}).
**Muss ich ein Team mitbringen?** Nein — Teams bilden sich Freitagabend ({#ideen-marktplatz} / {#team-suche}).
**Wie reiche ich ein?** 1 Post in {#projekte} mit Repo/Demo + **Pitch-Video ≤ 2 Min (als Link!)**.
**Kosten?** Teilnahme kostenlos. Verpflegung inklusive.
**Sprache?** Deutsch & Englisch, EN als gemeinsame Sprache.`,
  ],
  'tools-und-credits': [
`🛠️ **AI-Tools & Credits** (Beispiele — final via Tool-Partner)

• **Claude** (Anthropic) — Coding, Text, Analyse
• **Cursor** / **v0** — App- & UI-Prototyping
• **Lovable** / **Bolt** — Full-Stack aus dem Prompt
• **Figma** (+ AI) — Design
• **Supabase / Vercel** — Backend & Deploy

🎟️ Team-Credits/Codes werden am Freitagabend hier gepostet. Fragt bei Bedarf ein **@Orga**-Mitglied.`,
  ],
  'crashkurs-videos': [
`🎥 **Crash-Kurs & Video-Reihe** (30 Min „von der Idee zum Prototyp mit AI")

[Beispiel-Links — extern gehostet, hier nur verlinkt]
▶️ Teil 1 — Vibe-Coding-Basics: https://youtu.be/AI4A-crash-01
▶️ Teil 2 — Prototyp deployen: https://youtu.be/AI4A-crash-02
▶️ Aufzeichnung Eröffnungs-Keynote: (folgt nach dem Event)

*Warum extern? Pitch-/Kurs-Videos sprengen Discords Upload-Limit → immer als Link posten.*`,
  ],
  vorstellung: [
`👋 [Beispiel] **Amina**, Ärztin aus Damaskus, jetzt in Bern. Kein Code, aber viele Ideen rund um **Health Access**. Suche Team! 🩺`,
`👋 [Beispiel] **Luca**, UX-Designer aus Bern. Figma, Prototyping, gern barrierefreie Interfaces. 🎨`,
`👋 [Beispiel] **Sara**, Informatikstudentin BFH. React/Next.js, mag Legal-Tech. Newcomer beim Hackathon! 💻`,
  ],
  'team-suche': [
`🔎 [Beispiel] **Suche Dev** für „Behörden-Navigator" (Foto→Todo-Liste). Habe Konzept + Domain-Wissen, brauche jemanden fürs Prototyping. — Amina`,
`🙋 [Beispiel] **Biete Design** (UX/UI, Figma). Schließe mich gern einem Team im Access-/Bildungsbereich an. — Luca`,
`🔎 [Beispiel] Wir sind zu zweit (Legal-Domain + PM) und **suchen 1 Dev** für „Access Law". — Team Mietrecht`,
  ],
  'pitch-fragen': [
`💬 [Beispiel] An Team „Behörden-Navigator": Wie geht ihr mit sensiblen Daten aus den Briefen um — läuft die Verarbeitung lokal oder in der Cloud? 🔐`,
  ],
  bewertung: [
`⚖️ **Jury — Bewertung** (intern)

Scoring-Sheet (5 Kriterien, je 1–5): **[Beispiel]** https://docs.google.com/spreadsheets/AI4A-jury
• **Impact** — löst es ein echtes Zugangsproblem?
• **AI-Einsatz** — wie smart genutzt?
• **Prototyp** — funktioniert es?
• **Teamwork** — Interdisziplinarität?
• **Pitch** — Klarheit & Story?

Ablauf: Speedrun-Videos in {#projekte} sichten → Top 10 → Live-Pitches bewerten → Konsens hier im Kanal.`,
  ],
};

// ---------------------------------------------------------------------------
// FORUM-CHANNELS: Threads (name = Titel, body = erster Post)
// ---------------------------------------------------------------------------
const FORUM_SEED = {
  challenges: [
    { name: '🏢 [Challenge] Behörden-Navigator — Sponsor: KantonTech AG',
      body: `**Problem:** Amtliche Briefe (Steueramt, Migration, Krankenkasse) sind für viele unverständlich — besonders für Newcomer.
**Zielgruppe:** Menschen mit wenig Behörden-/Sprach-Erfahrung.
**Warum jetzt?** AI kann Briefe erklären, übersetzen und in To-dos mit Deadlines verwandeln.
**Ressourcen:** Beispiel-Briefe (anonymisiert), API-Credits, Domain-Expertin vor Ort.
**Challenge-Owner:** @KantonTech (Samstag anwesend) · Kein IP-Claim auf Ergebnisse.` },
    { name: '🏢 [Challenge] Health Access — Sponsor: MediBern',
      body: `**Problem:** Patient:innen kommen unvorbereitet zum Arzt, Sprachbarrieren erschweren die Anamnese.
**Zielgruppe:** Neuzugezogene, ältere Menschen.
**Warum jetzt?** AI kann Symptome in der eigenen Sprache erfassen und ein Vorbereitungsblatt generieren.
**Ressourcen:** medizinische Terminologie-Liste, Test-Personas, Ärztin als Mentorin.
**Challenge-Owner:** @MediBern · Firmenpreis: 1× Innovations-Workshop.` },
    { name: '🏢 [Challenge] Skill Match — Sponsor: Powercoders',
      body: `**Problem:** Qualifikationen von Newcomern werden im CH-Arbeitsmarkt nicht erkannt.
**Zielgruppe:** Hochqualifizierte Geflüchtete & Career-Changer.
**Warum jetzt?** AI kann aus einem CV ein Kompetenzprofil bauen und mit CH-Berufen matchen.
**Ressourcen:** anonymisierte CV-Beispiele, Berufsnomenklatur, Alumni als Tester.
**Challenge-Owner:** @Powercoders` },
  ],
  'ideen-marktplatz': [
    { name: '💡 Digi-Coach — AI-Begleiter für digital abgehängte Menschen',
      body: `[Beispiel-Idee · Weg 2: eigene Idee]
Ein Schritt-für-Schritt-Assistent, der durch Online-Prozesse führt (Steuererklärung, Arzttermin, Kassenwechsel). Sprachbasiert, geduldig, in einfacher Sprache.
**Suche:** 1 Dev, 1 UX. **Rolle offen:** Domain (Sozialarbeit). 🙋 Reagiert im Thread!` },
    { name: '💡 Access Law — Rechtsfragen verständlich machen',
      body: `[Beispiel-Idee · passt zu #challenges „Access"]
AI beantwortet Alltagsrecht (Miete, Arbeit, Versicherung) in verständlicher Sprache und zeigt den Weg zur passenden Beratungsstelle.
**Team bisher:** Legal-Domain + PM. **Suchen:** 1 Dev. 💻` },
    { name: '💡 Barrier-Free Bern — Accessibility-Checker',
      body: `[Beispiel-Idee]
Tool scannt Behörden-Websites, generiert konkrete Barrierefreiheits-Verbesserungen + Report.
**Suche:** Frontend-Dev mit a11y-Interesse, Designer:in. 🎨` },
  ],
  'mentor-anfragen': [
    { name: '🧑‍🏫 [Beispiel] Team Digi-Coach — Scoping-Hilfe',
      body: `Wir wollen für 10h zu viel. Können wir mit einer Mentorin den Scope auf **ein** Feature eindampfen? Zeitfenster ~15:00. 🙏` },
    { name: '🧑‍🏫 [Beispiel] Team Access Law — Deploy-Frage',
      body: `Prototyp läuft lokal, wir kriegen ihn nicht auf Vercel deployed. Kurz-Support möglich? 🚀` },
  ],
  projekte: [
    { name: '🚀 Behörden-Navigator — Team Amina & Sara',
      body: `**Team:** Amina (Domain/Health), Sara (Dev), Luca (Design)
**Challenge:** Behörden-Navigator (KantonTech)
**Was:** Foto vom Amtsbrief → AI erklärt in einfacher Sprache + erzeugt To-do-Liste mit Deadlines.
**Repo/Demo:** [Beispiel] https://ai4access-navigator.vercel.app · https://github.com/ai4a/navigator
🎥 **Pitch-Video (1:52):** [Beispiel] https://youtu.be/AI4A-proj-navigator
*(Video ≤2 Min, extern gehostet — genau so einreichen!)*` },
    { name: '🚀 Access Law — Team Mietrecht',
      body: `**Team:** Jonas (PM), Nadia (Legal), Tim (Dev)
**Was:** Chat für Alltagsrecht in verständlicher Sprache + Verweis auf Beratungsstelle.
**Repo/Demo:** [Beispiel] https://ai4access-law.vercel.app
🎥 **Pitch-Video (1:47):** [Beispiel] https://youtu.be/AI4A-proj-law` },
    { name: '🚀 Skill Match — Team Powercoders Alumni',
      body: `**Team:** 3 Alumni
**Challenge:** Skill Match (Powercoders)
**Was:** CV → Kompetenzprofil → Match mit CH-Berufen + nächste Schritte zur Anerkennung.
**Repo/Demo:** [Beispiel] https://ai4access-skillmatch.vercel.app
🎥 **Pitch-Video (2:00):** [Beispiel] https://youtu.be/AI4A-proj-skillmatch` },
  ],
};

// ---------------------------------------------------------------------------
// POLLS (native Discord-Umfrage)
// ---------------------------------------------------------------------------
const POLL_SEED = {
  voting: {
    question: { text: '🏆 Publikumspreis — welches Projekt hat dich überzeugt?' },
    answers: [
      { text: 'Behörden-Navigator', emoji: '📬' },
      { text: 'Access Law', emoji: '⚖️' },
      { text: 'Skill Match', emoji: '🧩' },
      { text: 'Digi-Coach', emoji: '🤖' },
    ],
    allowMultiselect: false,
    duration: 24,
  },
};

// ---------------------------------------------------------------------------
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async () => {
  try {
    const guild = await (await client.guilds.fetch(GUILD_ID)).fetch();
    const channels = await guild.channels.fetch();
    const botId = client.user.id;
    console.log(`\n🌱 Seed für: ${guild.name}  (${DRY ? 'DRY-RUN' : 'LIVE'})`);
    const byName = (n) => channels.find((c) => c && c.name === n);
    // {#channel-name} -> echter Discord-Kanal-Link <#id> (fällt auf #name zurück, falls unbekannt)
    const mentions = (content) => content.replace(/\{#([\w\-äöü]+)\}/gi, (_, n) => {
      const c = byName(n); return c ? `<#${c.id}>` : `#${n}`;
    });

    // Text / Announcement
    for (const [name, messages] of Object.entries(TEXT_SEED)) {
      const ch = byName(name);
      if (!ch) { console.log(`│ ⚠️  #${name} nicht gefunden`); continue; }
      const recent = await ch.messages.fetch({ limit: 25 }).catch(() => null);
      const botMsgs = recent ? recent.filter((m) => m.author.id === botId) : null;
      if (botMsgs && botMsgs.size) {
        if (!REFRESH) { console.log(`│ ✓ #${name} schon befüllt — übersprungen (--refresh zum Neu-Posten)`); continue; }
        console.log(`│ ♻️  #${name}: ${botMsgs.size} alte Nachricht(en) löschen + neu posten`);
        if (!DRY) for (const [, m] of botMsgs) await m.delete().catch(() => {});
      } else {
        console.log(`│ + #${name}: ${messages.length} Nachricht(en)`);
      }
      if (!DRY) for (const content of messages) await ch.send({ content: mentions(content) });
    }

    // Foren
    for (const [name, threads] of Object.entries(FORUM_SEED)) {
      const ch = byName(name);
      if (!ch || ch.type !== ChannelType.GuildForum) { console.log(`│ ⚠️  Forum #${name} nicht gefunden`); continue; }
      const active = await ch.threads.fetchActive().catch(() => null);
      const existing = new Set(active ? active.threads.map((t) => t.name) : []);
      for (const t of threads) {
        if (existing.has(t.name)) { console.log(`│ ✓ [${name}] "${t.name}" existiert`); continue; }
        console.log(`│ + [${name}] Thread: ${t.name}`);
        if (!DRY) await ch.threads.create({ name: t.name, message: { content: mentions(t.body) } });
      }
    }

    // Polls
    for (const [name, poll] of Object.entries(POLL_SEED)) {
      const ch = byName(name);
      if (!ch) { console.log(`│ ⚠️  #${name} nicht gefunden`); continue; }
      const recent = await ch.messages.fetch({ limit: 10 }).catch(() => null);
      const botMsgs = recent ? recent.filter((m) => m.author.id === botId) : null;
      if (botMsgs && botMsgs.size) {
        if (!REFRESH) { console.log(`│ ✓ #${name} (Poll) schon da — übersprungen`); continue; }
        console.log(`│ ♻️  #${name}: Poll neu posten`);
        if (!DRY) for (const [, m] of botMsgs) await m.delete().catch(() => {});
      } else {
        console.log(`│ + #${name}: Umfrage "${poll.question.text}"`);
      }
      if (!DRY) await ch.send({ poll });
    }

    console.log(`\n✅ ${DRY ? 'Dry-Run fertig.' : 'Seed abgeschlossen — Server ist "lebendig" zum Review.'}`);
  } catch (err) {
    console.error('\n❌ Fehler:', err?.message || err);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(DISCORD_TOKEN);
