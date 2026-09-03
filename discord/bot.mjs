#!/usr/bin/env node
/**
 * AI for Access — Team-Bot
 * ------------------------
 * Slash-Commands für self-service Team-Räume:
 *   /team create name:<Team-Name>   → legt Team-Rolle + privaten Text- & Voice-Channel an
 *   /team add user:<@person>         → fügt jemanden zu DEINEM Team hinzu (im Team-Channel ausführen)
 *   /team leave                      → verlässt dein Team (letzte Person → Team wird aufgeräumt)
 *
 * Regeln (Orga-Meeting 03.09.2026):
 *   - Eine Person ist in höchstens EINEM Team. Ausnahme: Orga-Rolle / Administrator.
 *   - Ein Team ohne Mitglieder wird automatisch gelöscht (Rolle + Text- & Voice-Channel).
 *
 * Der Bot muss laufen, damit die Commands reagieren (am Event-Tag also online halten,
 * z.B. auf der Mac Studio / einem kleinen Server).
 *
 *   node bot.mjs                  # registriert Commands (guild-scoped, sofort da) und geht online
 *   node bot.mjs --sweep --dry-run  # einmalig prüfen, welche Teams verwaist sind — löscht nichts
 *   node bot.mjs --sweep            # einmalig aufräumen und beenden
 *
 * Voraussetzung: setup.mjs lief einmal (Kategorie "🛠️ TEAMS", Rollen "Orga"/"Mentor:in").
 * WICHTIG: Für das Aufräumen braucht der Bot den privilegierten "Server Members Intent"
 * (Developer Portal → Bot → Privileged Gateway Intents). Ohne ihn sieht er keine
 * Mitglieder und würde jedes Team für leer halten — der Sweep bricht dann bewusst ab.
 */

import 'dotenv/config';
import {
  Client, GatewayIntentBits, ChannelType, PermissionsBitField,
  SlashCommandBuilder, REST, Routes, MessageFlags, Events,
} from 'discord.js';
import {
  TEAM_ROLE_PREFIX, slug, teamName, teamRolesOf, isExempt, channelsOfTeam, emptyTeamVerdict,
} from './team-rules.mjs';
import { createRoleButtons, isSkillButton, loadRolePost } from './reaction-roles.mjs';

const { DISCORD_TOKEN, GUILD_ID, CLIENT_ID } = process.env;
if (!DISCORD_TOKEN || !GUILD_ID) {
  console.error('❌ DISCORD_TOKEN und GUILD_ID müssen in .env gesetzt sein.');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const SWEEP_ONCE = process.argv.includes('--sweep');

const F = PermissionsBitField.Flags;
const TEAMS_CATEGORY = '🛠️ TEAMS';
const TEAM_COLORS = [0x58A6FF, 0x3FB950, 0xBC8CFF, 0xF778BA, 0xE3B341, 0x22D3EE, 0xFF7B72, 0x7C5CFF];

const SWEEP_INTERVAL_MS = 5 * 60_000;     // Nachlauf, falls ein Gateway-Event verloren geht
const EMPTY_GRACE_MS = 15 * 60_000;       // so lange darf ein Team leer stehen, bevor es fällt
const LOG_CHANNEL = 'bot-logs';           // Orga-interner Kanal für Team-Ereignisse

// Sprache: Alles, was Teilnehmende sehen, ist ENGLISCH — bei Powercoders ist Englisch die
// gemeinsame Sprache, Deutsch nicht bei allen vorausgesetzt. Konsolen-Ausgaben und
// Code-Kommentare bleiben deutsch, die sieht nur die Orga.
const commands = [
  new SlashCommandBuilder()
    .setName('team')
    .setDescription('Manage your team space')
    .setDMPermission(false)
    .addSubcommand((s) => s
      .setName('create')
      .setDescription('Create a new team with a private text & voice channel')
      .addStringOption((o) => o.setName('name').setDescription('Team name').setRequired(true)))
    .addSubcommand((s) => s
      .setName('add')
      .setDescription('Add someone to your team (run this inside your team channel)')
      .addUserOption((o) => o.setName('user').setDescription('Person').setRequired(true)))
    .addSubcommand((s) => s
      .setName('leave')
      .setDescription('Leave your team — afterwards you can join another one'))
    .toJSON(),
];

// GuildMembers ist ein privilegierter Intent. Ist er im Developer Portal nicht aktiviert,
// verweigert Discord nicht nur den Intent, sondern die GESAMTE Gateway-Verbindung
// ("Used disallowed intents") — der Bot ginge also gar nicht online. Deshalb bauen wir den
// Client so, dass er im Zweifel ohne ihn startet: lieber ohne Auto-Cleanup als tot.
let cleanupEnabled = true;

function buildClient({ withMembers }) {
  const intents = [GatewayIntentBits.Guilds];
  if (withMembers) intents.push(GatewayIntentBits.GuildMembers);
  return new Client({ intents });
}

let client = buildClient({ withMembers: true });

async function registerCommands(appId) {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(appId, GUILD_ID), { body: commands });
  console.log('✓ Slash-Commands registriert (guild-scoped, sofort verfügbar).');
}

