import { readFile } from 'node:fs/promises';
import { ChannelType, PermissionsBitField } from 'discord.js';

export const SKILL_ROLES = [
  { emoji: '💻', names: ['Dev'] },
  { emoji: '🎨', names: ['Design'] },
  { emoji: '🧠', names: ['Domain-Expert', 'Domain Expert'] },
  { emoji: '📊', names: ['PM / Business'] },
  { emoji: '✨', names: ['Newcomer'] },
];
export const ROLE_POST_MARKER = '-# ⟨post:choose-your-role⟩';
const CHANNEL_NAMES = ['choose-your-role', 'rollen-waehlen'];
const F = PermissionsBitField.Flags;

export function skillForEmoji(emoji) {
  // Custom Emojis mit gleichem Namen sind keine erlaubten Skill-Reaktionen.
  return !emoji.id && SKILL_ROLES.find((s) => s.emoji === emoji.name);
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
 * Die Queue erhält die Reihenfolge auch bei schnellem Add → Remove und kaltem Cache.
 */
export function createReactionRoles(guild, botId, { report = console.error } = {}) {
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
      await guild.channels.fetch();
      const channels = guild.channels.cache.filter(
        (c) => c.type === ChannelType.GuildText && CHANNEL_NAMES.includes(c.name),
      );
      if (channels.size !== 1) throw new Error('Genau ein Skill-Rollenkanal erforderlich.');
      const channel = channels.first();
      const me = await guild.members.fetchMe();
      if (!me.permissions.has(F.ManageRoles)
        || !channel.permissionsFor(me)?.has([F.ViewChannel, F.ReadMessageHistory, F.SendMessages, F.AddReactions])) {
        throw new Error('Reaction-Roles: Bot braucht Rollenverwaltung und Lese-/Schreib-/Reaktionsrechte im Rollenkanal.');
      }
      // Vor jeglichem Post-Edit müssen alle fünf Rollen geprüft sein.
      const roles = await Promise.all(SKILL_ROLES.map(resolveRole));
      const existing = await findRolePost(channel, botId);
      const target = existing
        ? (existing.content === content ? existing : await existing.edit(content))
        : await channel.send({ content, allowedMentions: { parse: [] } });
      for (const skill of SKILL_ROLES) await target.react(skill.emoji);
      message = target;

      // Bereits abgegebene Stimmen nach Erstaktivierung/Neustart nachtragen (paginieren).
      // Keine Rollen ohne Reaktion entfernen: diese könnten manuell vergeben worden sein.
      for (const [index, skill] of SKILL_ROLES.entries()) {
        const reaction = target.reactions.cache.find((r) => skillForEmoji(r.emoji) === skill);
        if (!reaction) continue;
        let after;
        do {
          const users = await reaction.users.fetch({ limit: 100, ...(after ? { after } : {}) });
          for (const user of users.values()) {
            if (user.bot) continue;
            try {
              const member = await guild.members.fetch(user.id);
              await member.roles.add(roles[index].id, 'Skill-Reaktion beim Bot-Start');
            } catch (err) {
              report(`Reaction-Roles: Stimme nicht nachgetragen (${user.id}): ${err.message}`);
            }
          }
          if (users.size < 100) break;
          after = users.last().id;
        } while (after);
      }
      return message;
    }),

    handle: (reaction, user, added) => enqueue(async () => {
      const skill = skillForEmoji(reaction.emoji);
      if (!message || user.bot || user.id === botId || !skill
        || reaction.message.guildId !== guild.id
        || reaction.message.channelId !== message.channelId
        || reaction.message.id !== message.id) return false;

      // Beim Entfernen der letzten Reaktion ist reaction.fetch() nicht zuverlässig.
      // IDs aus Partial-Reaktionen reichen; nur Mitglied und Rolle frisch abrufen.
      const role = await resolveRole(skill);
      const member = await guild.members.fetch(user.id);
      if (member.user.bot) return false;
      if (added) await member.roles.add(role.id, 'Skill-Reaktion hinzugefügt');
      else await member.roles.remove(role.id, 'Skill-Reaktion entfernt');
      return true;
    }),
  };
}
