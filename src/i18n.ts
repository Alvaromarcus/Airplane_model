import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import pt from './locales/pt';
import es from './locales/es';
import fr from './locales/fr';
import zh from './locales/zh';

export const LANGUAGES = [
  { code: 'pt', label: 'Português', html: 'pt-BR' },
  { code: 'en', label: 'English', html: 'en-US' },
  { code: 'es', label: 'Español', html: 'es' },
  { code: 'fr', label: 'Français', html: 'fr' },
  { code: 'zh', label: '中文', html: 'zh-CN' },
] as const;
export type LangCode = (typeof LANGUAGES)[number]['code'];

const resources = {
  en: { translation: en },
  pt: { translation: pt },
  es: { translation: es },
  fr: { translation: fr },
  zh: { translation: zh },
};

const isLang = (v: string | null | undefined): v is LangCode => !!v && LANGUAGES.some(l => l.code === v);

/** Saved choice, else the browser language (pt-BR → pt, zh-TW → zh…), else English. */
function detectLanguage(): LangCode {
  try {
    const saved = localStorage.getItem('aerobuilder_lang');
    if (isLang(saved)) return saved;
  } catch { /* storage unavailable */ }
  const nav = typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : [];
  for (const n of nav) {
    const code = n?.toLowerCase().slice(0, 2);
    if (isLang(code)) return code;
  }
  return 'en';
}

/** Applies a language: i18next, <html lang> and the saved preference. */
export function setLanguage(code: LangCode) {
  i18n.changeLanguage(code);
  if (typeof document !== 'undefined') document.documentElement.lang = LANGUAGES.find(l => l.code === code)!.html;
  try { localStorage.setItem('aerobuilder_lang', code); } catch { /* ignore */ }
}

/** Current language as one of the supported codes. */
export function currentLang(): LangCode {
  const c = (i18n.resolvedLanguage ?? i18n.language ?? 'en').slice(0, 2);
  return isLang(c) ? c : 'en';
}

const initialLang = detectLanguage();
if (typeof document !== 'undefined') {
  document.documentElement.lang = LANGUAGES.find(l => l.code === initialLang)!.html;
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLang,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
