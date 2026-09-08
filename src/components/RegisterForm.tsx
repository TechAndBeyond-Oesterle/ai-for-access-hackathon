import { useState, type FormEvent } from 'react';
import type { Lang } from '../i18n/translations';

interface Props {
  lang: Lang;
}

const API_ENDPOINT = '/api/register';
const DISCORD_INVITE = 'https://discord.gg/yaZTAY2yx';

const ROLES = ['Participant', 'Mentor/Coach', 'Volunteer', 'Jury', 'Organizer', 'Sponsor/Partner', 'Other'] as const;
const DIETARY = ['No preference', 'Vegetarian', 'Vegan', 'Pescatarian', 'Halal', 'Kosher'] as const;
const INFO_SESSIONS = ['Sep 18 18:30-19:30', 'Sep 25 18:30-19:30', 'Not attending'] as const;
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
  role: '',
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
  const toggle = (key: 'dietary' | 'infoSession' | 'childcareDays', v: string) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v],
    }));

  function validate() {
    const e: Record<string, string> = {};
    if (!form.fullName.trim()) e.fullName = de ? 'Name ist erforderlich' : 'Name is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = de ? 'Gültige E-Mail erforderlich' : 'Valid email required';
    if (!form.role) e.role = de ? 'Bitte Rolle wählen' : 'Please pick a role';
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
    <form onSubmit={handleSubmit} className="space-y-5 max-w-md mx-auto text-left">
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

      <Field id="reg-role" label={(de ? 'Rolle am Hackathon' : 'Role at hackathon') + ' *'}>
        <select id="reg-role" value={form.role} onChange={(e) => set({ role: e.target.value })}
          className={inputCls} style={errors.role ? errStyle : inputStyle}>
          <option value="">{de ? 'Bitte wählen…' : 'Please select…'}</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        {errors.role && <p className="mt-1 text-xs" style={{ color: ERROR_RED }}>{errors.role}</p>}
      </Field>

      <Field id="reg-org" label={de ? 'Organisation/Schule' : 'Organization/School'}>
        <input id="reg-org" type="text" value={form.organization} onChange={(e) => set({ organization: e.target.value })}
          className={inputCls} style={inputStyle} />
      </Field>

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

      <Field label={de ? 'Info-Session' : 'Info session'}>
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
