export const ROLES = ['Participant', 'Mentor/Coach', 'Volunteer', 'Jury', 'Organizer', 'Sponsor/Partner', 'Other'] as const;

export const PARTICIPANT_CONFLICTS = ['Mentor/Coach', 'Volunteer', 'Jury'] as const;

export function hasRoleConflict(roles: readonly string[]): boolean {
  return roles.includes('Participant') && PARTICIPANT_CONFLICTS.some((role) => roles.includes(role));
}
