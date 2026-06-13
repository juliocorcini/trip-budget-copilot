import { parseLocaleNumber } from '@/domain/money';

/**
 * E1 (M11): turns a free-form voice transcript into a draft expense. It is
 * intentionally forgiving — it extracts the first number as the amount and
 * keeps the remaining words as the description, stripping the obvious command
 * verb and currency words. The user always reviews the draft before saving.
 */
export interface VoiceExpenseParse {
  amountCents: number | null;
  description: string;
}

// Currency words/symbols in the three supported languages.
const CURRENCY_TOKENS =
  /\b(euros?|reais?|real|d[óo]lares?|dollars?|pesos?|bucks?)\b|r\$|[€$]/gi;

// Leading "spend" verbs people naturally say — dropped so they do not pollute
// the description ("gastei 25 no mercado" → "mercado").
const SPEND_VERBS = /\b(gastei|paguei|gast[ée]|pagu[ée]|spent|paid)\b/gi;

// First number in the phrase, accepting both "12,50" and "12.50" forms.
const AMOUNT_PATTERN = /\d+(?:[.,]\d+)?/;

export function parseVoiceExpense(transcript: string): VoiceExpenseParse {
  const text = transcript.trim();
  if (text === '') return { amountCents: null, description: '' };

  let amountCents: number | null = null;
  let working = text;

  const match = text.match(AMOUNT_PATTERN);
  if (match) {
    const value = parseLocaleNumber(match[0]);
    amountCents = value !== null ? Math.round(value * 100) : null;
    working = working.replace(match[0], ' ');
  }

  const description = working
    .replace(CURRENCY_TOKENS, ' ')
    .replace(SPEND_VERBS, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { amountCents, description };
}
