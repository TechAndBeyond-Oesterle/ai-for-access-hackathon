import type { APIRoute } from 'astro';
import { submitToAirtable } from '../../lib/airtable';

export const prerender = false;

const AIRTABLE_TABLE_ID = 'tblrmwLnLpICBjJBx';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, email, dates, domain, phone } = body;

    if (!name || !email || !Array.isArray(dates) || dates.length === 0 || !domain || !phone) {
      return new Response(JSON.stringify({ error: 'All fields are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      await submitToAirtable(AIRTABLE_TABLE_ID, {
        Name: name,
        Email: email,
        'Dates of participation': dates,
        Domain: domain,
        Phone: phone,
      });
    } catch (err) {
      console.error('[Mentors] Airtable error:', err);
      return new Response(JSON.stringify({ error: 'Registration failed', detail: String(err) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[Mentors] Error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
