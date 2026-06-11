import type { Locale } from 'date-fns';
import { ptBR, enUS, es } from 'date-fns/locale';

/**
 * PAR-001/002 (R6-15/16): single bridge between the active i18n language and
 * every formatting concern (dates, numbers, currency). The i18n layer pushes
 * language changes here; domain formatters read from it so the 80+ call sites
 * stay untouched.
 */

export type AppLanguage = 'pt-BR' | 'en' | 'es';

interface LanguageConfig {
  intlLocale: string;
  dateFnsLocale: Locale;
  decimalSeparator: string;
  /** pt-BR reference patterns translated per language (data-driven). */
  datePatterns: Record<string, string>;
}

const LANGUAGE_CONFIGS: Record<AppLanguage, LanguageConfig> = {
  'pt-BR': {
    intlLocale: 'pt-BR',
    dateFnsLocale: ptBR,
    decimalSeparator: ',',
    datePatterns: {},
  },
  en: {
    intlLocale: 'en-US',
    dateFnsLocale: enUS,
    decimalSeparator: '.',
    datePatterns: {
      'dd/MM/yyyy': 'MM/dd/yyyy',
      'dd/MM': 'MM/dd',
      "d 'de' MMMM": 'MMMM d',
    },
  },
  es: {
    intlLocale: 'es-ES',
    dateFnsLocale: es,
    decimalSeparator: ',',
    datePatterns: {},
  },
};

const DEFAULT_LANGUAGE: AppLanguage = 'pt-BR';

let activeLanguage: AppLanguage = DEFAULT_LANGUAGE;

function isAppLanguage(value: string): value is AppLanguage {
  return value in LANGUAGE_CONFIGS;
}

export function setActiveLanguage(language: string): void {
  activeLanguage = isAppLanguage(language) ? language : DEFAULT_LANGUAGE;
}

export function getActiveLanguage(): AppLanguage {
  return activeLanguage;
}

export function getActiveIntlLocale(): string {
  return LANGUAGE_CONFIGS[activeLanguage].intlLocale;
}

export function getActiveDateFnsLocale(): Locale {
  return LANGUAGE_CONFIGS[activeLanguage].dateFnsLocale;
}

export function getActiveDecimalSeparator(): string {
  return LANGUAGE_CONFIGS[activeLanguage].decimalSeparator;
}

/** Translates a pt-BR reference date pattern to the active language. */
export function translateDatePattern(pattern: string): string {
  return LANGUAGE_CONFIGS[activeLanguage].datePatterns[pattern] ?? pattern;
}
