import { createInstance } from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import es from './locales/es.json' with { type: 'json' };
import en from './locales/en.json' with { type: 'json' };
import de from './locales/de.json' with { type: 'json' };
import fr from './locales/fr.json' with { type: 'json' };
const i18n = createInstance();
export const languages = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
] as const;
export type Language = typeof languages[number]['code'];
export function supportedLanguage(value: string | null | undefined): Language {
  const base = value?.toLowerCase().split(/[-_]/)[0];
  return languages.some(language => language.code === base) ? base as Language : 'es';
}
void i18n.use(initReactI18next).init({ lng: 'es', fallbackLng: 'es', keySeparator: false, nsSeparator: false,
  resources: { es: { translation: es }, en: { translation: en }, de: { translation: de }, fr: { translation: fr } },
  interpolation: { escapeValue: false }, initAsync: false,
});
export function t(text: string, values?: Record<string, unknown>): string { return String(i18n.t(text, values ?? {})); }
export function useLanguage() { return useTranslation().i18n.language; }
export function intlLocale() { return ({ es: 'es-ES', en: 'en-GB', de: 'de-DE', fr: 'fr-FR' })[supportedLanguage(i18n.language)]; }
export { i18n };
