import type { APIRoute } from 'astro';
import { submitToAirtable, uploadAttachment } from '../../lib/airtable';

export const prerender = false;

const AIRTABLE_TABLE_ID = 'tbluAK4cJ5wfSdnnz';

export const companyOrOrganisation = (isCompanyChallenge: boolean, company?: string) =>
  isCompanyChallenge ? company : 'Personal idea';

// ponytail: total stays under Vercel's 4.5 MB request body limit, so no separate storage is
// needed. Bigger files would need direct-to-bucket uploads (e.g. R2 presigned URLs).
export const MAX_FILES = 5;
export const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

export const filesError = (files: File[]) => {
  if (files.length > MAX_FILES) return 'Too many files';
  if (files.reduce((sum, f) => sum + f.size, 0) > MAX_TOTAL_BYTES) return 'Files too large';
  return null;
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const body = JSON.parse(String(formData.get('data') ?? '{}'));
    const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
    const {
      title,
      teaser,
      context,
      problemStatement,
      resources,
      isCompanyChallenge,
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
      typeof isCompanyChallenge !== 'boolean' ||
      (isCompanyChallenge && !company) ||
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

    const fileError = filesError(files);
    if (fileError) {
      return new Response(JSON.stringify({ error: fileError }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let recordId: string;
    try {
      recordId = await submitToAirtable(AIRTABLE_TABLE_ID, {
        Title: title,
        Teaser: teaser || undefined,
        Context: context,
        'Problem Statement': problemStatement,
        Resources: resources || undefined,
        'Company Challenge': isCompanyChallenge,
        'Company or Organisation': companyOrOrganisation(isCompanyChallenge, company),
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

    // ponytail: the challenge row is already saved, so a failed file upload is logged
    // instead of failing the whole submission.
    const failedFiles: string[] = [];
    for (const file of files) {
      try {
        await uploadAttachment(recordId, 'Attachments', file);
      } catch (err) {
        console.error('[Challenges] Attachment upload error:', file.name, err);
        failedFiles.push(file.name);
      }
    }

    return new Response(JSON.stringify({ ok: true, failedFiles }), {
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
