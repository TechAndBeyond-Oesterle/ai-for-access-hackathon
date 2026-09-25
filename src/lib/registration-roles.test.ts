import { expect, test } from 'bun:test';
import { hasRoleConflict } from './registration-roles';

test('participant cannot also be mentor, volunteer or jury', () => {
  for (const role of ['Mentor/Coach', 'Volunteer', 'Jury']) {
    expect(hasRoleConflict(['Participant', role])).toBe(true);
    expect(hasRoleConflict([role])).toBe(false);
  }
  expect(hasRoleConflict(['Participant', 'Organizer', 'Other'])).toBe(false);
});
