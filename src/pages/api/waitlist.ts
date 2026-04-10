import type { APIRoute } from 'astro';

export const prerender = false;

const AIRTABLE_PAT = import.meta.env.AIRTABLE_PAT;
const AIRTABLE_BASE_ID = 'appapD55EOTAiqT0I';
const AIRTABLE_TABLE_ID = 'tblDlijXwL2EsAeRm';
const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, email, role } = body;

    if (!name || !email) {
      return new Response(JSON.stringify({ error: 'Name and email required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch(AIRTABLE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        typecast: true,
        records: [{
          fields: {
            Name: name,
            'E-Mail': email,
            ...(role ? { Rolle: [role] } : {}),
            Status: '0 Waitlist',
            RegisteredAt: new Date().toISOString(),
          },
        }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[Waitlist] Airtable error:', res.status, err);
      return new Response(JSON.stringify({ error: 'Registration failed', detail: err }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[Waitlist] Error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
