import { z } from 'zod';
import type { Participant } from '@/domain/types/participant';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { Transaction } from '@/domain/types/transaction';
import type { Settlement } from '@/domain/types/settlement';
import {
  buildParticipantStatement,
  filterStatementToCounterparty,
  type ParticipantStatement,
} from '@/domain/splitting';
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
  /**
   * DEC-402 (G3): where the shared expense happened — so the recipient can see
   * each item's place/detail (a map), the same context the owner sees. Additive +
   * optional → older payloads read back `undefined` (no place). It is ALWAYS the
   * expense location only; NEVER any internal fund/wallet/pool/balance data.
   */
  placeLabel: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  placeId: z.string().nullable().optional(),
});

/**
 * DEC-402 (G3): a payment that already moved between the owner and the recipient,
 * carried as an explicit line so the shared statement RECONCILES — items plus
 * payments add up to the headline `netCents`. Before this, the net silently
 * folded settlements the recipient could not see (items €70 but net €50, the €20
 * payment invisible). `kind` is from the RECIPIENT's point of view: `paid` = the
 * recipient paid (offsets what they owe → shown as a credit `+`), `received` =
 * the owner paid the recipient (shown as `−`). Additive + optional.
 */
export const statementSettlementSchema = z.object({
  settlementId: z.string().uuid(),
  kind: z.enum(['paid', 'received']),
  amountCents: z.number().int().positive(),
  settledAt: z.string(),
  note: z.string().nullable(),
});

/**
 * DEC-399 — a debt the recipient has with someone OTHER than the owner that the
 * owner merely recorded (e.g. "Débora owes Bruno"). Display-only on the guest
 * side: never folded into the owner↔recipient `netCents`. `netCents` here is the
 * recipient's net with that third party, from CONFIRMED lines only (same
 * convention as the headline net): positive = the third party owes the recipient.
 */
export const statementThirdPartyGroupSchema = z.object({
  counterpartyId: z.string().uuid(),
  counterpartyName: z.string(),
  netCents: z.number().int(),
  lines: z.array(statementLineSchema),
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
  /**
   * DEC-402 (G3): payments between the owner and the recipient, so the shared
   * statement reconciles (Σ confirmed lines + Σ settlements = `netCents`).
   * Additive + optional → older payloads (and payloads with no settlement)
   * read back `undefined`; no migration.
   */
  settlements: z.array(statementSettlementSchema).optional(),
  /**
   * DEC-399 — optional, display-only debts the recipient has with third parties.
   * Additive + optional → older/QR payloads (and the redacted owner-only headline)
   * read back `undefined`; no migration.
   */
  thirdParty: z.array(statementThirdPartyGroupSchema).optional(),
});

export type StatementPayloadLine = z.infer<typeof statementLineSchema>;
export type StatementPayloadSettlement = z.infer<typeof statementSettlementSchema>;
export type StatementThirdPartyGroup = z.infer<typeof statementThirdPartyGroupSchema>;
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

/** Index live shares by `${transactionId}:${participantId}` for share-id lookup. */
function indexSharesByTxAndParticipant(shares: ParticipantShare[]): Map<string, ParticipantShare> {
  return new Map(
    shares.filter((s) => s.deletedAt === null).map((s) => [`${s.transactionId}:${s.participantId}`, s]),
  );
}

/**
 * Maps one statement line to its answerable payload line. 'owes' lines are the
 * recipient's own shares; 'is_owed' lines belong to the counterparty — the
 * shareId always points at the share that actually moves on confirm/reject.
 * Returns null when the backing share is missing (deleted/out of scope).
 */
function toPayloadLine(
  line: ParticipantStatement['lines'][number],
  recipientId: string,
  sharesByKey: Map<string, ParticipantShare>,
): StatementPayloadLine | null {
  const shareParticipantId = line.kind === 'owes' ? recipientId : line.counterpartyId;
  const share = sharesByKey.get(`${line.transactionId}:${shareParticipantId}`);
  if (!share) return null;
  return {
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
    // DEC-402 (G3): carry the expense location so the recipient can see each
    // item's place/detail. Copied from the statement line (which copied it off
    // the transaction) — display-only, never internal data.
    placeLabel: line.placeLabel,
    latitude: line.latitude,
    longitude: line.longitude,
    placeId: line.placeId,
  };
}

/**
 * DEC-402 (G3): maps one settlement of the statement to its payload line, with the
 * direction expressed from the RECIPIENT's point of view so the guest reads
 * "you paid" / "{owner} paid you" and the sign reconciles against the net.
 */
function toPayloadSettlement(
  settlement: Settlement,
  recipientId: string,
): StatementPayloadSettlement {
  return {
    settlementId: settlement.id,
    kind: settlement.debtorParticipantId === recipientId ? 'paid' : 'received',
    amountCents: settlement.amountCents,
    settledAt: settlement.settledAt,
    note: settlement.notes,
  };
}