function roleByName(guild, name) {
  return guild.roles.cache.find((r) => r.name === name);
}

/**
 * Schreibt ein Ereignis nach #bot-logs (Orga-intern): wer welches Team angelegt, wen
 * aufgenommen, wer es verlassen hat, was aufgeräumt wurde. Damit ist am Event-Tag
 * nachvollziehbar, was passiert ist, ohne in die Container-Logs zu schauen.
 * Schlägt das Loggen fehl, darf das nie den eigentlichen Befehl scheitern lassen.
 */
async function logEvent(guild, text) {
  try {
    const channel = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildText && c.name === LOG_CHANNEL,
    );
    if (channel) await channel.send(`-# ${new Date().toLocaleString('de-CH')}\n${text}`);
  } catch (err) {
    console.error(`  (Log nach #${LOG_CHANNEL} fehlgeschlagen: ${err?.message || err})`);
  }
}

async function ensureTeamsCategory(guild) {
  let cat = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === TEAMS_CATEGORY,
  );
  if (!cat) cat = await guild.channels.create({ name: TEAMS_CATEGORY, type: ChannelType.GuildCategory });
  return cat;
}


async function handleCreate(interaction) {
  const guild = interaction.guild;
  const name = interaction.options.getString('name').trim();
  const s = slug(name);

  await guild.roles.fetch();
  await guild.channels.fetch();

  if (guild.channels.cache.find((c) => c.name === `team-${s}`)) {
    return interaction.editReply(`⚠️ A team channel **team-${s}** already exists. Please pick another name.`);
  }

  const own = teamRolesOf(interaction.member).first();
  if (own && !isExempt(interaction.member)) {
    return interaction.editReply(
      `⚠️ You're already in **${teamName(own)}**. One team per person — `
      + 'run `/team leave` there first, then you can create a new one.',
    );
  }

  const color = TEAM_COLORS[Math.floor(guild.roles.cache.size) % TEAM_COLORS.length];
  const teamRole = await guild.roles.create({ name: `${TEAM_ROLE_PREFIX}${name}`, color, mentionable: true, reason: 'Team-Raum' });
  await interaction.member.roles.add(teamRole);

  const everyone = guild.roles.everyone.id;
  const orga = roleByName(guild, 'Orga');
  const mentor = roleByName(guild, 'Mentor:in');
  const base = [
    { id: everyone, deny: [F.ViewChannel] },
    { id: teamRole.id, allow: [F.ViewChannel, F.SendMessages, F.Connect, F.Speak, F.ReadMessageHistory] },
  ];
  if (orga) base.push({ id: orga.id, allow: [F.ViewChannel, F.SendMessages, F.Connect, F.Speak] });
  if (mentor) base.push({ id: mentor.id, allow: [F.ViewChannel, F.SendMessages, F.Connect, F.Speak] });

  const category = await ensureTeamsCategory(guild);
  const text = await guild.channels.create({
    name: `team-${s}`, type: ChannelType.GuildText, parent: category.id,
    topic: `Privater Raum für Team „${name}". [teamRole:${teamRole.id}]`,
    permissionOverwrites: base, reason: 'Team-Raum',
  });
  const voice = await guild.channels.create({
    name: `team-${s}-voice`, type: ChannelType.GuildVoice, parent: category.id,
    permissionOverwrites: base, reason: 'Team-Raum',
  });
  // Voice-ID mit in den Topic, damit das Aufräumen beide Räume sicher findet.
  await text.setTopic(`Privater Raum für Team „${name}". [teamRole:${teamRole.id}] [teamVoice:${voice.id}]`);

  await text.send(`👋 Welcome to **${name}**! Use \`/team add @person\` here to bring in more members. `
    + '`/team leave` gets you out again — once the last person leaves, the bot removes the role and these rooms. '
    + 'Remember to post your project in **#projekte** (pitch video ≤2 min as an external link).');
  await logEvent(guild, `✚ **${name}** created by <@${interaction.user.id}> — <#${text.id}>`);
  return interaction.editReply(`✅ Team **${name}** created: <#${text.id}> + voice channel. You've got the <@&${teamRole.id}> role.`);
}

