import { z } from 'zod';

/**
 * DEC-346 (G7, L8) — a peer announces a P2P repayment. Two directions, ONE confirm
 * path on the recipient:
 *  - 'paid'     → the SENDER is the debtor ("I paid you {amount}"); the recipient is
 *                 the creditor who RECEIVED the cash → on confirm: close the obligation
 *                 (a Settlement, never red) AND **always prompt to credit a fund/wallet**
 *                 (a real inflow — the money genuinely arrived).
 *  - 'received' → the SENDER is the creditor ("I received your {amount}"); the recipient
 *                 is the debtor → on confirm: close the obligation only (the creditor
 *                 credited their own fund when they sent it).
 * Settlement ≠ duplicating the expense; the trip settle-bridge (DEC-306) stays read-only.
 * `paymentId` is stable, so a redelivery never double-settles (idempotent). Opaque to
 * the Worker (sealed inside the mailbox blob).
 */
export const paymentPayloadSchema = z.object({
  v: z.literal(1),
  paymentId: z.string().uuid(),
  fromActorId: z.string().uuid(),
  fromName: z.string().min(1).max(60),
  currency: z.string().length(3),
  amountCents: z.number().int().positive(),
  direction: z.enum(['paid', 'received']),
  note: z.string().max(120).nullable(),
});

export type PaymentDirection = z.infer<typeof paymentPayloadSchema>['direction'];
export type PaymentPayload = z.infer<typeof paymentPayloadSchema>;

export function buildPaymentPayload(input: {
  paymentId: string;
  fromActorId: string;
  fromName: string;
  currency: string;
  amountCents: number;
  direction: PaymentDirection;
  note?: string | null;
}): PaymentPayload {
  return {
    v: 1,
    paymentId: input.paymentId,
    fromActorId: input.fromActorId,
    fromName: input.fromName.trim().slice(0, 60),
    currency: input.currency,
    amountCents: input.amountCents,
    direction: input.direction,
    note: input.note?.trim().slice(0, 120) ?? null,
  };
}

export function parsePaymentPayload(raw: unknown): PaymentPayload | null {
  const result = paymentPayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}
