// src/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { loadRemoteLanguages } from './lib/loadLanguages';

const savedLanguage = localStorage.getItem('app_language') || 'en';

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
