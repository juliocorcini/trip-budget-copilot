import type { AssistantPreview } from '@/domain/assistant';

/**
 * AI Quick Entry (DEC-246) — the preview HEADLINE composer, extracted as a pure
 * function so the "what will this save?" line is unit-testable on its own.
 *
 * The split fix (device-test 2026-06-20): a divided expense someone ELSE paid
 * carries BOTH `debtDirection:'i_owe'` AND `participantNames`/`perPersonCents`.
 * The old code checked `debtDirection` first and printed the FULL amount, so a
 * 3-way €12 read "you'll owe Bruno €12" instead of MY share, €4. We now branch
 * on "is this a split?" first and show the per-person slice for both debt
 * directions, while the pure (non-split) cases keep showing the full amount.
 */
type Translate = (key: string, opts?: Record<string, unknown>) => string;
type FormatMoney = (cents?: number, currency?: string) => string;

export function composePreview(preview: AssistantPreview, t: Translate, money: FormatMoney): string {
  const amount = money(preview.amountCents, preview.currency);

  if (preview.op === 'navigate') return t(`assistant.nav.${preview.navKey ?? 'open'}`);

  if (preview.op === 'expense') {
    const count = preview.participantNames?.length ?? 0;
    const isSplit = count > 0;
    const per = money(preview.perPersonCents, preview.currency);

    if (preview.debtDirection === 'i_owe') {
      // Someone else paid. Split → I owe only my slice; pure → I owe the total.
      return isSplit
        ? t('assistant.preview.split_i_owe', { person: preview.personName, per, amount, count })
        : t('assistant.preview.someone_paid', { person: preview.personName, amount });
    }
    if (preview.debtDirection === 'owes_me') {
      // I paid. Split among several others → each owes a slice; one → owes total.
      return isSplit
        ? t('assistant.preview.split_owes_me', { per, amount, count })
        : t('assistant.preview.i_paid_for', { person: preview.personName, amount });
    }
    // I paid and I'm a sharer (no debt direction) → classic "split N ways" read.
    if (isSplit) return t('assistant.preview.split', { amount, count, per });
    return t('assistant.preview.log_expense', { amount });
  }

  if (preview.op === 'income') return t('assistant.preview.income', { amount });
  if (preview.op === 'transfer')
    return t('assistant.preview.transfer', {
      amount,
      from: preview.walletFromName ?? '',
      to: preview.walletToName ?? '',
    });
  if (preview.op === 'withdraw') return t('assistant.preview.withdraw', { amount });
  if (preview.op === 'settle') {
    const value = preview.amountCents ? amount : t('assistant.preview.settle_full');
    return preview.debtDirection === 'owes_me'
      ? t('assistant.preview.settle_owes_me', { person: preview.personName, amount: value })
      : t('assistant.preview.settle_i_owe', { person: preview.personName, amount: value });
  }
  if (preview.op === 'plan_purchase')
    return t('assistant.preview.plan_purchase', { item: preview.itemName, amount });
  if (preview.op === 'event') {
    // DEC-410: "create event {name}" — with a reserve when one was stated, else a
    // track-only event. The "starts now" cue is shown as a chip, not the headline.
    const key = preview.amountCents ? 'assistant.preview.plan_event' : 'assistant.preview.plan_event_track';
    return t(key, { name: preview.itemName ?? '', amount });
  }
  return amount;
}
