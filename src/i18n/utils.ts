import { translations, type Lang, type TranslationKey } from './translations';

export function getLangFromUrl(url: URL): Lang {
  const [, lang] = url.pathname.split('/');
  if (lang === 'en') return 'en';
  return 'de';
}

export function useTranslations(lang: Lang) {
  return function t(key: TranslationKey): string {
    return translations[lang][key] ?? translations['de'][key] ?? key;
  };
}

export function getAlternateLang(lang: Lang): Lang {
  return lang === 'de' ? 'en' : 'de';
}

export function getAlternateUrl(url: URL, lang: Lang): string {
  const alternate = getAlternateLang(lang);
  return url.pathname.replace(`/${lang}`, `/${alternate}`) + url.search;
}
