import { useState, type FormEvent } from 'react';
import type { Lang } from '../i18n/translations';
import { useTranslations } from '../i18n/utils';

interface Props {
  lang: Lang;
}

const API_ENDPOINT = '/api/waitlist';

export default function SignupForm({ lang }: Props) {
  const t = useTranslations(lang);

  const [form, setForm] = useState({ name: '', email: '', role: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const roles = [
    { value: 'domain', label: t('signup.role.domain') },
    { value: 'design', label: t('signup.role.design') },
    { value: 'dev', label: t('signup.role.dev') },
    { value: 'pm', label: t('signup.role.pm') },
    { value: 'student', label: t('signup.role.student') },
    { value: 'alumni', label: t('signup.role.alumni') },
    { value: 'newcomer', label: t('signup.role.newcomer') },
    { value: 'career', label: t('signup.role.career') },
    { value: 'other', label: t('signup.role.other') },
  ];

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t('signup.error.name');
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = t('signup.error.email');
    return errs;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);

    try {
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          role: form.role || '',
        }),
      });
      setSubmitting(false);
      if (res.ok) {
        setSubmitted(true);
      } else {
        setErrors({ email: lang === 'de' ? 'Etwas ist schiefgelaufen. Bitte nochmal versuchen.' : 'Something went wrong. Please try again.' });
      }
    } catch (err) {
      setSubmitting(false);
      setErrors({ email: lang === 'de' ? 'Netzwerkfehler. Bitte nochmal versuchen.' : 'Network error. Please try again.' });
    }
  }

  if (submitted) {
    const shareUrl = typeof window !== 'undefined' ? window.location.origin + '/' + lang + '/' : '';
    return (
      <div
        className="text-center p-8 sm:p-12 rounded-2xl border"
        style={{
          borderColor: 'var(--accent)',
          background: 'color-mix(in srgb, var(--accent) 5%, var(--bg-raised))',
        }}
      >
        <div className="text-4xl mb-4">✓</div>
        <p
          className="text-lg font-semibold mb-6"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}
        >
          {t('signup.success')}
        </p>
        <div className="pt-4" style={{ borderTop: '1px solid color-mix(in srgb, var(--fg) 8%, transparent)' }}>
          <p className="text-sm mb-3" style={{ color: 'var(--fg-muted)' }}>
            {t('signup.share')}
          </p>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(shareUrl)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono rounded-lg border transition-all hover:border-[var(--accent)]"
            style={{
              borderColor: 'color-mix(in srgb, var(--fg) 12%, transparent)',
              color: 'var(--fg-muted)',
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {lang === 'de' ? 'Link kopieren' : 'Copy link'}
          </button>
        </div>
      </div>
    );
  }

  const labelStyle = { color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' as const, letterSpacing: '0.05em' };
  const inputStyle = {
    backgroundColor: 'var(--bg-raised)',
    color: 'var(--fg)',
    borderColor: 'color-mix(in srgb, var(--fg) 12%, transparent)',
    fontFamily: 'var(--font-body)',
  };
  const errorStyle = { ...inputStyle, borderColor: 'var(--accent-alt)' };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-md mx-auto">
      {/* Name */}
      <div>
        <label htmlFor="signup-name" className="block mb-1.5" style={labelStyle}>
          {t('signup.name')} *
        </label>
        <input
          id="signup-name"
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
          style={errors.name ? errorStyle : inputStyle}
        />
        {errors.name && <p className="mt-1 text-xs" style={{ color: 'var(--accent-alt)' }}>{errors.name}</p>}
      </div>

      {/* Email */}
      <div>
        <label htmlFor="signup-email" className="block mb-1.5" style={labelStyle}>
          {t('signup.email')} *
        </label>
        <input
          id="signup-email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
          style={errors.email ? errorStyle : inputStyle}
        />
        {errors.email && <p className="mt-1 text-xs" style={{ color: 'var(--accent-alt)' }}>{errors.email}</p>}
      </div>

      {/* Role (optional) */}
      <div>
        <label htmlFor="signup-role" className="block mb-1.5" style={labelStyle}>
          {t('signup.role')}
        </label>
        <select
          id="signup-role"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] appearance-none"
          style={inputStyle}
        >
          <option value="">—</option>
          {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full px-8 py-4 text-base font-semibold rounded-full transition-all duration-300 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
        style={{ backgroundColor: 'var(--accent)', color: 'var(--bg)' }}
      >
        {submitting ? '...' : t('signup.submit')}
      </button>
    </form>
  );
}
