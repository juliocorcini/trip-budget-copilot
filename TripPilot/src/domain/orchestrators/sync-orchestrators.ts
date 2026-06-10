import {
  participantRepository,
  participantShareRepository,
  peerLinkRepository,
  mirroredStatementRepository,
} from '@/data/repositories';
import { db } from '@/data/db/database';
import { createSyncMetadata } from '@/utils/entity-factory';
import { applyStatementResponses } from '@/domain/sync/statement-payload';
import type { StatementPayload, StatementResponse } from '@/domain/sync/statement-payload';
import type { IdentityQrPayload } from '@/domain/sync/identity';
import {
  buildMirroredStatement,
  answerMirroredLine,
  clearSentResponses,
} from '@/domain/sync/mirrored';
import { createParticipant } from '@/domain/splitting';
import type { Participant } from '@/domain/types/participant';
import type { PeerLink } from '@/domain/types/peer-link';
import type { MirroredStatement } from '@/domain/types/mirrored-statement';

/**
 * R4 orchestrators (DEC-105/106): thin persistence around the pure sync
 * domain — pairing, mirrored statements and owner-side confirmations.
 */

async function upsertPeerLink(
  actorId: string,
  displayName: string,
  participantId: string | null,
): Promise<PeerLink> {
  const existing = await peerLinkRepository.getByActorId(actorId);
  if (existing) {
    return peerLinkRepository.update({
      ...existing,
      displayName,
      participantId: participantId ?? existing.participantId,
      lastSyncAt: new Date().toISOString(),
    });
  }
  const link: PeerLink = {
    ...createSyncMetadata(),
    actorId,
    displayName,
    participantId,
    lastSyncAt: new Date().toISOString(),
  };
  return peerLinkRepository.create(link);
}

export type PairResult =
  | { status: 'created'; participant: Participant }
  | { status: 'linked'; participant: Participant }
  | { status: 'already_paired'; participant: Participant };

/** Scanning an identity QR in the add-participant flow (P2P-11). */
export async function pairParticipantFromIdentity(
  identity: IdentityQrPayload,
  tripId: string,
): Promise<PairResult> {
  const participants = await participantRepository.getByTripId(tripId);
  const existing = participants.find((p) => p.linkedActorId === identity.actorId);
  if (existing) {
    await upsertPeerLink(identity.actorId, identity.name, existing.id);
    return { status: 'already_paired', participant: existing };
  }

  const participant: Participant = {
    ...createParticipant(tripId, identity.name, null),
    linkedActorId: identity.actorId,
  };
  await participantRepository.create(participant);
  await upsertPeerLink(identity.actorId, identity.name, participant.id);
  return { status: 'created', participant };
}

/** Retroactive link: connect an existing participant to a scanned identity. */
export async function linkParticipantToIdentity(
  participantId: string,
  identity: IdentityQrPayload,
  tripId: string,
): Promise<PairResult | null> {
  const participants = await participantRepository.getByTripId(tripId);
  const alreadyLinked = participants.find((p) => p.linkedActorId === identity.actorId);
  if (alreadyLinked) return { status: 'already_paired', participant: alreadyLinked };

  const participant = await participantRepository.getById(participantId);
  if (!participant) return null;

  const updated = await participantRepository.update({
    ...participant,
    linkedActorId: identity.actorId,
  });
  await upsertPeerLink(identity.actorId, identity.name, participantId);
  return { status: 'linked', participant: updated };
}

/** Mirror side: store/replace the statement received from an owner device. */
export async function storeMirroredStatement(payload: StatementPayload): Promise<MirroredStatement> {
  const existing = (await mirroredStatementRepository.getByPeerActorId(payload.owner.actorId)) ?? null;
  const statement = buildMirroredStatement(payload, existing);
  await db.mirroredStatements.put(statement);
  await upsertPeerLink(payload.owner.actorId, payload.owner.name, null);
  return statement;
}

/** Mirror side: confirm/reject a pending line (queued until next session). */
export async function answerMirroredStatementLine(
  statementId: string,
  shareId: string,
  status: 'confirmed' | 'rejected',
): Promise<MirroredStatement | null> {
  const statement = await mirroredStatementRepository.getById(statementId);
  if (!statement) return null;
  const updated = answerMirroredLine(statement, shareId, status);
  await db.mirroredStatements.put(updated);
  return updated;
}

/** Mirror side: mark queued responses as delivered after the owner acks. */
export async function markResponsesSent(
  statementId: string,
  sentShareIds: string[],
): Promise<void> {
  const statement = await mirroredStatementRepository.getById(statementId);
  if (!statement) return;
  await db.mirroredStatements.put(clearSentResponses(statement, sentShareIds));
}

/**
 * Owner side: apply confirm/reject responses from the mirror. Only the
 * paired participant's own pending shares can change (DEC-106).
 */
export async function applyPeerResponses(
  participantId: string,
  responses: StatementResponse[],
): Promise<number> {
  if (responses.length === 0) return 0;
  const shares = await participantShareRepository.getAllIncludingDeleted();
  const updated = applyStatementResponses(shares, participantId, responses);
  if (updated.length > 0) {
    await db.participantShares.bulkPut(updated);
  }
  const link = await peerLinkRepository.getByParticipantId(participantId);
  if (link) {
    await peerLinkRepository.update({ ...link, lastSyncAt: new Date().toISOString() });
  }
  return updated.length;
}
