import { z } from 'zod';
import type { Participant } from '@/domain/types/participant';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { ParticipantStatement } from '@/domain/splitting';
import type { ActorIdentity } from './identity';

/**
 * DEC-106 (owner/mirror): the owner device exports a read-only statement for
 * one paired participant. The mirror device never merges it into its own
 * financial data — it stores the payload as-is and answers with
 * confirm/reject responses for pending lines.
 */

export const statementLineSchema = z.object({
  shareId: z.string().uuid(),
  transactionId: z.string().uuid(),
  kind: z.enum(['owes', 'is_owed']),
  description: z.string().nullable(),
  category: z.string().nullable(),
  subcategoryId: z.string().nullable(),
  occurredAt: z.string(),
  amountCents: z.number().int().positive(),
  counterpartyName: z.string(),
  confirmationStatus: z.enum(['pending', 'confirmed', 'rejected']),
});

export const statementPayloadSchema = z.object({
  v: z.literal(1),
  owner: z.object({
    actorId: z.string().uuid(),
    name: z.string().min(1).max(60),
  }),
  participantId: z.string().uuid(),
  peerName: z.string(),
  currency: z.string().length(3),
  netCents: z.number().int(),
  generatedAt: z.string(),
  lines: z.array(statementLineSchema),
});

export type StatementPayloadLine = z.infer<typeof statementLineSchema>;
export type StatementPayload = z.infer<typeof statementPayloadSchema>;

export interface StatementResponse {
  shareId: string;
  status: 'confirmed' | 'rejected';
}

export interface BuildStatementPayloadInput {
  owner: ActorIdentity;
  participant: Participant;
  statement: ParticipantStatement;
  shares: ParticipantShare[];
  currency: string;
}

export function buildStatementPayload(input: BuildStatementPayloadInput): StatementPayload {
  const { owner, participant, statement, shares, currency } = input;
  const shareByTxAndParticipant = new Map(
    shares.filter((s) => s.deletedAt === null).map((s) => [`${s.transactionId}:${s.participantId}`, s]),
  );

  const lines: StatementPayloadLine[] = [];
  for (const line of statement.lines) {
    // 'owes' lines are the participant's own shares; 'is_owed' lines belong
    // to the counterparty — only the participant's shares are answerable.
    const shareParticipantId =
      line.kind === 'owes' ? participant.id : line.counterpartyId;
    const share = shareByTxAndParticipant.get(`${line.transactionId}:${shareParticipantId}`);
    if (!share) continue;
    lines.push({
      shareId: share.id,
      transactionId: line.transactionId,
      kind: line.kind,
      description: line.description,
      category: line.category,
      subcategoryId: line.subcategoryId,
      occurredAt: line.occurredAt,
      amountCents: line.amountCents,
      counterpartyName: line.counterpartyName,
      confirmationStatus: line.confirmationStatus,
    });
  }

  return {
    v: 1,
    owner: { actorId: owner.actorId, name: owner.displayName.trim().slice(0, 60) },
    participantId: participant.id,
    peerName: participant.nickname ?? participant.name,
    currency,
    netCents: statement.netCents,
    generatedAt: new Date().toISOString(),
    lines,
  };
}

export function parseStatementPayload(raw: unknown): StatementPayload | null {
  const result = statementPayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/**
 * Applies mirror responses on the owner device. Only the paired participant's
 * own PENDING shares can change — anything else is silently ignored, so a
 * stale or malicious response can never rewrite settled money (DEC-106).
 */
export function applyStatementResponses(
  shares: ParticipantShare[],
  participantId: string,
  responses: StatementResponse[],
): ParticipantShare[] {
  const statusByShareId = new Map(responses.map((r) => [r.shareId, r.status]));
  const now = new Date().toISOString();
  const updated: ParticipantShare[] = [];

  for (const share of shares) {
    const status = statusByShareId.get(share.id);
    if (!status) continue;
    if (share.participantId !== participantId) continue;
    if (share.deletedAt !== null) continue;
    if (share.confirmationStatus !== 'pending') continue;
    updated.push({
      ...share,
      confirmationStatus: status,
      updatedAt: now,
      revision: share.revision + 1,
    });
  }

  return updated;
}
