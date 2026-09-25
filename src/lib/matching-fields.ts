export const SKILL_AREAS = [
  { value: 'AI & Machine Learning', de: 'KI & maschinelles Lernen', en: 'AI & machine learning' },
  { value: 'Optimization & Simulation', de: 'Optimierung & Simulation', en: 'Optimization & simulation' },
  { value: 'Software Development', de: 'Softwareentwicklung', en: 'Software development' },
  { value: 'Data', de: 'Datenanalyse & Visualisierung', en: 'Data analysis & visualization' },
  { value: 'Design & UX', de: 'Design & UX', en: 'Design & UX' },
  { value: 'Law', de: 'Recht', en: 'Law' },
] as const;

export const SKILL_LEVELS = ['NA', 'Novice', 'Some experience', 'Experienced', 'Advanced', 'Expert'] as const;
export const TEAM_STATUSES = ['No team', 'Partly formed', 'Complete team'] as const;

export function matchingFields(body: Record<string, unknown>): Record<string, unknown> | null {
  if (!TEAM_STATUSES.includes(body.teamStatus as typeof TEAM_STATUSES[number])) return null;
  const status = body.teamStatus as typeof TEAM_STATUSES[number];
  const skills = body.skills;
  const levels = body.skillLevels;
  if (!Array.isArray(skills) || !skills.length || !skills.every((s) =>
    s === 'Other' || SKILL_AREAS.some((area) => area.value === s))) return null;
  if (new Set(skills).size !== skills.length || !levels || typeof levels !== 'object' || Array.isArray(levels)) return null;
  if (skills.includes('Other') && (typeof body.otherSkill !== 'string' || !body.otherSkill.trim() || body.otherSkill.length > 100)) return null;

  const fields: Record<string, unknown> = {
    'Team status': status,
    'Knowledge areas': skills,
    'Other knowledge area': skills.includes('Other') ? String(body.otherSkill).trim() : '',
    'Current team size': null,
  };
  for (const area of SKILL_AREAS) {
    const level = (levels as Record<string, unknown>)[area.value];
    if (!SKILL_LEVELS.includes(level as typeof SKILL_LEVELS[number])) return null;
    if (skills.includes(area.value) !== (level !== 'NA')) return null;
    fields[`Skill level: ${area.value}`] = level;
  }

  if (status !== 'No team') {
    // ponytail: shared team names can collide or be mistyped; use invitations if that becomes common.
    const teamName = typeof body.teamName === 'string' ? body.teamName.trim() : '';
    if (!teamName || teamName.length > 100) return null;
    fields['Team name'] = teamName;
  } else {
    fields['Team name'] = '';
  }

  if (status === 'Partly formed') {
    const size = Number(body.teamSize);
    if (!Number.isInteger(size) || size < 2 || size > 3) return null;
    fields['Current team size'] = size;
  }
  if (status === 'Partly formed') {
    if (typeof body.wantsTeammates !== 'boolean') return null;
    fields['Wants teammate suggestions'] = body.wantsTeammates ? 'Yes' : 'No';
  } else {
    fields['Wants teammate suggestions'] = status === 'No team' ? 'Yes' : 'No';
  }
  return fields;
}
