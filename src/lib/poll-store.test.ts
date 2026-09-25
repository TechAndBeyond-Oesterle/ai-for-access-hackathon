import { afterEach, expect, test } from 'bun:test';
import {
  createRows,
  hasSubmitted,
  hasSubmittedEmail,
  isRegistered,
  listRows,
  pollDay,
  safeFormulaValue,
  safeSessionKey,
} from './poll-store';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

type Call = { url: string; init?: RequestInit };

function stubFetch(responses: unknown[]) {
  const calls: Call[] = [];
  let i = 0;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const body = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return calls;
}

test('session keys are stripped to formula-safe characters', () => {
  expect(safeSessionKey('test-prod-1')).toBe('test-prod-1');
  expect(safeSessionKey('abc"),{x}=(1')).toBe('abcx1');
  expect(safeSessionKey(undefined)).toBe('');
  expect(safeSessionKey('a'.repeat(200))).toHaveLength(80);
});

test('a known session key is detected as a duplicate', async () => {
  const calls = stubFetch([{ records: [{ id: 'rec1' }] }]);
  expect(await hasSubmitted('infosession', 'abc-123')).toBe(true);
  expect(calls[0].url).toContain('maxRecords=1');
  expect(decodeURIComponent(calls[0].url)).toContain(
    'AND({event}="infosession",{sessionKey}="abc-123")',
  );
});

test('an unknown session key is not a duplicate', async () => {
  stubFetch([{ records: [] }]);
  expect(await hasSubmitted('infosession', 'fresh-key')).toBe(false);
});

test('rows are written in batches of ten', async () => {
  const calls = stubFetch([{ records: [] }]);
  const rows = Array.from({ length: 23 }, (_, i) => ({ questionId: `q${i}`, answer: 'x' }));
  await createRows('infosession', 'abc-123', rows);

  expect(calls).toHaveLength(3);
  const sizes = calls.map((c) => JSON.parse(String(c.init?.body)).records.length);
  expect(sizes).toEqual([10, 10, 3]);

  const first = JSON.parse(String(calls[0].init?.body)).records[0].fields;
  expect(first.event).toBe('infosession');
  expect(first.sessionKey).toBe('abc-123');
  expect(typeof first.createdAt).toBe('string');
});

test('listing follows Airtable pagination', async () => {
  const calls = stubFetch([
    {
      records: [
        { fields: { event: 'infosession', sessionKey: 'a', questionId: 'q1', answer: 'Other' } },
      ],
      offset: 'page2',
    },
    {
      records: [
        { fields: { event: 'infosession', sessionKey: 'b', questionId: 'q1', answer: 'Other' } },
      ],
    },
  ]);

  const rows = await listRows('infosession');
  expect(calls).toHaveLength(2);
  expect(calls[1].url).toContain('offset=page2');
  expect(rows.map((r) => r.sessionKey)).toEqual(['a', 'b']);
});

test('formula values lose quotes and backslashes', () => {
  expect(safeFormulaValue('anna@example.ch')).toBe('anna@example.ch');
  expect(safeFormulaValue('a"),{x}=(1')).toBe('a),{x}=(1');
  expect(safeFormulaValue('back\\slash')).toBe('backslash');
  expect(safeFormulaValue(undefined)).toBe('');
});

test('poll days follow Bern time on either side of midnight and DST', () => {
  expect(pollDay(new Date('2026-09-24T21:59:59Z'))).toBe('2026-09-24');
  expect(pollDay(new Date('2026-09-24T22:00:00Z'))).toBe('2026-09-25');
  expect(pollDay(new Date('2026-12-24T23:00:00Z'))).toBe('2026-12-25');
});

test('today only filters answers in Airtable, while all-time reads every day', async () => {
  const calls = stubFetch([{ records: [] }]);
  await listRows('infosession', '2026-09-25');
  await listRows('infosession');
  expect(decodeURIComponent(calls[0].url)).toContain(
    `DATETIME_FORMAT(SET_TIMEZONE({createdAt},'Europe/Zurich'),'YYYY-MM-DD')="2026-09-25"`,
  );
  expect(decodeURIComponent(calls[1].url)).toContain('filterByFormula={event}="infosession"');
});

test('a known email hash is detected as a duplicate', async () => {
  const calls = stubFetch([{ records: [{ id: 'rec1' }] }]);
  expect(await hasSubmittedEmail('infosession', 'abc123', '2026-09-25')).toBe(true);
  expect(calls[0].url).toContain('maxRecords=1');
  expect(decodeURIComponent(calls[0].url)).toContain(
    `AND({event}="infosession",{emailHash}="abc123",DATETIME_FORMAT(SET_TIMEZONE({createdAt},'Europe/Zurich'),'YYYY-MM-DD')="2026-09-25")`,
  );
});

test('an unknown email hash is not a duplicate', async () => {
  stubFetch([{ records: [] }]);
  expect(await hasSubmittedEmail('infosession', 'fresh-hash', '2026-09-25')).toBe(false);
});

test('the registration lookup asks the Registrations table for the address', async () => {
  const calls = stubFetch([{ records: [{ id: 'rec1' }] }]);
  expect(await isRegistered('Anna@Example.ch')).toBe(true);
  expect(decodeURIComponent(calls[0].url)).toContain('LOWER({E-Mail})="anna@example.ch"');

  stubFetch([{ records: [] }]);
  expect(await isRegistered('nobody@example.ch')).toBe(false);
});

test('submission meta is written on every row, the address never is', async () => {
  const calls = stubFetch([{ records: [] }]);
  await createRows('infosession', 'abc-123', [{ questionId: 'q1', answer: 'Other' }], {
    emailHash: 'deadbeef',
    registered: 'yes',
  });

  const body = String(calls[0].init?.body);
  const fields = JSON.parse(body).records[0].fields;
  expect(fields.emailHash).toBe('deadbeef');
  expect(fields.registered).toBe('yes');
  expect(fields.email).toBeUndefined();
  expect(body).not.toContain('@');
});
