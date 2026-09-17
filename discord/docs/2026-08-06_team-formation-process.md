# Team Formation Process — AI for Access Hackathon (Discord)

> Saved 2026-08-06. Based on the actual server structure (`discord/setup/setup.mjs`) and the
> `/team` bot (`discord/setup/bot.mjs`, see [BOT-REMINDER.md](./BOT-REMINDER.md)).
> Event: Fri 20 – Sat 21 Nov 2026, Stadtkloster Frieden, Bern.

## Before the event (from server invite onwards)

1. **Onboarding** — Participants join the Discord server, read `#willkommen` and the code of
   conduct, and pick their **skill tags** in `#rollen-waehlen`
   (Dev / Design / Domain Expert / Newcomer / PM). These roles are purely for matching —
   everyone can see at a glance who brings what.
2. **Challenges stay closed** (changed 2026-09-17) — Challenges are submitted through the
   website, reviewed by the orga in Airtable (`Status = Accepted`) and prepared as forum posts
   while `#challenges` is still hidden from `@everyone`. Nothing is visible before the event.
   Posting and reveal are two separate steps, see `challenges.mjs` in the README.
3. **Idea marketplace opens** — Anyone can post their own idea (or a take on a challenge) in
   the `#ideen-marktplatz` forum: **one post = one idea**. Interested people join the
   discussion in that thread — the thread naturally becomes the future team's chat.
4. **Skill matching** — In `#team-suche`, people post what they're looking for or offering
   ("Looking for a designer", "Offering legal domain expertise").

## Friday evening (warm-up = team formation)

5. **Challenge teasers go live** at the kick-off (`npm run challenges` + `npm run challenges:reveal`):
   title, sponsor, focus area, one sentence. Enough to form a team around a sponsor challenge,
   not enough to start building. On-site, ideas are pitched briefly and people cluster around
   them; Discord threads from the idea marketplace serve as the starting point.
6. **Team creation via bot** — Once a team has formed, one member runs
   `/team create name:<team name>`. The bot creates a team role plus a **private text and
   voice channel** under 🛠️ TEAMS and assigns the role to the creator. Teammates are added
   with `/team add @person` inside the team channel.
   - ⚠️ Ops note: the bot process (`npm run bot`) **must be running** for the slash commands
     to respond — especially Friday evening. Fallback: orga creates team channels manually.

## During the hack (Saturday)

6b. **Full briefs go live** in the morning (`npm run challenges:full`): context, problem,
   resources, contact person. Teams mark the challenge they picked with ✋ on the post;
   several teams may share a challenge. The orga runs `npm run challenges:report` right after
   and personally addresses every sponsor challenge that still has no team.
7. Teams work in their private channels; `#mentor-anfragen` (forum, one post per request)
   connects them with mentors, who pick up threads and meet in the mentoring voice channels.
8. At the end, each team posts its project in the `#projekte` forum (repo/demo, ≤2-min pitch
   video as external link), pitches on the stage channel, and the audience votes via native
   polls in `#voting`. `#projekte` goes read-only at code freeze.
