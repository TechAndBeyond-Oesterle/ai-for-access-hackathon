# Poll-Tool: Live-Umfrage für Info-Sessions und Event, Plan 2026-09-17

Task: HCK-30. Ersatz für Slido. Erste Nutzung: Info-Session Fr 18.09. 18:30. Später `/poll/eventday` für den Publikumspreis (HCK-29).

## Entscheidungen (Jonas, 17.09.)

- Fragen stehen im Code, je Event eine Route: `/poll/infosession` jetzt, `/poll/eventday` später. Kein Fragen-Backend.
- Antworten gehen direkt nach Airtable. Ergebnisse werden auf Vercel kurz gecacht, mehr nicht.
- Kein Login, kein Name. Schnell beantwortbar: 7 Fragen, Single Choice, ein Slider, eine gruppierte Multi-Choice, ein optionales Kommentarfeld, unter 60 Sekunden.

## Architektur (alles im Website-Repo, Astro server + Vercel-Adapter, bestehendes Muster von `src/pages/api/register.ts`)

- `src/lib/polls.ts`: Fragenkatalog als typisiertes Objekt `{ infosession: { title, questions: [{ id, text, type: 'single'|'multi', options[] }] } }`. Neue Umfrage = neuer Key.
- `src/pages/[lang]/poll/[event].astro`: rendert die Fragen des Events, ein Formular, Submit per fetch. Zufälliger `sessionKey` in `localStorage`, wird mitgeschickt, verhindert Doppelabgabe (Server ignoriert zweite Abgabe je Key und Event). Danach Danke-Seite mit Link zu den Ergebnissen.
- `src/pages/api/poll/[event].ts`:
  - `POST`: validiert gegen den Katalog (unbekannte Frage oder Option = 400), schreibt eine Airtable-Zeile je Frage: `event, sessionKey, questionId, answer, createdAt`. Tabelle `PollAnswers` in der bestehenden Base, `submitToAirtable` aus `src/lib/airtable.ts`.
  - `GET`: liest alle Zeilen des Events aus Airtable (Filter `event`), zählt je Frage und Option, liefert JSON `{ total, questions: [{ id, text, options: [{ label, count }] }] }`. Header `Cache-Control: s-maxage=5, stale-while-revalidate=30`, damit Vercel die Antwort 5 Sekunden hält. Zusätzlich ein Modul-Cache (Map mit Zeitstempel, 5 s) als Schutz, falls mehrere Ergebnis-Tabs offen sind.
- `src/pages/[lang]/poll/[event]/results.astro`: liest per fetch `GET /api/poll/[event]` alle 5 Sekunden, zeigt je Frage Balken in CSS (Breite = Anteil), Gesamtzahl der Abgaben oben. Grosse Schrift, für den Screen-Share. Kein Chart-Framework.
- Nur `de`-Route optional: die Fragen sind englisch, `/en/poll/infosession` reicht, `/de/...` leitet um oder zeigt dasselbe.
- QR-Code für die Folie: `slides-assets/qr-poll-infosession.png` im Hackathon-Projektordner (npx qrcode).

## Fragen `infosession` (englisch, 7 Fragen, Ziel: Wissensstand und Bedarf für Videos, unter 60 Sekunden)

1. **What is your background?** (single) Domain expert (health, law, education, social work, other) · Designer or product · Developer or data · Student or career changer · Other
2. **How much coding experience do you have?** (slider 0 bis 10, Beschriftung links „none", rechts „professional developer"; als Zahl gespeichert)
3. **Have you built something with AI tools before?** (single) Never · Tried once · Built a small thing · I build with AI every week
4. **Which tools have you used?** (multi, Checkboxen einzeln, aber in Gruppen mit Überschrift)
   - Chat assistants: ChatGPT · Claude · Gemini
   - Prompt-to-app builders: Lovable · Bloom · Bolt · v0
   - AI code editors: Cursor · GitHub Copilot · Windsurf
   - Terminal agents: Claude Code · Codex · OpenCode or other
   - None of these
