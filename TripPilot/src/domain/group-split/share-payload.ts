import { z } from 'zod';
import { fileRefSchema, imageRefSchema } from '@/domain/media';
import type { GroupSplitEvent } from './types';

/**
 * C23 / DEC-297 (Tricount public link) — the owner publishes the whole
 * `GroupSplitEvent` as the shared payload. It travels as E2E ciphertext through
 * the existing share channel (DEC-207 `/share`, prefix `/g/`): the worker stores
 * opaque bytes, the AES key lives only in the link fragment. Guests decrypt it to
 * pick their name and read their balance; the owner re-publishes (PUT) on every
 * edit so the mirror stays current.
 *
 * The schema validates the decrypted blob defensively — a corrupt or hostile
 * payload yields `null` (broken link) instead of crashing the guest page. It
 * mirrors `domain/group-split/types.ts` exactly; keep them in lockstep.
 */

const participantKindSchema = z.enum(['owner', 'manual', 'connected']);
// DEC-353 (G7) — the lifecycle gained `contested`/`cancelled`; the schema must
// accept them or an event carrying one would parse as a broken link on guests.
const paymentStatusSchema = z.enum(['unpaid', 'marked', 'confirmed', 'contested', 'cancelled']);
const expenseSourceSchema = z.enum(['manual', 'ai', 'receipt']);
const splitModeSchema = z.enum(['equal', 'custom']);
// DEC-354 (G7) — the append-only movement history rides the E2E payload.
const groupActivitySchema = z.object({
  id: z.string(),
  ts: z.string(),
  actorId: z.string().nullable(),
  actorName: z.string(),
  kind: z.enum([
    'expense_added',
    'expense_removed',
    'payment_marked',
    'payment_confirmed',
    'payment_override',
    'payment_contested',
    'payment_cancelled',
    'participant_joined',
    'share_revoked',
  ]),
  subjectName: z.string().optional(),
  counterpartName: z.string().optional(),
  detail: z.string().optional(),
  amountCents: z.number().int().optional(),
  // DEC-363 (Item D) — an optional payment proof (full image ref on R2 + inline
  // thumb) rides the E2E payload so the creditor sees it before confirming.
  // Additive: an old guest snapshot without it still parses.
  proof: imageRefSchema.optional(),
  proofThumb: z.string().optional(),
});

// DEC-433 (Field v2) — the owner's published repayment methods ride the payload so
// a debtor on the `/g/` board sees how to pay + can copy the key. Mirrors
// `domain/payment/payment-methods.ts`; additive + optional (old snapshots parse).
const paymentMethodSchema = z.object({
  id: z.string(),
  kind: z.enum(['pix', 'wise', 'bank', 'other']),
  label: z.string(),
  value: z.string(),
  enabled: z.boolean(),
});

const groupParticipantSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: participantKindSchema,
  linkedParticipantId: z.string().nullable(),
  claimedByActorId: z.string().nullable(),
  paymentStatus: paymentStatusSchema,
  paymentMethods: z.array(paymentMethodSchema).optional(),
});

const groupExpenseLineItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  amountCents: z.number().int(),
  qty: z.number(),
});

const groupExpenseSchema = z.object({
  id: z.string(),
  description: z.string(),
  amountCents: z.number().int(),
  paidByParticipantId: z.string(),
  splitMode: splitModeSchema,
  participantIds: z.array(z.string()),
  customAmountsCents: z.record(z.string(), z.number().int()),
  category: z.string(),
  source: expenseSourceSchema,
  createdAt: z.string(),
  // DEC-336/337 additive fields — kept so the `/g/` board can surface date/registrant/items.
  occurredAt: z.string().optional(),
  createdByParticipantId: z.string().optional(),
  items: z.array(groupExpenseLineItemSchema).optional(),
  // DEC-340 — preserve the authoring device so the board can mark mine + retract.
  authoredByActorId: z.string().optional(),
  // DEC-342/343 (legacy single) + DEC-348 (multi, plaintext) — carry the image
  // reference(s) so every member + the `/g/` guest can view/download the receipt.
  imageRef: imageRefSchema.optional(),
  imageRefs: z.array(imageRefSchema).optional(),
  // File attachments (PDFs, docs) — same R2 model, carries name + description.
  fileRefs: z.array(fileRefSchema).optional(),
});

const groupSplitEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  currency: z.string(),
  tripId: z.string().nullable(),
  ownerParticipantId: z.string(),
  participants: z.array(groupParticipantSchema),
  expenses: z.array(groupExpenseSchema),
  status: z.enum(['open', 'settled']),
  createdAt: z.string(),
  // DEC-340 — owner tombstones travel so a guest's stale snapshot can't resurrect.
  hiddenExpenseIds: z.array(z.string()).optional(),
  // DEC-354 — append-only movement history (display-only; additive/optional).
  activity: z.array(groupActivitySchema).optional(),
});

export const groupSharePayloadSchema = z.object({
  v: z.literal(1),
  /** Bumped on every owner re-publish; lets a guest ignore a stale re-pull. */
  revision: z.number().int().nonnegative(),
  event: groupSplitEventSchema,
  generatedAt: z.string(),
});

export type GroupSharePayload = Omit<z.infer<typeof groupSharePayloadSchema>, 'event'> & {
  event: GroupSplitEvent;
};

/**
 * Build the publishable payload from an event. The event is taken as-is (it is
 * already a clean serialisable shape); we only stamp the protocol version, a
 * monotonic revision and a timestamp.
 */
export function buildGroupSharePayload(event: GroupSplitEvent, revision: number): GroupSharePayload {
  return {
    v: 1,
    revision: revision >= 0 ? Math.floor(revision) : 0,
    event,
    generatedAt: new Date().toISOString(),
  };
}

export function parseGroupSharePayload(raw: unknown): GroupSharePayload | null {
  const result = groupSharePayloadSchema.safeParse(raw);
  return result.success ? (result.data as GroupSharePayload) : null;
}
