import { z } from 'zod';
import type { Transaction } from '@/domain/types/transaction';

/**
 * DEC-457 — a single shared EXPENSE ("olha esse gasto"), the payload behind
 * `/x/:id` links. Read-only on the guest side: no lines to answer, no claims —
 * just the expense as the owner sees it (amount, category, date, place, notes,
 * photos). Travels as an E2E blob through the same share channel as
 * statements/splits/groups.
 *
 * What NEVER enters this payload: fund/pool/wallet names, balances, budgets,
 * split shares or participant identities — the guest sees the EXPENSE, not the
 * owner's finances (same red line as DEC-402's statement location carve-out).
 */

export const EXPENSE_SHARE_MAX_IMAGES = 4;

/** Plaintext (DEC-348) R2 image ref — enough for `<img src>` on the guest. */
export const expenseShareImageSchema = z.object({
  r2Id: z.string().min(8).max(64),
  mime: z.string().min(1).max(64),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});

export const expenseSharePayloadSchema = z.object({
  v: z.literal(1),
  kind: z.literal('expense'),
  /** Who is sharing (display only). */
  ownerName: z.string().min(1).max(60),
  description: z.string().max(200),
  category: z.string().max(40).nullable(),
  amountCents: z.number().int(),
  currency: z.string().min(1).max(8),
  /** ISO datetime of the expense (guest formats it in their locale). */
  date: z.string(),
  placeLabel: z.string().max(120).nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  notes: z.string().max(500).nullable(),
  images: z.array(expenseShareImageSchema).max(EXPENSE_SHARE_MAX_IMAGES),
  generatedAt: z.string(),
});

export type ExpenseShareImage = z.infer<typeof expenseShareImageSchema>;
export type ExpenseSharePayload = z.infer<typeof expenseSharePayloadSchema>;

export interface BuildExpenseSharePayloadInput {
  ownerName: string;
  transaction: Transaction;
  /** Already-uploaded plaintext R2 refs of the expense photos (≤4 used). */
  images: ExpenseShareImage[];
  /** Injectable clock for tests. */
  now?: Date;
}

export function buildExpenseSharePayload(
  input: BuildExpenseSharePayloadInput,
): ExpenseSharePayload {
  const { transaction: tx } = input;
  return {
    v: 1,
    kind: 'expense',
    ownerName: input.ownerName.trim().slice(0, 60) || 'TripPilot',
    description: tx.description.trim().slice(0, 200),
    category: tx.category,
    amountCents: tx.amountCents,
    currency: tx.currency,
    date: tx.date,
    placeLabel: tx.placeLabel ? tx.placeLabel.slice(0, 120) : null,
    latitude: tx.latitude,
    longitude: tx.longitude,
    notes: tx.notes ? tx.notes.slice(0, 500) : null,
    images: input.images.slice(0, EXPENSE_SHARE_MAX_IMAGES),
    generatedAt: (input.now ?? new Date()).toISOString(),
  };
}

export function parseExpenseSharePayload(raw: unknown): ExpenseSharePayload | null {
  const result = expenseSharePayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}
