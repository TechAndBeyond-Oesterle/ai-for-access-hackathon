import type { APIRoute } from 'astro';
import { getPoll } from '../../../lib/polls';
import { countAnswers, validateSubmission, type PollResults } from '../../../lib/poll-answers';
import { createRows, hasSubmitted, listRows, safeSessionKey } from '../../../lib/poll-store';

export const prerender = false;

/** Short module cache so several open result screens do not hammer Airtable. */
const CACHE_MS = 5000;
const cache = new Map<string, { at: number; data: PollResults }>();

const json = (data: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

export const POST: APIRoute = async ({ params, request }) => {
  const event = String(params.event ?? '');
  const poll = getPoll(event);
  if (!poll) return json({ error: 'Unknown poll' }, 404);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const sessionKey = safeSessionKey(body?.sessionKey);
  if (sessionKey.length < 8) {
    return json({ error: 'Missing sessionKey' }, 400);
  }

  const validated = validateSubmission(poll, body?.answers);
  if (!validated.ok) {
    return json({ error: validated.error }, 400);
  }

  try {
    if (await hasSubmitted(event, sessionKey)) {
      return json({ ok: true, duplicate: true }, 200);
    }
    await createRows(event, sessionKey, validated.rows);
  } catch (err) {
    console.error('[Poll] Airtable error:', err);
    return json({ error: 'Could not save answers' }, 500);
  }

  cache.delete(event);
  return json({ ok: true, rows: validated.rows.length }, 200);
};

export const GET: APIRoute = async ({ params }) => {
  const event = String(params.event ?? '');
  const poll = getPoll(event);
  if (!poll) return json({ error: 'Unknown poll' }, 404);

  const headers = {
    'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=30',
  };

  const hit = cache.get(event);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return json(hit.data, 200, headers);
  }

  try {
    const rows = await listRows(event);
    const data = countAnswers(event, poll, rows);
    cache.set(event, { at: Date.now(), data });
    return json(data, 200, headers);
  } catch (err) {
    console.error('[Poll] Airtable error:', err);
    if (hit) return json(hit.data, 200, headers);
    return json({ error: 'Could not read answers' }, 500);
  }
};
