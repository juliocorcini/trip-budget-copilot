import { z } from 'zod';
import type { StatementResponse } from './statement-payload';

/**
 * DEC-207 — the guest → owner channel of a shared link. The guest answers
 * pending lines (confirm/reject, reusing the owner/mirror StatementResponse)
 * and may additionally propose "I paid" (a settle proposal). Each batch is
 * encrypted with the link's AES key and appended to the share's responses slot;
 * the owner pulls and reconciles them. The owner never auto-trusts a settle —
 * it surfaces as a proposal the owner confirms (Julio's "ele diz que pagou →
 * eu confirmo" round-trip), so a guest can never settle money unilaterally.
 */

export const shareLineResponseSchema = z.object({
  shareId: z.string().uuid(),
  status: z.enum(['confirmed', 'rejected']),
});

export const shareSettleProposalSchema = z.object({
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  note: z.string().max(200).nullable(),
});

export const shareResponseBatchSchema = z.object({
  v: z.literal(1),
  fromActorId: z.string().uuid(),
  fromName: z.string().min(1).max(60),
  responses: z.array(shareLineResponseSchema),
  settle: shareSettleProposalSchema.nullable(),
  at: z.string(),
});

export type ShareSettleProposal = z.infer<typeof shareSettleProposalSchema>;
export type ShareResponseBatch = z.infer<typeof shareResponseBatchSchema>;

export interface BuildShareResponseBatchInput {
  fromActorId: string;
  fromName: string;
  responses: StatementResponse[];
  settle: ShareSettleProposal | null;
}

export function buildShareResponseBatch(input: BuildShareResponseBatchInput): ShareResponseBatch {
  return {
    v: 1,
    fromActorId: input.fromActorId,
    fromName: input.fromName.trim().slice(0, 60),
    responses: input.responses.map((r) => ({ shareId: r.shareId, status: r.status })),
    settle: input.settle,
    at: new Date().toISOString(),
  };
}

export function parseShareResponseBatch(raw: unknown): ShareResponseBatch | null {
  const result = shareResponseBatchSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export interface MergedShareResponses {
  /** Latest confirm/reject per line (later batches win), for applyStatementResponses. */
  responses: StatementResponse[];
  /** Most recent settle proposal, if any (the guest's current "I paid" claim). */
  settle: ShareSettleProposal | null;
  /** Guest display name from the most recent batch, for the owner's UI. */
  fromName: string | null;
}

/**
 * Owner-side: collapse all pulled batches (oldest→newest) into the effective
 * responses. Lines are keyed by shareId so the latest answer wins; the most
 * recent settle proposal supersedes earlier ones. Pure — the orchestrator
 * feeds `responses` to applyStatementResponses and shows `settle` for confirm.
 */
export function mergeShareResponseBatches(batches: ShareResponseBatch[]): MergedShareResponses {
  const ordered = [...batches].sort((a, b) => a.at.localeCompare(b.at));
  const statusByShareId = new Map<string, 'confirmed' | 'rejected'>();
  let settle: ShareSettleProposal | null = null;
  let fromName: string | null = null;

  for (const batch of ordered) {
    for (const line of batch.responses) statusByShareId.set(line.shareId, line.status);
    if (batch.settle) settle = batch.settle;
    if (batch.fromName) fromName = batch.fromName;
  }

  const responses: StatementResponse[] = [...statusByShareId.entries()].map(([shareId, status]) => ({
    shareId,
    status,
  }));
  return { responses, settle, fromName };
}
