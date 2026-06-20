import { EXPENSE_CATEGORY_KEYS } from './resolve';
import type { Participant } from '@/domain/types/participant';
import type { Wallet } from '@/domain/types/wallet';
import type { CurrentPlace } from '@/domain/types/common';

/**
 * AI Quick Entry (DEC-246) — the minimal "context pack" sent to the cloud model
 * so it can map names/labels correctly. It carries ONLY low-sensitivity hints:
 * first names/nicknames, wallet names, the category taxonomy, the current place
 * label, language and base currency. It NEVER includes ids, amounts, balances or
 * history. In "private names" mode the people/wallet lists are withheld entirely
 * (the device then always asks "who?" on a name) — privacy-first, like
 * `cloudReceiptOcrEnabled` (ÂNCORA 8).
 */
export interface AssistantContextPack {
  language: string;
  baseCurrency: string;
  /** YYYY-MM-DD, so the model can resolve relative dates if it must. */
  today: string;
  place: string | null;
  participants: string[];
  wallets: string[];
  categories: string[];
  privateNames: boolean;
}

export interface BuildAssistantContextInput {
  language: string;
  baseCurrency: string;
  now?: Date;
  place: CurrentPlace | null;
  participants: Participant[];
  wallets: Wallet[];
  privateNames: boolean;
}

export function buildAssistantContext(input: BuildAssistantContextInput): AssistantContextPack {
  const now = input.now ?? new Date();
  const names = input.privateNames
    ? []
    : input.participants.filter((p) => !p.isOwner).map((p) => p.nickname ?? p.name);
  const wallets = input.privateNames ? [] : input.wallets.map((w) => w.name);

  return {
    language: input.language,
    baseCurrency: input.baseCurrency,
    today: now.toISOString().slice(0, 10),
    place: input.place?.label ?? null,
    participants: names,
    wallets,
    categories: [...EXPENSE_CATEGORY_KEYS],
    privateNames: input.privateNames,
  };
}
