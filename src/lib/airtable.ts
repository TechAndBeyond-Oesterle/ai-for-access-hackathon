export async function submitToAirtable(
  tableId: string,
  fields: Record<string, unknown>,
  baseId = 'appapD55EOTAiqT0I',
  // ponytail: when set, Airtable upserts on these fields instead of always creating a row
  mergeOn?: string[],
) {
  const AIRTABLE_PAT = import.meta.env.AIRTABLE_PAT;

  const res = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}`, {
    method: mergeOn ? 'PATCH' : 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      typecast: true,
      ...(mergeOn ? { performUpsert: { fieldsToMergeOn: mergeOn } } : {}),
      records: [{ fields }],
    }),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  const data = (await res.json()) as { records: { id: string }[] };
  return data.records[0].id;
}

// Airtable's direct upload: max 5 MB per file, base64 in a JSON body.
export async function uploadAttachment(
  recordId: string,
  field: string,
  file: File,
  baseId = 'appapD55EOTAiqT0I',
) {
  const res = await fetch(
    `https://content.airtable.com/v0/${baseId}/${recordId}/${encodeURIComponent(field)}/uploadAttachment`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.AIRTABLE_PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contentType: file.type || 'application/octet-stream',
        filename: file.name,
        file: Buffer.from(await file.arrayBuffer()).toString('base64'),
      }),
    },
  );

  if (!res.ok) {
    throw new Error(await res.text());
  }
}
