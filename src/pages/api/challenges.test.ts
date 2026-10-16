import { expect, test } from 'bun:test';
import { MAX_TOTAL_BYTES, companyOrOrganisation, filesError } from './challenges';

test('stores the challenge source in the existing organisation field', () => {
  expect(companyOrOrganisation(true, 'Example AG')).toBe('Example AG');
  expect(companyOrOrganisation(false)).toBe('Personal idea');
});

test('limits attachments by count and total size', () => {
  const file = (size: number) => new File([new Uint8Array(size)], 'data.csv');
  expect(filesError([])).toBeNull();
  expect(filesError([file(1000), file(1000)])).toBeNull();
  expect(filesError(Array.from({ length: 6 }, () => file(1)))).toBe('Too many files');
  expect(filesError([file(MAX_TOTAL_BYTES), file(1)])).toBe('Files too large');
});
