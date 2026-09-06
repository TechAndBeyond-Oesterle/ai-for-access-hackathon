import type { APIRoute } from 'astro';
import { submitToAirtable } from '../../lib/airtable';
import { sendEmail, confirmationEmail, addToAudience } from '../../lib/resend';

export const prerender = false;

// Registrations table (same id as the former waitlist table)
const AIRTABLE_TABLE_ID = 'tblDlijXwL2EsAeRm';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request }) => {
  try {
    const b = await request.json();

    const fullName = String(b.fullName ?? '').trim();
    const email = String(b.email ?? '').trim();
    const lang: 'de' | 'en' = b.lang === 'en' ? 'en' : 'de';

    if (!fullName || !EMAIL_RE.test(email) || !b.role) {
      return json({ error: 'Full name, valid email and role are required' }, 400);
    }

    const childcare = Boolean(b.childcare);
    if (childcare) {
      const n = Number(b.numChildren);
      if (!Number.isFinite(n) || n < 1 || !String(b.childAges ?? '').trim() ||
          !Array.isArray(b.childcareDays) || !b.childcareDays.length) {
        return json({ error: 'Childcare requires number of children, ages and day(s)' }, 400);
      }
    }

    const fields: Record<string, unknown> = {
      'Full name': fullName,
      Name: fullName,
      Email: email,
      'E-Mail': email,
      Status: 'Todo',
      RegisteredAt: new Date().toISOString(),
      'Role at hackathon': b.role,
      'Photo/video consent': b.photoConsent || 'Ask me first',
      'Bringing a child/needs childcare': childcare,
      'Infos for next events': Boolean(b.futureInfos),
    };

    if (b.age !== '' && b.age != null && !Number.isNaN(Number(b.age)))
      fields['Age'] = Number(b.age);
    if (b.organization) fields['Organization/School'] = String(b.organization).trim();
    if (Array.isArray(b.dietary) && b.dietary.length) fields['Dietary preference'] = b.dietary;
    if (b.allergies) fields['Allergies/intolerances'] = String(b.allergies).trim();
    if (b.foodNotes) fields['Other food notes'] = String(b.foodNotes).trim();
    if (b.accessibility) fields['Accessibility or support needs'] = String(b.accessibility).trim();
    if (Array.isArray(b.infoSession) && b.infoSession.length) fields['Info session'] = b.infoSession;

    if (childcare) {
      if (b.numChildren !== '' && b.numChildren != null && !Number.isNaN(Number(b.numChildren)))
        fields['Number of children'] = Number(b.numChildren);
      if (b.childAges) fields['Child age(s)'] = String(b.childAges).trim();
      if (Array.isArray(b.childcareDays) && b.childcareDays.length)
        fields['Childcare day(s) needed'] = b.childcareDays;
      if (b.childcareNotes) fields['Childcare notes'] = String(b.childcareNotes).trim();
    }

    try {
      // Upsert on E-Mail so waitlist signups keep their existing row (and their spot in line)
      await submitToAirtable(AIRTABLE_TABLE_ID, fields, undefined, ['E-Mail']);
    } catch (err) {
      console.error('[Register] Airtable error:', err);
      return json({ error: 'Registration failed', detail: String(err) }, 500);
    }

    // Newsletter audience — opt-in only, never fail the registration if this errors
    if (b.futureInfos) {
      try {
        await addToAudience(email, fullName);
      } catch (err) {
        console.error('[Register] Resend audience error:', err);
      }
    }

    // Confirmation email — never fail the registration if this errors
    try {
      const { subject, html } = confirmationEmail(lang, fullName);
      await sendEmail({ to: email, subject, html });
    } catch (err) {
      console.error('[Register] Resend error:', err);
    }

    return json({ ok: true }, 200);
  } catch (err) {
    console.error('[Register] Error:', err);
    return json({ error: 'Server error' }, 500);
  }
};

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
