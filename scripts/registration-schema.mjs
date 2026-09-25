/** Add the pre-match fields to the existing Registrations table. Safe to rerun. */
const BASE_ID = process.env.AIRTABLE_BASE_ID || 'appapD55EOTAiqT0I';
const TABLE_ID = 'tblDlijXwL2EsAeRm';
const TOKEN = process.env.AIRTABLE_PAT || process.env.AIRTABLE_API_KEY;

const skills = ['AI & Machine Learning', 'Optimization & Simulation', 'Software Development', 'Data', 'Design & UX', 'Law'];
const levels = ['NA', 'Novice', 'Some experience', 'Experienced', 'Advanced', 'Expert'];
const select = (name, choices, type = 'singleSelect') => ({ name, type, options: { choices: choices.map((choice) => ({ name: choice })) } });
const fields = [
  select('Knowledge areas', [...skills, 'Other'], 'multipleSelects'),
  { name: 'Other knowledge area', type: 'singleLineText' },
  ...skills.map((skill) => select(`Skill level: ${skill}`, levels)),
  select('Team status', ['No team', 'Partly formed', 'Complete team']),
  { name: 'Team name', type: 'singleLineText' },
  { name: 'Current team size', type: 'number', options: { precision: 0 } },
  select('Wants teammate suggestions', ['Yes', 'No']),
];

if (!TOKEN) throw new Error('AIRTABLE_PAT is missing');

async function api(path, init = {}) {
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error(`Airtable schema request failed (${response.status}): ${await response.text()}`);
  return response.json();
}

const { tables } = await api('/tables');
const registration = tables.find((table) => table.id === TABLE_ID);
if (!registration) throw new Error('Registrations table not found');
const existing = new Map(registration.fields.map((field) => [field.name, field.type]));
for (const field of fields) {
  if (existing.has(field.name)) {
    if (existing.get(field.name) !== field.type) throw new Error(`${field.name} exists with type ${existing.get(field.name)}; expected ${field.type}`);
    continue;
  }
  await api(`/tables/${TABLE_ID}/fields`, { method: 'POST', body: JSON.stringify(field) });
  console.log(`Added ${field.name}`);
}
console.log('Registration fields ready');
