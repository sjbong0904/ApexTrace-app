// src/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { normalizeLanguageCode } from './constants/languages';
import { loadRemoteLanguages } from './lib/loadLanguages';

const stored = localStorage.getItem('app_language');
const savedLanguage = normalizeLanguageCode(stored || 'en');
if (stored && stored !== savedLanguage) {
    localStorage.setItem('app_language', savedLanguage);
}

export const i18nReady = i18n
    .use(initReactI18next)
    .init({
        resources: {},
        lng: savedLanguage,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
    })
    .then(() => loadRemoteLanguages());

export default i18n;
