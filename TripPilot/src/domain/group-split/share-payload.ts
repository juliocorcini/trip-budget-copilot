import { z } from 'zod';
import { imageRefSchema } from '@/domain/media';
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
const paymentStatusSchema = z.enum(['unpaid', 'marked', 'confirmed']);
const expenseSourceSchema = z.enum(['manual', 'ai', 'receipt']);
const splitModeSchema = z.enum(['equal', 'custom']);

const groupParticipantSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: participantKindSchema,
  linkedParticipantId: z.string().nullable(),
  claimedByActorId: z.string().nullable(),
  paymentStatus: paymentStatusSchema,
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
});

export const groupSharePayloadSchema = z.object({
  v: z.literal(1),
  /** Bumped on every owner re-publish; lets a guest ignore a stale re-pull. */
  revision: z.number().int().nonnegative(),
  event: groupSplitEventSchema,
  generatedAt: z.string(),
});

export type GroupSharePayload = z.infer<typeof groupSharePayloadSchema>;

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
  return result.success ? result.data : null;
}
