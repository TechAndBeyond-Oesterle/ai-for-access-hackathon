# Screenshots

- `2026-09-30_1442_HCK-recording_mobile.png`: Unverlinkte Info-Session-Aufzeichnung mit nativem Videoplayer (`/en/info-session/2026-09-18/`, Mobile 390 px).

Konvention: `YYYY-MM-DD_HHMM_<ticket>-<feature>_<inhalt>.png`

- `2026-10-05_1610_HCK-anniversary-logo_desktop.png`, `2026-10-05_1610_HCK-anniversary-logo_mobile.png`: Jubiläumsbanner mit weisser Powercoders-Wortmarke, EN Desktop und DE Mobile.

- `2026-10-05_1553_HCK-anniversary_desktop.png`, `2026-10-05_1553_HCK-anniversary_mobile.png`, `2026-10-05_1553_HCK-anniversary_hosts.png`: Jubiläumsmarke für 10 Jahre Powercoders im Hero (EN Desktop, DE Mobile) und vollständiger Veranstalterbereich auf der Startseite.

Aufnahme: `bun run dev` auf einem freien Port, dann ein Node-Skript mit
`chromium` aus `/Users/jonas/code/site-snapshots/node_modules/playwright-core`
(`chromium.launch({ channel: 'chromium' })` nutzt das gecachte Chromium).
Die Playwright-CLI ist im Repo nicht installiert.

- `2026-09-17_1640_HCK-tb-logo_header-hosts-footer.png`: Tech & Beyond Drachen-Logo in Header, Hosts-Karte und Footer (Seite `/de/about/`).
- `2026-09-17_1752_HCK-tb-wordmark_header-sponsors-footer.png`: neue Tech & Beyond Wortmarke statt Drachen-Logo. Header (Desktop + Mobile 375), Hosts-Karten, Sponsoren-Tier Community und Footer (`/de/about/`, `/de/sponsors/`).
- `2026-09-25_1545_HCK-registration_sections-desktop.png`: Anmeldeformular mit vier durch Abstand getrennten Abschnitten und integrierten Matching-Fragen (`/de/register/`, Desktop).
- `2026-09-25_1545_HCK-registration_sections-mobile.png`: dieselbe Anordnung auf 375 px Breite (`/de/register/`, Mobile).
- `2026-09-25_1738_HCK-poll_today-results.png`: Ergebnisansicht mit Tagesfilter und „See all results“-Link (`/en/poll/infosession/results`, leere API-Antwort im Browser simuliert).
