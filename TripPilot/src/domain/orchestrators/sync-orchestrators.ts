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
  publicKey?: string | null,
): Promise<PeerLink> {
  const existing = await peerLinkRepository.getByActorId(actorId);
  if (existing) {
    return peerLinkRepository.update({
      ...existing,
      displayName,
      participantId: participantId ?? existing.participantId,
      lastSyncAt: new Date().toISOString(),
      // FIELD item 8: only overwrite the key when a fresh one arrives — a
      // statement (no pk) must never wipe a key captured at QR pairing.
      publicKey: publicKey ?? existing.publicKey ?? null,
    });
  }
  const link: PeerLink = {
    ...createSyncMetadata(),
    actorId,
    displayName,
    participantId,
    lastSyncAt: new Date().toISOString(),
    publicKey: publicKey ?? null,
  };
  return peerLinkRepository.create(link);
}

/**
 * DEC-344 (G6) — receive side of the two-way handshake. A drained `connect`
 * envelope means a peer I paired with is announcing who they are; upsert the
 * reverse `peerLink` (with their public key) so they appear in my connections and
 * I can seal async messages back. No trip participant is created here — they
 * surface under "Conexões" and can be added to a trip in one tap when needed.
 * `participantId: null` preserves any existing mapping (upsert keeps it).
 */
export async function upsertPeerLinkFromConnect(connect: {
  actorId: string;
  name: string;
  pk: string;
}): Promise<PeerLink> {
  return upsertPeerLink(connect.actorId, connect.name, null, connect.pk);
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
    await upsertPeerLink(identity.actorId, identity.name, existing.id, identity.pk ?? null);
    return { status: 'already_paired', participant: existing };
  }

  const participant: Participant = {
    ...createParticipant(tripId, identity.name, null),
    linkedActorId: identity.actorId,
  };
  await participantRepository.create(participant);
  await upsertPeerLink(identity.actorId, identity.name, participant.id, identity.pk ?? null);
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
  await upsertPeerLink(identity.actorId, identity.name, participantId, identity.pk ?? null);
  return { status: 'linked', participant: updated };
}

/**
 * Mirror side: store/replace the statement received from an owner device.
 * DEC-207 — `share` records the shared-link origin so a link guest can re-pull
 * updates and push responses to the same channel; a re-pull preserves it. QR /
 * mailbox statements pass no origin and read back null.
 */
export async function storeMirroredStatement(
  payload: StatementPayload,
  share?: { shareId: string; key: string } | null,
): Promise<MirroredStatement> {
  const existing = (await mirroredStatementRepository.getByPeerActorId(payload.owner.actorId)) ?? null;
  const built = buildMirroredStatement(payload, existing);
  const statement: MirroredStatement = {
    ...built,
    share: share ?? existing?.share ?? null,
  };
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
 * B2 wave 3 (coherence §2.2) — re-point a trip participant to a friend's NEW
 * device (a fresh actorId from re-pairing). LEDGER-NEUTRAL by design: debts and
 * shares key off `participantId`, never `actorId`, so this only changes the
 * mailbox/live address the mirror talks to — not one cent moves. The caller has
 * already confirmed the match (the conservative `findReconnectCandidate` + the
 * name in view). The dead old link is retired only when it belongs to this
 * person (or to nobody), so a different person's mapping is never disturbed.
 */
export async function reconnectParticipantDevice(
  participantId: string,
  newActorId: string,
): Promise<Participant | null> {
  const participant = await participantRepository.getById(participantId);
  if (!participant) return null;
  const oldActorId = participant.linkedActorId;
  if (oldActorId === newActorId) return participant;

  const updated = await participantRepository.update({
    ...participant,
    linkedActorId: newActorId,
  });

  // Point the new device's link at this person. Preserve its key/sync — never
  // fake a fresh sync we didn't actually do.
  const newLink = await peerLinkRepository.getByActorId(newActorId);
  if (newLink && newLink.participantId !== participantId) {
    await peerLinkRepository.update({ ...newLink, participantId });
  }

  // Retire the dead old link only when it is ours or unowned (another trip may
  // still map to that actor — leave a different participant's mapping intact).
  if (oldActorId) {
    const oldLink = await peerLinkRepository.getByActorId(oldActorId);
    if (oldLink && (oldLink.participantId === null || oldLink.participantId === participantId)) {
      await peerLinkRepository.delete(oldLink.id);
    }
  }

  return updated;
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
