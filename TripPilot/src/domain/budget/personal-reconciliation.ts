import type { Transaction } from '@/domain/types/transaction';
import { transactionBasePersonalCostCents, sumCents } from '@/domain/money';

/**
 * DEC-466 (INV-1) — the "conta do Julio": reconcile the phase's PERSONAL cost
 * ("Já gasto" on the hero) with what the traveler sees on their bank statement.
 *
 * The hero subtracts your PERSONAL cost (your share after splits). A traveler
 * checking Wise sees the WALLET FLOW instead — including what they fronted for
 * friends (comes back as "te devem") and excluding what friends fronted for
 * them (becomes "você deve"). The identity this module makes visible:
 *
 *   personal cost = wallet outflow − paid for others + your share paid by others
 *
 * Pure arithmetic over the SAME rows that feed `calculatePoolSpent`, so the
 * total always equals the hero's "Já gasto" line for the same input set.
 */
export interface PersonalReconciliation {
  /** Money that actually LEFT your wallet (gross, you were the payer). */
  walletOutflowCents: number;
  /** Part of that outflow that was other people's share (their debt to you). */
  paidForOthersCents: number;
  /** Your share of expenses SOMEONE ELSE fronted (your debt to them). */
  sharePaidByOthersCents: number;
  /** Your real personal cost = outflow − paidForOthers + sharePaidByOthers. */
  personalCostCents: number;
}

/** Gross base-currency amount of a row (mirrors the total strip's math). */
function transactionBaseAmountCents(tx: Transaction): number {
  if (tx.exchangeRate === null) return tx.amountCents;
  return Math.round(tx.amountCents * tx.exchangeRate);
}

/**
 * `ownerParticipantId` — the traveler's own participant id; a row with
 * `paidByParticipantId` null (solo expense) counts as paid by the traveler.
 */
export function buildPersonalReconciliation(
  transactions: Transaction[],
  ownerParticipantId: string | null,
): PersonalReconciliation {
  const rows = transactions.filter(
    (t) => t.deletedAt === null && (t.type === 'expense' || t.type === 'adjustment'),
  );
  const paidByMe = (t: Transaction): boolean =>
    t.paidByParticipantId === null ||
    (ownerParticipantId !== null && t.paidByParticipantId === ownerParticipantId);

  const myRows = rows.filter(paidByMe);
  const othersRows = rows.filter((t) => !paidByMe(t));

  const walletOutflowCents = sumCents(myRows.map(transactionBaseAmountCents));
  const myShareOfMyRowsCents = sumCents(myRows.map(transactionBasePersonalCostCents));
  const paidForOthersCents = Math.max(0, walletOutflowCents - myShareOfMyRowsCents);
  const sharePaidByOthersCents = sumCents(othersRows.map(transactionBasePersonalCostCents));

  return {
    walletOutflowCents,
    paidForOthersCents,
    sharePaidByOthersCents,
    personalCostCents: myShareOfMyRowsCents + sharePaidByOthersCents,
  };
}
