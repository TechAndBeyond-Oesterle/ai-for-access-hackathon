#!/usr/bin/env bun
/**
 * Sends the new role-based Discord invite to everyone whose confirmation email
 * contained the expired link (registered between 2026-09-06 and the fix on 2026-10-12).
 *
 * Dry run by default: prints recipients and a sample email, sends nothing.
 *
 * Usage:
 *   bun scripts/resend-discord-invite.mjs                 # dry run
 *   bun scripts/resend-discord-invite.mjs --to me@x.ch    # one test email to me@x.ch
 *   bun scripts/resend-discord-invite.mjs --send          # send to all recipients
 *
 * Bun loads .env automatically. Env: AIRTABLE_PAT, RESEND_API_KEY (required), AIRTABLE_BASE_ID, RESEND_FROM (optional).
 */
import { discordInvite } from '../src/lib/registration-roles.ts';

const BASE = process.env.AIRTABLE_BASE_ID || 'appapD55EOTAiqT0I';
const TABLE = 'tblDlijXwL2EsAeRm';
const FROM = process.env.RESEND_FROM || 'AI for Access Hackathon <info@hackathon.powercoders.org>';
const FIXED_AT = Date.parse('2026-10-12T20:05:00Z');
const SKIP_IDS = new Set(['recI7OLWMsv0sD5nx']); // test registration

const args = process.argv.slice(2);
const send = args.includes('--send');
const testTo = args.includes('--to') ? args[args.indexOf('--to') + 1] : null;

for (const key of ['AIRTABLE_PAT', 'RESEND_API_KEY']) {
  if (!process.env[key]) throw new Error(`${key} is not set`);
}

async function fetchRegistrations() {
  const records = [];
  let offset;
  do {
    const url = `https://api.airtable.com/v0/${BASE}/${TABLE}?pageSize=100${offset ? `&offset=${offset}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.AIRTABLE_PAT}` } });
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
    const json = await res.json();
    records.push(...json.records);
    offset = json.offset;
  } while (offset);
  return records;
}

function recipients(records) {
  return records
    .filter((r) => r.fields['Role at hackathon']?.length && r.fields.RegisteredAt)
    .filter((r) => Date.parse(r.fields.RegisteredAt) < FIXED_AT)
    .filter((r) => !(r.fields.Status || '').trim().startsWith('Cancelled'))
    .filter((r) => !SKIP_IDS.has(r.id))
    .map((r) => ({
      id: r.id,
      name: (r.fields['Full name'] || r.fields.Name || '').trim(),
      email: (r.fields['E-Mail'] || r.fields.Email || '').trim(),
      roles: r.fields['Role at hackathon'],
    }))
    .filter((p) => p.email);
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function email(name, invite) {
  const first = name.split(/\s+/)[0] || '';
  return {
    subject: 'New Discord link: AI for Access Hackathon',
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:560px">
        <p>Hi${first ? ' ' + escapeHtml(first) : ''},</p>
        <p>the Discord link in your registration confirmation has expired, sorry about that. Here is your new link, which already gives you the right role on the server:</p>
        <p><a href="${invite}" style="display:inline-block;background:#5865F2;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Join Discord</a></p>
        <p style="color:#666;font-size:13px">${invite}</p>
        <p>If you have already joined, you can ignore this email.</p>
        <p>See you soon!<br/>The AI for Access team</p>
      </div>`,
  };
}

async function sendEmail(to, { subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

const list = recipients(await fetchRegistrations());
const byInvite = Object.groupBy(list, (p) => discordInvite(p.roles));

console.log(`${list.length} recipients`);
for (const [invite, people] of Object.entries(byInvite)) console.log(`  ${invite}: ${people.length}`);

if (testTo) {
  const sample = list.find((p) => p.roles.includes('Participant')) || list[0];
  await sendEmail(testTo, email(sample.name, discordInvite(sample.roles)));
  console.log(`Test email sent to ${testTo} (rendered for ${sample.name}).`);
} else if (!send) {
  console.log('\nRecipients:');
  for (const p of list) console.log(`  ${p.email.padEnd(40)} ${p.name.padEnd(30)} ${p.roles.join(' + ')}`);
  const sample = email(list[0].name, discordInvite(list[0].roles));
  console.log(`\nSample (${list[0].email}):\nSubject: ${sample.subject}\n${sample.html}`);
  console.log('\nDry run, nothing sent. Use --to <email> for a test mail or --send to send to all.');
} else {
  const failed = [];
  for (const [i, p] of list.entries()) {
    try {
      await sendEmail(p.email, email(p.name, discordInvite(p.roles)));
      console.log(`[${i + 1}/${list.length}] sent ${p.email}`);
    } catch (err) {
      failed.push(p.email);
      console.log(`[${i + 1}/${list.length}] FAILED ${p.email}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 600)); // ponytail: Resend allows 2 req/s
  }
  console.log(`\nDone: ${list.length - failed.length} sent, ${failed.length} failed.`);
  if (failed.length) console.log(`Failed: ${failed.join(', ')}`);
}
