# Team-Bot deployen (Coolify)

Stand 2026-09-03. Ziel: Der Bot läuft dauerhaft, damit Teilnehmende **schon vor dem Event**
Teams anlegen können — nicht nur, solange auf der Mac Studio ein Terminal offen ist.

Verifiziert: `docker build` läuft durch, der Container startet und bricht erst beim Login
mit `TokenInvalid` ab (Dummy-Token). Image ~263 MB.

---

## Warum nicht die Mac Studio

Ein `npm run bot` im Terminal oder ein launchd-Job auf der Mac Studio ist in 10 Minuten
eingerichtet — reicht aber nur für das Event-Wochenende, solange der Rechner läuft.
Für „Teams schon vorher anlegen" braucht es einen Server, der immer an ist.
**Empfehlung: Coolify auf einem Hetzner-Ziel-Server.**

## Wohin mit dem Code — Repo-Frage

Der Bot liegt heute im `code-monorepo`. Als Deploy-Quelle ist das aus zwei Gründen ungeeignet:
Coolify klont bei jedem Deploy das **komplette** Monorepo, und der dafür nötige Deploy-Key
gäbe einem Hackathon-Server Lesezugriff auf das gesamte Second Brain inklusive Kundenprojekte.

Deshalb wie im Meeting beschlossen: **alles Discord-bezogene ins Website-Repo**
[`TechAndBeyond-Oesterle/ai-for-access-hackathon`](https://github.com/TechAndBeyond-Oesterle/ai-for-access-hackathon)
(klein, thematisch passend, Org-Repo). Damit ist HCK-9 **Voraussetzung** für das Deployment,
nicht Nacharbeit.

### Website und Bot im selben Repo — zwei Varianten

Die Website ist Astro und deployt über `@astrojs/vercel`.

**Variante A — Bot als Unterordner, Website bleibt im Root (empfohlen zum Start)**

```
ai-for-access-hackathon/
├── src/ astro.config.mjs …   ← Website, unverändert im Root
└── discord/                  ← Bot (bot.mjs, team-rules.mjs, Dockerfile, …)
```

An Vercel muss **nichts** geändert werden: Vercel baut weiter das Astro-Projekt im Root und
ignoriert `discord/`. Coolify bekommt `discord` als *Base Directory*. Kein Risiko für die
laufende Landingpage — das ist der schnelle Weg.

**Variante B — beides gleichberechtigt nebeneinander**

```
ai-for-access-hackathon/
├── website/   ← Vercel: Settings → General → Root Directory = "website"
└── discord/   ← Coolify: Base Directory = "discord"
```

Sauberer, aber mit zwei Haken:

1. **Die Vercel CLI kann `rootDirectory` nicht setzen** (v54: nur `add`/`rename`/`remove`/
   `inspect`/`protection`). Es geht nur über das Dashboard oder die REST API:
   ```bash
   curl -X PATCH "https://api.vercel.com/v9/projects/prj_khlAEtECM5tX6sJD0tCm4A3nBxId?teamId=tech-and-beyond" \
     -H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json" \
     -d '{"rootDirectory":"website"}'
   ```
2. **Setting und Push müssen zusammen passieren.** Steht das Setting schon auf `website`,
   während im Repo noch alles im Root liegt, bricht der nächste Deploy — auch einer, den
   jemand anderes auslöst. Umgekehrt genauso. Die Production-URL ist
   **hackathon.powercoders.org**, also eine sichtbare Partner-Domain: nicht nebenbei umstellen.

Deshalb zum Live-Gehen Variante A nehmen und B später in einem ruhigen Moment nachziehen —
A blockiert nichts und lässt sich jederzeit umbauen.

Aktueller Stand (03.09.2026): Projekt `prj_khlAEtECM5tX6sJD0tCm4A3nBxId`, Scope
`tech-and-beyond`, Framework Astro, **Root Directory `.`**.

**Optional (beide Varianten):** Damit ein Bot-Commit keinen Website-Deploy auslöst, in Vercel
unter *Settings → Git → Ignored Build Step* eintragen:

```bash
git diff --quiet HEAD^ HEAD -- . ':(exclude)discord'
```

## Umzug — erledigt am 03.09.2026 (Variante A)

Alles Discord-bezogene liegt jetzt hier im Repo unter `discord/`:

```
ai-for-access-hackathon/
├── src/ astro.config.mjs …   ← Website, unverändert im Root (Vercel: Root Directory ".")
└── discord/
    ├── bot.mjs team-rules.mjs           ← der Dauerprozess (das deployt Coolify)
    ├── setup.mjs seed*.mjs events.mjs … ← Einmal-Werkzeuge fürs Server-Setup
    ├── Dockerfile .dockerignore
    ├── assets/                          ← Bot-Avatar
    └── docs/                            ← Spike, Team-Formation, Anleitung, Reminder
```

Im `code-monorepo` verweist `01-Projects/2026-10_hackathon_powercoders/discord/` nur noch
hierher — dort wird **nicht mehr** entwickelt, sonst laufen zwei Stände auseinander.

## Coolify-Setup

Dashboard: `http://100.125.243.52:8000` (Tailscale) bzw. `http://coolify-server.orb.local:8000`.
Die Mac-Studio-VM ist nur die **Control-Plane** — als Ziel-Server einen der Hetzner-Server
wählen (`ubuntu-4gb-nbg1-2`, `138.199.210.76`), nicht `macstudio-internal-vm`.

1. **+ New → Application → Public/Private Repository** → `ai-for-access-hackathon`, Branch `main`.
2. **Build Pack: Dockerfile**, **Base Directory** `/discord`, Dockerfile-Pfad `Dockerfile`.
3. **Kein Port, keine Domain.** Der Bot hört auf nichts. Falls Coolify einen Port erzwingt:
   Domain leer lassen und den Health-Check deaktivieren — sonst stuft Coolify den laufenden
   Bot als „unhealthy" ein und startet ihn im Kreis neu.
4. **Environment Variables** setzen (Werte aus Infisical, Projekt *hackathon powercoders*):
   - `DISCORD_TOKEN` — als **Secret/Build-time: nein** markieren
   - `GUILD_ID`
   - `CLIENT_ID`
5. **Deploy.** Logs müssen zeigen: `🤖 Online als …`, `✓ Slash-Commands registriert`.

### Secrets: Coolify-Env statt Infisical-im-Container

**Empfehlung: die drei Werte direkt als Environment Variables in Coolify setzen.**

Der naheliegende Gedanke ist, im Container `infisical run -- node bot.mjs` zu nutzen. Für
diesen Bot lohnt das nicht:

- Es tauscht drei Secrets gegen ein anderes — der Container braucht dann
  Machine-Identity-Credentials, um an die Secrets zu kommen. Bei drei Werten, die sich bis
  November nicht ändern, ist das kein Gewinn.
- **Es baut eine zirkuläre Abhängigkeit.** Infisical läuft selbst self-hosted auf Coolify
  (`infisical.jonasoesterle.de`). Ist es beim Container-Start nicht erreichbar, startet der
  Bot nicht — ausgerechnet am Event-Wochenende, wo er laufen muss.
- Zusätzliche CLI im Image, größere Angriffsfläche.

Infisical bleibt trotzdem die **Quelle der Wahrheit** (Projekt *hackathon powercoders*);
Coolify hält eine Kopie. Bei einer Token-Rotation beide Orte anfassen — bei drei Werten
vertretbar. Für Setups mit vielen Secrets oder mehreren Umgebungen dreht sich die Abwägung um.

> Der Discord-Bot-Token ist Vollzugriff auf den Server. Landet er in einem Log, einem Chat
> oder einem Repo: im Developer Portal sofort *Reset Token* — und den neuen Wert nur noch in
> Infisical und Coolify eintragen.

## Zwei Fallstricke

**Server Members Intent** (Developer Portal → Bot → *Privileged Gateway Intents*).
Ohne ihn verweigert Discord die **gesamte Gateway-Verbindung** (`Used disallowed intents`),
nicht nur den Intent — ein Bot, der ihn anfordert ohne ihn zu haben, geht gar nicht online.
`bot.mjs` fängt das ab und verbindet sich automatisch ohne den Intent neu: Die `/team`-Befehle
laufen dann normal, nur das Aufräumen leerer Teams entfällt (Konsole: `— OHNE Auto-Cleanup`).
Für den vollen Funktionsumfang das Häkchen setzen.

**Zwei Instanzen gleichzeitig.** Läuft der Bot lokal auf der Mac Studio **und** in Coolify,
reagieren beide auf jeden Command — `/team create` legt dann zwei Rollen an. Nach dem
Deployment den lokalen Prozess beenden. `bot.mjs` behandelt SIGTERM sauber, damit beim
Redeploy die alte Instanz zuerst abmeldet.

## Nach dem Deploy prüfen

- [ ] Coolify-Logs: `🤖 Online als …` + `✓ Slash-Commands registriert`
- [ ] In Discord `/team create name:Deploy-Test` → Team-Channel entsteht
- [ ] `/team leave` → Log meldet später `🧹 gelöscht: Team: Deploy-Test`
- [ ] Container einmal manuell neu starten → Bot kommt von allein zurück
- [ ] Kein zweiter Bot-Prozess mehr lokal offen
