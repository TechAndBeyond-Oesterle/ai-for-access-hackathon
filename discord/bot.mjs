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

const commands = [
  new SlashCommandBuilder()
    .setName('team')
    .setDescription('Team-Räume verwalten')
    .setDMPermission(false)
    .addSubcommand((s) => s
      .setName('create')
      .setDescription('Neues Team + privaten Raum (Text & Voice) anlegen')
      .addStringOption((o) => o.setName('name').setDescription('Team-Name').setRequired(true)))
    .addSubcommand((s) => s
      .setName('add')
      .setDescription('Mitglied zu deinem Team hinzufügen (im Team-Text-Channel ausführen)')
      .addUserOption((o) => o.setName('user').setDescription('Person').setRequired(true)))
    .addSubcommand((s) => s
      .setName('leave')
      .setDescription('Dein Team verlassen — danach kannst du einem anderen beitreten'))
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
    return interaction.editReply(`⚠️ Ein Team-Channel **team-${s}** existiert schon. Wähle einen anderen Namen.`);
  }

  const own = teamRolesOf(interaction.member).first();
  if (own && !isExempt(interaction.member)) {
    return interaction.editReply(
      `⚠️ Du bist schon im Team **${teamName(own)}**. Pro Person ist ein Team möglich — `
      + 'mit `/team leave` steigst du dort aus und kannst danach ein neues anlegen.',
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

  await text.send(`👋 Willkommen im Team **${name}**! Nutzt \`/team add @person\` hier, um weitere Mitglieder aufzunehmen. Mit \`/team leave\` steigt ihr wieder aus — verlässt die letzte Person das Team, räumt der Bot Rolle und Räume auf. Denkt an euer Projekt in **#projekte** (Pitch-Video ≤2 min als externer Link).`);
  return interaction.editReply(`✅ Team **${name}** angelegt: <#${text.id}> + Voice. Rolle <@&${teamRole.id}> ist dir zugewiesen.`);
}

async function handleAdd(interaction) {
  const channel = interaction.channel;
  const match = channel?.topic?.match(/\[teamRole:(\d+)\]/);
  if (!match) {
    return interaction.editReply('⚠️ Bitte im **Text-Channel deines Teams** ausführen (dort ist die Team-Rolle hinterlegt).');
  }
  const roleId = match[1];
  const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
  if (!role) return interaction.editReply('⚠️ Team-Rolle nicht gefunden.');

  // Nur Teammitglieder (oder Orga) dürfen einladen
  const isMember = interaction.member.roles.cache.has(roleId);
  const isOrga = interaction.member.roles.cache.some((r) => r.name === 'Orga');
  if (!isMember && !isOrga) {
    return interaction.editReply('⚠️ Nur Mitglieder dieses Teams (oder Orga) können jemanden hinzufügen.');
  }

  const user = interaction.options.getUser('user');
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) return interaction.editReply('⚠️ Person nicht auf dem Server gefunden.');

  if (member.roles.cache.has(roleId)) {
    return interaction.editReply(`ℹ️ <@${user.id}> ist bereits in **${teamName(role)}**.`);
  }
  // Das Ein-Team-Limit gilt auch hier, sonst wäre /team add das Schlupfloch.
  const other = teamRolesOf(member).first();
  if (other && !isExempt(member)) {
    return interaction.editReply(
      `⚠️ <@${user.id}> ist schon im Team **${teamName(other)}**. `
      + 'Pro Person ist ein Team möglich — die Person muss dort erst `/team leave` machen.',
    );
  }

  await member.roles.add(role);
  return interaction.editReply(`✅ <@${user.id}> ist jetzt Teil von **${teamName(role)}**.`);
}

async function handleLeave(interaction) {
  const own = teamRolesOf(interaction.member);
  if (own.size === 0) return interaction.editReply('ℹ️ Du bist in keinem Team.');

  const names = own.map((r) => teamName(r)).join('**, **');
  await interaction.member.roles.remove([...own.keys()]);
  scheduleSweep(interaction.guild);
  return interaction.editReply(
    `✅ Du hast **${names}** verlassen. Bleibt ein Team ohne Mitglieder, räumt der Bot es `
    + `in ${EMPTY_GRACE_MS / 60_000} Minuten auf. Mit \`/team create\` kannst du jetzt ein neues anlegen.`,
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
  if (cleanupEnabled) {
    c.on(Events.GuildMemberUpdate, (before, after) => {
      const lost = before.roles.cache.some((r) => r.name.startsWith(TEAM_ROLE_PREFIX) && !after.roles.cache.has(r.id));
      if (lost) scheduleSweep(after.guild);
    });
    c.on(Events.GuildMemberRemove, (member) => scheduleSweep(member.guild));
  }

  c.on(Events.InteractionCreate, async (interaction) => {
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
