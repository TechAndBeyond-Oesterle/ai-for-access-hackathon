# ⚠️ Discord-Bot am Event-Tag starten (Team-Creation)

**Was:** Der `/team`-Bot (`hackathon-ai4access-james`) muss **online laufen**, damit
Teilnehmer:innen per `/team create` ihre eigenen Team-Räume anlegen können.

**Warum:** Die Slash-Commands sind dauerhaft im Server registriert, **reagieren aber nur,
solange der Bot-Prozess läuft**. Ist er offline → „Diese Anwendung reagiert nicht", keine
Team-Räume möglich.

**Wann:** Vor allem **Freitagabend (Teamfindung)**, sicherheitshalber das ganze Event über.

**Wie starten:**
```
cd discord        # im Repo ai-for-access-hackathon
npm run bot       # Terminal offen lassen
```

> Sobald der Bot über Coolify läuft (→ [`DEPLOY.md`](../DEPLOY.md)), ist das nur noch der
> Notfallweg — dann muss am Event-Tag kein Terminal mehr offen bleiben.

**Checkliste vorm Event:**
- [ ] `.env` vorhanden (DISCORD_TOKEN + GUILD_ID)
- [ ] Bot ist auf dem Server „AI - Access - Bern 2026"
- [ ] `npm run bot` gestartet → Konsole zeigt „🤖 Online als …" + „Slash-Commands registriert"
- [ ] Test: `/team create name:Test` in Discord → Team-Channel entsteht → Test-Channel wieder löschen
- [ ] (Optional) Bot als Dauer-Prozess deployen (Mac Studio / Coolify), falls always-on gewünscht

**Alternative ohne Bot:** Orga legt Team-Räume von Hand an — dann ist der Bot nicht nötig.
