import type {
  MirroredStatement,
  MirroredLine,
  MirroredResponse,
  MirroredSettlement,
  MirroredThirdPartyGroup,
} from '@/domain/types/mirrored-statement';
import { createSyncMetadata } from '@/utils/entity-factory';
import type { StatementPayload } from './statement-payload';

/**
 * DEC-106 mirror-side pure logic: one MirroredStatement per peer. A new
 * payload replaces the previous snapshot but preserves queued (unsent)
 * responses for lines that still exist, so an offline confirm/reject
 * survives a refreshed statement.
 */

export function buildMirroredStatement(
  payload: StatementPayload,
  existing: MirroredStatement | null,
): MirroredStatement {
  const incomingShareIds = new Set(payload.lines.map((line) => line.shareId));
  const preservedResponses: MirroredResponse[] = (existing?.pendingResponses ?? []).filter(
    (response) => incomingShareIds.has(response.shareId),
  );

  const lines: MirroredLine[] = payload.lines.map((line) => ({ ...line }));

  // DEC-402 (G3) — payments mirrored as lines so the statement reconciles to the
  // headline net. Always taken from the incoming payload (the owner's truth);
  // display-only, never answerable.
  const settlements: MirroredSettlement[] | null = payload.settlements
    ? payload.settlements.map((s) => ({ ...s }))
    : null;

  // DEC-399 — display-only third-party debts ride along the payload (link/transfer).
  // Always taken from the incoming payload (the owner's latest truth); never merged
  // and never answerable, so there are no responses to preserve.
  const thirdParty: MirroredThirdPartyGroup[] | null = payload.thirdParty
    ? payload.thirdParty.map((group) => ({
        counterpartyId: group.counterpartyId,
        counterpartyName: group.counterpartyName,
        netCents: group.netCents,
        lines: group.lines.map((line) => ({ ...line })),
        // DEC-474 — per-currency group nets ride along when present.
        nets: group.nets ?? null,
      }))
    : null;

  const base = existing ?? (createSyncMetadata() as MirroredStatement);
  return {
    ...base,
    peerActorId: payload.owner.actorId,
    peerName: payload.owner.name,
    receivedAt: new Date().toISOString(),
    currency: payload.currency,
    netCents: payload.netCents,
    // DEC-474 — the per-currency headline is the guest's display truth.
    nets: payload.nets ?? null,
    lines,
    settlements,
    thirdParty,
    // DEC-476 — "how to pay me" is the owner's latest truth, never merged.
    paymentMethods: payload.paymentMethods ?? null,
    pendingResponses: preservedResponses,
    updatedAt: new Date().toISOString(),
    revision: existing ? existing.revision + 1 : 1,
  };
}

/** Records a confirm/reject locally: updates the line + queues the response. */
export function answerMirroredLine(
  statement: MirroredStatement,
  shareId: string,
  status: 'confirmed' | 'rejected',
): MirroredStatement {
  const line = statement.lines.find((l) => l.shareId === shareId);
  if (!line || line.confirmationStatus !== 'pending') return statement;

  return {
    ...statement,
    lines: statement.lines.map((l) =>
      l.shareId === shareId ? { ...l, confirmationStatus: status } : l,
    ),
    pendingResponses: [
      ...statement.pendingResponses.filter((r) => r.shareId !== shareId),
      { shareId, status },
    ],
    updatedAt: new Date().toISOString(),
    revision: statement.revision + 1,
  };
}

/** Removes responses that were acked by the owner. */
export function clearSentResponses(
  statement: MirroredStatement,
  sentShareIds: string[],
): MirroredStatement {
  const sent = new Set(sentShareIds);
  return {
    ...statement,
    pendingResponses: statement.pendingResponses.filter((r) => !sent.has(r.shareId)),
    updatedAt: new Date().toISOString(),
    revision: statement.revision + 1,
  };
}
