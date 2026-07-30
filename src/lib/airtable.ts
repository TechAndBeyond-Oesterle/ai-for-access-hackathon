export async function submitToAirtable(
  tableId: string,
  fields: Record<string, unknown>,
  baseId = 'appapD55EOTAiqT0I',
) {
  const AIRTABLE_PAT = import.meta.env.AIRTABLE_PAT;

  const res = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      typecast: true,
      records: [{ fields }],
    }),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }
}
