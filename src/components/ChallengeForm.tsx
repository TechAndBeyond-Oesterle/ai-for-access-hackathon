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

// ponytail: mock challenges from non-technical partners (city, non-profit, association) so
// first-time submitters see what a filled-in challenge looks like. Plain data, no i18n keys.
type ExampleForm = {
  title: string;
  teaser: string;
  context: string;
  problemStatement: string;
  resources: string;
  company: string;
  contactName: string;
  contactAddress: string;
  availability: string[];
  category: string[];
};

const EXAMPLES: Record<Lang, { badge: string; data: ExampleForm }[]> = {
  de: [
    {
      badge: '🏛️ Stadtverwaltung',
      data: {
        title: 'Verständliche Baugesuche für alle',
        teaser: 'Baugesuche in Leichter Sprache — damit jede:r versteht, was gebaut wird.',
        context:
          'Unsere Gemeinde veröffentlicht wöchentlich Dutzende Baugesuche auf der Website. Der Amtsdeutsch-Jargon ist für viele Bürger:innen — insbesondere Menschen mit kognitiven Einschränkungen, Lernschwierigkeiten oder wenig Deutschkenntnissen — kaum verständlich. Das führt dazu, dass Einsprachefristen verpasst werden und Betroffene sich nicht am demokratischen Prozess beteiligen können.',
        problemStatement:
          'Wie können wir Baugesuche automatisch in Leichte Sprache übersetzen und verständlich aufbereiten, ohne dass unsere Sachbearbeiter:innen jedes Dokument manuell umschreiben müssen?',
        resources:
          'Wir stellen anonymisierte Beispiel-Baugesuche der letzten 2 Jahre (PDF) sowie Zugang zu unserem öffentlichen Geoportal zur Verfügung.',
        company: 'Stadtverwaltung (Beispiel)',
        contactName: 'Fürs Beispiel: Bauamt-Sekretariat',
        contactAddress: 'beispiel@musterstadt.ch',
        availability: ['Friday Evening', 'Saturday'],
        category: ['Digital Inclusion', 'Accessibility'],
      },
    },
    {
      badge: '❤️ Sozialorganisation',
      data: {
        title: 'Termine bei der Spitex einfacher buchen',
        teaser: 'Ältere Menschen sollen Pflegetermine ohne Telefon-Marathon buchen können.',
        context:
          'Unsere Klient:innen sind mehrheitlich über 75 und wenig technikaffin. Termine für Pflege- und Betreuungsleistungen werden aktuell ausschliesslich telefonisch vereinbart, was zu langen Wartezeiten und Missverständnissen führt. Angehörige, die den Kontakt übernehmen, wohnen oft nicht in der Nähe.',
        problemStatement:
          'Wie liesse sich ein Buchungssystem gestalten, das auch für Menschen ohne Smartphone-Erfahrung, mit Sehbeeinträchtigung oder Hörproblemen nutzbar ist?',
        resources:
          'Wir können anonymisierte Umfragedaten zu den Bedürfnissen unserer Klient:innen sowie Zugang für ein Interview mit unserem Pflegeteam anbieten.',
        company: 'Gemeinnützige Sozialorganisation (Beispiel)',
        contactName: 'Fürs Beispiel: Leitung Spitex-Dienste',
        contactAddress: 'beispiel@musterorganisation.ch',
        availability: ['Saturday'],
        category: ['Health', 'Accessibility'],
      },
    },
    {
      badge: '🎓 Branchenverband',
      data: {
        title: 'Automatisches Matching: Lehrstelle ↔ Unterstützungsbedarf',
        teaser: 'Lehrstellen und Zugänglichkeits-Anforderungen algorithmisch zusammenbringen — nicht nur eine Liste.',
        context:
          'Über unsere bestehende Lehrstellenbörse (CMS mit REST-API, ca. 4\'000 aktive Inserate) läuft die Vermittlung heute rein stichwortbasiert. Betriebe geben in einem Freitextfeld an, ob sie „barrierefrei" sind, ohne einheitliche Kriterien. Jugendliche mit Rollstuhl, Hör- oder Sehbeeinträchtigung oder Assistenzbedarf müssen deshalb jedes Inserat einzeln telefonisch abklären — das ist eine zu hohe Hürde und führt zu Abbrüchen im Bewerbungsprozess.',
        problemStatement:
          'Wir brauchen ein Matching-System, das strukturierte Zugänglichkeits-Merkmale eines Betriebs (z.B. stufenloser Zugang, Höhe der Arbeitsplätze, Verfügbarkeit von Gebärdensprachdolmetscher:innen, Screenreader-taugliche interne Software) mit den Bedürfnissen der Bewerbenden abgleicht und pro Lehrstelle einen Kompatibilitäts-Score berechnet. Die Anbindung soll über unsere bestehende REST-API (OpenAPI-Spec vorhanden) erfolgen, ohne dass wir die ganze Plattform neu bauen müssen.',
        resources:
          'Wir stellen Zugriff auf unsere Inserats-API (REST, JSON, OpenAPI-Spec), einen anonymisierten Datenexport aller aktiven Inserate der letzten 12 Monate sowie die technische Dokumentation unseres CMS zur Verfügung.',
        company: 'Branchenverband (Beispiel)',
        contactName: 'Fürs Beispiel: Geschäftsstelle',
        contactAddress: 'beispiel@musterverband.ch',
        availability: ['Friday Evening'],
        category: ['Employment', 'Education', 'Accessibility'],
      },
    },
  ],
  en: [
    {
      badge: '🏛️ City Administration',
      data: {
        title: 'Plain-language building permits for everyone',
        teaser: "Turn building permit notices into Easy Language so everyone understands what's being built.",
        context:
          "Our municipality publishes dozens of building permit notices on its website every week. The bureaucratic language is hard to understand for many residents — especially people with cognitive disabilities, learning difficulties, or limited language skills. As a result, objection deadlines get missed and people are excluded from the democratic process.",
        problemStatement:
          'How can we automatically translate building permit notices into Easy Language and present them clearly, without our staff having to rewrite every document by hand?',
        resources: 'We can provide anonymised sample building permits from the last 2 years (PDF) and access to our public geoportal.',
        company: 'City Administration (example)',
        contactName: "Example: Building Office secretariat",
        contactAddress: 'example@samplecity.ch',
        availability: ['Friday Evening', 'Saturday'],
        category: ['Digital Inclusion', 'Accessibility'],
      },
    },
    {
      badge: '❤️ Social Services Org',
      data: {
        title: 'Making it easier to book home-care appointments',
        teaser: 'Older adults should be able to book care appointments without a phone marathon.',
        context:
          "Most of our clients are over 75 and not very tech-savvy. Appointments for care and support services are currently arranged exclusively by phone, leading to long wait times and misunderstandings. Family members who help often don't live nearby.",
        problemStatement:
          'How could we design a booking system that also works for people without smartphone experience, with visual impairments, or with hearing difficulties?',
        resources: "We can offer anonymised survey data on our clients' needs and access for an interview with our care team.",
        company: 'Non-profit social services organisation (example)',
        contactName: 'Example: Head of home-care services',
        contactAddress: 'example@sampleorg.ch',
        availability: ['Saturday'],
        category: ['Health', 'Accessibility'],
      },
    },
    {
      badge: '🎓 Trade Association',
      data: {
        title: 'Automated matching: apprenticeship ↔ support needs',
        teaser: 'Match apprenticeships and accessibility requirements algorithmically — not just list them.',
        context:
          'Our existing apprenticeship board (a CMS with a REST API, around 4,000 active listings) matches candidates by keyword search only. Companies state whether they\'re "accessible" in a free-text field, with no consistent criteria. Young people who use a wheelchair, are Deaf or hard of hearing, are blind or have low vision, or need assistance therefore have to call and clarify every single listing individually — too high a hurdle for many, and it causes them to drop out of the application process.',
        problemStatement:
          "We need a matching system that compares a company's structured accessibility attributes (e.g. step-free access, adjustable-height workstations, availability of sign language interpreters, screen-reader-compatible internal software) against an applicant's needs and computes a compatibility score per listing. It should connect through our existing REST API (an OpenAPI spec exists) without us having to rebuild the whole platform.",
        resources:
          'We can provide access to our listings API (REST, JSON, OpenAPI spec available), an anonymised export of all active listings from the last 12 months, and technical documentation for our CMS.',
        company: 'Trade association (example)',
        contactName: 'Example: Association office',
        contactAddress: 'example@sampleassociation.ch',
        availability: ['Friday Evening'],
        category: ['Employment', 'Education', 'Accessibility'],
      },
    },
  ],
};

