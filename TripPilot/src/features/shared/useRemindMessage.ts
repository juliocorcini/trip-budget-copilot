import { useTranslation } from 'react-i18next';
import { useLiveSettings } from '@/hooks/useLiveSettings';
import {
  buildPaymentInstructions,
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
}

/**
 * G4 (DEC-244): single source of truth for the "Lembrar/Cobrar" message, shared
 * by the settle-up hub and the post-split nudge so the wording — and the
 * appended payment methods — never drift between the two. The base sentence is
 * payment-neutral; the user's enabled payment methods (Pix key, Wise tag, bank
 * details, free text) are appended only when present, so a user who set none
 * gets exactly the previous message (zero regression).
 */
export function useRemindMessage(): (args: RemindMessageArgs) => string {
  const { t } = useTranslation();
  const settings = useLiveSettings();
  const methods: PaymentMethod[] = settings?.paymentMethods ?? [];

  return ({ name, amount, tripName }) => {
    const base = tripName
      ? t('shared.remind_message', { name, trip: tripName, amount })
      : t('shared.remind_message_no_trip', { name, amount });

    const kindLabels: Record<PaymentMethodKind, string> = {
      pix: t('payment.kind_pix'),
      wise: t('payment.kind_wise'),
      bank: t('payment.kind_bank'),
      other: t('payment.kind_other'),
    };
    const instructions = buildPaymentInstructions(methods, {
      header: t('shared.pay_via'),
      kindLabels,
    });

    return instructions ? `${base}\n\n${instructions}` : base;
  };
}
