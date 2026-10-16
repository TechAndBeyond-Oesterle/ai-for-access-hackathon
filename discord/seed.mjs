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
  welcome: [
`👋 **Welcome to the AI for Access Hackathon 2026!**
🗓️ **20–21 November 2026** · 📍 **Stadtkloster Frieden**, Friedensstrasse 9, Bern
🤝 Powercoders × Tech & Beyond

**You don't need to code. You need to understand a problem.** In interdisciplinary teams you build real prototypes with AI tools in ~10 hours on the theme of **Access**: access to health, justice, education, work and community.`,
`**How to start:**
1️⃣ Read the 👉 {#code-of-conduct}
2️⃣ Pick your skill tags in 👉 {#choose-your-role}
3️⃣ Introduce yourself in 👉 {#introductions}
4️⃣ Browse {#challenges} & {#idea-marketplace} and find your team.

*The event language is English.* 🇬🇧`,
  ],
  'code-of-conduct': [
`📜 **Code of Conduct: short & binding**

We want a safe, open space for **everyone**, especially newcomers and people without a coding background.

• **Respect**: no harassment, discrimination or demeaning language.
• **Helpfulness**: questions are welcome, nobody is "too much of a beginner".
• **Fairness**: AI tools yes, but honestly; no "recycling" of finished projects.
• **Consent**: photos/videos only with the OK of the people shown (→ #docs-and-press).

Something wrong? → DM a member of **@Orga**. Thanks for helping carry this space. 💜`,
  ],
  // #choose-your-role: den Skill-Post samt Buttons legt bot.mjs selbst an (posts/choose-your-role.md).
  announcements: [
`📢 **[Example] T-14 · Registration is open!**
Sign-up is live, share the link in your networks. Goal: ~100 participants, at least 30 % without a coding background. 🚀`,
`📢 **[Example] The programme is set, check the event overview!**
The full Fri/Sat schedule is available as **Discord events** (at the top under "Events", click "Interested" to get reminders). Highlights: crash course, mentor check-in, pitch speedrun → top 10 live. 🏆`,
  ],
  schedule: [
`🗓️ **Programme** (details + reminders under "Events")

**Friday, 20 Nov**
18:00 Doors Open & Networking
18:30 Opening & Keynote
19:15 Idea Pitches & Team Building
20:30 Concept Phase · 21:00 End

**Saturday, 21 Nov**
09:00 Doors & Coffee · 09:30 **Hack Start (10h)**
12:30 Lunch · 14:00 Yoga
15:00 Mentor Check-in · 17:00 Yoga
18:30 **Code Freeze** → submission in {#projects}
19:00 **Pitch Speedrun → Top 10 Live** (stage)
20:30 🎉 Awards & Apéro`,
  ],
  faq: [
`❓ **FAQ**

**Do I need to know how to code?** No! Domain knowledge, design, facilitation, pitching: it all counts.
**What do I need?** Laptop, charger, good mood. We provide access to AI tools (→ {#tools-and-credits}).
**Do I need to bring a team?** No, teams form on Friday evening ({#idea-marketplace} / {#team-search}).
**How do I submit?** 1 post in {#projects} with repo/demo + **pitch video ≤ 2 min (as a link!)**.
**Cost?** Participation is free. Food included.
**Language?** English.`,
  ],
  'tools-and-credits': [
`🛠️ **AI Tools & Credits** (examples, final list via tool partners)

• **Claude** (Anthropic): coding, text, analysis
• **Cursor** / **v0**: app & UI prototyping
• **Lovable** / **Bolt**: full stack from a prompt
• **Figma** (+ AI): design
• **Supabase / Vercel**: backend & deploy

🎟️ Team credits/codes will be posted here on Friday evening. Ask a member of **@Orga** if you need anything.`,
  ],
  'crash-course-videos': [
`🎥 **Crash Course & Video Series** (30 min "from idea to prototype with AI")

[Example links, hosted externally and only linked here]
▶️ Part 1: Vibe coding basics: https://youtu.be/AI4A-crash-01
▶️ Part 2: Deploying a prototype: https://youtu.be/AI4A-crash-02
▶️ Recording of the opening keynote: (after the event)

*Why external? Pitch/course videos exceed Discord's upload limit, so always post them as a link.*`,
  ],
  introductions: [
`👋 [Example] **Amina**, doctor from Damascus, now in Bern. No code, but lots of ideas around **health access**. Looking for a team! 🩺`,
`👋 [Example] **Luca**, UX designer from Bern. Figma, prototyping, likes accessible interfaces. 🎨`,
`👋 [Example] **Sara**, computer science student at BFH. React/Next.js, into legal tech. First hackathon! 💻`,
  ],
  'team-search': [
`🔎 [Example] **Looking for a dev** for "Authority Navigator" (photo → to-do list). I have the concept + domain knowledge, need someone for prototyping. (Amina)`,
`🙋 [Example] **Offering design** (UX/UI, Figma). Happy to join a team working on access or education. (Luca)`,
`🔎 [Example] We are two (legal domain + PM) and **looking for 1 dev** for "Access Law". (Team Tenancy Law)`,
  ],
  'pitch-questions': [
`💬 [Example] To team "Authority Navigator": how do you handle sensitive data from the letters? Does processing run locally or in the cloud? 🔐`,
  ],
  scoring: [
`⚖️ **Jury: Scoring** (internal)

Scoring sheet (4 criteria, 1–5 each): **[Example]** https://docs.google.com/spreadsheets/AI4A-jury
• **Impact**: does it solve a real access problem?
• **Use of AI**: how smartly is it used?
• **Prototype**: does it work?
• **Pitch**: clarity & story?

Process: review speedrun videos in {#projects} → top 10 → score live pitches → consensus here in the channel.`,
  ],
};

