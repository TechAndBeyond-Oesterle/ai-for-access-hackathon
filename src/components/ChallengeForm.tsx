import { useState, type FormEvent } from 'react';
import type { Lang } from '../i18n/translations';
import { useTranslations } from '../i18n/utils';

interface Props {
  lang: Lang;
}

const API_ENDPOINT = '/api/challenges';
const CATEGORY_OPTIONS = [
  { value: 'Digital Inclusion', key: 'challenges.form.category.digitalInclusion' },
  { value: 'Legal Tech', key: 'challenges.form.category.legalTech' },
  { value: 'Health', key: 'challenges.form.category.health' },
  { value: 'Employment', key: 'challenges.form.category.employment' },
  { value: 'Education', key: 'challenges.form.category.education' },
  { value: 'Accessibility', key: 'challenges.form.category.accessibility' },
  { value: 'Other', key: 'challenges.form.category.other' },
] as const;
const AVAILABILITY_OPTIONS = [
  { value: 'Friday Evening', key: 'challenges.form.availability.friday' },
  { value: 'Saturday', key: 'challenges.form.availability.saturday' },
] as const;

function donateUrl(lang: Lang) {
  const message = encodeURIComponent('Hackathon 2026 Challenge');
  return `https://donate.raisenow.io/tjhvh?analytics.channel=embed&lng=${lang}&rnw-stored_customer_message=${message}`;
}

