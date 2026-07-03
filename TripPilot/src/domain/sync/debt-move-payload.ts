import { z } from 'zod';

/**
 * DEC-451 (D07) — the owner moved a debt between people, and a connected device
 * is affected. Unlike `debt` (DEC-345, accept-first), a move is IMMEDIATE by
 * product decision (Julio's lock): the RECIPIENT device folds the items on
 * drain, the SOURCE device gets an informative record, and an owner undo sends
 * the same payload with `direction: 'revert'`. Never silent — both sides see
 * who moved what, from whom, and can trace it (Â-MOVE-VISIBLE-BOTH-SIDES).
 * The Worker only forwards opaque ciphertext — this lives inside the sealed blob.
 */
export const debtMoveItemSchema = z.object({
  /** Stable per-item id (the owner-side share id) — the idempotency unit. */
  moveItemId: z.string().min(1).max(64),
  amountCents: z.number().int().positive(),
  description: z.string().min(1).max(120),
  occurredAt: z.string().nullable(),
});

export type DebtMoveItem = z.infer<typeof debtMoveItemSchema>;

export const debtMovePayloadSchema = z.object({
  v: z.literal(1),
  /** Stable move id (= the owner's DebtMovement id) — apply/revert correlate on it. */
  moveId: z.string().uuid(),
  direction: z.enum(['apply', 'revert']),
  /** recipient = the items now land on YOUR side; source = they LEFT your side. */
  role: z.enum(['recipient', 'source']),
  /** Who owed these items before the move (e.g. "Débora"). */
  fromPersonName: z.string().min(1).max(60),
  /** Who holds them now (e.g. "Bruno"). */
  toPersonName: z.string().min(1).max(60),
  /** The owner who performed the move (e.g. "Julio"). */
  movedByName: z.string().min(1).max(60),
  currency: z.string().length(3),
  items: z.array(debtMoveItemSchema).min(1).max(200),
  /** Recipient-device annotation: set when the fold already ran (informative card). */
  appliedAt: z.string().nullable().optional(),
  /** Recipient-device annotation: set when a revert already ran (informative card). */
  revertedAt: z.string().nullable().optional(),
});

export type DebtMovePayload = z.infer<typeof debtMovePayloadSchema>;

const clampName = (value: string): string => value.trim().slice(0, 60);

export function buildDebtMovePayload(input: {
  moveId: string;
  direction: DebtMovePayload['direction'];
  role: DebtMovePayload['role'];
  fromPersonName: string;
  toPersonName: string;
  movedByName: string;
  currency: string;
  items: Array<{
    moveItemId: string;
    amountCents: number;
    description: string;
    occurredAt?: string | null;
  }>;
}): DebtMovePayload {
  return {
    v: 1,
    moveId: input.moveId,
    direction: input.direction,
    role: input.role,
    fromPersonName: clampName(input.fromPersonName),
    toPersonName: clampName(input.toPersonName),
    movedByName: clampName(input.movedByName),
    currency: input.currency,
    items: input.items.map((item) => ({
      moveItemId: item.moveItemId,
      amountCents: item.amountCents,
      description: item.description.trim().slice(0, 120) || '—',
      occurredAt: item.occurredAt ?? null,
    })),
  };
}

export function parseDebtMovePayload(raw: unknown): DebtMovePayload | null {
  const result = debtMovePayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/** Display total (the shares stay the truth on the owner device). */
export function debtMoveTotalCents(payload: Pick<DebtMovePayload, 'items'>): number {
  return payload.items.reduce((sum, item) => sum + item.amountCents, 0);
}

/**
 * Cross-device idempotency key for ONE folded moved item. Prefix-searchable by
 * move (`debtMoveRefPrefix`) so a revert finds every transaction it created.
 */
export function externalRefForDebtMoveItem(
  fromActorId: string,
  moveId: string,
  moveItemId: string,
): string {
  return `${debtMoveRefPrefix(fromActorId, moveId)}${moveItemId}`;
}

export function debtMoveRefPrefix(fromActorId: string, moveId: string): string {
  return `debt_move:${fromActorId}:${moveId}:`;
}
