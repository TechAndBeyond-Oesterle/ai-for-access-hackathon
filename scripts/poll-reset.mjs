#!/usr/bin/env node
/**
 * Clears poll answers of one event (HCK-30). Dry run by default.
 *
 * Use it to take the team's test submissions out of `PollAnswers` before a
 * real session starts. Without `--yes` the script only reports what it found.
 *
 * Usage:
 *   set -a; . path/to/.env; set +a
 *   node scripts/poll-reset.mjs --event infosession            # dry run
 *   node scripts/poll-reset.mjs --event infosession --only-test --yes
 *   node scripts/poll-reset.mjs --event infosession --yes      # deletes all rows
 *
 * Env: AIRTABLE_PAT or AIRTABLE_API_KEY (required), AIRTABLE_BASE_ID,
 *      AIRTABLE_POLL_TABLE_ID (both optional).
 */

const TOKEN = process.env.AIRTABLE_PAT || process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID || 'appapD55EOTAiqT0I';
const TABLE = process.env.AIRTABLE_POLL_TABLE_ID || 'PollAnswers';
const TEST_PREFIX = 'test-';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const EVENT = value('event', 'infosession');
const ONLY_TEST = flag('only-test');
const CONFIRMED = flag('yes');

if (!TOKEN) {
  console.error('Missing AIRTABLE_PAT (or AIRTABLE_API_KEY) in the environment.');
  process.exit(1);
}

const endpoint = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}`;

async function airtable(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function listRows() {
  const out = [];
  let offset;
  do {
    const params = new URLSearchParams({
      pageSize: '100',
      filterByFormula: `{event}="${EVENT}"`,
    });
    for (const field of ['event', 'sessionKey', 'questionId', 'emailHash', 'createdAt']) {
      params.append('fields[]', field);
    }
    if (offset) params.set('offset', offset);
    const data = await airtable(`${endpoint}?${params.toString()}`);
    for (const record of data.records ?? []) {
      out.push({ id: record.id, ...(record.fields ?? {}) });
    }
    offset = data.offset;
  } while (offset);
  return out;
}

async function deleteRows(ids) {
  let done = 0;
  for (let i = 0; i < ids.length; i += 10) {
    const params = new URLSearchParams();
    for (const id of ids.slice(i, i + 10)) params.append('records[]', id);
    await airtable(`${endpoint}?${params.toString()}`, { method: 'DELETE' });
    done += Math.min(10, ids.length - i);
    console.log(`  deleted ${done}/${ids.length}`);
  }
}

async function main() {
  console.log(`Base: ${BASE_ID}, table: ${TABLE}, event: ${EVENT}`);

  const rows = await listRows();
  const targets = ONLY_TEST
    ? rows.filter((r) => String(r.sessionKey ?? '').startsWith(TEST_PREFIX))
    : rows;

  const sessions = new Set(rows.map((r) => r.sessionKey));
  const testSessions = new Set(
    rows.filter((r) => String(r.sessionKey ?? '').startsWith(TEST_PREFIX)).map((r) => r.sessionKey),
  );
  // Only the hash is stored, so people are counted by hash, never by address.
  const people = new Set(rows.filter((r) => r.emailHash).map((r) => r.emailHash));

  console.log('');
  console.log(`Rows:            ${rows.length}`);
  console.log(`Sessions:        ${sessions.size} (of those test-: ${testSessions.size})`);
  console.log(`Distinct people: ${people.size} (by emailHash, no address is stored)`);
  console.log(`Rows without an emailHash: ${rows.filter((r) => !r.emailHash).length}`);
  console.log('');
  console.log(`Selected for deletion: ${targets.length}${ONLY_TEST ? ' (only-test)' : ' (all)'}`);

  for (const hash of people) {
    const forHash = rows.filter((r) => r.emailHash === hash);
    console.log(`  ${String(hash).slice(0, 12)}...  ${forHash.length} rows`);
  }

  if (!targets.length) {
    console.log('');
    console.log('Nothing to delete.');
    return;
  }

  if (!CONFIRMED) {
    console.log('');
    console.log('Dry run. Re-run with --yes to delete these rows.');
    return;
  }

  console.log('');
  console.log('Deleting.');
  await deleteRows(targets.map((r) => r.id));
  console.log('Done.');
}

main().catch((err) => {
  console.error(String(err.message || err));
  process.exit(1);
});
