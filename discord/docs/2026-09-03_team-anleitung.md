# Anleitung „Team anlegen" — fertig zum Posten

> Erstellt 2026-09-03 (Orga-Meeting). Gehört nach **#teamfindung** (oder #willkommen),
> am besten **angepinnt**. Beschreibt den Stand nach HCK-5 (Ein-Team-Limit + Auto-Cleanup).
> Vor dem Posten prüfen: Läuft der Bot? Ohne laufenden Bot antworten die Befehle nicht (→ HCK-6).

**Zwei Fassungen:** Deutsch und Englisch. Powercoders-Teilnehmende sprechen nicht alle Deutsch —
im Zweifel beide Posts hintereinander setzen (oder je einen Thread).

---

## 🇩🇪 Fassung Deutsch

# 🛠️ So legt ihr euer Team an

Ihr braucht keinen Admin dafür — ihr macht das selbst, direkt hier im Server.

**1. Team gründen**
Eine Person aus eurem Team schreibt in einen beliebigen Channel:
```
/team create name: Nachtschicht
```
Der Bot legt daraufhin an:
• eine Team-Rolle
• einen **privaten Text-Channel** unter 🛠️ TEAMS
• einen **privaten Voice-Channel** dazu

Nur ihr (plus Orga und Mentor:innen) seht diese Räume.

**2. Die anderen dazuholen**
In eurem neuen Team-Channel:
```
/team add user: @Name
```
Das kann jede Person aus dem Team machen — ihr müsst nicht warten, bis die Gründerin online ist.

**3. Team wechseln**
```
/team leave
```
Danach könnt ihr einem anderen Team beitreten oder ein neues gründen.

## Zwei Regeln

**Eine Person, ein Team.** Ihr könnt nicht gleichzeitig in zwei Teams sein. Wenn ihr wechseln
wollt, erst `/team leave`.

**Leere Teams verschwinden.** Verlässt die letzte Person ein Team, räumt der Bot Rolle und
Räume nach kurzer Zeit automatisch auf. Legt also ruhig ein Team an, wenn ihr euch noch
sucht — es bleibt kein Datenmüll zurück.

## Wenn etwas nicht klappt

• **„Diese Anwendung reagiert nicht"** → Der Bot ist gerade offline. Meldet euch in
  #hilfe, die Orga startet ihn (oder legt euch den Raum von Hand an).
• **„Du bist schon im Team …"** → Ihr seid noch in einem anderen Team. `/team leave`, dann nochmal.
• **„Ein Team-Channel … existiert schon"** → Der Name ist vergeben, nehmt einen anderen.

Ihr sucht noch Mitstreiter:innen? Schaut in **#team-suche** und **#ideen-marktplatz** —
ein Post pro Idee, und der Thread wird ganz von selbst euer Team-Chat.

---

## 🇬🇧 English version

# 🛠️ How to create your team

You don't need an admin for this — you do it yourself, right here on the server.

**1. Create the team**
One person from your team types this in any channel:
```
/team create name: Night Shift
```
The bot then creates:
• a team role
• a **private text channel** under 🛠️ TEAMS
• a **private voice channel**

Only you (plus organizers and mentors) can see these rooms.

**2. Add the others**
Inside your new team channel:
```
/team add user: @Name
```
Anyone on the team can do this — no need to wait for whoever created it.

**3. Switch teams**
```
/team leave
```
After that you can join another team or start a new one.

## Two rules

**One person, one team.** You can't be in two teams at once. To switch, run `/team leave` first.

**Empty teams disappear.** When the last person leaves, the bot removes the role and the
channels a little later. So go ahead and create a team while you're still figuring things
out — nothing is left behind.

## If something doesn't work

• **"This application did not respond"** → The bot is offline right now. Post in #hilfe and
  the organizers will start it (or create the room manually for you).
• **"Du bist schon im Team …" / "You're already in team …"** → You're still in another team.
  Run `/team leave`, then try again.
• **"Ein Team-Channel … existiert schon"** → That name is taken, pick another one.

Still looking for teammates? Check **#team-suche** and **#ideen-marktplatz** — one post per
idea, and the thread naturally becomes your team chat.
