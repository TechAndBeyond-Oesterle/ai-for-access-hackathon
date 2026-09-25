import { expect, test } from 'bun:test';
import { matchingFields, SKILL_AREAS } from './matching-fields';

const levels = Object.fromEntries(SKILL_AREAS.map((area) => [area.value, 'NA']));

test('pre-match answers preserve skills and only allow eligible teammate suggestions', () => {
  const solo = matchingFields({
    skills: ['Data'],
    skillLevels: { ...levels, Data: 'Experienced' },
    teamStatus: 'No team',
  });
  expect(solo?.['Skill level: Data']).toBe('Experienced');
  expect(solo?.['Wants teammate suggestions']).toBe('Yes');
  expect(solo?.['Current team size']).toBeNull();
  expect(solo?.['Team name']).toBe('');

  expect(matchingFields({
    skills: ['Data'], skillLevels: levels, teamStatus: 'No team', wantsTeammates: true,
  })).toBeNull();
  expect(matchingFields({
    skills: [], skillLevels: levels, teamStatus: 'No team',
  })).toBeNull();
  expect(matchingFields({
    skills: ['Data'], skillLevels: { ...levels, Data: 'Experienced' }, teamStatus: 'Partly formed', teamName: 'Team A', teamSize: 4, wantsTeammates: true,
  })).toBeNull();
  expect(matchingFields({
    skills: ['Data'], skillLevels: { ...levels, Data: 'Experienced' }, teamStatus: 'Complete team', teamName: 'Team A',
  })?.['Wants teammate suggestions']).toBe('No');
});