5. **What would help you most before the event?** (single plus freies Kommentarfeld „Anything else?", optional, max. 280 Zeichen) Choosing and setting up tools · Turning an idea into a small demo · Finding a team · Pitching · Nothing, I am ready
6. **Do you want to submit your own challenge?** (single) Yes, I have an idea · Maybe, I need help shaping it · No
7. **Do you have a team?** (single) Yes, complete · Partly, we need people · No, I am looking for one

Warum genau diese: 1 bis 3 ergeben das Niveau (Zielgruppe der Videos), 4 zeigt je Gruppe, welche Tools wir zeigen müssen, 5 steuert das Angebot vor dem Event, 6 und 7 geben Zahlen für Challenge-Nachfassen und Team-Matching.

Speicherung: je Frage eine Zeile; Multi-Choice als eine Zeile je angekreuztem Tool; Slider als Zahl im Feld `answer`; Kommentar als eigene Zeile `questionId = q5_comment`. Ergebnisseite: Slider als Verteilung 0 bis 10 (Balken je Wert) plus Durchschnitt; Kommentare als Liste unter Frage 5.

## Airtable

Tabelle `PollAnswers` in der bestehenden Base (Felder: `event` single line, `sessionKey` single line, `questionId` single line, `answer` single line, `createdAt` date). Anlegen per Code über die Airtable-Meta-API (`POST /v0/meta/bases/{baseId}/tables`, Felder und spätere Feld-Ergänzungen per `POST/PATCH .../fields`). Der vorhandene Key darf das Schema lesen (getestet 17.09., Tabellen Registrations, Challenges, Mentors sichtbar); ob er schreiben darf, zeigt der erste Aufruf. Bei 403: in Airtable dem PAT den Scope `schema.bases:write` geben, zwei Minuten. Skript `scripts/airtable-schema.mjs` im Website-Repo: idempotent, legt `PollAnswers` an, wenn sie fehlt, ergänzt fehlende Felder, gibt die Tabellen-ID aus. Tabellen und Felder löschen kann die API nicht, das bleibt Handarbeit.

## Grenzen, bewusst akzeptiert

- Airtable-Limit 5 Anfragen pro Sekunde je Base: reicht für Info-Sessions. Für `eventday` mit 100 Personen vorher Batch-Schreiben (10 Zeilen pro Request) und längeren Cache einbauen.
- Ohne Login kann jemand mit gelöschtem localStorage zweimal abstimmen. Für die Info-Session egal, für den Publikumspreis später Discord-Login oder Code je Person.

## Verify (aus HCK-30)

- [ ] Zwei Geräte: Abgaben erscheinen in Airtable und in `/en/poll/infosession/results` innerhalb von 10 Sekunden
- [ ] Zweite Abgabe vom selben Gerät wird ignoriert, Ergebnis bleibt gleich
- [ ] Unbekannte Option per curl gibt 400
- [ ] `AIRTABLE_PAT` nicht im Client-Bundle (Network-Tab)
- [ ] Ergebnisseite auf 1920 px lesbar aus 3 m Entfernung

## Nachtrag 18.09. (umgesetzt, live)

- Einmal-Schutz über die Registrierungs-E-Mail: Pflichtfeld, SHA-256-Hash als Duplikat-Schlüssel (`emailHash`), dazu auf Wunsch von Jonas die Adresse im Klartext (`email`) und ein Linked Record `registration` auf die Registrations-Zeile, wenn die Adresse dort existiert (`registered` yes/no/unknown, nie blockierend).
- Ergebnisseite im Präsentationsstil: Kopf „Who is in the room?", vier Kacheln (Coding-Schnitt, Anteil mit AI-Erfahrung, eigene Idee, ohne Team), sortierte Balken mit Top 5 plus „Other", Slider mit Durchschnittsmarke, Kommentare unten, flackerfreier 5-Sekunden-Refresh, Taste `f` für Vollbild. Öffentlich, kein Key (Key-Variante gebaut und wieder entfernt).
- Zähl-Regel: je Session und Frage zählt nur die neueste Abgabe, Nenner je Frage = verschiedene Abgaben, Single Choice summiert auf 100 %, Multi Choice je Option unter 100 %. `test-`-Sessions werden gespeichert, nie gezählt.
- `scripts/poll-reset.mjs --event <key>`: Dry-Run zeigt Zeilen, Sessions und E-Mails, `--yes` löscht (10 pro Request), `--only-test` nur Test-Sessions. Vor jeder echten Session ausführen.
- Weitere Umfragen (z. B. Forschungsfragen): neuer Key in `src/lib/polls.ts`, Deploy. Routen und Speicherung laufen ohne weitere Änderung.
