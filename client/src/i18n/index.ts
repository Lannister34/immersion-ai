import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en, ru } from './locales';

export type UiLanguage = 'ru' | 'en';

export function initI18n(language: UiLanguage): void {
  if (i18n.isInitialized) {
    i18n.changeLanguage(language);
    return;
  }

  i18n.use(initReactI18next).init({
    resources: {
      ru: { translation: ru },
      en: { translation: en },
    },
    lng: language,
    fallbackLng: 'ru',
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });
}

export { i18n };
