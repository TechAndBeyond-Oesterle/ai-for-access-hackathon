#!/usr/bin/env node
/**
 * AI for Access — Beispiel-Teams
 * ------------------------------
 * Legt 2–3 Beispiel-Teams an (wie /team create es täte), damit die Kategorie 🛠️ TEAMS
 * im Review nicht leer ist: je Team eine Rolle + privater Text- & Voice-Channel.
 *
 *   node seed-teams.mjs --dry-run
 *   node seed-teams.mjs
 *
 * Idempotent: existierende team-<slug>-Channels werden übersprungen.
 * (Beispiel-Teams — passend zu den eingereichten Projekten in #projekte.)
 */

import 'dotenv/config';
import { Client, GatewayIntentBits, ChannelType, PermissionsBitField, Events } from 'discord.js';

const DRY = process.argv.includes('--dry-run');
const { DISCORD_TOKEN, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !GUILD_ID) {
  console.error('❌ DISCORD_TOKEN und GUILD_ID müssen in .env gesetzt sein.');
  process.exit(1);
}

const F = PermissionsBitField.Flags;
const TEAMS_CATEGORY = '🛠️ TEAMS';
const TEAM_COLORS = [0x58A6FF, 0x3FB950, 0xBC8CFF, 0xF778BA, 0xE3B341];

const TEAMS = ['Behörden-Navigator', 'Access Law', 'Skill Match'];

const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '')
  .trim().replace(/\s+/g, '-').slice(0, 24) || 'team';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async () => {
  try {
    const guild = await (await client.guilds.fetch(GUILD_ID)).fetch();
    await guild.roles.fetch();
    const channels = await guild.channels.fetch();
    console.log(`\n👥 Beispiel-Teams für: ${guild.name}  (${DRY ? 'DRY-RUN' : 'LIVE'})`);

    const roleByName = (n) => guild.roles.cache.find((r) => r.name === n);
    let category = channels.find((c) => c && c.type === ChannelType.GuildCategory && c.name === TEAMS_CATEGORY);
    if (!category) {
      console.log(`│ + Kategorie ${TEAMS_CATEGORY} anlegen`);
      if (!DRY) category = await guild.channels.create({ name: TEAMS_CATEGORY, type: ChannelType.GuildCategory });
    }
    const orga = roleByName('Orga');
    const mentor = roleByName('Mentor:in');

    for (let i = 0; i < TEAMS.length; i++) {
      const name = TEAMS[i];
      const s = slug(name);
      if (channels.find((c) => c && c.name === `team-${s}`)) {
        console.log(`│ ✓ Team „${name}" existiert schon (team-${s})`); continue;
      }
      console.log(`│ + Team „${name}"  → Rolle + team-${s} (Text+Voice)`);
      if (DRY) continue;

      const teamRole = await guild.roles.create({
        name: `Team: ${name}`, color: TEAM_COLORS[i % TEAM_COLORS.length], mentionable: true, reason: 'Beispiel-Team',
      });
      const everyone = guild.roles.everyone.id;
      const ow = [
        { id: everyone, deny: [F.ViewChannel] },
        { id: teamRole.id, allow: [F.ViewChannel, F.SendMessages, F.Connect, F.Speak, F.ReadMessageHistory] },
      ];
      if (orga) ow.push({ id: orga.id, allow: [F.ViewChannel, F.SendMessages, F.Connect, F.Speak] });
      if (mentor) ow.push({ id: mentor.id, allow: [F.ViewChannel, F.SendMessages, F.Connect, F.Speak] });

      const text = await guild.channels.create({
        name: `team-${s}`, type: ChannelType.GuildText, parent: category?.id,
        topic: `Privater Raum für Team „${name}". [teamRole:${teamRole.id}]`,
        permissionOverwrites: ow, reason: 'Beispiel-Team',
      });
      await guild.channels.create({
        name: `team-${s}-voice`, type: ChannelType.GuildVoice, parent: category?.id,
        permissionOverwrites: ow, reason: 'Beispiel-Team',
      });
      await text.send(`👋 [Beispiel] Team **${name}** — privater Raum. Im echten Betrieb entsteht der per \`/team create\`, weitere Mitglieder via \`/team add @person\`. Projekt einreichen in #projekte (Pitch-Video ≤2 min als Link).`);
    }

    console.log(`\n✅ ${DRY ? 'Dry-Run fertig.' : 'Beispiel-Teams angelegt.'}`);
  } catch (err) {
    console.error('\n❌ Fehler:', err?.message || err);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(DISCORD_TOKEN);
