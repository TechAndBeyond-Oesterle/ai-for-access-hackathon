import { afterEach, expect, test } from 'bun:test';
import { GET } from './[event]';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test('all-time results count separate days from the same browser as separate rounds', async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ records: [
    { fields: { event: 'infosession', sessionKey: 'same-browser', questionId: 'q1', answer: 'Other', createdAt: '2026-09-18T10:00:00Z' } },
    { fields: { event: 'infosession', sessionKey: 'same-browser', questionId: 'q1', answer: 'Designer or product', createdAt: '2026-09-25T10:00:00Z' } },
  ] }))) as typeof fetch;

  const request = new Request('http://localhost/api/poll/infosession?all=1');
  const response = await GET({ params: { event: 'infosession' }, request } as unknown as Parameters<typeof GET>[0]);
  const results = await response.json();
  const background = results.questions.find((question: { id: string }) => question.id === 'q1');

  expect(results.total).toBe(2);
  expect(background.responses).toBe(2);
  expect(background.options.find((option: { label: string }) => option.label === 'Other').count).toBe(1);
  expect(background.options.find((option: { label: string }) => option.label === 'Designer or product').count).toBe(1);
});
