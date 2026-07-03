import {
  tripRepository,
  phaseRepository,
  budgetPoolRepository,
  budgetPoolPhaseLinkRepository,
  participantRepository,
  transactionRepository,
  participantShareRepository,
  mailboxQueueRepository,
} from '@/data/repositories';
import { resolveActivePhase } from '@/domain/dates';
import { selectActivePhasePool } from '@/domain/budget';
import { createParticipant } from '@/domain/splitting';
import {
  buildExpenseFromMovedItem,
  externalRefForDebtMoveItem,
  debtMoveRefPrefix,
  parseDebtMovePayload,
  type DebtMovePayload,
} from '@/domain/sync';
import type { Participant } from '@/domain/types/participant';
import { peerLinkRepository } from '@/data/repositories';

/**
 * DEC-451 (D07) — drain-side handling of `debt_move` envelopes. This module is
 * imported by the mailbox drain, so it must NOT import mailbox-orchestrators
 * (send-side lives in p2p-orchestrators instead — no cycle).
 *
 * A move is IMMEDIATE (Julio's product lock): `apply` folds the moved items on
 * the recipient right in the drain — no accept step — and `revert` (owner undo)
 * soft-deletes exactly what the apply created. Both leave a dismissible
 * informative inbox card so nothing is ever silent (Â-MOVE-VISIBLE-BOTH-SIDES).
 */

/** Same auto-target the accept-debt tap uses: active trip → active phase/pool. */
async function resolveAutoTarget(): Promise<{
  tripId: string;
  phaseId: string;
  budgetPoolId: string;
  owner: Participant;
} | null> {
  const trip = await tripRepository.getActive();
  if (!trip) return null;
  const [phases, pools, links, participants] = await Promise.all([
    phaseRepository.getByTripId(trip.id),
    budgetPoolRepository.getByTripId(trip.id),
    // Links have no trip index; other trips' links reference other pools, so
    // the selector (which intersects with THIS trip's pools) ignores them.
    budgetPoolPhaseLinkRepository.getAll(),
    participantRepository.getByTripId(trip.id),
  ]);
  const phaseId = resolveActivePhase(phases)?.id ?? phases[0]?.id ?? null;
  const pool = selectActivePhasePool(pools, links, phaseId) ?? pools[0] ?? null;
  const owner = participants.find((p) => p.isOwner && p.deletedAt === null) ?? null;
  if (!phaseId || !pool || !owner) return null;
  return { tripId: trip.id, phaseId, budgetPoolId: pool.id, owner };
}

/** Mirror of `resolveOrCreatePeerParticipant` (kept here to avoid an import cycle). */
async function resolveMoverParticipant(
  tripId: string,
  actorId: string,
  name: string,
): Promise<Participant> {
  const participants = await participantRepository.getByTripId(tripId);
  const existing = participants.find((p) => p.linkedActorId === actorId && p.deletedAt === null);
  if (existing) return existing;
  const created: Participant = { ...createParticipant(tripId, name, null), linkedActorId: actorId };
  await participantRepository.create(created);
  const link = await peerLinkRepository.getByActorId(actorId);
  if (link && link.participantId !== created.id) {
    await peerLinkRepository.update({ ...link, participantId: created.id });
  }
  return created;
}

/**
 * RECIPIENT side of `direction: 'apply'` — fold every moved item as a shared
 * expense (payer = the mover, my confirmed share = the amount, provenance on the
 * share). Idempotent per item via `externalRef`, so a redelivered envelope is a
 * no-op. Returns false when no active trip/phase/pool/owner exists yet — the
 * caller keeps the payload queued for a later manual apply instead of losing it.
 */
export async function applyInboundDebtMove(
  payload: DebtMovePayload,
  fromActorId: string,
  fromName: string,
): Promise<boolean> {
  const target = await resolveAutoTarget();
  if (!target) return false;

  const existing = await transactionRepository.getByTripId(target.tripId);
  const existingRefs = new Set(existing.map((t) => t.externalRef).filter(Boolean));
  const mover = await resolveMoverParticipant(target.tripId, fromActorId, fromName);

  for (const item of payload.items) {
    const ref = externalRefForDebtMoveItem(fromActorId, payload.moveId, item.moveItemId);
    if (existingRefs.has(ref)) continue;
    const { transaction, shares } = buildExpenseFromMovedItem({
      item,
      currency: payload.currency,
      fromActorId,
      moveId: payload.moveId,
      fromPersonName: payload.fromPersonName,
      tripId: target.tripId,
      phaseId: target.phaseId,
      budgetPoolId: target.budgetPoolId,
      creditorParticipantId: mover.id,
      myParticipantId: target.owner.id,
    });
    await transactionRepository.create(transaction);
    await participantShareRepository.bulkCreate(shares);
  }
  return true;
}

/**
 * RECIPIENT side of `direction: 'revert'` (owner undo) — soft-delete exactly the
 * transactions the apply created (matched by the move's `externalRef` prefix;
 * hide-never-delete keeps them in history) and drop any still-pending inbox card
 * for the same move. Idempotent: nothing matching = no-op. Returns how many
 * transactions were reverted.
 */
export async function revertInboundDebtMove(
  payload: Pick<DebtMovePayload, 'moveId'>,
  fromActorId: string,
): Promise<number> {
  const prefix = debtMoveRefPrefix(fromActorId, payload.moveId);
  const all = await transactionRepository.getAll();
  const created = all.filter((t) => t.externalRef?.startsWith(prefix));
  for (const tx of created) await transactionRepository.delete(tx.id);

  const pending = await mailboxQueueRepository.pendingInbox();
  for (const item of pending) {
    if (item.kind !== 'debt_move' || !item.envelope) continue;
    const queued = parseDebtMovePayload(item.envelope.data);
    if (queued?.moveId === payload.moveId) await mailboxQueueRepository.remove(item.id);
  }
  return created.length;
}

/**
 * Manual apply for a move that arrived before the app had an active trip (the
 * drain kept the card ACTIONABLE instead of losing the payload). On success the
 * card is swapped for its applied/informative version.
 */
export async function applyPendingDebtMove(itemId: string): Promise<boolean> {
  const pending = await mailboxQueueRepository.pendingInbox();
  const item = pending.find((i) => i.id === itemId);
  const envelope = item?.envelope ?? null;
  const move = envelope ? parseDebtMovePayload(envelope.data) : null;
  if (!envelope || !move) {
    if (item) await mailboxQueueRepository.remove(itemId);
    return false;
  }
  const applied = await applyInboundDebtMove(move, envelope.fromActorId, envelope.fromName);
  if (!applied) return false;
  await mailboxQueueRepository.remove(itemId);
  await mailboxQueueRepository.enqueueIn({
    kind: 'debt_move',
    fromActorId: envelope.fromActorId,
    fromName: envelope.fromName,
    envelope: { ...envelope, data: { ...move, appliedAt: new Date().toISOString() } },
  });
  return true;
}
