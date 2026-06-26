import { z } from 'zod';

/**
 * DEC-345 (G7) — a peer shares a debt: "you owe me {amountCents} for {description}".
 * Accept-first: the recipient gets a notification; one-tap ACCEPT materializes it as
 * a shared expense on their ledger (payer = the sender's linked participant, a single
 * confirmed share = the recipient's owed amount), one-tap REJECT informs the sender.
 * `debtId` is stable, so a re-drain / redelivery never double-folds (idempotent).
 * The Worker only forwards opaque ciphertext — this lives inside the sealed blob.
 */
export const sharedDebtPayloadSchema = z.object({
  v: z.literal(1),
  debtId: z.string().uuid(),
  fromActorId: z.string().uuid(),
  fromName: z.string().min(1).max(60),
  currency: z.string().length(3),
  amountCents: z.number().int().positive(),
  description: z.string().min(1).max(120),
  occurredAt: z.string().nullable(),
});

export type SharedDebtPayload = z.infer<typeof sharedDebtPayloadSchema>;

export function buildSharedDebtPayload(input: {
  debtId: string;
  fromActorId: string;
  fromName: string;
  currency: string;
  amountCents: number;
  description: string;
  occurredAt?: string | null;
}): SharedDebtPayload {
  return {
    v: 1,
    debtId: input.debtId,
    fromActorId: input.fromActorId,
    fromName: input.fromName.trim().slice(0, 60),
    currency: input.currency,
    amountCents: input.amountCents,
    description: input.description.trim().slice(0, 120),
    occurredAt: input.occurredAt ?? null,
  };
}

export function parseSharedDebtPayload(raw: unknown): SharedDebtPayload | null {
  const result = sharedDebtPayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}