async function handleAdd(interaction) {
  const channel = interaction.channel;
  const match = channel?.topic?.match(/\[teamRole:(\d+)\]/);
  if (!match) {
    return interaction.editReply('⚠️ Please run this **inside your own team channel** (that\'s where the team role is stored).');
  }
  const roleId = match[1];
  const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
  if (!role) return interaction.editReply('⚠️ Team role not found.');

  // Nur Teammitglieder (oder Orga) dürfen einladen
  const isMember = interaction.member.roles.cache.has(roleId);
  const isOrga = interaction.member.roles.cache.some((r) => r.name === 'Orga');
  if (!isMember && !isOrga) {
    return interaction.editReply('⚠️ Only members of this team (or the organizers) can add someone.');
  }

  const user = interaction.options.getUser('user');
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) return interaction.editReply('⚠️ That person is not on this server.');

  if (member.roles.cache.has(roleId)) {
    return interaction.editReply(`ℹ️ <@${user.id}> is already in **${teamName(role)}**.`);
  }
  // Das Ein-Team-Limit gilt auch hier, sonst wäre /team add das Schlupfloch.
  const other = teamRolesOf(member).first();
  if (other && !isExempt(member)) {
    return interaction.editReply(
      `⚠️ <@${user.id}> is already in **${teamName(other)}**. `
      + 'One team per person — they need to run `/team leave` there first.',
    );
  }

  await member.roles.add(role);
  await logEvent(interaction.guild,
    `➕ <@${user.id}> added to **${teamName(role)}** by <@${interaction.user.id}>`);
  return interaction.editReply(`✅ <@${user.id}> is now part of **${teamName(role)}**.`);
}

async function handleLeave(interaction) {
  const own = teamRolesOf(interaction.member);
  if (own.size === 0) return interaction.editReply('ℹ️ You are not in any team.');

  const names = own.map((r) => teamName(r)).join('**, **');
  await interaction.member.roles.remove([...own.keys()]);
  scheduleSweep(interaction.guild);
  await logEvent(interaction.guild, `➖ <@${interaction.user.id}> left **${names}**`);
  return interaction.editReply(
    `✅ You left **${names}**. If a team ends up with no members, the bot clears it after `
    + `${EMPTY_GRACE_MS / 60_000} minutes. You can create a new one with \`/team create\`.`,
  );
}

/* ------------------------------------------------------------------ Aufräumen */

const emptySince = new Map();   // roleId -> Zeitpunkt, seit dem das Team leer ist
let sweepTimer = null;

/**
 * Löscht Teams ohne Mitglieder (Rolle + Text- & Voice-Channel).
 * Erst nach EMPTY_GRACE_MS, damit ein verzögertes Rollen-Update kein Team wegräumt,
 * das gerade erst angelegt wurde.
 */
