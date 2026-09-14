import { expect, test } from 'bun:test';
import { companyOrOrganisation } from './challenges';

test('stores the challenge source in the existing organisation field', () => {
  expect(companyOrOrganisation(true, 'Example AG')).toBe('Example AG');
  expect(companyOrOrganisation(false)).toBe('Personal idea');
});
