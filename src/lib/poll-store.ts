/**
 * Airtable access for the poll tool (HCK-30).
 *
 * The table is addressed by name by default, so it keeps working once
 * `PollAnswers` exists. Set AIRTABLE_POLL_TABLE_ID to pin it to a table id.
 */

import type { NewRow, PollRow } from './poll-answers';

const API = 'https://api.airtable.com/v0';

const baseId = () => import.meta.env.AIRTABLE_BASE_ID || 'appapD55EOTAiqT0I';
const tableRef = () => import.meta.env.AIRTABLE_POLL_TABLE_ID || 'PollAnswers';
const token = () => import.meta.env.AIRTABLE_PAT;

const endpoint = () => `${API}/${baseId()}/${encodeURIComponent(tableRef())}`;

async function airtable(url: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/** Session keys are uuids (plus an optional `test-` prefix): keep them formula-safe. */
export const safeSessionKey = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 80);

/** True when this session already submitted for this event. */
export async function hasSubmitted(event: string, sessionKey: string): Promise<boolean> {
  const formula = `AND({event}="${event}",{sessionKey}="${sessionKey}")`;
  const url = `${endpoint()}?maxRecords=1&filterByFormula=${encodeURIComponent(formula)}`;
  const data = await airtable(url);
  return Array.isArray(data.records) && data.records.length > 0;
}

/** Writes the rows of one submission. Airtable takes at most 10 records per request. */
export async function createRows(event: string, sessionKey: string, rows: NewRow[]) {
  const createdAt = new Date().toISOString();
  const records = rows.map((row) => ({
    fields: {
      event,
      sessionKey,
      questionId: row.questionId,
      answer: row.answer,
      createdAt,
    },
  }));

  for (let i = 0; i < records.length; i += 10) {
    await airtable(endpoint(), {
      method: 'POST',
      body: JSON.stringify({ typecast: true, records: records.slice(i, i + 10) }),
    });
  }
}

/** Reads every row of an event, following Airtable's `offset` pagination. */
export async function listRows(event: string): Promise<PollRow[]> {
  const formula = `{event}="${event}"`;
  const out: PollRow[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams({
      pageSize: '100',
      filterByFormula: formula,
    });
    params.append('fields[]', 'event');
    params.append('fields[]', 'sessionKey');
    params.append('fields[]', 'questionId');
    params.append('fields[]', 'answer');
    if (offset) params.set('offset', offset);

    const data = await airtable(`${endpoint()}?${params.toString()}`);
    for (const record of data.records ?? []) {
      const f = record.fields ?? {};
      out.push({
        event: String(f.event ?? ''),
        sessionKey: String(f.sessionKey ?? ''),
        questionId: String(f.questionId ?? ''),
        answer: String(f.answer ?? ''),
      });
    }
    offset = data.offset;
  } while (offset);

  return out;
}
