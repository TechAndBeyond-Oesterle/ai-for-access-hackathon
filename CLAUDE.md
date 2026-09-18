@~/code/tb-workspace/CLAUDE.md

# ai-for-access-hackathon

Landingpage **hackathon.powercoders.org** für den AI for Access Hackathon
(Powercoders × Tech & Beyond, 20.–21. November 2026, Stadtkloster Frieden Bern).
Die Website ist die Wahrheitsquelle für Zeitplan, Challenges, Bewertungskriterien
und Preise. Weicht eine Notiz oder ein Slide davon ab, gilt das Repo.

flow-Projekt `wevibecode-hackathon`, Ticket-Prefix `HCK`.
Commits: `HCK | HCK-nn - Kurze Beschreibung` (ohne Ticket: `HCK | …`).

## Stack

- Astro 6 (`output: 'server'`, Vercel-Adapter), React 19, Tailwind 4.
- i18n de/en: Texte in `src/i18n/translations.ts`, Seiten unter `src/pages/[lang]/`,
  `defaultLocale: 'de'` mit Prefix (`/de/…`, `/en/…`).
- Paketmanager **bun**: `bun install --frozen-lockfile`, `bun run dev`,
  `bun run build`, `bun test` (Tests in `src/lib/*.test.ts`, `src/pages/api/*.test.ts`,
  `discord/*.test.mjs`).

## Deploy

Push auf `main` deployt Produktion auf Vercel. CLI immer mit Scope:
`vercel … --scope tech-and-beyond`.
Env: `AIRTABLE_PAT`, `AIRTABLE_BASE_ID` (Default `appapD55EOTAiqT0I`),
dazu `RESEND_*` für die Bestätigungsmails. Vollständig in `.env.example`.

## Daten (Airtable)

Base „Anmeldungen" mit den Tabellen Registrations, Challenges, Mentors, PollAnswers.
Geschrieben wird ausschliesslich über `src/lib/airtable.ts` (Tabellen-IDs stehen in den
jeweiligen API-Routen unter `src/pages/api/`). Schema-Änderungen laufen über
`node scripts/airtable-schema.mjs` (Meta-API, idempotent), nicht von Hand.

## Poll-Tool (HCK-30)

Fragen je Event stehen im Code: `src/lib/polls.ts`. Routen `/[lang]/poll/[event]` und
`/[lang]/poll/[event]/results`, API `src/pages/api/poll/[event].ts`,
Speicherung `src/lib/poll-store.ts`. Plan und Entscheidungen:
`docs/2026-09-17_poll-tool-plan.md`.

## Discord

Bot und Setup-Skripte liegen unter `discord/` mit eigener Doku
(`discord/README.md`, `discord/DEPLOY.md`). Eigenes `package.json`, npm statt bun.

## Konventionen

- Screenshots aus UI-Arbeit nach `docs/screenshots/YYYY-MM-DD_HHMM_<ticket>-<feature>_<inhalt>.png`
  plus eine Zeile in `docs/screenshots/README.md`.
- Kein Em-Dash („—") in neuem Code, Kommentaren, Commits: Punkt, Doppelpunkt, Komma.
  Bestehende Seitentitel und Fliesstexte nutzen ihn historisch, die bleiben.
- Logos: Tech & Beyond ist die Wortmarke `public/images/logos/tech-and-beyond*.svg`.
  Der Drachen-Kreis (`tech-and-beyond.jpg` / `.webp`) ist alt und nicht mehr referenziert.