export function buildStatementPayload(input: BuildStatementPayloadInput): StatementPayload {
  const { owner, participant, statement, shares, currency } = input;
  const sharesByKey = indexSharesByTxAndParticipant(shares);

  const lines: StatementPayloadLine[] = [];
  for (const line of statement.lines) {
    const payloadLine = toPayloadLine(line, participant.id, sharesByKey);
    if (payloadLine) lines.push(payloadLine);
  }

  // DEC-402 (G3): the settlements already folded into `statement.netCents` ride
  // along as explicit lines so the recipient can reconcile items + payments to
  // the net. Omitted entirely when there are none (older-payload shape).
  const settlements = statement.settlements.map((s) => toPayloadSettlement(s, participant.id));

  const payload: StatementPayload = {
    v: 1,
    owner: { actorId: owner.actorId, name: owner.displayName.trim().slice(0, 60) },
    participantId: participant.id,
    peerName: participant.nickname ?? participant.name,
    currency,
    netCents: statement.netCents,
    generatedAt: new Date().toISOString(),
    lines,
  };
  return settlements.length > 0 ? { ...payload, settlements } : payload;
}

export interface BuildThirdPartyGroupsInput {
  participant: Participant;
  /** The recipient's FULL statement (all counterparties), before owner redaction. */
  statement: ParticipantStatement;
  shares: ParticipantShare[];
  ownerParticipantId: string;
}

/**
 * DEC-399 — groups the recipient's statement lines that DON'T involve the owner,
 * keyed by the third party. Used to ride along a redacted share payload as a
 * display-only "what other people I recorded owe you" section. The owner↔recipient
 * lines (handled by the headline) are excluded.
 */
export function buildThirdPartyStatementGroups(
  input: BuildThirdPartyGroupsInput,
): StatementThirdPartyGroup[] {
  const { participant, statement, shares, ownerParticipantId } = input;
  const sharesByKey = indexSharesByTxAndParticipant(shares);
  const grouped = new Map<string, { name: string; lines: StatementPayloadLine[] }>();

  for (const line of statement.lines) {
    if (line.counterpartyId === ownerParticipantId) continue;
    const payloadLine = toPayloadLine(line, participant.id, sharesByKey);
    if (!payloadLine) continue;
    const group = grouped.get(line.counterpartyId) ?? { name: line.counterpartyName, lines: [] };
    group.lines.push(payloadLine);
    grouped.set(line.counterpartyId, group);
  }

  const groups: StatementThirdPartyGroup[] = [];
  for (const [counterpartyId, group] of grouped) {
    const netCents = group.lines
      .filter((l) => l.confirmationStatus === 'confirmed')
      .reduce((sum, l) => sum + (l.kind === 'owes' ? -l.amountCents : l.amountCents), 0);
    groups.push({ counterpartyId, counterpartyName: group.name, netCents, lines: group.lines });
  }

  return groups.sort((a, b) => Math.abs(b.netCents) - Math.abs(a.netCents));
}

export interface BuildParticipantSharePayloadInput {
  owner: ActorIdentity;
  /** Trip participant id of the owner — the only counterparty kept in the headline. */
  ownerParticipantId: string;
  participant: Participant;
  transactions: Transaction[];
  shares: ParticipantShare[];
  participants: Participant[];
  settlements: Settlement[];
  currency: string;
  /**
   * Attach the display-only third-party section (link / live transfer). Omitted
   * for QR to keep the single-frame budget. Defaults to false.
   */
  includeThirdParty?: boolean;
}

/**
 * DEC-399 — builds the payload the OWNER shares with ONE participant. The headline
 * net + answerable lines are redacted to owner↔participant only (reuses
 * `filterStatementToCounterparty`, the same ego-centric truth as the in-app People
 * view, DEC-394) — so a third-party debt the owner merely recorded never inflates
 * what the recipient sees. When `includeThirdParty` is set, those third-party debts
 * ride along in a separate, display-only section that is NEVER part of the net.
 */
export function buildParticipantSharePayload(
  input: BuildParticipantSharePayloadInput,
): StatementPayload {
  const fullStatement = buildParticipantStatement(
    input.participant.id,
    input.transactions,
    input.shares,
    input.participants,
    input.settlements,
    input.ownerParticipantId,
  );
  const ownerSlice = filterStatementToCounterparty(fullStatement, input.ownerParticipantId);
  const payload = buildStatementPayload({
    owner: input.owner,
    participant: input.participant,
    statement: ownerSlice,
    shares: input.shares,
    currency: input.currency,
  });

  if (!input.includeThirdParty) return payload;

  const thirdParty = buildThirdPartyStatementGroups({
    participant: input.participant,
    statement: fullStatement,
    shares: input.shares,
    ownerParticipantId: input.ownerParticipantId,
  });
  return thirdParty.length > 0 ? { ...payload, thirdParty } : payload;
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
