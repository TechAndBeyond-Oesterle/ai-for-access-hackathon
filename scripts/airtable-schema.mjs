#!/usr/bin/env node
/**
 * Idempotent Airtable schema setup for the poll tool (HCK-30).
 *
 * Creates the `PollAnswers` table if it is missing and adds any missing fields.
 * Airtable cannot delete tables or fields via API, so this script only adds.
 *
 * Usage:
 *   set -a; . path/to/.env; set +a
 *   node scripts/airtable-schema.mjs
 *
 * Env: AIRTABLE_PAT or AIRTABLE_API_KEY (required), AIRTABLE_BASE_ID (optional).
 */

const TOKEN = process.env.AIRTABLE_PAT || process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID || 'appapD55EOTAiqT0I';
const TABLE_NAME = 'PollAnswers';

const FIELDS = [
  { name: 'event', type: 'singleLineText' },
  { name: 'sessionKey', type: 'singleLineText' },
  { name: 'questionId', type: 'singleLineText' },
  { name: 'answer', type: 'singleLineText' },
  // SHA-256 of the lower-cased registration email, used for the one-answer check.
  { name: 'emailHash', type: 'singleLineText' },
  // Lower-cased registration email, kept so answers can be matched to participants (Jonas, 18.09.).
  { name: 'email', type: 'singleLineText' },
  // Link to the Registrations record when the address was found there.
  { name: 'registration', type: 'multipleRecordLinks', options: { linkedTableId: 'tblDlijXwL2EsAeRm' } },
  // yes, no or unknown: was that address found in the Registrations table?
  { name: 'registered', type: 'singleLineText' },
  {
    name: 'createdAt',
    type: 'dateTime',
    options: {
      timeZone: 'utc',
      dateFormat: { name: 'iso' },
      timeFormat: { name: '24hour' },
    },
  },
];

if (!TOKEN) {
  console.error('Missing AIRTABLE_PAT (or AIRTABLE_API_KEY) in the environment.');
  process.exit(1);
}

async function api(path, init = {}) {
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`Airtable ${res.status}: ${text}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

function scopeHint(err) {
  if (err.status === 403) {
    console.error('');
    console.error('403 from the Airtable Meta API.');
    console.error('The personal access token most likely lacks the scope `schema.bases:write`.');
    console.error('Add it in Airtable (Developer hub, personal access tokens), then re-run.');
  }
}

async function main() {
  console.log(`Base: ${BASE_ID}`);

  let tables;
  try {
    ({ tables } = await api('/tables'));
  } catch (err) {
    console.error(String(err.message));
    scopeHint(err);
    process.exit(2);
  }

  let table = tables.find((t) => t.name === TABLE_NAME);

  if (!table) {
    console.log(`Table "${TABLE_NAME}" not found, creating it.`);
    try {
      table = await api('/tables', {
        method: 'POST',
        body: JSON.stringify({
          name: TABLE_NAME,
          description: 'Live poll answers, one row per question and session (HCK-30).',
          fields: FIELDS,
        }),
      });
    } catch (err) {
      console.error(String(err.message));
      scopeHint(err);
      process.exit(3);
    }
    console.log(`Created table ${TABLE_NAME}`);
  } else {
    console.log(`Table "${TABLE_NAME}" already exists.`);
    const existing = new Set(table.fields.map((f) => f.name));
    const missing = FIELDS.filter((f) => !existing.has(f.name));
    if (!missing.length) {
      console.log('All fields present, nothing to add.');
    }
    for (const field of missing) {
      console.log(`Adding field ${field.name} (${field.type})`);
      try {
        await api(`/tables/${table.id}/fields`, {
          method: 'POST',
          body: JSON.stringify(field),
        });
      } catch (err) {
        console.error(String(err.message));
        scopeHint(err);
        process.exit(4);
      }
    }
  }

  console.log('');
  console.log(`AIRTABLE_POLL_TABLE_ID=${table.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
