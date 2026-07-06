import { currencyFlag, currencyPriority } from '@/domain/money';

/**
 * DEC-473 — the app-standard currency option label (Julio: "todo lugar segue o
 * mesmo padrão"): MAJORS read as `🇧🇷 BRL · Real brasileiro` (flag + code +
 * localized name via Intl.DisplayNames — pt/en/es for free, no name table);
 * every other currency stays a bare code so long pickers don't drown.
 */

// Intl.DisplayNames construction is not free — cache one instance per language.
const displayNamesByLanguage = new Map<string, Intl.DisplayNames | null>();

function currencyDisplayNames(language: string): Intl.DisplayNames | null {
  if (!displayNamesByLanguage.has(language)) {
    try {
      displayNamesByLanguage.set(language, new Intl.DisplayNames([language], { type: 'currency' }));
    } catch {
      displayNamesByLanguage.set(language, null);
    }
  }
  return displayNamesByLanguage.get(language) ?? null;
}

export function buildCurrencyOptionLabel(code: string, language: string): string {
  const clean = code.trim().toUpperCase();
  // Minors: bare code (priority Infinity = not a major).
  if (!Number.isFinite(currencyPriority(clean))) return clean;
  const flag = currencyFlag(clean);
  let name = '';
  try {
    name = currencyDisplayNames(language)?.of(clean) ?? '';
  } catch {
    name = '';
  }
  const namePart = name && name.toUpperCase() !== clean ? ` · ${name}` : '';
  return `${flag ? `${flag} ` : ''}${clean}${namePart}`;
}