async function sweepEmptyTeams(guild, { dryRun = DRY_RUN, graceMs = EMPTY_GRACE_MS } = {}) {
  await guild.roles.fetch();
  await guild.channels.fetch();

  let members;
  try {
    members = await guild.members.fetch();
  } catch (err) {
    console.error('⚠️ Mitglieder nicht abrufbar — "Server Members Intent" im Developer Portal aktiv?',
      err?.message || err);
    return [];
  }

  const removed = [];
  for (const role of guild.roles.cache.filter((r) => r.name.startsWith(TEAM_ROLE_PREFIX)).values()) {
    const memberCount = members.filter((m) => m.roles.cache.has(role.id)).size;
    const verdict = emptyTeamVerdict({ memberCount, since: emptySince.get(role.id) ?? null, graceMs });

    if (verdict.action === 'keep') { emptySince.delete(role.id); continue; }
    emptySince.set(role.id, verdict.since);
    if (verdict.action === 'wait') {
      console.log(`… "${teamName(role)}" ist leer (seit ${Math.round(verdict.waitedMs / 60_000)} min) — `
        + `Löschung ab ${graceMs / 60_000} min.`);
      continue;
    }

    const { text, voice } = channelsOfTeam(guild, role.id);
    if (dryRun) {
      console.log(`[dry-run] würde löschen: Rolle "${role.name}"`
        + `${text ? `, #${text.name}` : ''}${voice ? `, #${voice.name}` : ''}`);
      removed.push(role.name);
      continue;
    }

    const reason = 'Team ohne Mitglieder (Auto-Cleanup)';
    await text?.delete(reason).catch((e) => console.error(`  Channel: ${e?.message || e}`));
    await voice?.delete(reason).catch((e) => console.error(`  Voice: ${e?.message || e}`));
    await role.delete(reason).catch((e) => console.error(`  Rolle: ${e?.message || e}`));
    emptySince.delete(role.id);
    removed.push(role.name);
    console.log(`🧹 gelöscht: ${role.name}`);
    await logEvent(guild, `🧹 **${teamName(role)}** had no members left — role and rooms removed.`);
  }
  return removed;
}

/** Sammelt Events kurz auf, statt bei jedem Rollen-Update einen Full-Fetch zu fahren. */
function scheduleSweep(guild) {
  clearTimeout(sweepTimer);
  sweepTimer = setTimeout(
    () => sweepEmptyTeams(guild).catch((e) => console.error('sweep error:', e)),
    30_000,
  );
}

function registerHandlers(c) {
  let skillRoles;
  if (cleanupEnabled) {
    c.on(Events.GuildMemberUpdate, (before, after) => {
      const lost = before.roles.cache.some((r) => r.name.startsWith(TEAM_ROLE_PREFIX) && !after.roles.cache.has(r.id));
      if (lost) scheduleSweep(after.guild);
    });
    c.on(Events.GuildMemberRemove, (member) => scheduleSweep(member.guild));
  }

  c.on(Events.InteractionCreate, async (interaction) => {
    if (isSkillButton(interaction)) {
      try {
        if (skillRoles) return await skillRoles.handle(interaction);
        return await interaction.reply({
          content: '⚠️ Role selection is temporarily unavailable. Please try again shortly.',
          flags: MessageFlags.Ephemeral,
        });
      } catch (err) {
        console.error('Skill-Button-Antwort:', err?.message || err);
        return;
      }
    }
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'team') return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const sub = interaction.options.getSubcommand();
      if (sub === 'create') return await handleCreate(interaction);
      if (sub === 'leave') return await handleLeave(interaction);
      return await handleAdd(interaction);
    } catch (err) {
      console.error('team-command error:', err);
      return interaction.editReply(`❌ Fehler: ${err?.message || err}`);
    }
  });

  c.once(Events.ClientReady, async () => {
    console.log(`🤖 Online als ${c.user.tag}`);
    const guild = await c.guilds.fetch(GUILD_ID);

    // Einmal-Modus: nur aufräumen (bzw. zeigen, was fiele) und beenden — ohne Grace-Period,
    // weil der Lauf sonst nie etwas fände.
    if (SWEEP_ONCE) {
      if (!cleanupEnabled) {
        console.error('❌ Aufräumen braucht den Server Members Intent — siehe Hinweis oben.');
        return c.destroy();
      }
      const removed = await sweepEmptyTeams(guild, { graceMs: 0 });
      console.log(removed.length
        ? `${DRY_RUN ? '[dry-run] ' : ''}${removed.length} verwaiste(s) Team(s): ${removed.join(', ')}`
        : '✓ Keine verwaisten Teams.');
      return c.destroy();
    }

    await registerCommands(CLIENT_ID || c.application.id);
    // Nicht im Sweep-/Dry-Run-Modus posten oder Rollen vergeben.
    if (!DRY_RUN) {
      try {
        const content = await loadRolePost();
        skillRoles = createRoleButtons(guild, c.user.id);
        const post = await skillRoles.initialize(content);
        console.log(`✓ Rollen-Buttons aktiv: ${post.url}`);
      } catch (err) {
        skillRoles = null;
        console.error('❌ Rollen-Buttons nicht aktiv:', err?.message || err);
      }
    }
    if (cleanupEnabled) {
      await sweepEmptyTeams(guild).catch((e) => console.error('sweep error:', e));
      setInterval(
        () => sweepEmptyTeams(guild).catch((e) => console.error('sweep error:', e)),
        SWEEP_INTERVAL_MS,
      );
    }
    console.log(`   Bereit. /team create | /team add | /team leave`
      + `${DRY_RUN ? ' (dry-run: löscht nichts)' : ''}`
      + `${cleanupEnabled ? '' : ' — OHNE Auto-Cleanup'}`);
  });
}

// Beim Redeploy schickt Docker/Coolify SIGTERM. Ohne sauberes destroy() bleibt die alte
// Gateway-Session kurz offen — dann laufen zwei Instanzen parallel und reagieren doppelt
// auf dieselben Commands.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`\n${sig} — Bot fährt herunter.`);
    client.destroy().finally(() => process.exit(0));
  });
}

const INTENT_HINT = [
  '⚠️  Der "Server Members Intent" ist im Developer Portal nicht aktiviert.',
  '   → Discord verweigert damit die komplette Verbindung, nicht nur den Intent.',
  '   Der Bot läuft deshalb OHNE Auto-Cleanup weiter: /team create, add und leave',
  '   funktionieren, leere Teams bleiben aber stehen.',
  '   Aktivieren: Developer Portal → Bot → Privileged Gateway Intents → Server Members Intent',
].join('\n');

async function start() {
  registerHandlers(client);
  try {
    await client.login(DISCORD_TOKEN);
  } catch (err) {
    if (!/disallowed intents/i.test(err?.message ?? '')) throw err;

    console.error(INTENT_HINT);
    cleanupEnabled = false;
    client.destroy().catch(() => {});
    client = buildClient({ withMembers: false });
    registerHandlers(client);
    await client.login(DISCORD_TOKEN);
  }
}

start().catch((err) => {
  console.error('❌ Start fehlgeschlagen:', err?.message || err);
  process.exit(1);
});