export default function ChallengeForm({ lang }: Props) {
  const t = useTranslations(lang);

  const [form, setForm] = useState({
    title: '',
    teaser: '',
    context: '',
    problemStatement: '',
    resources: '',
    company: '',
    contactName: '',
    contactAddress: '',
    availability: [] as string[],
    category: [] as string[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = t('challenges.form.error.title');
    if (!form.context.trim()) errs.context = t('challenges.form.error.context');
    if (!form.problemStatement.trim()) errs.problemStatement = t('challenges.form.error.problemStatement');
    if (!form.company.trim()) errs.company = t('challenges.form.error.company');
    if (!form.contactName.trim()) errs.contactName = t('challenges.form.error.contactName');
    if (!form.contactAddress.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactAddress))
      errs.contactAddress = t('challenges.form.error.contact');
    if (form.availability.length === 0) errs.availability = t('challenges.form.error.availability');
    if (form.category.length === 0) errs.category = t('challenges.form.error.category');
    return errs;
  }

  function toggleValue(field: 'category' | 'availability', value: string) {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(value) ? f[field].filter((v) => v !== value) : [...f[field], value],
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
        setErrors({ title: t('challenges.form.error.generic') });
      }
    } catch (err) {
      setSubmitting(false);
      setErrors({ title: t('challenges.form.error.network') });
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
          className="text-lg font-semibold mb-6"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}
        >
          {t('challenges.form.success')}
        </p>
        <p className="text-sm mb-4" style={{ color: 'var(--fg-muted)' }}>
          {t('challenges.form.donate.hint')}
        </p>
        <a
          href={donateUrl(lang)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold border-2 transition-all duration-300 hover:scale-105"
          style={{ borderColor: 'var(--accent)', color: 'var(--accent)', borderRadius: 'var(--radius)' }}
        >
          {t('challenges.form.donate.cta')}
        </a>
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
        <label htmlFor="challenge-title" className="block mb-1.5" style={labelStyle}>
          {t('challenges.form.title')} *
        </label>
        <input
          id="challenge-title"
          type="text"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
          style={errors.title ? errorStyle : inputStyle}
        />
        {errors.title && <p className="mt-1 text-xs" style={{ color: 'var(--accent-alt)' }}>{errors.title}</p>}
      </div>

      <div>
        <label htmlFor="challenge-teaser" className="block mb-1.5" style={labelStyle}>
          {t('challenges.form.teaser')}
        </label>
        <p className="text-xs mb-2" style={{ color: 'var(--fg-muted)' }}>
          {t('challenges.form.teaser.hint')}
        </p>
        <input
          id="challenge-teaser"
          type="text"
          value={form.teaser}
          onChange={(e) => setForm({ ...form, teaser: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="challenge-context" className="block mb-1.5" style={labelStyle}>
          {t('challenges.form.context')} *
        </label>
        <p className="text-xs mb-2" style={{ color: 'var(--fg-muted)' }}>
          {t('challenges.form.context.hint')}
        </p>
        <textarea
          id="challenge-context"
          rows={4}
          value={form.context}
          onChange={(e) => setForm({ ...form, context: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
          style={errors.context ? errorStyle : inputStyle}
        />
        {errors.context && <p className="mt-1 text-xs" style={{ color: 'var(--accent-alt)' }}>{errors.context}</p>}
      </div>

      <div>
        <label htmlFor="challenge-problem" className="block mb-1.5" style={labelStyle}>
          {t('challenges.form.problemStatement')} *
        </label>
        <p className="text-xs mb-2" style={{ color: 'var(--fg-muted)' }}>
          {t('challenges.form.problemStatement.hint')}
        </p>
        <textarea
          id="challenge-problem"
          rows={4}
          value={form.problemStatement}
          onChange={(e) => setForm({ ...form, problemStatement: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
          style={errors.problemStatement ? errorStyle : inputStyle}
        />
        {errors.problemStatement && <p className="mt-1 text-xs" style={{ color: 'var(--accent-alt)' }}>{errors.problemStatement}</p>}
      </div>

      <div>
        <label htmlFor="challenge-resources" className="block mb-1.5" style={labelStyle}>
          {t('challenges.form.resources')}
        </label>
        <p className="text-xs mb-2" style={{ color: 'var(--fg-muted)' }}>
          {t('challenges.form.resources.hint')}
        </p>
        <textarea
          id="challenge-resources"
          rows={3}
          value={form.resources}
          onChange={(e) => setForm({ ...form, resources: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="challenge-company" className="block mb-1.5" style={labelStyle}>
          {t('challenges.form.company')} *
        </label>
        <input
          id="challenge-company"
          type="text"
          value={form.company}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
          style={errors.company ? errorStyle : inputStyle}
        />
        {errors.company && <p className="mt-1 text-xs" style={{ color: 'var(--accent-alt)' }}>{errors.company}</p>}
      </div>

      <div>
        <label htmlFor="challenge-contact-name" className="block mb-1.5" style={labelStyle}>
          {t('challenges.form.contactName')} *
        </label>
        <input
          id="challenge-contact-name"
          type="text"
          value={form.contactName}
          onChange={(e) => setForm({ ...form, contactName: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
          style={errors.contactName ? errorStyle : inputStyle}
        />
        {errors.contactName && <p className="mt-1 text-xs" style={{ color: 'var(--accent-alt)' }}>{errors.contactName}</p>}
      </div>

      <div>
        <label htmlFor="challenge-contact" className="block mb-1.5" style={labelStyle}>
          {t('challenges.form.contact')} *
        </label>
        <input
          id="challenge-contact"
          type="email"
          value={form.contactAddress}
          onChange={(e) => setForm({ ...form, contactAddress: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
          style={errors.contactAddress ? errorStyle : inputStyle}
        />
        {errors.contactAddress && <p className="mt-1 text-xs" style={{ color: 'var(--accent-alt)' }}>{errors.contactAddress}</p>}
      </div>

      <div>
        <label className="block mb-1.5" style={labelStyle}>
          {t('challenges.form.availability')} *
        </label>
        <div className="flex flex-wrap gap-4">
          {AVAILABILITY_OPTIONS.map(({ value, key }) => (
            <label key={value} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--fg)' }}>
              <input
                type="checkbox"
                checked={form.availability.includes(value)}
                onChange={() => toggleValue('availability', value)}
                className="w-4 h-4"
              />
              {t(key)}
            </label>
          ))}
        </div>
        {errors.availability && <p className="mt-1 text-xs" style={{ color: 'var(--accent-alt)' }}>{errors.availability}</p>}
      </div>

      <div>
        <label className="block mb-1.5" style={labelStyle}>
          {t('challenges.form.category')} *
        </label>
        <div className="flex flex-wrap gap-3">
          {CATEGORY_OPTIONS.map(({ value, key }) => (
            <label key={value} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--fg)' }}>
              <input
                type="checkbox"
                checked={form.category.includes(value)}
                onChange={() => toggleValue('category', value)}
                className="w-4 h-4"
              />
              {t(key)}
            </label>
          ))}
        </div>
        {errors.category && <p className="mt-1 text-xs" style={{ color: 'var(--accent-alt)' }}>{errors.category}</p>}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full px-8 py-4 text-base font-semibold rounded-full transition-all duration-300 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
        style={{ backgroundColor: 'var(--accent)', color: 'var(--bg)' }}
      >
        {submitting ? '...' : t('challenges.form.submit')}
      </button>
    </form>
  );
}
