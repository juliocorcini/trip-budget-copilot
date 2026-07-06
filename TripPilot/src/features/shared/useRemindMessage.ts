import { useTranslation } from 'react-i18next';
import { useLiveSettings } from '@/hooks/useLiveSettings';
import {
  buildPaymentInstructions,
  buildPaymentInstructionsForCurrency,
  type PaymentMethod,
  type PaymentMethodKind,
} from '@/domain/payment';

export interface RemindMessageArgs {
  /** Debtor's display name woven into the greeting. */
  name: string;
  /** Pre-formatted amount owed (e.g. "R$ 42,00"). */
  amount: string;
  /** Trip name; when absent the no-trip variant is used. */
  tripName?: string | null;
  /**
   * DEC-476 — the debt's currency. When set, only payment methods that can
   * receive THAT currency are appended (a BRL charge never shows a EUR-only
   * IBAN). Absent → all enabled methods (legacy behavior).
   */
  currency?: string | null;
  /**
   * DEC-476 — the public charge-page URL. When set it is appended so the
   * debtor can open the itemized charge (photos included) from the message.
   */
  chargeUrl?: string | null;
}

/**
 * G4 (DEC-244): single source of truth for the "Lembrar/Cobrar" message, shared
 * by the settle-up hub and the post-split nudge so the wording — and the
 * appended payment methods — never drift between the two. The base sentence is
 * payment-neutral; the user's enabled payment methods (Pix key, Wise tag, bank
 * details, free text) are appended only when present, so a user who set none
 * gets exactly the previous message (zero regression). DEC-476 adds currency
 * scoping and the charge-page link.
 */
export function useRemindMessage(): (args: RemindMessageArgs) => string {
  const { t } = useTranslation();
  const settings = useLiveSettings();
  const methods: PaymentMethod[] = settings?.paymentMethods ?? [];

  return ({ name, amount, tripName, currency, chargeUrl }) => {
    const base = tripName
      ? t('shared.remind_message', { name, trip: tripName, amount })
      : t('shared.remind_message_no_trip', { name, amount });

    const kindLabels: Record<PaymentMethodKind, string> = {
      pix: t('payment.kind_pix'),
      wise: t('payment.kind_wise'),
      bank: t('payment.kind_bank'),
      other: t('payment.kind_other'),
    };
    const labels = { header: t('shared.pay_via'), kindLabels };
    // DEC-476 — a charge in a known currency only offers methods that take it.
    const instructions = currency
      ? buildPaymentInstructionsForCurrency(methods, currency, labels)
      : buildPaymentInstructions(methods, labels);

    const parts = [base];
    if (instructions) parts.push(instructions);
    if (chargeUrl) parts.push(t('shared.remind_link_line', { url: chargeUrl }));
    return parts.join('\n\n');
  };
}
