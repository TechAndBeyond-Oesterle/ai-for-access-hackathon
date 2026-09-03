/**
 * Reine Regel-Logik des Team-Bots — ohne Discord-Aufrufe, damit sie ohne Server
 * und ohne Token testbar ist (`npm test`). Der Bot selbst (bot.mjs) macht daraus
 * die eigentlichen Aktionen.
 *
 * Regeln aus dem Orga-Meeting 03.09.2026:
 *   - Eine Person ist in höchstens einem Team (Ausnahme: Orga / Administrator).
 *   - Ein Team ohne Mitglieder wird nach einer Karenzzeit gelöscht.
 */

import { PermissionsBitField, ChannelType } from 'discord.js';

export const TEAM_ROLE_PREFIX = 'Team: ';
export const EXEMPT_ROLES = ['Orga'];

/** Channel-tauglicher Name aus einem freien Team-Namen. */
export const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '')
  .trim().replace(/\s+/g, '-').slice(0, 24) || 'team';

/** "Team: Nachtschicht" → "Nachtschicht" */
export const teamName = (role) => role.name.slice(TEAM_ROLE_PREFIX.length);

/** Team-Rollen einer Person; Skill-Tags (Dev/Design/…) bleiben außen vor. */
export const teamRolesOf = (member) =>
  member.roles.cache.filter((r) => r.name.startsWith(TEAM_ROLE_PREFIX));

/** Orga und Admins dürfen mehrere Teams begleiten, alle anderen genau eins. */
export const isExempt = (member) =>
  member.permissions.has(PermissionsBitField.Flags.Administrator)
  || member.roles.cache.some((r) => EXEMPT_ROLES.includes(r.name));

/**
 * Text- und Voice-Channel eines Teams.
 * Primär über die Marker im Topic; für Teams, die vor dem [teamVoice:…]-Marker
 * angelegt wurden, greift das Namensschema als Fallback.
 */
export function channelsOfTeam(guild, roleId) {
  const text = guild.channels.cache.find((c) => c.topic?.includes(`[teamRole:${roleId}]`));
  const voiceId = text?.topic?.match(/\[teamVoice:(\d+)\]/)?.[1];
  const voice = (voiceId && guild.channels.cache.get(voiceId))
    || (text && guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildVoice && c.name === `${text.name}-voice`,
    ))
    || null;
  return { text, voice: voice || null };
}

/**
 * Entscheidet über ein leeres Team: löschen, oder noch warten?
 * `since` = Zeitpunkt, seit dem es leer ist (null = gerade erst festgestellt).
 */
export function emptyTeamVerdict({ memberCount, since, now = Date.now(), graceMs }) {
  if (memberCount > 0) return { action: 'keep', waitedMs: 0 };
  const start = since ?? now;
  const waitedMs = now - start;
  return { action: waitedMs >= graceMs ? 'delete' : 'wait', waitedMs, since: start };
}