// ---------------------------------------------------------------------------
// FORUM-CHANNELS: Threads (name = Titel, body = erster Post)
// ---------------------------------------------------------------------------
const FORUM_SEED = {
  challenges: [
    { name: '🏢 [Challenge] Authority Navigator (Sponsor: KantonTech AG)',
      body: `**Problem:** Official letters (tax office, migration, health insurance) are hard to understand for many people, especially newcomers.
**Target group:** People with little experience with authorities or the language.
**Why now?** AI can explain and translate letters and turn them into to-dos with deadlines.
**Resources:** Example letters (anonymised), API credits, domain expert on site.
**Challenge owner:** @KantonTech (on site Saturday) · No IP claim on results.` },
    { name: '🏢 [Challenge] Health Access (Sponsor: MediBern)',
      body: `**Problem:** Patients arrive at the doctor unprepared, language barriers make taking a medical history hard.
**Target group:** Newly arrived people, older people.
**Why now?** AI can capture symptoms in one's own language and generate a preparation sheet.
**Resources:** Medical terminology list, test personas, a doctor as mentor.
**Challenge owner:** @MediBern · Company prize: 1× innovation workshop.` },
    { name: '🏢 [Challenge] Skill Match (Sponsor: Powercoders)',
      body: `**Problem:** Newcomers' qualifications are not recognised on the Swiss job market.
**Target group:** Highly qualified refugees & career changers.
**Why now?** AI can build a skills profile from a CV and match it with Swiss occupations.
**Resources:** Anonymised CV examples, occupational classification, alumni as testers.
**Challenge owner:** @Powercoders` },
  ],
  'idea-marketplace': [
    { name: '💡 Digi-Coach: AI companion for people left behind digitally',
      body: `[Example idea · path 2: own idea]
A step-by-step assistant that guides through online processes (tax return, doctor's appointment, switching health insurance). Voice-based, patient, in plain language.
**Looking for:** 1 dev, 1 UX. **Open role:** domain (social work). 🙋 Reply in the thread!` },
    { name: '💡 Access Law: making legal questions understandable',
      body: `[Example idea · fits #challenges "Access"]
AI answers everyday legal questions (rent, work, insurance) in plain language and points to the right advice centre.
**Team so far:** legal domain + PM. **Looking for:** 1 dev. 💻` },
    { name: '💡 Barrier-Free Bern: Accessibility Checker',
      body: `[Example idea]
A tool that scans government websites and generates concrete accessibility improvements + a report.
**Looking for:** frontend dev interested in a11y, designer. 🎨` },
  ],
  'mentor-requests': [
    { name: '🧑‍🏫 [Example] Team Digi-Coach: scoping help',
      body: `We want too much for 10h. Can a mentor help us cut the scope down to **one** feature? Around 15:00. 🙏` },
    { name: '🧑‍🏫 [Example] Team Access Law: deploy question',
      body: `The prototype runs locally, but we can't get it deployed on Vercel. Quick support possible? 🚀` },
  ],
  projects: [
    { name: '🚀 Authority Navigator: Team Amina & Sara',
      body: `**Team:** Amina (domain/health), Sara (dev), Luca (design)
**Challenge:** Authority Navigator (KantonTech)
**What:** Photo of an official letter → AI explains it in plain language + creates a to-do list with deadlines.
**Repo/Demo:** [Example] https://ai4access-navigator.vercel.app · https://github.com/ai4a/navigator
🎥 **Pitch video (1:52):** [Example] https://youtu.be/AI4A-proj-navigator
*(Video ≤2 min, hosted externally: submit exactly like this!)*` },
    { name: '🚀 Access Law: Team Tenancy Law',
      body: `**Team:** Jonas (PM), Nadia (legal), Tim (dev)
**What:** Chat for everyday legal questions in plain language + referral to an advice centre.
**Repo/Demo:** [Example] https://ai4access-law.vercel.app
🎥 **Pitch video (1:47):** [Example] https://youtu.be/AI4A-proj-law` },
    { name: '🚀 Skill Match: Team Powercoders Alumni',
      body: `**Team:** 3 alumni
**Challenge:** Skill Match (Powercoders)
**What:** CV → skills profile → match with Swiss occupations + next steps towards recognition.
**Repo/Demo:** [Example] https://ai4access-skillmatch.vercel.app
🎥 **Pitch video (2:00):** [Example] https://youtu.be/AI4A-proj-skillmatch` },
  ],
};

// ---------------------------------------------------------------------------
// POLLS (native Discord-Umfrage)
// ---------------------------------------------------------------------------
const POLL_SEED = {
  voting: {
    question: { text: '🏆 Audience award: which project won you over?' },
    answers: [
      { text: 'Authority Navigator', emoji: '📬' },
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
