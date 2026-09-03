import { readFile } from 'node:fs/promises';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, MessageFlags, PermissionsBitField } from 'discord.js';

export const SKILL_ROLES = [
  { key: 'dev', emoji: '💻', names: ['Dev'] },
  { key: 'design', emoji: '🎨', names: ['Design'] },
  { key: 'domain', emoji: '🧠', names: ['Domain-Expert', 'Domain Expert'] },
  { key: 'pm', emoji: '📊', names: ['PM / Business'] },
  { key: 'newcomer', emoji: '✨', names: ['Newcomer'] },
];
export const ROLE_POST_MARKER = '-# ⟨post:choose-your-role⟩';
const CHANNEL_NAMES = ['choose-your-role', 'rollen-waehlen'];
const F = PermissionsBitField.Flags;

export function isSkillButton(interaction) {
  return interaction.isButton() && interaction.customId.startsWith('skill-role:');
}

export function roleButtons() {
  // Öffentlich identische Buttons: die Auswahl einer Person nie für alle einfärben.
  return [new ActionRowBuilder().addComponents(SKILL_ROLES.map((skill) => new ButtonBuilder()
    .setCustomId(`skill-role:${skill.key}`).setLabel(skill.names[0])
    .setEmoji(skill.emoji).setStyle(ButtonStyle.Secondary))).toJSON()];
}

export function isRolePost(message, botId) {
  return message.author?.id === botId && (
    message.content?.includes(ROLE_POST_MARKER)
    || message.content?.startsWith('🎭 **Wähle deine Skill-Tags**')
  );
}

export function assertSkillRole(role) {
  if (!role || role.managed || !role.editable || role.permissions.bitfield !== 0n) {
    throw new Error(`Skill-Rolle fehlt, ist nicht verwaltbar oder hat Rechte: ${role?.name ?? 'unbekannt'}`);
  }
}

/** Nur eigene markierte Posts bzw. der bekannte deutsche Seed werden übernommen. */
async function findRolePost(channel, botId) {
  let before;
  let legacy;
  do {
    const page = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    for (const message of page.values()) {
      if (!isRolePost(message, botId)) continue;
      if (message.content.includes(ROLE_POST_MARKER)) return message;
      legacy ??= message;
    }
    if (page.size < 100) break;
    before = page.last().id;
  } while (before);
  return legacy;
}

export async function loadRolePost() {
  const raw = await readFile(new URL('./posts/choose-your-role.md', import.meta.url), 'utf8');
  const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();
  const content = `${body}\n\n${ROLE_POST_MARKER}`;
  if (content.length > 2000) throw new Error('Skill-Post überschreitet 2000 Zeichen.');
  return content;
}

/**
 * Genau ein Post im Zielserver. Single-Role-REST-Operationen lassen andere Rollen in Ruhe.
 * Die Queue erhält die Reihenfolge bei schnellen Klicks; vor jedem Toggle frisch lesen.
 */
export function createRoleButtons(guild, botId, { report = console.error } = {}) {
  let message;
  let queue = Promise.resolve();
  const enqueue = (job) => {
    const result = queue.then(job);
    queue = result.catch(() => {});
    return result;
  };

  async function resolveRole(skill) {
    // Frisch prüfen: eine nachträglich privilegierte Rolle nie zur Selbstvergabe nutzen.
    const roles = await guild.roles.fetch();
    const matches = roles.filter((r) => skill.names.includes(r.name));
    if (matches.size !== 1) throw new Error(`Skill-Rolle nicht eindeutig: ${skill.names[0]}`);
    const role = matches.first();
    assertSkillRole(role);
    return role;
  }

  return {
    initialize: (content) => enqueue(async () => {
      message = null;
      await guild.channels.fetch();
      const channels = guild.channels.cache.filter(
        (c) => c.type === ChannelType.GuildText && CHANNEL_NAMES.includes(c.name),
      );
      if (channels.size !== 1) throw new Error('Genau ein Skill-Rollenkanal erforderlich.');
      const channel = channels.first();
      const me = await guild.members.fetchMe();
      if (!me.permissions.has(F.ManageRoles)
        || !channel.permissionsFor(me)?.has([F.ViewChannel, F.ReadMessageHistory, F.SendMessages])) {
        throw new Error('Rollen-Buttons: Bot braucht Rollenverwaltung und Lese-/Schreibrechte im Rollenkanal.');
      }
      // Vor jeglichem Post-Edit müssen alle fünf Rollen geprüft sein.
      await Promise.all(SKILL_ROLES.map(resolveRole));
      const existing = await findRolePost(channel, botId);
      const components = roleButtons();
      const payload = { content, components, allowedMentions: { parse: [] } };
      const target = existing
        ? await existing.edit(payload)
        : await channel.send(payload);
      // Migration nur der Oberfläche: bestehende Rollen bleiben unverändert.
      // Alte Reaktionen werden nie mehr eingelesen, auch nicht nach einem Neustart.
      if (target.reactions.cache.size && channel.permissionsFor(me)?.has(F.ManageMessages)) {
        await target.reactions.removeAll().catch((err) => report(`Alte Skill-Reaktionen: ${err.message}`));
      }
      message = target;
      return message;
    }),

    handle: async (interaction) => {
      if (!isSkillButton(interaction)) return false;
      // Vor jeder REST-Abfrage und vor dem Warten auf die Queue bestätigen (<3 s).
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const result = await enqueue(async () => {
        const skill = SKILL_ROLES.find((s) => interaction.customId === `skill-role:${s.key}`);
        if (!message || !skill || interaction.user.bot
          || interaction.guildId !== guild.id || interaction.channelId !== message.channelId
          || interaction.message.id !== message.id) {
          return '⚠️ This role button is unavailable. Please use the current post in #choose-your-role.';
        }
        try {
          const role = await resolveRole(skill);
          const member = await guild.members.fetch({ user: interaction.user.id, force: true });
          const remove = member.roles.cache.has(role.id);
          const updated = remove
            ? await member.roles.remove(role.id, 'Skill-Button: entfernen')
            : await member.roles.add(role.id, 'Skill-Button: hinzufügen');
          const selected = SKILL_ROLES.filter((s) => updated.roles.cache.some((r) => s.names.includes(r.name)))
            .map((s) => s.names[0]).join(' · ') || 'none yet';
          return `✅ **${skill.names[0]}** ${remove ? 'removed' : 'added'}.\nYour skill tags: **${selected}**.`;
        } catch (err) {
          report(`Skill-Button fehlgeschlagen: ${err.message}`);
          return '⚠️ I could not update your role. Please try again or contact the organizers.';
        }
      });
      await interaction.editReply({ content: result, allowedMentions: { parse: [] } });
      return true;
    },
  };
}