function donateUrl(lang: Lang) {
  const message = encodeURIComponent('Hackathon 2026 Challenge');
  return `https://donate.raisenow.io/tjhvh?analytics.channel=embed&lng=${lang}&rnw-stored_customer_message=${message}`;
}

const BLANK_FORM: ExampleForm = {
  title: '',
  teaser: '',
  context: '',
  problemStatement: '',
  resources: '',
  company: '',
  contactName: '',
  contactAddress: '',
  availability: [],
  category: [],
};

export default function ChallengeForm({ lang }: Props) {
  const t = useTranslations(lang);

  const [form, setForm] = useState<ExampleForm>(BLANK_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // ponytail: an example is read-only mock data, not a real submission — fields lock and
  // submit is disabled while one is loaded. "Start your own" resets to a blank form.
  const [isExample, setIsExample] = useState(false);

  function updateForm(patch: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function startOwnForm() {
    setForm(BLANK_FORM);
    setErrors({});
    setIsExample(false);
  }

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
    if (isExample) return;
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
        <p className="text-sm mb-3 max-w-md mx-auto leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
          {t('challenges.form.donate.pitch')}
        </p>
        <p className="text-sm mb-4 font-medium" style={{ color: 'var(--fg)' }}>
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
        <p className="text-xs mb-2" style={{ color: 'var(--fg-muted)' }}>
          {isExample ? t('challenges.form.examples.blocked') : t('challenges.form.examples.label')}
        </p>
        <div className="flex flex-wrap gap-2">
          {isExample ? (
            <button
              type="button"
              onClick={startOwnForm}
              className="px-3 py-1.5 text-xs rounded-full border transition-all hover:scale-105"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
            >
              {t('challenges.form.examples.back')}
            </button>
          ) : (
            EXAMPLES[lang].map(({ badge, data }) => (
              <button
                key={badge}
                type="button"
                onClick={() => {
                  setForm(data);
                  setErrors({});
                  setIsExample(true);
                }}
                className="px-3 py-1.5 text-xs rounded-full border transition-all hover:scale-105"
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
              >
                {badge}
              </button>
            ))
          )}
        </div>
      </div>

      <div>
        <label htmlFor="challenge-title" className="block mb-1.5" style={labelStyle}>
          {t('challenges.form.title')} *
        </label>
        <input
          id="challenge-title"
          type="text"
          value={form.title}
          onChange={(e) => updateForm({ title: e.target.value })}
          disabled={isExample}
          className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] disabled:opacity-70"
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
          onChange={(e) => updateForm({ teaser: e.target.value })}
          disabled={isExample}
          className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] disabled:opacity-70"
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
          rows={7}
          value={form.context}
          onChange={(e) => updateForm({ context: e.target.value })}
          disabled={isExample}
          className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] disabled:opacity-70"
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
          rows={7}
          value={form.problemStatement}
          onChange={(e) => updateForm({ problemStatement: e.target.value })}
          disabled={isExample}
          className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] disabled:opacity-70"
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
          onChange={(e) => updateForm({ resources: e.target.value })}
          disabled={isExample}
          className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] disabled:opacity-70"
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
          onChange={(e) => updateForm({ company: e.target.value })}
          disabled={isExample}
          className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] disabled:opacity-70"
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
          onChange={(e) => updateForm({ contactName: e.target.value })}
          disabled={isExample}
          className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] disabled:opacity-70"
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
          onChange={(e) => updateForm({ contactAddress: e.target.value })}
          disabled={isExample}
          className="w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] disabled:opacity-70"
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
                disabled={isExample}
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
                disabled={isExample}
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
        disabled={submitting || isExample}
        className="w-full px-8 py-4 text-base font-semibold rounded-full transition-all duration-300 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
        style={{ backgroundColor: 'var(--accent)', color: 'var(--bg)' }}
      >
        {submitting ? '...' : t('challenges.form.submit')}
      </button>
    </form>
  );
}
