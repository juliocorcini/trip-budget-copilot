import { extractReceiptViaCloud } from '@/utils/ai-ocr';
import { requestAssistantIntents } from '@/utils/ai-assistant';
import { compressImageFile, blobToDataUrl } from '@/utils/image/compress';
import { summarizeReceiptTotal, dominantReceiptCategory } from '@/domain/receipt';
import { EXPENSE_CATEGORY_KEYS } from '@/domain/assistant';
import { toCents } from '@/domain/money';
import type { AssistantContextPack } from '@/domain/assistant';

/**
 * C23 / DEC-297 (m3) — AI/receipt entry for a Tricount expense. A group split
 * books ONE expense per bill (the per-item detail is the single-bill SplitSession's
 * job), so both paths return the same minimal prefill the editor needs: a
 * description, a total in cents, and a best-effort category. They reuse the
 * existing cloud boundaries (`/ocr`, `/assistant`) and never throw — every failure
 * folds into a typed error so the editor degrades to manual entry.
 */
export interface GroupExpensePrefill {
  description: string;
  amountCents: number;
  category: string;
}

export type GroupAiError = 'not_configured' | 'rate_limited' | 'offline' | 'failed' | 'empty';

export type GroupAiOutcome =
  | { ok: true; prefill: GroupExpensePrefill }
  | { ok: false; error: GroupAiError };

/** Scan a receipt photo → one summarized group expense (merchant + total). */
export async function scanReceiptForGroup(file: File): Promise<GroupAiOutcome> {
  try {
    const image = await compressImageFile(file);
    const dataUrl = await blobToDataUrl(image.blob);
    const outcome = await extractReceiptViaCloud(dataUrl);
    if (!outcome.ok) {
      return { ok: false, error: outcome.error === 'rate_limited' ? 'rate_limited' : outcome.error };
    }
    const summary = summarizeReceiptTotal(outcome.plan);
    if (!summary) return { ok: false, error: 'empty' };
    return {
      ok: true,
      prefill: {
        description: summary.merchant ?? '',
        amountCents: summary.amountCents,
        category: dominantReceiptCategory(outcome.plan.items) ?? 'other',
      },
    };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

/** Parse a free-text phrase ("churrasco 90 reais") → one group expense. */
export async function parseTextForGroup(
  text: string,
  currency: string,
  language: string,
): Promise<GroupAiOutcome> {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { ok: false, error: 'empty' };

  // Minimal, low-sensitivity pack: the group resolves people/wallets by hand, so
  // those lists stay empty — the model only needs the language, currency and the
  // category taxonomy to read an amount + description out of the phrase.
  const context: AssistantContextPack = {
    language,
    baseCurrency: currency,
    today: new Date().toISOString().slice(0, 10),
    place: null,
    participants: [],
    wallets: [],
    categories: [...EXPENSE_CATEGORY_KEYS],
    privateNames: false,
  };

  const outcome = await requestAssistantIntents(trimmed, context);
  if (!outcome.ok) {
    return { ok: false, error: outcome.error === 'rate_limited' ? 'rate_limited' : outcome.error };
  }
  const intent = outcome.intents.find((i) => i.amount !== null && i.amount > 0) ?? outcome.intents[0];
  if (!intent || intent.amount === null || intent.amount <= 0) return { ok: false, error: 'empty' };

  return {
    ok: true,
    prefill: {
      description: (intent.description ?? '').trim(),
      amountCents: toCents(intent.amount),
      category: intent.category ?? 'other',
    },
  };
}
