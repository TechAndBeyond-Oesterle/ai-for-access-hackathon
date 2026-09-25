import type { APIRoute } from 'astro';
import { getPoll } from '../../../lib/polls';
import {
  countAnswers,
  hashEmail,
  isValidEmail,
  normalizeEmail,
  validateSubmission,
  type PollResults,
} from '../../../lib/poll-answers';
import {
  createRows,
  findRegistrationId,
  hasSubmittedEmail,
  listRows,
  pollDay,
  safeSessionKey,
} from '../../../lib/poll-store';

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

  const email = normalizeEmail(body?.email);
  if (!isValidEmail(email)) {
    return json({ error: 'Please enter the email you registered with' }, 400);
  }

  const validated = validateSubmission(poll, body?.answers);
  if (!validated.ok) {
    return json({ error: validated.error }, 400);
  }

  try {
    // The hash is the one-answer check. The address is stored as well so the
    // team can match answers to registrations (decided 18.09.).
    const emailHash = await hashEmail(email);
    if (await hasSubmittedEmail(event, emailHash, pollDay())) {
      return json({ ok: true, duplicate: true }, 200);
    }

    // Nice to know, never a gate: a failed lookup stays "unknown".
    let registered = 'unknown';
    let registrationId: string | null = null;
    try {
      registrationId = await findRegistrationId(email);
      registered = registrationId ? 'yes' : 'no';
    } catch (err) {
      console.error('[Poll] Registration lookup failed:', err);
    }

    await createRows(event, sessionKey, validated.rows, {
      emailHash,
      registered,
      email,
      registrationId,
    });
  } catch (err) {
    console.error('[Poll] Airtable error:', err);
    return json({ error: 'Could not save answers' }, 500);
  }

  cache.delete(`${event}:all`);
  cache.delete(`${event}:${pollDay()}`);
  return json({ ok: true, rows: validated.rows.length }, 200);
};

export const GET: APIRoute = async ({ params, request }) => {
  const event = String(params.event ?? '');
  const poll = getPoll(event);
  if (!poll) return json({ error: 'Unknown poll' }, 404);

  const headers = {
    'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=30',
  };

  const all = new URL(request.url).searchParams.get('all') === '1';
  const day = pollDay();
  const key = `${event}:${all ? 'all' : day}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return json(hit.data, 200, headers);
  }

  try {
    const rows = await listRows(event, all ? undefined : day);
    const data = countAnswers(event, poll, all
      ? rows.map((row) => ({
          ...row,
          sessionKey: row.createdAt
            ? `${row.sessionKey}:${pollDay(new Date(row.createdAt))}`
            : row.sessionKey,
        }))
      : rows);
    cache.set(key, { at: Date.now(), data });
    return json(data, 200, headers);
  } catch (err) {
    console.error('[Poll] Airtable error:', err);
    if (hit) return json(hit.data, 200, headers);
    return json({ error: 'Could not read answers' }, 500);
  }
};
