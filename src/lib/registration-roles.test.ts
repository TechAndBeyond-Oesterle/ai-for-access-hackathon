import { expect, test } from 'bun:test';
import { DISCORD_INVITES, discordInvite, hasRoleConflict } from './registration-roles';

test('participant cannot also be mentor, volunteer or jury', () => {
  for (const role of ['Mentor/Coach', 'Volunteer', 'Jury']) {
    expect(hasRoleConflict(['Participant', role])).toBe(true);
    expect(hasRoleConflict([role])).toBe(false);
  }
  expect(hasRoleConflict(['Participant', 'Sponsor/Partner', 'Other'])).toBe(false);
});

test('discord invite follows the selected role', () => {
  expect(discordInvite(['Participant'])).toBe(DISCORD_INVITES.participant);
  expect(discordInvite(['Mentor/Coach'])).toBe(DISCORD_INVITES.mentor);
  expect(discordInvite(['Jury'])).toBe(DISCORD_INVITES.jury);
  expect(discordInvite(['Mentor/Coach', 'Jury'])).toBe(DISCORD_INVITES.jury);
  expect(discordInvite(['Volunteer', 'Other'])).toBe(DISCORD_INVITES.participant);
});
