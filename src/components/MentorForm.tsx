import { useState, type FormEvent } from 'react';
import type { Lang } from '../i18n/translations';
import { useTranslations } from '../i18n/utils';

interface Props {
  lang: Lang;
}

const API_ENDPOINT = '/api/mentors';
const DATE_OPTIONS = ['20.11.2026', '21.11.2026'] as const;

export default function MentorForm({ lang }: Props) {
  const t = useTranslations(lang);

  const [form, setForm] = useState({ name: '', email: '', dates: [] as string[], domain: '', phone: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t('mentors.error.name');
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = t('mentors.error.email');
    if (form.dates.length === 0) errs.dates = t('mentors.error.dates');
    if (!form.domain.trim()) errs.domain = t('mentors.error.domain');
    if (!form.phone.trim()) errs.phone = t('mentors.error.phone');
    return errs;
  }

  function toggleDate(date: string) {
    setForm((f) => ({
      ...f,
      dates: f.dates.includes(date) ? f.dates.filter((d) => d !== date) : [...f.dates, date],
    }));
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
        body: JSON.stringify(form),
      });
      setSubmitting(false);
      if (res.ok) {
        setSubmitted(true);
      } else {
        setErrors({ email: t('mentors.error.generic') });
      }
    } catch (err) {
      setSubmitting(false);
      setErrors({ email: t('mentors.error.network') });
    }
  }

  if (submitted) {
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
          className="text-lg font-semibold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}
        >
          {t('mentors.success')}
        </p>
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
      <div>
        <label htmlFor="mentor-name" className="block mb-1.5" style={labelStyle}>
          {t('mentors.name')} *
        </label>
        <input
          id="mentor-name"
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
          style={errors.name ? errorStyle : inputStyle}
        />
        {errors.name && <p className="mt-1 text-xs" style={{ color: 'var(--accent-alt)' }}>{errors.name}</p>}
      </div>

      <div>
        <label htmlFor="mentor-email" className="block mb-1.5" style={labelStyle}>
          {t('mentors.email')} *
        </label>
        <input
          id="mentor-email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
          style={errors.email ? errorStyle : inputStyle}
        />
        {errors.email && <p className="mt-1 text-xs" style={{ color: 'var(--accent-alt)' }}>{errors.email}</p>}
      </div>

      <div>
        <label className="block mb-1.5" style={labelStyle}>
          {t('mentors.dates')} *
        </label>
        <p className="text-xs mb-2" style={{ color: 'var(--fg-muted)' }}>
          {t('mentors.dates.hint')}
        </p>
        <div className="flex gap-4">
          {DATE_OPTIONS.map((date, i) => (
            <label key={date} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--fg)' }}>
              <input
                type="checkbox"
                checked={form.dates.includes(date)}
                onChange={() => toggleDate(date)}
                className="w-4 h-4"
              />
              {i === 0 ? t('mentors.dates.fri') : t('mentors.dates.sat')}
            </label>
          ))}
        </div>
        {errors.dates && <p className="mt-1 text-xs" style={{ color: 'var(--accent-alt)' }}>{errors.dates}</p>}
      </div>

      <div>
        <label htmlFor="mentor-domain" className="block mb-1.5" style={labelStyle}>
          {t('mentors.domain')} *
        </label>
        <input
          id="mentor-domain"
          type="text"
          value={form.domain}
          placeholder={t('mentors.domain.placeholder')}
          onChange={(e) => setForm({ ...form, domain: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
          style={errors.domain ? errorStyle : inputStyle}
        />
        {errors.domain && <p className="mt-1 text-xs" style={{ color: 'var(--accent-alt)' }}>{errors.domain}</p>}
      </div>

      <div>
        <label htmlFor="mentor-phone" className="block mb-1.5" style={labelStyle}>
          {t('mentors.phone')} *
        </label>
        <input
          id="mentor-phone"
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
          style={errors.phone ? errorStyle : inputStyle}
        />
        {errors.phone && <p className="mt-1 text-xs" style={{ color: 'var(--accent-alt)' }}>{errors.phone}</p>}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full px-8 py-4 text-base font-semibold rounded-full transition-all duration-300 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
        style={{ backgroundColor: 'var(--accent)', color: 'var(--bg)' }}
      >
        {submitting ? '...' : t('mentors.submit')}
      </button>
    </form>
  );
}
