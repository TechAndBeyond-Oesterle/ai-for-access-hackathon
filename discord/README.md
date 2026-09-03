# Discord Server Setup — AI for Access

Idempotentes Skript, das die komplette Server-Struktur (Rollen, Kategorien, Channels, Rechte)
aus dem [Spike-Blueprint](./docs/2026-07-28_discord-spike.html) anlegt. Zum Aufsetzen des
**Beispiel-Servers**, damit das Team ihn durchklicken kann.

## Voraussetzungen

- Node ≥ 18 (native `fetch`, `discord.js` v14)
- Ein **leerer Discord-Server** (du erstellst ihn: „+" → Eigenen Server erstellen → „AI for Access 2026")

## Schritte

1. **Bot anlegen** im [Discord Developer Portal](https://discord.com/developers/applications)
   → *New Application* → Tab **Bot** → *Reset Token* → Token kopieren.
2. **Bot einladen** (WICHTIG — ohne das: Fehler „Unknown Guild"). Diese URL öffnen und den Server wählen:
   ```
   https://discord.com/api/oauth2/authorize?client_id=<APPLICATION_ID>&scope=bot%20applications.commands&permissions=8
   ```
   Für dieses Projekt (App `hackathon-ai4access-james`):
   ```
   https://discord.com/api/oauth2/authorize?client_id=1531558085649367050&scope=bot%20applications.commands&permissions=8
   ```
   Beide Scopes (`bot` + `applications.commands`) müssen aktiv sein, Permission **Administrator** (nur fürs Setup, danach entziehbar).
   Prüfen, ob der Bot auf dem richtigen Server ist:
   ```bash
   node -e "import('dotenv/config').then(()=>import('discord.js')).then(({Client,GatewayIntentBits,Events})=>{const c=new Client({intents:[GatewayIntentBits.Guilds]});c.once(Events.ClientReady,async()=>{(await c.guilds.fetch()).forEach(g=>console.log(g.name,g.id));c.destroy();});c.login(process.env.DISCORD_TOKEN);});"
   ```
3. **Konfig**: `.env.example` → `.env` kopieren, `DISCORD_TOKEN` + `GUILD_ID` eintragen.
   (`GUILD_ID` = Rechtsklick auf Server → „Server-ID kopieren"; Entwicklermodus in
   Einstellungen → Erweitert aktivieren.)
4. **Installieren & Trockenlauf**:
   ```bash
   cd discord
   npm install
   npm run dry      # zeigt nur, was es täte — ändert nichts
   ```
5. **Anlegen**:
   ```bash
   npm run setup    # legt Struktur an / gleicht ab (idempotent, mehrfach ausführbar)
   ```
6. **Durchklicken** & justieren. Struktur in `setup.mjs` (Arrays `ROLES` / `CATEGORIES`)
   anpassen, `npm run setup` erneut laufen lassen.

## Was es anlegt

- **Rollen**: Orga (Admin), Jury, Mentor:in, Challenge-Owner, Media/Doku, Teilnehmer:in
  + Skill-Tags (Dev/Design/Domain-Expert/Newcomer/PM)
- **Kategorien/Channels**: START-HIER · TEAMFINDUNG · ALLGEMEIN · TEAMS (leer, per Bot) ·
  MENTORING · BÜHNE & PITCHES · DOKU & PRESSE · JURY · SPONSOREN · ORGA
- **Rechte**: Info-Kanäle read-only, private Kategorien (Jury/Sponsoren/Doku/Orga) nur für ihre Rollen,
  `#challenges` nur von Challenge-Ownern bepostbar.

## Troubleshooting (real getroffen 2026-07-28)

- **`Unknown Guild`** → Bot ist nicht auf dem Server. Invite-URL (Schritt 2) ausführen; mit dem
  Check-Snippet verifizieren, dass der Bot auf dem richtigen Server ist.
- **`Invalid Form Body … type must be one of {…}`** beim Announcement-Channel → **Announcement-Channels
  (Typ 5) brauchen Community-Modus.** `#ankuendigungen` läuft daher als read-only Text-Channel.
- **`Cannot execute action on this channel type`** bei der Bühne → **Stage-Channels (Typ 13) brauchen
  Community-Modus.** `#Bühne` läuft daher als Voice-Channel.
- **`CHANNEL_TOPIC_INVALID … word that is not allowed`** → Discords Wort-Filter für **Voice**-Channel-Topics
  ist streng; Voice-Channels bekommen deshalb keinen Topic.

**Community-Upgrade (erledigt 2026-07-28):** Der Server ist auf **Community** umgestellt. `setup.mjs` legt
`#ankuendigungen` (Announcement) und `#Bühne` (Stage) jetzt direkt korrekt an. Für einen bereits
bestehenden Server, der noch die Text-/Voice-Varianten hat, wandelt `npm run upgrade`
(`community-upgrade.mjs`) sie in-place um (idempotent, `--dry-run`-fähig; Voice→Stage per Neu-Anlage).

## Aktueller Ist-Zustand (Beispiel-Server)

Server **„AI - Access - Bern 2026"** (`GUILD_ID` in `.env`) ist aufgesetzt:
11 Rollen, 10 Kategorien mit allen Channels, 13 Timeline-Events (20.–21.11.2026), `/team`-Commands registriert.
Zum Testen von `/team create`/`/team add` muss `npm run bot` laufen.

## Sicherheit

- `.env` ist **gitignored** — Token nie committen. Nach dem Setup den Bot-Token im Portal
  regenerieren oder den Bot entfernen (Admin-Rechte nicht dauerhaft nötig).

## Beispiel-Inhalte (`seed.mjs`)

Füllt den Server mit realistischen Beispiel-Nachrichten, damit das Team den kompletten Flow
"lebendig" reviewen kann (Willkommen, Regeln, Ansagen, Zeitplan, FAQ, Tools, Firmen-Challenges &
Ideen als Forum-Posts, eingereichte Beispiel-Projekte mit Pitch-Video-Links, Mentor-Anfragen,
native Voting-Umfrage).

```bash
npm run seed:dry   # Vorschau
npm run seed       # postet (idempotent: befüllte Channels/Threads werden übersprungen)
```

Inhalte sind mit `[Beispiel]` markiert; Kanal-Verweise (`{#name}`) werden zu **echten Discord-Links**
aufgelöst. `npm run seed:refresh` löscht die alten Bot-Posts und postet neu (z.B. nach Textänderungen).
**Beispiel-Teams:** `npm run seed:teams` legt 2–3 Teams (Rolle + privater Text-/Voice-Channel) unter
🛠️ TEAMS an, damit die Kategorie im Review nicht leer ist. **Vor dem echten Event** alles leeren/anpassen.

### Spike-Termine (Demo-Wochenende)

`npm run events:demo` schiebt die Event-Termine auf das **kommende Wochenende** (statt 20.–21.11.2026),
damit man den Ablauf im Spike „live" durchspielen kann. Zurück auf die echten Termine: `npm run events`.

## Bot-Avatar / Icon

`npm run avatar` generiert das Icon (Schlüsselloch = Access + AI-Funken, Spike-Gradient) als PNG
nach `assets/bot-avatar.png` und setzt es als Bot-Avatar. `--server` setzt dasselbe Bild
zusätzlich als Server-Icon; `--dry-run` erzeugt nur das PNG. SVG-Quelle liegt in `assets/bot-avatar.svg`.

## Team-Bot (`/team`)

> ⚠️ **WICHTIG — der Bot muss LAUFEN, damit `/team create` funktioniert.**
> Die Slash-Commands sind zwar dauerhaft im Server registriert, **antworten aber nur, solange
> `bot.mjs` online ist**. Ist der Prozess offline, erscheint „Diese Anwendung reagiert nicht"
> und es lassen sich **keine Team-Räume anlegen**.
> **→ Am Event-Tag (v.a. Freitagabend zur Teamfindung) unbedingt `npm run bot` laufen lassen**
> (Terminal offen halten, oder als Dauer-Prozess auf Mac Studio / Coolify deployen).
> Kein Hosting nötig, wenn du ihn nur im Event-Zeitfenster lokal laufen lässt.

Self-service Team-Räume. Der Bot muss **laufen**, damit die Commands reagieren (am Event-Tag online halten).

```bash
npm run bot        # registriert Commands (sofort da) und geht online
```

- `/team create name:<Team-Name>` → legt Team-Rolle + privaten Text- & Voice-Channel unter „🛠️ TEAMS" an, weist dir die Rolle zu.
- `/team add user:<@person>` → im Team-Text-Channel ausführen, fügt jemanden zu deinem Team hinzu.
- `/team leave` → verlässt das eigene Team (nötig, um in ein anderes zu wechseln).

Voraussetzung: `setup.mjs` lief einmal (Kategorie + Rollen „Orga"/„Mentor:in" existieren). `CLIENT_ID` in `.env`.

### Team-Regeln (Orga-Meeting 03.09.2026)

**Ein Team pro Person.** `/team create` und `/team add` weisen ab, wer schon in einem Team ist —
Ausnahme sind die Rolle **Orga** und alle mit Administrator-Recht. Ohne die Prüfung in `/team add`
wäre das Limit umgehbar, deshalb greift sie an beiden Stellen. Wechseln geht über `/team leave`.

**Teams ohne Mitglieder werden gelöscht** (Rolle + Text- & Voice-Channel). Ein Team gilt als
verwaist, sobald niemand mehr seine Rolle trägt — typischerweise nach `/team leave` oder wenn
jemand den Server verlässt. Gelöscht wird erst nach **15 Minuten Karenz** (`EMPTY_GRACE_MS`),
damit ein verzögertes Rollen-Update kein frisch angelegtes Team wegräumt. Geprüft wird beim
Start, alle 5 Minuten und ereignisgesteuert.

```bash
npm run bot:sweep:dry   # zeigt, welche Teams verwaist sind — löscht nichts
npm run bot:sweep       # räumt einmalig auf und beendet sich (ohne Karenzzeit)
npm test                # Regel-Logik prüfen (ohne Discord-Server/Token)
```

> ⚠️ **Privileged Intent nötig:** Fürs Aufräumen braucht der Bot den **Server Members Intent**
> (Developer Portal → Bot → *Privileged Gateway Intents*).
>
> Fehlt er, verweigert Discord **die gesamte Gateway-Verbindung** (`Used disallowed intents`) —
> nicht nur den Intent. Ein Bot, der ihn anfordert ohne ihn zu haben, geht also gar nicht online.
> Damit ein fehlendes Häkchen nicht den ganzen Bot lahmlegt, verbindet sich `bot.mjs` in dem
> Fall automatisch neu **ohne** den Intent: `/team create`, `/team add` und `/team leave`
> funktionieren dann normal, nur leere Teams bleiben stehen. Die Konsole sagt das deutlich
> (`— OHNE Auto-Cleanup`). Verifiziert am 03.09.2026 gegen den echten Server.

Die Löschlogik findet die Räume eines Teams über Marker im Channel-Topic
(`[teamRole:…]`, `[teamVoice:…]`). Teams, die vor dieser Änderung angelegt wurden, haben nur den
`teamRole`-Marker — für sie greift das Namensschema `team-<slug>-voice` als Fallback.

## Channel-Posts aus Markdown (`posts.mjs`)

Feste Texte im Server (Anleitungen, Regeln, Hinweise) liegen als Markdown in `posts/` —
**eine Datei = eine Discord-Nachricht**. Wer den Text ändern will, ändert die Datei; niemand
muss dafür Code anfassen oder alte Posts von Hand löschen.

```bash
npm run posts:dry        # zeigt nur, was passieren würde
npm run posts:preview    # alles nach #orga-intern (nur Orga sieht es) — zur Abnahme
npm run posts            # in die Channels aus dem Frontmatter
node posts.mjs --only team-anleitung-de --channel orga-intern
```

**Beim zweiten Lauf wird die bestehende Nachricht editiert, nicht neu gepostet.** Der Bot
erkennt sie an einem unauffälligen Marker im Discord-Subtext (`-# ⟨post:<name>⟩`), den das
Skript ans Ende hängt. Es braucht also kein State-File — die Wahrheit steht in Discord.
Unveränderte Texte werden übersprungen (`✓ … unverändert`).

Aufbau einer Datei:

```markdown
---
channel: team-suche
---
# Überschrift
Text … {#hilfe-und-support} wird zu einem echten Kanal-Link.
```

- `{#kanal-name}` wird zu `<#id>` aufgelöst — ein einfaches `#kanal` bliebe im per API
  gesendeten Text toter Text (anders als beim Tippen im Client). Unbekannte Namen bleiben
  als `#name` stehen und erzeugen nur eine Warnung.
- **Discord-Limit: 2000 Zeichen pro Nachricht.** Wird eine Datei größer, bricht das Skript
  mit Angabe der Zeichenzahl ab — dann in `…-1.md` / `…-2.md` aufteilen.
- Die Reihenfolge der Posts folgt dem Dateinamen (deshalb ggf. `10-`, `20-` voranstellen).

## Scheduled Events (Fr/Sa-Timeline)

Legt die komplette Programm-Timeline als Discord-Events an (Ort = Stadtkloster Frieden, Reminder für Teilnehmende).

```bash
npm run events:dry   # zeigt nur, was es täte
npm run events       # legt an (idempotent: gleicher Name wird übersprungen)
```

## Rollen-Buttons mit privater Bestätigung

`bot.mjs` verknüpft beim Start den eigenen Post in `#choose-your-role`
(alter Kanalname `#rollen-waehlen` wird ebenfalls erkannt) mit den fünf Skill-Rollen:
💻 Dev · 🎨 Design · 🧠 Domain-Expert · 📊 PM / Business · ✨ Newcomer.
Mehrfachauswahl ist möglich; Klick vergibt die Rolle, erneuter Klick entfernt sie.
Erfolg oder Fehler erscheinen nur für die klickende Person (Ephemeral-Antwort).
Nach Erfolg zeigt der Bot zusätzlich ihre aktuellen Skill-Tags an. Die öffentlichen
Buttons bleiben neutral, weil jede Person eine andere Auswahl hat.
Team-, Teilnehmer- und Orga-Rollen bleiben unberührt.

- Textquelle: `posts/choose-your-role.md`. Der Bot editiert seinen markierten Post
  oder übernimmt den alten deutschen Seed **in-place** und ergänzt fünf Buttons.
  Fehlt ein eigener Rollenpost, legt er einen an. Fremde Posts/Preview-Kanäle zählen nicht.
- Migration von Reaction-Roles: bestehende Rollen bleiben erhalten. Alte Reaktionen
  werden bei vorhandenen `Manage Messages`-Rechten vom Rollenpost entfernt; andernfalls
  bleiben sie sichtbar, aber ohne Wirkung. Keine Reaktions-Listener und kein Nachtragen
  alter Stimmen beim Neustart: ein per Button entfernter Skill bleibt entfernt.
- Benötigt `Manage Roles`; die Bot-Rolle muss über allen Skill-Rollen stehen. Diese
  müssen eindeutig benannt, nicht integrationsverwaltet und ohne Serverrechte sein.
  Im Kanal: View Channel, Read Message History, Send Messages.
- Stabile Button-IDs, keine kurzlebigen Collector: funktionieren nach Neustart auf
  demselben Post. Kein Message Content-/Reaction-Intent nötig; funktioniert auch
  ohne den Server Members Intent, der nur für Team-Cleanup nötig ist.
- Dockerfile enthält Modul und Rollenpost. Nach dem Deploy muss im Log
  `✓ Rollen-Buttons aktiv: <Nachrichtenlink>` erscheinen. Setup-Fehler werden klar
  geloggt und lassen die Team-Commands weiterlaufen. `--sweep`/`--dry-run` aktivieren
  die Rollen-Buttons nicht. Kein zweiter lokaler Bot parallel zum produktiven Prozess!

Prüfen: `npm test`; anschließend mit einem normalen Mitglied auf dem verlinkten Post
zwei Buttons anklicken → beide Rollen erscheinen mit privater Bestätigung; einen
erneut anklicken → nur diese Rolle verschwindet. Nach Bot-Neustart denselben Post testen.

## Noch nicht enthalten (spätere Ausbaustufe)

- Code-Freeze-Timer (schaltet `#projekte` um 18:30 automatisch read-only)
- Gepinnte Willkommens-/Regel-Posts (aktuell als Channel-Topics)
- Airtable-Verify (bewusst verworfen)
