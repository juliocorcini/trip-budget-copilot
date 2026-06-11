import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { setActiveLanguage } from '@/domain/locale';
import ptBR from './locales/pt-BR.json';
import en from './locales/en.json';
import es from './locales/es.json';

// PAR-001/002 (R6-15/16): keep the domain locale bridge in sync with i18n so
// date/number formatters follow the active language.
i18n.on('languageChanged', setActiveLanguage);

i18n.use(initReactI18next).init({
  resources: {
    'pt-BR': { translation: ptBR },
    en: { translation: en },
    es: { translation: es },
  },
  lng: 'pt-BR',
  fallbackLng: 'pt-BR',
  returnEmptyString: false,
  interpolation: { escapeValue: false },
});

export default i18n;
