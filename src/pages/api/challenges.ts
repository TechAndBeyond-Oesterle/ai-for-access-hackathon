import type { APIRoute } from 'astro';
import { submitToAirtable } from '../../lib/airtable';

export const prerender = false;

const AIRTABLE_TABLE_ID = 'tbluAK4cJ5wfSdnnz';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      title,
      teaser,
      context,
      problemStatement,
      resources,
      company,
      contactName,
      contactAddress,
      availability,
      category,
    } = body;

    if (
      !title ||
      !context ||
      !problemStatement ||
      !company ||
      !contactName ||
      !contactAddress ||
      !Array.isArray(availability) ||
      availability.length === 0 ||
      !Array.isArray(category) ||
      category.length === 0
    ) {
      return new Response(JSON.stringify({ error: 'All fields are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      await submitToAirtable(AIRTABLE_TABLE_ID, {
        Title: title,
        Teaser: teaser || undefined,
        Context: context,
        'Problem Statement': problemStatement,
        Resources: resources || undefined,
        'Company or Organisation': company,
        'Contact Name': contactName,
        'Contact Address': contactAddress,
        Availability: availability,
        Category: category,
        Status: 'Submitted',
      });
    } catch (err) {
      console.error('[Challenges] Airtable error:', err);
      return new Response(JSON.stringify({ error: 'Submission failed', detail: String(err) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[Challenges] Error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
