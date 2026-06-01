/**
 * i18n — Language Support System
 *
 * Detects device locale via expo-localization.
 * Falls back to English for unsupported locales.
 * Supported: en, es, fr, de, pt, hi, zh, ja, ar, it
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from './locales/en';
import es from './locales/es';
import fr from './locales/fr';
import de from './locales/de';
import pt from './locales/pt';
import hi from './locales/hi';
import zh from './locales/zh';
import ja from './locales/ja';
import ar from './locales/ar';
import it from './locales/it';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English',    nativeName: 'English',    rtl: false },
  { code: 'es', name: 'Spanish',    nativeName: 'Español',    rtl: false },
  { code: 'fr', name: 'French',     nativeName: 'Français',   rtl: false },
  { code: 'de', name: 'German',     nativeName: 'Deutsch',    rtl: false },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português',  rtl: false },
  { code: 'hi', name: 'Hindi',      nativeName: 'हिन्दी',       rtl: false },
  { code: 'zh', name: 'Chinese',    nativeName: '中文',         rtl: false },
  { code: 'ja', name: 'Japanese',   nativeName: '日本語',        rtl: false },
  { code: 'ar', name: 'Arabic',     nativeName: 'العربية',     rtl: true  },
  { code: 'it', name: 'Italian',    nativeName: 'Italiano',   rtl: false },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];
export const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);

/** Get device locale and map to a supported language code */
export function getDeviceLanguage(): LanguageCode {
  const locale = Localization.getLocales()[0]?.languageCode ?? 'en';
  const base = locale.split('-')[0].toLowerCase();
  if ((SUPPORTED_CODES as readonly string[]).includes(base)) {
    return base as LanguageCode;
  }
  return 'en';
}

export function isRTL(code: LanguageCode): boolean {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.rtl ?? false;
}

i18n.use(initReactI18next).init({
  resources: { en, es, fr, de, pt, hi, zh, ja, ar, it },
  lng: getDeviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export default i18n;
