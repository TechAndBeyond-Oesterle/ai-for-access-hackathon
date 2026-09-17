import { afterEach, expect, test } from 'bun:test';
import { createRows, hasSubmitted, listRows, safeSessionKey } from './poll-store';

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
