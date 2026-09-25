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
const registrationsRef = () =>
  import.meta.env.AIRTABLE_REGISTRATIONS_TABLE_ID || 'tblDlijXwL2EsAeRm';
const token = () => import.meta.env.AIRTABLE_PAT;

const endpoint = () => `${API}/${baseId()}/${encodeURIComponent(tableRef())}`;
const registrationsEndpoint = () =>
  `${API}/${baseId()}/${encodeURIComponent(registrationsRef())}`;

export const pollDay = (date = new Date()): string => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
};

const dayFormula = (day: string) =>
  `DATETIME_FORMAT(SET_TIMEZONE({createdAt},'Europe/Zurich'),'YYYY-MM-DD')="${day}"`;

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

/** Quotes and backslashes would break out of an Airtable formula string. */
export const safeFormulaValue = (value: unknown): string =>
  String(value ?? '')
    .replace(/["\\]/g, '')
    .replace(/[\u0000-\u001f]/g, '')
    .slice(0, 254);

/** True when this session already submitted for this event. */
export async function hasSubmitted(event: string, sessionKey: string): Promise<boolean> {
  const formula = `AND({event}="${event}",{sessionKey}="${sessionKey}")`;
  const url = `${endpoint()}?maxRecords=1&filterByFormula=${encodeURIComponent(formula)}`;
  const data = await airtable(url);
  return Array.isArray(data.records) && data.records.length > 0;
}

/** True when this person already answered this poll. One email, one answer. */
export async function hasSubmittedEmail(event: string, emailHash: string, day: string): Promise<boolean> {
  const formula = `AND({event}="${event}",{emailHash}="${safeFormulaValue(emailHash)}",${dayFormula(day)})`;
  const url = `${endpoint()}?maxRecords=1&filterByFormula=${encodeURIComponent(formula)}`;
  const data = await airtable(url);
  return Array.isArray(data.records) && data.records.length > 0;
}

/**
 * Looks the address up in the Registrations table and returns the record id,
 * or null when it is not registered. The caller treats every error as
 * "unknown": this never blocks a submission.
 */
export async function findRegistrationId(email: string): Promise<string | null> {
  const formula = `LOWER({E-Mail})="${safeFormulaValue(email).toLowerCase()}"`;
  const params = new URLSearchParams({
    maxRecords: '1',
    filterByFormula: formula,
  });
  params.append('fields[]', 'E-Mail');
  const data = await airtable(`${registrationsEndpoint()}?${params.toString()}`);
  const first = Array.isArray(data.records) ? data.records[0] : undefined;
  return first && typeof first.id === 'string' ? first.id : null;
}

/** True when the address exists in the Registrations table. */
export async function isRegistered(email: string): Promise<boolean> {
  return (await findRegistrationId(email)) !== null;
}

export type SubmissionMeta = {
  emailHash: string;
  registered: string;
  /** Lower-cased registration email, stored so answers can be matched to participants. */
  email?: string;
  /** Registrations record id when the address was found there. */
  registrationId?: string | null;
};

/** Writes the rows of one submission. Airtable takes at most 10 records per request. */
export async function createRows(
  event: string,
  sessionKey: string,
  rows: NewRow[],
  meta?: SubmissionMeta,
) {
  const createdAt = new Date().toISOString();
  const records = rows.map((row) => ({
    fields: {
      event,
      sessionKey,
      questionId: row.questionId,
      answer: row.answer,
      createdAt,
      ...(meta
        ? {
            emailHash: meta.emailHash,
            registered: meta.registered,
            ...(meta.email ? { email: meta.email } : {}),
            ...(meta.registrationId ? { registration: [meta.registrationId] } : {}),
          }
        : {}),
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
export async function listRows(event: string, day?: string): Promise<PollRow[]> {
  const formula = day ? `AND({event}="${event}",${dayFormula(day)})` : `{event}="${event}"`;
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
    params.append('fields[]', 'createdAt');
    if (offset) params.set('offset', offset);

    const data = await airtable(`${endpoint()}?${params.toString()}`);
    for (const record of data.records ?? []) {
      const f = record.fields ?? {};
      out.push({
        event: String(f.event ?? ''),
        sessionKey: String(f.sessionKey ?? ''),
        questionId: String(f.questionId ?? ''),
        answer: String(f.answer ?? ''),
        createdAt: f.createdAt ? String(f.createdAt) : undefined,
      });
    }
    offset = data.offset;
  } while (offset);

  return out;
}
