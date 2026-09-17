import { expect, test } from 'bun:test';
import { constantTimeEquals, resultsKeyOk } from './poll-auth';

const KEY = '39e1de79eeae9d80af67a1dd';

test('the right key opens the results', () => {
  expect(resultsKeyOk(KEY, KEY)).toBe(true);
  expect(resultsKeyOk(KEY, ` ${KEY} `)).toBe(true);
});

test('a missing key is rejected', () => {
  expect(resultsKeyOk(null, KEY)).toBe(false);
  expect(resultsKeyOk('', KEY)).toBe(false);
  expect(resultsKeyOk(undefined, KEY)).toBe(false);
});

test('a wrong key is rejected, including prefixes and case changes', () => {
  expect(resultsKeyOk('nope', KEY)).toBe(false);
  expect(resultsKeyOk(KEY.slice(0, -1), KEY)).toBe(false);
  expect(resultsKeyOk(`${KEY}x`, KEY)).toBe(false);
  expect(resultsKeyOk(KEY.toUpperCase(), KEY)).toBe(false);
});

test('an unset env key locks the page instead of opening it', () => {
  expect(resultsKeyOk(KEY, undefined)).toBe(false);
  expect(resultsKeyOk(KEY, '')).toBe(false);
  expect(resultsKeyOk('', '')).toBe(false);
  expect(resultsKeyOk(null, '   ')).toBe(false);
});

test('the comparison stays exact', () => {
  expect(constantTimeEquals('abc', 'abc')).toBe(true);
  expect(constantTimeEquals('abc', 'abd')).toBe(false);
  expect(constantTimeEquals('abc', 'ab')).toBe(false);
  expect(constantTimeEquals('', '')).toBe(true);
});
