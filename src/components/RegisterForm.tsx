import { useState, type FormEvent } from 'react';
import type { Lang } from '../i18n/translations';
import { SKILL_AREAS, SKILL_LEVELS, TEAM_STATUSES } from '../lib/matching-fields';
import { ROLES, PARTICIPANT_CONFLICTS, hasRoleConflict } from '../lib/registration-roles';

interface Props {
  lang: Lang;
}

const API_ENDPOINT = '/api/register';
const DISCORD_INVITE = 'https://discord.gg/yaZTAY2yx';

const DIETARY = ['No preference', 'Vegetarian', 'Vegan', 'Pescatarian', 'Halal', 'Kosher'] as const;
const INFO_SESSIONS = ['18.09. 18:30–19:30', '25.09. 18:30–19:30', '23.10. 18:00–19:05', 'Not attending'] as const;
const CHILDCARE_DAYS = ['Friday', 'Saturday'] as const;
const PHOTO_CONSENT = ['Yes', 'No', 'Ask me first'] as const;

const labelStyle = { color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' as const, letterSpacing: '0.05em' };
const inputStyle = {
  backgroundColor: 'var(--bg-raised)',
  color: 'var(--fg)',
  borderColor: 'color-mix(in srgb, var(--fg) 12%, transparent)',
  fontFamily: 'var(--font-body)',
};
const ERROR_RED = '#d92d20';
const errStyle = { ...inputStyle, borderColor: ERROR_RED };
const MAX_CHILDREN = 10;

const inputCls = 'w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]';

function Field({ id, label, children }: { id?: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block mb-1.5" style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

const initial = {
  fullName: '',
  email: '',
  age: '',
  roles: [] as string[],
  skills: [] as string[],
  otherSkill: '',
  skillLevels: Object.fromEntries(SKILL_AREAS.map((area) => [area.value, 'NA'])) as Record<string, string>,
  teamStatus: 'No team',
  teamName: '',
  teamSize: '',
  wantsTeammates: null as boolean | null,
  organization: '',
  dietary: [] as string[],
  allergies: '',
  foodNotes: '',
  accessibility: '',
  infoSession: [] as string[],
  photoConsent: 'Ask me first',
  futureInfos: false,
  childcare: false,
  numChildren: '',
  childAges: [] as string[],
  childcareDays: [] as string[],
  childcareNotes: '',
};

export default function RegisterForm({ lang }: Props) {
  const de = lang === 'de';
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const childCount = Math.min(Math.max(Number(form.numChildren) || 0, 0), MAX_CHILDREN);

  const set = (patch: Partial<typeof initial>) => setForm((f) => ({ ...f, ...patch }));
  const toggle = (key: 'roles' | 'skills' | 'dietary' | 'infoSession' | 'childcareDays', v: string) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v],
    }));

  function validate() {
    const e: Record<string, string> = {};
    if (!form.fullName.trim()) e.fullName = de ? 'Name ist erforderlich' : 'Name is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = de ? 'Gültige E-Mail erforderlich' : 'Valid email required';
    if (!form.roles.length) e.roles = de ? 'Bitte mindestens eine Rolle wählen' : 'Please pick at least one role';
    if (hasRoleConflict(form.roles)) e.roles = de ? 'Teilnahme kann nicht mit Mentoring, Volunteer oder Jury kombiniert werden' : 'Participant cannot be combined with mentor, volunteer or jury';
    if (form.roles.includes('Participant')) {
      if (!form.skills.length) e.skills = de ? 'Bitte mindestens einen Bereich wählen' : 'Please select at least one area';
      if (form.skills.includes('Other') && !form.otherSkill.trim()) e.otherSkill = de ? 'Bitte Bereich angeben' : 'Please describe the area';
      if (SKILL_AREAS.some((area) => form.skills.includes(area.value) && (!SKILL_LEVELS.includes(form.skillLevels[area.value] as typeof SKILL_LEVELS[number]) || form.skillLevels[area.value] === 'NA')))
        e.skillLevels = de ? 'Bitte Kenntnisse für jeden gewählten Bereich einschätzen' : 'Please rate each selected area';
      if (form.teamStatus === '') e.teamStatus = de ? 'Bitte Teamstatus wählen' : 'Please choose your team status';
      if (form.teamStatus !== 'No team' && !form.teamName.trim()) e.teamName = de ? 'Bitte Teamnamen angeben' : 'Please enter a team name';
      if (form.teamStatus === 'Partly formed' && !['2', '3'].includes(form.teamSize)) e.teamSize = de ? 'Bitte 2 oder 3 Personen angeben' : 'Please enter 2 or 3 people';
      if (form.teamStatus === 'Partly formed' && form.wantsTeammates === null)
        e.wantsTeammates = de ? 'Bitte Ja oder Nein wählen' : 'Please choose Yes or No';
    }
    if (form.childcare) {
      const n = Math.min(Math.max(Number(form.numChildren) || 0, 0), MAX_CHILDREN);
      if (n < 1) e.numChildren = de ? 'Bitte Anzahl Kinder angeben' : 'Please enter the number of children';
      else if (Array.from({ length: n }, (_, i) => form.childAges[i]).some((a) => !a || !a.trim()))
        e.childAges = de ? 'Bitte Alter für jedes Kind angeben' : 'Please enter an age for every child';
      if (!form.childcareDays.length)
        e.childcareDays = de ? 'Bitte mindestens einen Tag wählen' : 'Please pick at least one day';
    }
    return e;
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSubmitting(true);
    try {
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, childAges: form.childAges.filter(Boolean).join(', '), lang }),
      });
      setSubmitting(false);
      if (res.ok) setSubmitted(true);
      else setErrors({ email: de ? 'Etwas ist schiefgelaufen. Bitte nochmal versuchen.' : 'Something went wrong. Please try again.' });
    } catch {
      setSubmitting(false);
      setErrors({ email: de ? 'Netzwerkfehler. Bitte nochmal versuchen.' : 'Network error. Please try again.' });
    }
  }

  if (submitted) {
    return (
      <div
        className="text-center p-8 sm:p-12 rounded-2xl border max-w-md mx-auto"
        style={{ borderColor: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 5%, var(--bg-raised))' }}
      >
        <div className="text-4xl mb-4">✓</div>
        <p className="text-lg font-semibold mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>
          {de ? 'Anmeldung eingegangen! Check deine Mailbox für die Bestätigung.' : "Registration received! Check your inbox for the confirmation."}
        </p>
        <p className="text-sm mb-4" style={{ color: 'var(--fg-muted)' }}>
          {de
            ? 'Die Teambildung startet am 1. November. Unserem Discord kannst du aber schon jetzt beitreten — dort findest du alle Infos und kannst Fragen stellen.'
            : 'Team formation starts on 1 November. You can already join our Discord though — all the info is there and you can ask questions.'}
        </p>
        <a
          href={DISCORD_INVITE}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full transition-all hover:scale-[1.02]"
          style={{ backgroundColor: '#5865F2', color: '#fff' }}
        >
          {de ? 'Discord beitreten' : 'Join Discord'}
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10 max-w-2xl mx-auto text-left">
      <section aria-labelledby="reg-personal-heading" className="space-y-5">
        <h2 id="reg-personal-heading" className="text-lg font-semibold" style={{ color: 'var(--fg)' }}>
          {de ? 'Persönliche Angaben' : 'Personal details'}
        </h2>
      <Field id="reg-name" label={(de ? 'Vollständiger Name' : 'Full name') + ' *'}>
        <input id="reg-name" type="text" value={form.fullName} onChange={(e) => set({ fullName: e.target.value })}
          className={inputCls} style={errors.fullName ? errStyle : inputStyle} />
        {errors.fullName && <p className="mt-1 text-xs" style={{ color: ERROR_RED }}>{errors.fullName}</p>}
      </Field>

      <Field id="reg-email" label={(de ? 'E-Mail' : 'Email') + ' *'}>
        <input id="reg-email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })}
          className={inputCls} style={errors.email ? errStyle : inputStyle} />
        {errors.email && <p className="mt-1 text-xs" style={{ color: ERROR_RED }}>{errors.email}</p>}
      </Field>

      <Field id="reg-age" label={de ? 'Alter' : 'Age'}>
        <input id="reg-age" type="number" min="0" value={form.age} onChange={(e) => set({ age: e.target.value })}
          className={inputCls} style={inputStyle} />
      </Field>

      <Field id="reg-org" label={de ? 'Organisation/Schule' : 'Organization/School'}>
        <input id="reg-org" type="text" value={form.organization} onChange={(e) => set({ organization: e.target.value })}
          className={inputCls} style={inputStyle} />
      </Field>
      </section>

      <section aria-labelledby="reg-participation-heading" className="space-y-5">
        <h2 id="reg-participation-heading" className="text-lg font-semibold" style={{ color: 'var(--fg)' }}>
          {de ? 'Teilnahme' : 'Participation'}
        </h2>
      <Field label={(de ? 'Rollen am Hackathon' : 'Roles at hackathon') + ' *'}>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLES.map((role) => (
            <label key={role} className="flex items-center gap-2 text-sm cursor-pointer has-disabled:cursor-not-allowed has-disabled:opacity-50" style={{ color: 'var(--fg)' }}>
              <input
                type="checkbox"
                checked={form.roles.includes(role)}
                onChange={() => toggle('roles', role)}
                disabled={role === 'Participant'
                  ? PARTICIPANT_CONFLICTS.some((conflict) => form.roles.includes(conflict))
                  : form.roles.includes('Participant') && PARTICIPANT_CONFLICTS.some((conflict) => conflict === role)}
                className="w-4 h-4"
              />
              {role}
            </label>
          ))}
        </div>
        {errors.roles && <p className="mt-1 text-xs" style={{ color: ERROR_RED }}>{errors.roles}</p>}
      </Field>

      {form.roles.includes('Participant') && (
        <div className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-sm" style={labelStyle}>{(de ? 'In welchen Bereichen hast du Kenntnisse? (Mehrfachauswahl)' : 'Which areas do you know something about? (Select all that apply)') + ' *'}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {SKILL_AREAS.map((area) => (
                <label key={area.value} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--fg)' }}>
                  <input type="checkbox" checked={form.skills.includes(area.value)}
                    onChange={() => setForm((f) => ({
                      ...f,
                      skills: f.skills.includes(area.value) ? f.skills.filter((skill) => skill !== area.value) : [...f.skills, area.value],
                      skillLevels: { ...f.skillLevels, [area.value]: f.skills.includes(area.value) ? 'NA' : '' },
                    }))} className="w-4 h-4" />
                  {de ? area.de : area.en}
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--fg)' }}>
                <input type="checkbox" checked={form.skills.includes('Other')} onChange={() => toggle('skills', 'Other')} className="w-4 h-4" />
                {de ? 'Anderes' : 'Other'}
              </label>
            </div>
            {form.skills.includes('Other') && (
              <div className="mt-2">
                <label htmlFor="reg-other-skill" className="block mb-1.5" style={labelStyle}>{de ? 'Anderer Bereich *' : 'Other area *'}</label>
                <input id="reg-other-skill" type="text" value={form.otherSkill} onChange={(e) => set({ otherSkill: e.target.value })}
                  className={inputCls} style={errors.otherSkill ? errStyle : inputStyle} />
                {errors.otherSkill && <p className="mt-1 text-xs" style={{ color: ERROR_RED }}>{errors.otherSkill}</p>}
              </div>
            )}
            {errors.skills && <p className="mt-2 text-xs" style={{ color: ERROR_RED }}>{errors.skills}</p>}
          </fieldset>
          {form.skills.some((skill) => skill !== 'Other') && (
            <fieldset>
              <legend className="mb-2 text-sm" style={labelStyle}>
                {de ? 'Wie schätzt du deine Kenntnisse im Vergleich zu Personen ein, mit denen du arbeitest oder lernst?' : 'How would you rate your skills compared with people you work or study with?'}
              </legend>
              <div className="space-y-3">
                {SKILL_AREAS.filter((area) => form.skills.includes(area.value)).map((area) => (
                  <div key={area.value}>
                    <label htmlFor={`reg-level-${SKILL_AREAS.indexOf(area)}`} className="block mb-1 text-sm" style={{ color: 'var(--fg)' }}>{de ? area.de : area.en}</label>
                    <select id={`reg-level-${SKILL_AREAS.indexOf(area)}`} value={form.skillLevels[area.value]}
                      onChange={(e) => set({ skillLevels: { ...form.skillLevels, [area.value]: e.target.value } })}
                      className={inputCls} style={errors.skillLevels && !form.skillLevels[area.value] ? errStyle : inputStyle}>
                      <option value="">{de ? 'Bitte wählen…' : 'Please select…'}</option>
                      {SKILL_LEVELS.filter((level) => level !== 'NA').map((level) => (
                        <option key={level} value={level}>{de ? ({ Novice: 'Einsteiger:in', 'Some experience': 'Etwas Erfahrung', Experienced: 'Erfahren', Advanced: 'Fortgeschritten', Expert: 'Expert:in' } as Record<string, string>)[level] : level}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {errors.skillLevels && <p className="mt-1 text-xs" style={{ color: ERROR_RED }}>{errors.skillLevels}</p>}
            </fieldset>
          )}
          <div className="space-y-3">
            <h3 className="text-sm" style={labelStyle}>{de ? 'Dein Team' : 'Your team'}</h3>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--fg)' }}>
              <input type="checkbox" checked={form.teamStatus !== 'No team'}
                onChange={(e) => set({ teamStatus: e.target.checked ? '' : 'No team', teamName: '', teamSize: '', wantsTeammates: null })}
                className="w-4 h-4 shrink-0" />
              {de ? 'Ich habe bereits ein Team' : 'I already have a team'}
            </label>
          {form.teamStatus !== 'No team' && <>
            <Field id="reg-team-status" label={(de ? 'Ist dein Team vollständig?' : 'Is your team complete?') + ' *'}>
              <select id="reg-team-status" value={form.teamStatus} onChange={(e) => set({ teamStatus: e.target.value, teamSize: '', wantsTeammates: null })}
                className={inputCls} style={errors.teamStatus ? errStyle : inputStyle}>
                <option value="">{de ? 'Bitte wählen…' : 'Please select…'}</option>
                {TEAM_STATUSES.filter((status) => status !== 'No team').map((status) => <option key={status} value={status}>
                  {de ? (status === 'Partly formed' ? 'Noch nicht vollständig' : 'Vollständig') : (status === 'Partly formed' ? 'Not yet complete' : 'Complete')}
                </option>)}
              </select>
              {errors.teamStatus && <p className="mt-1 text-xs" style={{ color: ERROR_RED }}>{errors.teamStatus}</p>}
            </Field>
            <Field id="reg-team-name" label={(de ? 'Teamname (alle Teammitglieder geben denselben Namen ein)' : 'Team name (each teammate should enter the same name)') + ' *'}>
              <input id="reg-team-name" type="text" maxLength={100} value={form.teamName} onChange={(e) => set({ teamName: e.target.value })}
                className={inputCls} style={errors.teamName ? errStyle : inputStyle} />
              {errors.teamName && <p className="mt-1 text-xs" style={{ color: ERROR_RED }}>{errors.teamName}</p>}
            </Field>
          {form.teamStatus === 'Partly formed' && (
            <Field id="reg-team-size" label={(de ? 'Aktuelle Teamgrösse (inklusive dir)' : 'Current team size (including you)') + ' *'}>
              <select id="reg-team-size" value={form.teamSize} onChange={(e) => set({ teamSize: e.target.value })}
                className={inputCls} style={errors.teamSize ? errStyle : inputStyle}>
                <option value="">{de ? 'Bitte wählen…' : 'Please select…'}</option>
                <option value="2">2</option><option value="3">3</option>
              </select>
              {errors.teamSize && <p className="mt-1 text-xs" style={{ color: ERROR_RED }}>{errors.teamSize}</p>}
            </Field>
          )}
          {form.teamStatus === 'Partly formed' && (
            <fieldset>
              <legend className="mb-2 text-sm" style={labelStyle}>{(de ? 'Dürfen wir zusätzlich Personen für dein bestehendes Team vorschlagen?' : 'May we also suggest people to join your existing team?') + ' *'}</legend>
              <div className="flex gap-4">
                {[true, false].map((value) => <label key={String(value)} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--fg)' }}>
                  <input type="radio" name="wantsTeammates" checked={form.wantsTeammates === value} onChange={() => set({ wantsTeammates: value })} />
                  {value ? (de ? 'Ja' : 'Yes') : (de ? 'Nein' : 'No')}
                </label>)}
              </div>
              {errors.wantsTeammates && <p className="mt-1 text-xs" style={{ color: ERROR_RED }}>{errors.wantsTeammates}</p>}
            </fieldset>
          )}
          </>}
          </div>
        </div>
      )}
      </section>

      <section aria-labelledby="reg-support-heading" className="space-y-5">
        <h2 id="reg-support-heading" className="text-lg font-semibold" style={{ color: 'var(--fg)' }}>
          {de ? 'Verpflegung & Unterstützung' : 'Food & support'}
        </h2>
      <Field label={de ? 'Ernährung' : 'Dietary preference'}>
        <div className="flex flex-wrap gap-3">
          {DIETARY.map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--fg)' }}>
              <input type="checkbox" checked={form.dietary.includes(d)} onChange={() => toggle('dietary', d)} className="w-4 h-4" />
              {d}
            </label>
          ))}
        </div>
      </Field>

      <Field id="reg-allergies" label={de ? 'Allergien/Unverträglichkeiten' : 'Allergies/intolerances'}>
        <textarea id="reg-allergies" rows={2} value={form.allergies} onChange={(e) => set({ allergies: e.target.value })}
          className={inputCls} style={inputStyle} />
      </Field>

      <Field id="reg-foodnotes" label={de ? 'Weitere Hinweise zum Essen' : 'Other food notes'}>
        <textarea id="reg-foodnotes" rows={2} value={form.foodNotes} onChange={(e) => set({ foodNotes: e.target.value })}
          className={inputCls} style={inputStyle} />
      </Field>

      <Field id="reg-access" label={de ? 'Barrierefreiheit oder Support-Bedarf' : 'Accessibility or support needs'}>
        <textarea id="reg-access" rows={2} value={form.accessibility} onChange={(e) => set({ accessibility: e.target.value })}
          className={inputCls} style={inputStyle} />
      </Field>
      </section>

      <section aria-labelledby="reg-event-heading" className="space-y-5">
        <h2 id="reg-event-heading" className="text-lg font-semibold" style={{ color: 'var(--fg)' }}>
          {de ? 'Organisatorisches' : 'Event details'}
        </h2>
      <Field label={de ? 'Info-Session' : 'Info session'}>
        <p
          className="mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          style={{
            color: 'var(--fg-muted)',
            borderColor: 'color-mix(in srgb, #3b82f6 35%, transparent)',
            background: 'color-mix(in srgb, #3b82f6 8%, var(--bg-raised))',
          }}
        >
          <span aria-hidden="true" style={{ color: '#3b82f6' }}>ⓘ</span>
          {de
            ? 'Die Info-Sessions finden online statt. Die Einladung zum Online-Meeting folgt per E-Mail.'
            : 'The info sessions will be held online. You will receive the meeting invitation by email.'}
        </p>
        <div className="flex flex-col gap-2">
          {INFO_SESSIONS.map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--fg)' }}>
              <input type="checkbox" checked={form.infoSession.includes(s)} onChange={() => toggle('infoSession', s)} className="w-4 h-4" />
              {s}
            </label>
          ))}
        </div>
      </Field>

      <Field id="reg-photo" label={de ? 'Foto-/Video-Einverständnis' : 'Photo/video consent'}>
        <select id="reg-photo" value={form.photoConsent} onChange={(e) => set({ photoConsent: e.target.value })}
          className={inputCls} style={inputStyle}>
          {PHOTO_CONSENT.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </Field>

      {/* Childcare */}
      <div>
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--fg)' }}>
          <input type="checkbox" checked={form.childcare} onChange={(e) => set({ childcare: e.target.checked })} className="w-4 h-4" />
          {de ? 'Ich bringe ein Kind mit / brauche Kinderbetreuung' : 'Bringing a child / need childcare'}
        </label>
      </div>

      {form.childcare && (
        <div className="space-y-4 pl-4 border-l-2" style={{ borderColor: 'color-mix(in srgb, var(--accent) 40%, transparent)' }}>
          <Field id="reg-numchildren" label={(de ? 'Anzahl Kinder' : 'Number of children') + ' *'}>
            <input id="reg-numchildren" type="number" min="1" max={MAX_CHILDREN} value={form.numChildren}
              onChange={(e) => {
                const n = Math.min(Math.max(Number(e.target.value) || 0, 0), MAX_CHILDREN);
                set({ numChildren: e.target.value === '' ? '' : String(n), childAges: form.childAges.slice(0, n) });
              }}
              className={inputCls} style={errors.numChildren ? errStyle : inputStyle} />
            {errors.numChildren && <p className="mt-1 text-xs" style={{ color: ERROR_RED }}>{errors.numChildren}</p>}
          </Field>
          {childCount > 0 && (
            <Field label={(de ? 'Alter der Kinder' : 'Child age(s)') + ' *'}>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: childCount }, (_, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <label htmlFor={`reg-childage-${i}`} className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                      {i + 1}.
                    </label>
                    <input id={`reg-childage-${i}`} type="number" min="0" max="18" inputMode="numeric"
                      aria-label={(de ? 'Alter Kind ' : 'Age of child ') + (i + 1)}
                      value={form.childAges[i] ?? ''}
                      onChange={(e) => {
                        const next = Array.from({ length: childCount }, (_, j) => form.childAges[j] ?? '');
                        next[i] = e.target.value;
                        set({ childAges: next });
                      }}
                      className="w-16 px-2 py-1.5 rounded-lg border text-sm text-center transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
                      style={errors.childAges ? errStyle : inputStyle} />
                  </div>
                ))}
              </div>
              {errors.childAges && <p className="mt-1 text-xs" style={{ color: ERROR_RED }}>{errors.childAges}</p>}
            </Field>
          )}
          <Field label={(de ? 'Benötigte Betreuungstage' : 'Childcare day(s) needed') + ' *'}>
            <div className="flex gap-4">
              {CHILDCARE_DAYS.map((d) => (
                <label key={d} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--fg)' }}>
                  <input type="checkbox" checked={form.childcareDays.includes(d)} onChange={() => toggle('childcareDays', d)} className="w-4 h-4" />
                  {d}
                </label>
              ))}
            </div>
            {errors.childcareDays && <p className="mt-1 text-xs" style={{ color: ERROR_RED }}>{errors.childcareDays}</p>}
          </Field>
          <Field id="reg-childnotes" label={de ? 'Hinweise zur Kinderbetreuung' : 'Childcare notes'}>
            <textarea id="reg-childnotes" rows={2} value={form.childcareNotes} onChange={(e) => set({ childcareNotes: e.target.value })}
              className={inputCls} style={inputStyle} />
          </Field>
        </div>
      )}

      <div>
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--fg)' }}>
          <input type="checkbox" checked={form.futureInfos} onChange={(e) => set({ futureInfos: e.target.checked })} className="w-4 h-4" />
          {de ? 'Infos zu zukünftigen Events erhalten' : 'Send me info about future events'}
        </label>
      </div>
      </section>

      {errors.email && !errors.fullName && (
        <p className="text-xs" style={{ color: ERROR_RED }}>{errors.email}</p>
      )}

      <button type="submit" disabled={submitting}
        className="w-full px-8 py-4 text-base font-semibold rounded-full transition-all duration-300 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
        style={{ backgroundColor: 'var(--accent)', color: 'var(--bg)' }}>
        {submitting ? '...' : de ? 'Anmeldung abschicken' : 'Submit registration'}
      </button>
    </form>
  );
}
