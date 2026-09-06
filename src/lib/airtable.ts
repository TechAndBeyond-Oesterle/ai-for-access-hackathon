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
}
