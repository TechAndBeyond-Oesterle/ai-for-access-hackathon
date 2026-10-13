export const ROLES = ['Participant', 'Mentor/Coach', 'Volunteer', 'Jury', 'Sponsor/Partner', 'Other'] as const;

export const PARTICIPANT_CONFLICTS = ['Mentor/Coach', 'Volunteer', 'Jury'] as const;

export function hasRoleConflict(roles: readonly string[]): boolean {
  return roles.includes('Participant') && PARTICIPANT_CONFLICTS.some((role) => roles.includes(role));
}

// Each invite gives its Discord role on join. Jury > Mentor; everyone else gets the participant invite.
export const DISCORD_INVITES = {
  participant: 'https://discord.gg/J83cyMN429',
  mentor: 'https://discord.gg/SyqJ9y3CTH',
  jury: 'https://discord.gg/mdnAFpJUVF',
} as const;

export function discordInvite(roles: readonly string[]): string {
  if (roles.includes('Jury')) return DISCORD_INVITES.jury;
  if (roles.includes('Mentor/Coach')) return DISCORD_INVITES.mentor;
  return DISCORD_INVITES.participant;
}
