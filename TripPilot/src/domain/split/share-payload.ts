import { z } from 'zod';
import type { SplitSession } from './types';

/**
 * G2 (live table link) — the owner publishes the whole `SplitSession` as the
 * shared payload. It travels as E2E ciphertext through the existing share channel
 * (DEC-207 `/share`): the worker stores opaque bytes, the AES key lives only in
 * the link fragment. Guests decrypt it to render the live table; the owner
 * re-publishes (PUT) on every edit so the mirror stays current.
 *
 * The schema validates the decrypted blob defensively — a corrupt or hostile
 * payload yields `null` (broken link) instead of crashing the guest page. It
 * mirrors `domain/split/types.ts` exactly; keep them in lockstep.
 */

const serviceChargeModeSchema = z.enum(['proportional', 'per_head', 'none']);
const serviceChargeSourceSchema = z.enum(['detected', 'inferred_included', 'asked', 'manual']);

const splitClaimSchema = z.object({
  participantId: z.string(),
  fraction: z.number(),
  units: z.number().nullable(),
});

const splitItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  qty: z.number(),
  unitAmountCents: z.number().int(),
  amountCents: z.number().int(),
  category: z.string(),
  claims: z.array(splitClaimSchema),
});

const serviceChargeSchema = z.object({
  mode: serviceChargeModeSchema,
  source: serviceChargeSourceSchema,
  amountCents: z.number().int(),
  percent: z.number().nullable(),
});

const adjustmentSchema = z.object({
  id: z.string(),
  kind: z.enum(['couvert', 'discount', 'other']),
  label: z.string(),
  amountCents: z.number().int(),
  mode: serviceChargeModeSchema,
  source: serviceChargeSourceSchema,
});

const splitParticipantSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['owner', 'adhoc', 'linked']),
  actorId: z.string().nullable(),
  linkedParticipantId: z.string().nullable(),
  markedPaid: z.boolean(),
});

const splitSessionSchema = z.object({
  id: z.string(),
  tripId: z.string().nullable(),
  phaseId: z.string().nullable(),
  name: z.string(),
  currency: z.string(),
  status: z.enum(['draft', 'live', 'committed']),
  mode: z.enum(['equal', 'itemized', 'mine']),
  serviceCharge: serviceChargeSchema,
  adjustments: z.array(adjustmentSchema),
  items: z.array(splitItemSchema),
  participants: z.array(splitParticipantSchema),
  readTotalCents: z.number().int().nullable(),
  createdAt: z.string(),
});

export const splitSharePayloadSchema = z.object({
  v: z.literal(1),
  /** Bumped on every owner re-publish; lets a guest ignore a stale re-pull. */
  revision: z.number().int().nonnegative(),
  session: splitSessionSchema,
  generatedAt: z.string(),
});

export type SplitSharePayload = z.infer<typeof splitSharePayloadSchema>;

/**
 * Build the publishable payload from a session. The session is taken as-is (it
 * is already a clean serialisable shape); we only stamp the protocol version,
 * a monotonic revision and a timestamp.
 */
export function buildSplitSharePayload(session: SplitSession, revision: number): SplitSharePayload {
  return {
    v: 1,
    revision: revision >= 0 ? Math.floor(revision) : 0,
    session,
    generatedAt: new Date().toISOString(),
  };
}

export function parseSplitSharePayload(raw: unknown): SplitSharePayload | null {
  const result = splitSharePayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}
