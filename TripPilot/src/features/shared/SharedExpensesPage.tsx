import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useLocation } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import {
  calculateDebts,
  summarizeOwnerDebts,
  thirdPartyDebts,
  ownerInvolvedDebts,
  createSettlement,
  createParticipant,
  ownerPairwiseBalances,
  resolveSettlementStanding,
  buildParticipantStatement,
  filterStatementToCounterparty,
  groupSharedExpenses,
  groupStatementLines,
  resolveShareStage,
  isShareReassignable,
  reassignShares,
  revertReassignedShares,
  createDebtMovement,
} from '@/domain/splitting';
import type {
  DebtSummary,
  DebtEntry,
  StatementLine,
  SharedExpenseGroup,
  StatementLineGroup,
} from '@/domain/splitting';
import { findSubcategory } from '@/domain/outing';
import {
  resolveSettlementDelivery,
  resolveDeliveryFailureCopy,
  settleStateFromInboundKind,
  settleStateTone,
  settleStateLabelKey,
  type SettleTone,
  type DeliveryReason,
  type DeliveryFailureReason,
} from '@/domain/settle-flows';
import type { Participant } from '@/domain/types/participant';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { Settlement } from '@/domain/types/settlement';
import type { DebtMovement } from '@/domain/types/debt-movement';
import {
  SETTLEMENT_METHOD_KINDS,
  SETTLEMENT_METHOD_ICONS,
  type SettlementMethod,
} from '@/domain/payment/payment-methods';
import { formatMoney, toCents } from '@/domain/money';
import { formatShortDate, resolveActivePhase } from '@/domain/dates';
import { selectActivePhasePool } from '@/domain/budget';
import { participantShareRepository } from '@/data/repositories/participant-share-repository';
import { settlementRepository } from '@/data/repositories/settlement-repository';
import { participantRepository, peerLinkRepository, sessionRepository, groupSplitRepository, debtMovementRepository } from '@/data/repositories';
import type { GroupSplitEvent } from '@/domain/group-split';
import {
  saveJoinedGroup,
  isAutoAcceptInviter,
  addAutoAcceptInviter,
  removeAutoAcceptInviter,
  listAutoAcceptInviters,
} from '@/features/group-split/group-link';
import type { PeerLink } from '@/domain/types/peer-link';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { Wallet } from '@/domain/types/wallet';
// B2 wave 2 (coherence §2.2): the honest "Amigos/Conexões" list under one roof.
// B2 wave 3: reuse a friend when charging + suggest reconnecting a new device.
import {
  buildConnectionViews,
  findReconnectCandidate,
  buildPeopleView,
  partitionPeople,
  searchPeople,
  type ConnectionView,
  type ReconnectCandidate,
  type PersonView,
} from '@/domain/connections';
import { Icon } from '@/components/Icon';
import { DataErrorScreen } from '@/components/DataErrorScreen';
import { LoadingScreen } from '@/components/LoadingScreen';
import { BottomSheet } from '@/components/BottomSheet';
import { showToast } from '@/components/Toast';
import { QrCodeDisplay } from '@/components/QrCodeDisplay';
import { QrScanner } from '@/components/QrScanner';
import {
  buildIdentityQrPayload,
  encodeQrPayload,
  decodeQrPayload,
  fitsInSingleQr,
  buildParticipantSharePayload,
  pairLinkFromEncoded,
  buildQrUrl,
  extractQrEnvelope,
  classifyScannedQr,
} from '@/domain/sync';
import { getInstallationId } from '@/utils/entity-factory';
import {
  connectPeerFromIdentity,
  linkConnectFromIdentity,
  applyPeerResponses,
  reconnectParticipantDevice,
  getInboundP2pItems,
  acceptInboundDebt,
  confirmInboundPayment,
  acceptGroupInvite,
  dismissInboundP2p,
  shareDebtWithPeer,
  announcePaymentToPeer,
  removeConnectedPerson,
  flushOutbox,
  materializeConnectedParticipant,
  type InboundP2pItem,
} from '@/domain/orchestrators';
import { resolveSelfName } from '@/domain/sync/self-name';
import { waitForResponses, getDevicePublicKeyB64 } from '@/data/sync';
import { MAILBOX_DRAINED_EVENT } from '@/utils/mailbox-boot';
import { getShareOrigin } from '@/utils/native/public-origin';
import { shareOrCopyLink, shareOrCopyText } from '@/utils/native/link-share';
import { SyncTransferFlow } from '@/features/sync/SyncTransferFlow';
import { MirroredStatementsSection } from './MirroredStatementsSection';
import { ShareLinkSheet } from './ShareLinkSheet';
import { useRemindMessage } from '@/features/shared/useRemindMessage';
import { enabledPaymentMethods } from '@/domain/payment';
import { ProofAttachField, ProofThumb, type AttachedProof } from '@/features/payment-proof/PaymentProof';

/** DEC-206: how many rows show before a "ver mais (N)" toggle reveals the rest. */
const SHARED_LIST_PAGE = 6;
const STATEMENT_PAGE = 8;
// G9 · DEC-356/359: the /shared people zone shows a short rich preview; the full
// list (search + connect + status sections) opens in the Pessoas full-screen sheet.
const PEOPLE_PREVIEW = 3;

// C11 · DEC-304: the per-share lifecycle stage colors. `confirmed` (accepted,
// awaiting payment) is a calm tint; `paid` is a solid success chip — the only
// "done" stage — so the cycle reads pending → confirmed → paid at a glance.
const STATUS_PILL_STYLE: Record<string, string> = {
  pending: 'bg-warning/15 text-warning',
  confirmed: 'bg-success/20 text-success',
  paid: 'bg-success text-white',
  rejected: 'bg-error/15 text-error',
};

// B2 wave 2: the honest-status dot color for a connection row.
const CONNECTION_STATUS_DOT: Record<ConnectionView['status'], string> = {
  connected: 'var(--success)',
  waiting: 'var(--warning)',
  offline: 'var(--on-surface-faint)',
};

type Translate = ReturnType<typeof useTranslation>['t'];

// G9 · DEC-357 — the ONE badge vocabulary, as a per-person attribute (not a
// separate list): connected = live-chargeable, invited = paired/queued, noapp =
// name-only. Tints stay calm; only an open balance pulls the eye (the subline).
const PERSON_BADGE_STYLE: Record<PersonView['status'], string> = {
  connected: 'bg-success/15 text-success',
  invited: 'bg-warning/15 text-warning',
  noapp: 'bg-surface-high text-on-surface-faint',
};

const PERSON_BADGE_KEY: Record<PersonView['status'], string> = {
  connected: 'shared.people_badge_connected',
  invited: 'shared.people_badge_invited',
  noapp: 'shared.people_badge_noapp',
};

/**
 * G9 · DEC-356 — a rich, 2-line "Pessoas" row (avatar + name + status badge on
 * line 1; the signed balance, color-coded, on line 2). It is the SAME visual in
 * the `/shared` preview and the full Pessoas sheet, so a person reads identically
 * wherever they appear. Money shown is the exact ledger net the row carries.
 */
function PersonRow({
  person,
  t,
  currency,
  awaitingCents,
  onTap,
}: {
  person: PersonView;
  t: Translate;
  currency: string;
  /** DEC-377 — sum of this person's delivered-but-unaccepted slices, display-only. */
  awaitingCents: number;
  onTap: () => void;
}) {
  const money = person.needsParticipant
    ? // DEC-376 — a freshly connected friend not yet in this trip: there is nothing
      // to settle, so the subline is the action ("tap to charge or split"), not a
      // fake "R$ 0,00" balance.
      { text: t('shared.people_new_connection'), cls: 'text-primary' }
    : person.balanceCents < 0
      ? {
          text: t('shared.balance_owes', { amount: formatMoney(Math.abs(person.balanceCents), currency) }),
          cls: 'text-error',
        }
      : person.balanceCents > 0
        ? {
            text: t('shared.balance_owed', { amount: formatMoney(person.balanceCents, currency) }),
            cls: 'text-success',
          }
        : awaitingCents > 0
          ? // DEC-377 (Â-HONEST) — a connected friend with a delivered slice they
            // haven't accepted yet is NOT "em dia": the debt only counts on accept
            // (arithmetic invariant), so the sender honestly reads "aguardando
            // aceitar" instead of a misleading zero.
            { text: t('settle_state.awaiting_acceptance'), cls: 'text-warning' }
          : { text: t('shared.balance_zero'), cls: 'text-on-surface-faint' };
  return (
    <button
      onClick={onTap}
      className="bg-surface-container rounded-xl px-4 py-3 flex items-center gap-3 w-full text-left btn-press"
    >
      <span className="w-9 h-9 rounded-full bg-surface-high text-on-surface-dim text-xs font-bold flex items-center justify-center shrink-0">
        {person.initials}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-on-surface flex items-center gap-1.5">
          <span className="truncate">{person.name}</span>
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${PERSON_BADGE_STYLE[person.status]}`}
          >
            {t(PERSON_BADGE_KEY[person.status])}
          </span>
        </p>
        <p className={`text-xs font-semibold tabular truncate ${money.cls}`}>{money.text}</p>
      </div>
      <Icon name="chevron_right" size={16} className="text-on-surface-faint shrink-0" />
    </button>
  );
}

// G6 · DEC-371 — the 15-state model's display tones → design tokens (same fairness
// palette as the group `PaymentTone` pill). `pending` waits on someone (amber),
// `neutral` is "in good standing, in progress" (never danger), `muted` is voided.
const SETTLE_TONE_PILL: Record<SettleTone, string> = {
  positive: 'text-success bg-success/15',
  neutral: 'text-primary bg-primary/15',
  pending: 'text-warning bg-warning/15',
  danger: 'text-error bg-error/15',
  muted: 'text-on-surface-faint bg-surface-high',
};

/** G6 · DEC-371 — a small status pill rendering a settle state in its fairness tone. */
function SettleStateChip({ state, t }: { state: ReturnType<typeof settleStateFromInboundKind>; t: Translate }) {
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg shrink-0 ${SETTLE_TONE_PILL[settleStateTone(state)]}`}
    >
      {t(settleStateLabelKey(state))}
    </span>
  );
}

/** G6 · DEC-369 (F3) — one label/value row of the inbound-item detail screen. */
function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-on-surface-dim shrink-0">{label}</span>
      <span className="text-xs font-semibold text-on-surface text-right truncate">{value}</span>
    </div>
  );
}

export function SharedExpensesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const buildRemindMessage = useRemindMessage();
  const { trip, transactions, participants, settings, phases, pools, links, wallets, loading, error, retry, reload } = useAppData();
  const [shares, setShares] = useState<ParticipantShare[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  // DEC-414 (G6): device-local log of debts moved between people (history + undo).
  const [debtMovements, setDebtMovements] = useState<DebtMovement[]>([]);
  const [debtSummary, setDebtSummary] = useState<DebtSummary | null>(null);
  // C23/DEC-306: trip-linked Tricount events feed the settle-up READ-ONLY (the
  // settle action stays in the group). Loaded here; bridged via groupSplitToDebts.
  const [groupEvents, setGroupEvents] = useState<GroupSplitEvent[]>([]);
  // DEC-206: receipt sessions, by id → name, to collapse a 40-item import into
  // ONE expandable "event" row in both the shared list and the settle-up sheet.
  const [sessionNameById, setSessionNameById] = useState<Record<string, string>>({});

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [saving, setSaving] = useState(false);
  // DEC-206: pagination for the (potentially long) shared-expenses list and for
  // a participant's itemized statement — only the first page shows until "ver mais".
  const [showAllShared, setShowAllShared] = useState(false);
  const [showAllStatement, setShowAllStatement] = useState(false);
  // G9 · DEC-356 — the "Mais" zone keeps Gastos compartilhados collapsed (one tap)
  // so the screen opens on intent, not on a long expense dump.
  const [sharedOpen, setSharedOpen] = useState(false);
  // G9 · DEC-359 — the full Pessoas view (search + status sections + pagination)
  // ships as a sanctioned full-screen sheet that reuses the already-loaded ledger.
  const [peopleSheetOpen, setPeopleSheetOpen] = useState(false);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [peopleShown, setPeopleShown] = useState(STATEMENT_PAGE);

  useEffect(() => {
    if (!trip) return;
    const load = async () => {
      const txIds = transactions.filter((tx) => tx.isShared).map((tx) => tx.id);
      const [sh, se, sessions, groupRecords, movements] = await Promise.all([
        participantShareRepository.getAllForTrip(txIds),
        settlementRepository.getByTripId(trip.id),
        sessionRepository.getByTripId(trip.id),
        groupSplitRepository.listEvents(trip.id),
        debtMovementRepository.getByTripId(trip.id),
      ]);
      setShares(sh);
      setSettlements(se);
      setSessionNameById(Object.fromEntries(sessions.map((s) => [s.id, s.name])));
      setGroupEvents(groupRecords.map((r) => r.event));
      setDebtMovements(movements);

      const owner = participants.find((p) => p.isOwner);
      if (owner) {
        const summary = calculateDebts(transactions, sh, participants, se, owner.id);
        setDebtSummary(summary);
      }
    };
    load();
  }, [trip, transactions, participants]);

  // GAP-032: settle goes through a confirmation sheet with optional partial amount.
  const [settleTarget, setSettleTarget] = useState<DebtEntry | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  // FB-27 (DEC-277): optional structured method of the recorded repayment.
  const [settleMethod, setSettleMethod] = useState<SettlementMethod | null>(null);
  // DEC-388 (G6 · S-EGO): the "charges I recorded between others" registry is a
  // collapsed-by-default secondary menu — never the owner's main settle list.
  const [showThirdParty, setShowThirdParty] = useState(false);
  // DEC-102 (R-25): tap on a participant opens their itemized statement.
  const [statementTarget, setStatementTarget] = useState<Participant | null>(null);
  // I1 / DEC-370: confirm removing a connected person (tombstone, history kept).
  const [removeTarget, setRemoveTarget] = useState<Participant | null>(null);
  // DEC-414 (G6): move a debt to another person — the "from" person (opened from
  // their statement), the chosen destination, and the selected share ids. Only
  // LOCAL (non-P2P) people on both ends, so the move stays device-safe.
  const [moveFrom, setMoveFrom] = useState<Participant | null>(null);
  const [moveDestId, setMoveDestId] = useState<string | null>(null);
  const [moveShareIds, setMoveShareIds] = useState<Set<string>>(new Set());
  const [movingDebt, setMovingDebt] = useState(false);
  // DEC-206: a fresh statement always opens collapsed (first page only).
  useEffect(() => {
    setShowAllStatement(false);
  }, [statementTarget]);
  // R4 P2P (DEC-105/106): pairing + statement sending sheets.
  const [showMyQr, setShowMyQr] = useState(false);
  const [showQrAdd, setShowQrAdd] = useState(false);
  const [linkTarget, setLinkTarget] = useState<Participant | null>(null);
  const [sendTarget, setSendTarget] = useState<Participant | null>(null);
  const [statementQrText, setStatementQrText] = useState<string | null>(null);
  // DEC-207: shared participant link — no pairing required.
  const [shareTarget, setShareTarget] = useState<Participant | null>(null);
  // FIELD item 8: peer links keyed by participant — drives the "send via the
  // mailbox" action (only available when the peer's public key is on file).
  const [peerLinks, setPeerLinks] = useState<PeerLink[]>([]);
  const [mailboxSending, setMailboxSending] = useState(false);

  // DEC-345/346 (G7) — live P2P: inbound debts/payments waiting PENDING (accept-
  // first ÂNCORA), and the send sheets ("Cobrar" / "Registrar pagamento").
  const [inboundItems, setInboundItems] = useState<InboundP2pItem[]>([]);
  const [p2pBusy, setP2pBusy] = useState<string | null>(null);
  // G_last (DEC-355) — inviter actorIds I auto-accept group invites from. Seeded
  // from the persisted allowlist so the per-row checkbox reflects prior choices.
  const [trustedInviters, setTrustedInviters] = useState<Set<string>>(
    () => new Set(listAutoAcceptInviters().map((e) => e.actorId)),
  );
  // L8: confirming a payment I RECEIVED opens a fund/wallet picker (real inflow).
  const [confirmPayItem, setConfirmPayItem] = useState<InboundP2pItem | null>(null);
  // G6 · DEC-369 (F2/F3) — tapping an inbox card opens this per-item detail screen
  // (who/what/total/date/proof/status + the per-state actions).
  const [detailItem, setDetailItem] = useState<InboundP2pItem | null>(null);
  // Send sheets, keyed by the target person (must be a connected peer).
  const [chargeTarget, setChargeTarget] = useState<Participant | null>(null);
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeNote, setChargeNote] = useState('');
  const [payTarget, setPayTarget] = useState<Participant | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDirection, setPayDirection] = useState<'paid' | 'received'>('paid');
  // DEC-363 (Item D) — an OPTIONAL payment proof attached to a P2P "paguei/recebi".
  const [payProof, setPayProof] = useState<AttachedProof | null>(null);
  // The L8 fund picker is shared by the inbound-confirm sheet and the outbound
  // "Eu recebi" path; both write the same chosen pool + wallet.
  const [fundPoolId, setFundPoolId] = useState<string | null>(null);
  const [fundWalletId, setFundWalletId] = useState<string | null>(null);
  const [p2pSending, setP2pSending] = useState(false);

  const ownerParticipant = participants.find((p) => p.isOwner);
  // I2 / DEC-350 — the real name a peer sees for ME: onboarding owner name first,
  // then the optional profile name, and only the technical device label as a last
  // resort (never "Android · Chrome" when a real name exists). Used for every
  // outgoing self-name surface (identity QR + statement transfer).
  const selfShareName =
    useMemo(
      () =>
        resolveSelfName({
          ownerName: ownerParticipant?.name,
          profileName: settings?.profileName,
          deviceName: settings?.deviceName,
        }),
      [ownerParticipant?.name, settings?.profileName, settings?.deviceName],
    ) || 'TripPilot';
  // FIELD item 8: the identity QR now carries the device public key so a scan
  // captures it for sealing async messages. Built async (key load), so it lives
  // in state instead of being computed inline.
  const [myIdentityQr, setMyIdentityQr] = useState('');
  useEffect(() => {
    let active = true;
    void (async () => {
      const pk = await getDevicePublicKeyB64().catch(() => null);
      if (!active) return;
      setMyIdentityQr(
        encodeQrPayload(
          buildIdentityQrPayload(
            {
              actorId: getInstallationId(),
              displayName: selfShareName,
            },
            pk,
          ),
        ),
      );
    })();
    return () => {
      active = false;
    };
  }, [selfShareName]);

  useEffect(() => {
    void peerLinkRepository.getAll().then(setPeerLinks);
  }, [participants]);

  // DEC-345/346 (G7) — the pending inbox is refreshed on mount and whenever a
  // drain lands new debts/payments (the boot/visibility sync fires the event).
  // G_last (DEC-355): a SILENT auto-accept pass runs first — any group invite
  // from an inviter I previously trusted is joined without a prompt (it never
  // shows in the list). Capability is unchanged (read-only `/g/` creds); only the
  // accept tap is skipped. Accepting drops the item, so the re-fetch can't loop.
  const refreshInbox = useCallback(async () => {
    let items = await getInboundP2pItems();
    const trusted = items.filter(
      (i) => i.kind === 'group_invite' && !!i.invite && isAutoAcceptInviter(i.fromActorId),
    );
    if (trusted.length > 0) {
      for (const item of trusted) {
        const invite = await acceptGroupInvite(item.itemId);
        if (!invite) continue;
        saveJoinedGroup({
          shareId: invite.shareId,
          key: invite.key,
          name: invite.groupName,
          invitedByName: item.fromName,
          joinedAt: new Date().toISOString(),
        });
      }
      items = await getInboundP2pItems();
    }
    setInboundItems(items);
  }, []);
  useEffect(() => {
    void refreshInbox();
    const onDrained = () => void refreshInbox();
    window.addEventListener(MAILBOX_DRAINED_EVENT, onDrained);
    return () => window.removeEventListener(MAILBOX_DRAINED_EVENT, onDrained);
  }, [refreshInbox]);

  // B5: arriving from the post-split nudge — open the share sheet for that
  // person once their participant record is loaded, then clear the nav state so
  // closing the sheet (or navigating back) never re-pops it.
  const nudgeOpenedRef = useRef(false);
  useEffect(() => {
    if (nudgeOpenedRef.current) return;
    const targetId = (location.state as { shareWithParticipantId?: string } | null)
      ?.shareWithParticipantId;
    if (!targetId || participants.length === 0) return;
    const target = participants.find((p) => p.id === targetId && !p.isOwner);
    if (!target) return;
    nudgeOpenedRef.current = true;
    setShareTarget(target);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, participants, navigate]);

  const peerLinkFor = (participantId: string): PeerLink | undefined =>
    peerLinks.find((link) => link.participantId === participantId && link.deletedAt === null);

  // DEC-414 (G6): a person is "local" (safe to move debts to/from) when there is no
  // live P2P mirror — no linked device and no peer link. Moving a share a connected
  // peer already accepted would desync their device, so we keep the whole op local.
  const isPersonLocal = useCallback(
    (participantId: string): boolean => {
      const p = participants.find((x) => x.id === participantId);
      return !!p && p.linkedActorId === null && !peerLinkFor(participantId);
    },
    // peerLinks/participants are the only inputs; peerLinkFor is a thin closure over them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [participants, peerLinks],
  );

  // DEC-414 (G6): the shares a person can hand off — the debts THEY owe someone else
  // (payer ≠ them) that are still open (confirmed, unpaid, live) and not P2P-accepted.
  const movableSharesFor = useCallback(
    (personId: string): ParticipantShare[] => {
      const payerByTx = new Map(transactions.map((tx) => [tx.id, tx.paidByParticipantId]));
      const connected = !isPersonLocal(personId);
      return shares.filter((s) => {
        if (s.participantId !== personId) return false;
        if (!isShareReassignable(s, connected)) return false;
        const payer = payerByTx.get(s.transactionId) ?? null;
        return payer !== personId; // a real debt owed to someone else, not their own share
      });
    },
    [shares, transactions, isPersonLocal],
  );

  // DEC-414 (G6): reassign the selected shares from `moveFrom` to the chosen person,
  // then record ONE device-local movement (history + undo). Amounts never change, so
  // the owner's total net is invariant — only the holder moves (Â-DEBT-TRACEABLE).
  const handleConfirmMove = async () => {
    if (!trip || !moveFrom || !moveDestId || moveShareIds.size === 0 || movingDebt) return;
    setMovingDebt(true);
    try {
      const toMove = shares.filter((s) => moveShareIds.has(s.id));
      const reassigned = reassignShares(toMove, moveFrom.id, moveDestId);
      await Promise.all(reassigned.map((s) => participantShareRepository.update(s)));
      const totalCents = toMove.reduce((sum, s) => sum + s.shareAmountCents, 0);
      const movement = createDebtMovement(
        trip.id,
        moveFrom.id,
        moveDestId,
        reassigned.map((s) => s.id),
        totalCents,
      );
      await debtMovementRepository.create(movement);
      setMoveFrom(null);
      await reload();
    } finally {
      setMovingDebt(false);
    }
  };

  // DEC-414 (G6): undo a move — send its shares back to the origin, clear the trail,
  // and tombstone the movement (kept for history, dropped from "active").
  const handleUndoMove = async (movement: DebtMovement) => {
    if (movingDebt) return;
    setMovingDebt(true);
    try {
      const affected = shares.filter((s) => movement.shareIds.includes(s.id));
      const reverted = revertReassignedShares(affected, movement.fromParticipantId);
      await Promise.all(reverted.map((s) => participantShareRepository.update(s)));
      await debtMovementRepository.update({ ...movement, undoneAt: new Date().toISOString() });
      await reload();
    } finally {
      setMovingDebt(false);
    }
  };

  // B2 wave 2 — the honest friend list (all paired devices, cross-trip), derived
  // from the SAME peerLinks the page already loads. One roof for "who am I
  // connected to and can I reach them right now".
  const connectionViews = useMemo<ConnectionView[]>(
    () => buildConnectionViews(peerLinks, Date.now()),
    [peerLinks],
  );

  // B2 wave 3 — connected friends who are NOT yet a person in THIS trip, so the
  // "add person" form can reuse a known friend in one tap (no re-typing/re-QR).
  const availableFriends = useMemo<ConnectionView[]>(
    () => connectionViews.filter((c) => !participants.some((p) => p.linkedActorId === c.actorId)),
    [connectionViews, participants],
  );

  // DEC-366 (G5, HEADLINE) — a connected peer who owes me gets the net delivered
  // as a real-time, accept-first `debt` (it lands in their notification center +
  // home + Acerto + profile and they accept on their own phone), NOT the old
  // hidden mirrored-statement mailbox that "never arrived". A debt is "you owe me
  // X" — when nothing is owed we never invent one (resolveSettlementDelivery → 'none').
  // DEC-375 (Â-HONEST) — a failed P2P send shows the TRUE reason (offline vs
  // server error vs no connection), never a blanket "sem internet". A server
  // error means the network is up, so it offers a real "try again" that re-runs
  // the same send; offline/no-connection stay informative (the queue retries
  // offline automatically, connecting first is the fix for no-key).
  const showSendFailure = (reason: DeliveryReason, retry: () => void, name?: string) => {
    const copy = resolveDeliveryFailureCopy(reason as DeliveryFailureReason);
    showToast(
      t(copy.messageKey, name ? { name } : undefined),
      copy.tone,
      copy.canRetry ? { actionLabel: t('p2p.retry'), onTap: retry } : undefined,
    );
  };

  // DEC-375 — the real "try again" re-attempts delivery of what is ALREADY queued
  // (the failed send left its sealed blob in the outbox). It never re-runs the
  // action handler, so a server-error retry can't enqueue a second debt or
  // re-settle a payment — idempotent by construction.
  const retrySend = async () => {
    try {
      const flush = await flushOutbox();
      const stillFailing = Object.values(flush.failures);
      if (stillFailing.length === 0) {
        showToast(t('p2p.retry_sent'), 'success');
        await reload();
      } else {
        showSendFailure(stillFailing[0]!, () => void retrySend());
      }
    } catch {
      showToast(t('p2p.send_failed'), 'danger');
    }
  };

  const handleSendSettlementDebt = async (participant: Participant) => {
    const link = peerLinkFor(participant.id);
    const owner = participants.find((p) => p.isOwner);
    if (!trip || !owner || !participant.linkedActorId || !link?.publicKey || mailboxSending) return;
    const statement = buildParticipantStatement(
      participant.id,
      transactions,
      shares,
      participants,
      settlements,
      owner.id,
    );
    // resolveSettlementDelivery flips the statement's sign convention internally
    // ("negative = the peer owes me") so we can't send a backwards debt: a peer I
    // actually owe resolves to 'none', preserving the settlement math (accept-first).
    // DEC-375: read the real key off the peerLink instead of hardcoding true.
    const decision = resolveSettlementDelivery({
      hasPublicKey: Boolean(link.publicKey),
      statementNetCents: statement.netCents,
    });
    if (decision.channel !== 'debt') {
      showToast(t('p2p.settle_nothing'), 'info');
      return;
    }
    setMailboxSending(true);
    try {
      const result = await shareDebtWithPeer({
        peerActorId: participant.linkedActorId,
        amountCents: decision.debtAmountCents,
        currency: trip.baseCurrency,
        // Provenance ("de onde veio"): the trip name rides in the debt description so
        // the recipient's inbox + folded expense record where the settlement came from.
        description: `${t('p2p.settle_debt_desc')} · ${trip.name}`,
      });
      setSendTarget(null);
      const name = participant.nickname ?? participant.name;
      if (result.delivered) {
        showToast(t('p2p.settle_sent', { name }), 'success');
      } else {
        showSendFailure(result.reason, () => void retrySend(), name);
      }
    } catch {
      showToast(t('p2p.send_failed'), 'danger');
    } finally {
      setMailboxSending(false);
    }
  };

  // G7 · DEC-373 — the universal scan router: the "Ler QR" scanner used to act
  // ONLY on an identity (connect) payload and silently ignore every other app QR.
  // Now it classifies the scan and either pairs inline (identity), navigates
  // in-app to the matching screen (extrato `/sync`, group `/g/`, shared link
  // `/s/`, live split `/t/`), or shows a clear "open the right screen and scan
  // again" hint — never a dead end.
  const handlePairScan = async (text: string) => {
    if (!trip) return;
    const scanned = classifyScannedQr(text);
    if (scanned.kind === 'identity') {
      setShowQrAdd(false);
      // DEC-344 — pair + reverse connect handshake so we appear on each other's phones.
      const result = await connectPeerFromIdentity(scanned.payload, trip.id);
      if (result.status === 'already_paired') {
        showToast(t('sync.already_connected'), 'info');
      } else {
        showToast(t('sync.pairing_done', { name: result.participant.name }), 'success');
      }
      await reload();
      return;
    }
    if (scanned.kind === 'app_route') {
      setShowQrAdd(false);
      navigate(scanned.route);
      return;
    }
    if (scanned.kind === 'statement') {
      setShowQrAdd(false);
      navigate(buildQrUrl('statement', scanned.encoded, ''));
      return;
    }
    // live_signal (belongs to device transfer) or unknown.
    showToast(t('qr_scan.scan_elsewhere'), 'info');
  };

  const handleLinkScan = async (text: string) => {
    if (!trip || !linkTarget) return;
    const decoded = decodeQrPayload(extractQrEnvelope(text) ?? '');
    if (!decoded || decoded.kind !== 'identity') {
      showToast(t('qr_scan.need_connect_qr'), 'info');
      return;
    }
    const target = linkTarget;
    setLinkTarget(null);
    const result = await linkConnectFromIdentity(target.id, decoded, trip.id);
    if (!result) return;
    if (result.status === 'already_paired' && result.participant.id !== target.id) {
      showToast(t('sync.already_connected'), 'info');
    } else {
      showToast(t('sync.linked_done', { name: result.participant.name }), 'success');
    }
    await reload();
  };

  // F19: the same identity the QR encodes, shared as a `/pair` link so the other
  // person can connect without a camera. `navigator.share` opens the OS share
  // sheet when available; otherwise we fall back to the clipboard.
  const canShareLink = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copyPairLink = async () => {
    if (!myIdentityQr) return;
    const url = pairLinkFromEncoded(getShareOrigin(), myIdentityQr);
    try {
      await navigator.clipboard.writeText(url);
      showToast(t('sync.link_copied'), 'success');
    } catch {
      showToast(t('sync.link_copy_failed'), 'danger');
    }
  };

  const sharePairLink = async () => {
    if (!myIdentityQr) return;
    const url = pairLinkFromEncoded(getShareOrigin(), myIdentityQr);
    // D-IMP-04: shared share/copy path — a cancel stays silent, only a real
    // failure falls back to the clipboard so the link is never lost.
    const outcome = await shareOrCopyLink({ title: t('sync.share_link_title'), url });
    if (outcome === 'copied') showToast(t('sync.link_copied'), 'success');
    else if (outcome === 'copy_failed') showToast(t('sync.link_copy_failed'), 'danger');
  };

  // DEC-399 — the shared payload is redacted to owner↔participant (ego-centric,
  // like the in-app People view), so a third-party debt I merely recorded never
  // inflates what the recipient sees. `includeThirdParty` rides those debts along
  // in a separate, display-only section for the link/live transfer; the QR omits
  // them to stay within the single-frame budget.
  const buildStatementForParticipant = (
    participant: Participant,
    opts?: { includeThirdParty?: boolean },
  ) => {
    const owner = participants.find((p) => p.isOwner);
    if (!owner || !trip) return null;
    return buildParticipantSharePayload({
      owner: { actorId: getInstallationId(), displayName: owner.name },
      ownerParticipantId: owner.id,
      participant,
      transactions,
      shares,
      participants,
      settlements,
      currency: trip.baseCurrency,
      includeThirdParty: opts?.includeThirdParty ?? false,
    });
  };

  const openSettleSheet = (debt: DebtEntry) => {
    setSettleTarget(debt);
    setSettleAmount((debt.amountCents / 100).toFixed(2));
    setSettleMethod(null);
  };

  const settleAmountCents = (() => {
    const parsed = Number(settleAmount.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return toCents(parsed);
  })();

  const handleConfirmSettle = async () => {
    if (!trip || !settleTarget || settleAmountCents === null) return;
    const amountCents = Math.min(settleAmountCents, settleTarget.amountCents);
    const settlement = createSettlement(
      trip.id,
      settleTarget.debtorId,
      settleTarget.creditorId,
      amountCents,
      trip.baseCurrency,
      settleMethod,
    );
    await settlementRepository.create(settlement);
    setSettleTarget(null);
    await reload();
  };

  // DL-5: nudge a debtor with a ready-to-send message ("você me deve {amount}").
  // G4 (DEC-244): the message is payment-neutral and the owner's published
  // payment methods (Pix/Wise/bank/free text) are appended by useRemindMessage.
  // Uses the OS share sheet, falling back to the clipboard so it is never lost.
  const handleRemind = async (debt: DebtEntry) => {
    if (!trip) return;
    const amount = formatMoney(debt.amountCents, trip.baseCurrency);
    const message = buildRemindMessage({
      name: debt.debtorName,
      amount,
      tripName: trip.name,
    });
    const outcome = await shareOrCopyText(message, t('shared.remind_share_title'));
    if (outcome === 'copied') showToast(t('shared.remind_copied'), 'success');
    else if (outcome === 'copy_failed') showToast(t('sync.link_copy_failed'), 'danger');
  };

  const handleAddParticipant = async () => {
    if (!trip || !newName.trim()) return;
    setSaving(true);
    try {
      const participant = createParticipant(
        trip.id,
        newName.trim(),
        newNickname.trim() || null,
      );
      await participantRepository.create(participant);
      await reload();
      setNewName('');
      setNewNickname('');
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  // B2 wave 3 — add a connected friend as a trip person in ONE tap (no re-typing,
  // no re-scanning a QR). Reuses the SAME pairing orchestrator the QR flow uses:
  // it links the new participant by actorId and maps the peer link, idempotent if
  // the friend is already a person here. Debts then ride the mirror automatically.
  const handleAddFriend = async (conn: ConnectionView) => {
    if (!trip || saving) return;
    setSaving(true);
    try {
      const peer = peerLinks.find((l) => l.actorId === conn.actorId && l.deletedAt === null);
      await connectPeerFromIdentity(
        buildIdentityQrPayload(
          { actorId: conn.actorId, displayName: conn.displayName },
          peer?.publicKey ?? null,
        ),
        trip.id,
      );
      setPeerLinks(await peerLinkRepository.getAll());
      await reload();
      setNewName('');
      setNewNickname('');
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  // B2 wave 3 — re-point a person to a friend's NEW device (a fresh actorId from
  // re-pairing). LEDGER-NEUTRAL: debts key off participantId, so only the mirror
  // delivery address changes. The suggestion is conservative + the name is in
  // view, so the tap itself is the confirmation.
  const handleReconnect = async (candidate: ReconnectCandidate) => {
    if (saving) return;
    setSaving(true);
    try {
      await reconnectParticipantDevice(candidate.participantId, candidate.newActorId);
      setPeerLinks(await peerLinkRepository.getAll());
      await reload();
      showToast(t('connections.reconnected', { name: candidate.displayName }), 'success');
    } finally {
      setSaving(false);
    }
  };

  // DEC-376 (Â-BILATERAL) — open a person's statement. A connected friend who is
  // not yet a participant of THIS trip (`needsParticipant`, surfaced straight from
  // their peerLink) is materialized on-demand first — dedupe by actorId — so the
  // very first tap can charge/split them; the row then reads as a normal person.
  // No balance moves; this only creates the addressable person + stamps the link.
  const handlePersonTap = async (person: PersonView) => {
    if (person.needsParticipant) {
      if (!trip || !person.linkedActorId || saving) return;
      setSaving(true);
      try {
        const created = await materializeConnectedParticipant(trip.id, person.linkedActorId);
        if (!created) return;
        setPeerLinks(await peerLinkRepository.getAll());
        await reload();
        setPeopleSheetOpen(false);
        setStatementTarget(created);
      } finally {
        setSaving(false);
      }
      return;
    }
    const target = participantById.get(person.participantId);
    if (target) {
      setPeopleSheetOpen(false);
      setStatementTarget(target);
    }
  };

  // I1 / DEC-370 — remove a connected person: tombstone their peer link(s) and
  // unlink the participant so they stop reading as an active contact. The
  // participant + every past division stay in history (hide-never-delete) and the
  // ledger is untouched (debts key off participantId, never actorId).
  const handleRemovePerson = async () => {
    if (!removeTarget || saving) return;
    const name = removeTarget.nickname ?? removeTarget.name;
    setSaving(true);
    try {
      await removeConnectedPerson(removeTarget.id);
      setRemoveTarget(null);
      setPeerLinks(await peerLinkRepository.getAll());
      await reload();
      showToast(t('connections.removed_toast', { name }), 'success');
    } finally {
      setSaving(false);
    }
  };

  // DEC-345/346 (G7) — the operational fund to default the L8 picker to: the
  // active phase's pool (same resolver the dashboard/receipt use), falling back
  // to the first pool. The user can still pick another.
  const defaultFundPoolId = (): string | null => {
    const activePhaseId = resolveActivePhase(phases)?.id ?? null;
    return (
      selectActivePhasePool(pools, links, activePhaseId)?.id ??
      pools.find((p) => p.deletedAt === null)?.id ??
      pools[0]?.id ??
      null
    );
  };

  // DEC-345 — accept a pending debt: fold it onto the active phase's pool as a
  // shared expense (the sender is the payer). Auto-resolved, so it is one tap.
  const resolveDebtTarget = (): { tripId: string; phaseId: string; budgetPoolId: string } | null => {
    if (!trip) return null;
    const activePhaseId = resolveActivePhase(phases)?.id ?? phases[0]?.id ?? null;
    const pool = selectActivePhasePool(pools, links, activePhaseId) ?? pools[0] ?? null;
    if (!activePhaseId || !pool) return null;
    return { tripId: trip.id, phaseId: activePhaseId, budgetPoolId: pool.id };
  };

  const handleAcceptDebt = async (item: InboundP2pItem) => {
    const target = resolveDebtTarget();
    if (!target || p2pBusy) return;
    setP2pBusy(item.itemId);
    try {
      const ok = await acceptInboundDebt(item.itemId, target);
      showToast(ok ? t('p2p.accepted') : t('p2p.send_failed'), ok ? 'success' : 'danger');
      await Promise.all([reload(), refreshInbox()]);
    } finally {
      setP2pBusy(null);
    }
  };

  const handleRejectInbound = async (item: InboundP2pItem) => {
    if (p2pBusy) return;
    setP2pBusy(item.itemId);
    try {
      await dismissInboundP2p(item.itemId);
      showToast(t('p2p.rejected'), 'info');
      await refreshInbox();
    } finally {
      setP2pBusy(null);
    }
  };

  // DEC-355 (G8) — accept a group invite: persist the joined group locally (so it
  // shows in my list), then open the live `/g/` board — the SAME capability a link
  // grants. Accept-first: nothing joins my list until this explicit tap.
  const handleAcceptInvite = async (item: InboundP2pItem) => {
    if (p2pBusy) return;
    setP2pBusy(item.itemId);
    try {
      const invite = await acceptGroupInvite(item.itemId);
      if (!invite) {
        showToast(t('p2p.send_failed'), 'danger');
        await refreshInbox();
        return;
      }
      saveJoinedGroup({
        shareId: invite.shareId,
        key: invite.key,
        name: invite.groupName,
        invitedByName: item.fromName,
        joinedAt: new Date().toISOString(),
      });
      showToast(t('p2p.invite_accepted'), 'success');
      await refreshInbox();
      navigate(`/g/${encodeURIComponent(invite.shareId)}#k=${invite.key}`);
    } finally {
      setP2pBusy(null);
    }
  };

  // G_last (DEC-355) — opt a connected inviter in/out of silent auto-accept. This
  // sets the preference for FUTURE invites only; the current item still needs an
  // explicit Accept (the accept-first guarantee for what's already on screen).
  const toggleAutoAccept = (actorId: string, name: string, on: boolean) => {
    if (!actorId) return;
    if (on) addAutoAcceptInviter(actorId, name);
    else removeAutoAcceptInviter(actorId);
    setTrustedInviters((prev) => {
      const next = new Set(prev);
      if (on) next.add(actorId);
      else next.delete(actorId);
      return next;
    });
  };

  const handleConfirmPayment = async (item: InboundP2pItem) => {
    if (!trip || !ownerParticipant || p2pBusy) return;
    // L8: a payment that means I RECEIVED the cash is a real inflow → pick the
    // fund/wallet first. When I PAID, there is no inflow → confirm in one tap.
    if (item.payment?.direction === 'paid') {
      setFundPoolId(defaultFundPoolId());
      setFundWalletId(wallets.find((w) => w.deletedAt === null)?.id ?? null);
      setConfirmPayItem(item);
      return;
    }
    setP2pBusy(item.itemId);
    try {
      const ok = await confirmInboundPayment(item.itemId, {
        tripId: trip.id,
        myParticipantId: ownerParticipant.id,
      });
      showToast(ok ? t('p2p.payment_confirmed') : t('p2p.send_failed'), ok ? 'success' : 'danger');
      await Promise.all([reload(), refreshInbox()]);
    } finally {
      setP2pBusy(null);
    }
  };

  const handleConfirmPaymentWithFund = async () => {
    if (!trip || !ownerParticipant || !confirmPayItem) return;
    const activePhaseId = resolveActivePhase(phases)?.id ?? phases[0]?.id ?? null;
    if (!activePhaseId || !fundPoolId) {
      showToast(t('p2p.send_failed'), 'danger');
      return;
    }
    setP2pSending(true);
    try {
      const ok = await confirmInboundPayment(confirmPayItem.itemId, {
        tripId: trip.id,
        myParticipantId: ownerParticipant.id,
        fundCredit: { phaseId: activePhaseId, budgetPoolId: fundPoolId, walletId: fundWalletId },
      });
      showToast(ok ? t('p2p.payment_confirmed') : t('p2p.send_failed'), ok ? 'success' : 'danger');
      setConfirmPayItem(null);
      await Promise.all([reload(), refreshInbox()]);
    } finally {
      setP2pSending(false);
    }
  };

  const chargeAmountCents = (() => {
    const parsed = Number(chargeAmount.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return toCents(parsed);
  })();

  const handleSendCharge = async () => {
    const target = chargeTarget;
    if (!trip || !target?.linkedActorId || chargeAmountCents === null || !chargeNote.trim()) return;
    const amountCents = chargeAmountCents;
    const note = chargeNote.trim();
    setP2pSending(true);
    try {
      const result = await shareDebtWithPeer({
        peerActorId: target.linkedActorId,
        amountCents,
        currency: trip.baseCurrency,
        description: note,
      });
      if (result.delivered) {
        showToast(t('p2p.charge_sent'), 'success');
        setChargeTarget(null);
        setChargeAmount('');
        setChargeNote('');
      } else {
        showSendFailure(result.reason, () => void retrySend(), target.nickname ?? target.name);
      }
    } catch {
      showToast(t('p2p.send_failed'), 'danger');
    } finally {
      setP2pSending(false);
    }
  };

  const payAmountCents = (() => {
    const parsed = Number(payAmount.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return toCents(parsed);
  })();

  const handleAnnouncePayment = async () => {
    if (!trip || !ownerParticipant || !payTarget?.linkedActorId || payAmountCents === null) return;
    const activePhaseId = resolveActivePhase(phases)?.id ?? phases[0]?.id ?? null;
    const fundCredit =
      payDirection === 'received' && activePhaseId && fundPoolId
        ? { phaseId: activePhaseId, budgetPoolId: fundPoolId, walletId: fundWalletId }
        : null;
    setP2pSending(true);
    try {
      const result = await announcePaymentToPeer({
        peerActorId: payTarget.linkedActorId,
        peerParticipantId: payTarget.id,
        myParticipantId: ownerParticipant.id,
        tripId: trip.id,
        amountCents: payAmountCents,
        currency: trip.baseCurrency,
        direction: payDirection,
        fundCredit,
        proof: payProof?.proof ?? null,
        proofThumb: payProof?.thumb ?? null,
      });
      // The settlement is already recorded locally (the cash moved); only the peer
      // notification can be queued/failed — so the copy is about reaching THEM.
      if (result.delivered) {
        showToast(t('p2p.pay_done'), 'success');
      } else {
        showSendFailure(result.reason, () => void retrySend(), payTarget.nickname ?? payTarget.name);
      }
      setPayTarget(null);
      setPayAmount('');
      setPayDirection('paid');
      setPayProof(null);
      await reload();
    } catch {
      showToast(t('p2p.send_failed'), 'danger');
    } finally {
      setP2pSending(false);
    }
  };

  // BUG-014: recovery on DB error instead of a blank page.
  if (!trip) {
    if (error) return <DataErrorScreen onRetry={retry} />;
    if (loading) return <LoadingScreen />;
    return <Navigate to="/welcome" replace />;
  }

  // DEC-394 (G4 · S-EGO-PEOPLE): the people list balances are the FAITHFUL
  // owner↔person pairwise nets (read from confirmed shares + settlements), not the
  // min-transfer graph — which could route the owner's debt through a third party
  // and so show the wrong person's number ("Bruno recebe 122"). The owner's TOTAL
  // is unchanged (−Σ == summarizeOwnerDebts net); only per-person attribution
  // becomes honest. Third-party-only people read 0 here (they live in the registry).
  const balances =
    debtSummary && ownerParticipant
      ? ownerPairwiseBalances(transactions, shares, settlements, ownerParticipant.id)
      : new Map<string, number>();
  // G9 · DEC-357 — the ONE unified people list (status badge + ledger balance,
  // deduped), driving the z3 preview and the full Pessoas page. `participantById`
  // maps a row back to its Participant for the statement / charge / pay sheets.
  const peopleView = buildPeopleView(participants, balances, peerLinks);
  const participantById = new Map(participants.map((p) => [p.id, p]));
  const peoplePreview = peopleView.slice(0, PEOPLE_PREVIEW);
  // DL-3: owner-centric settle-up summary (A receber / A pagar / net) for the hero.
  const ownerSummary =
    debtSummary && ownerParticipant
      ? summarizeOwnerDebts(debtSummary.debts, ownerParticipant.id)
      : null;
  // DEC-388 (G6 · S-EGO): the main settle list answers "what is MINE?" — only the
  // debts the owner is a party to. Debts between two OTHER people (surfaced just
  // because the owner recorded the expense) move to a display-only registry so
  // they never read as the owner's debt yet never vanish (A4). Pure partition of
  // the same `calculateDebts` graph the hero reads — the settle math is invariant.
  const ownerDebts =
    debtSummary && ownerParticipant
      ? ownerInvolvedDebts(debtSummary.debts, ownerParticipant.id)
      : [];
  const otherDebts =
    debtSummary && ownerParticipant
      ? thirdPartyDebts(debtSummary.debts, ownerParticipant.id)
      : [];
  // M18 (DEC-294): the group-wide settle-up standing → the "tudo acertado ✓"
  // seal shows only after real splitting AND once every debt is cleared.
  const sharedExpenseCount = transactions.filter(
    (tx) => tx.isShared && tx.type === 'expense' && tx.deletedAt === null,
  ).length;
  const settlementStanding = debtSummary
    ? resolveSettlementStanding(debtSummary.debts, sharedExpenseCount, settlements.length)
    : null;
  // DL-3: connected-pending shares — the "Aguardando aceite" group (display-only).
  // After G1 a `pending` third-party share means a CONNECTED counterparty who
  // hasn't accepted yet (offline friends are born confirmed). Never hide it.
  const awaitingShares = shares.filter(
    (s) =>
      s.deletedAt === null &&
      s.confirmationStatus === 'pending' &&
      s.participantId !== ownerParticipant?.id,
  );
  // DEC-377 (m3, Â-HONEST) — per-person total of delivered-but-unaccepted slices,
  // so a People row with a pending outbound debt reads "aguardando aceitar"
  // instead of a misleading "em dia". Display-only — the balance arithmetic is
  // untouched (pending never consolidates; DEC-071).
  const awaitingByParticipant = new Map<string, number>();
  for (const share of awaitingShares) {
    awaitingByParticipant.set(
      share.participantId,
      (awaitingByParticipant.get(share.participantId) ?? 0) + share.shareAmountCents,
    );
  }
  // G4 discoverability (DEC-244): when someone owes the owner but no payment
  // method is published yet, nudge them to add one so the "Lembrar" message can
  // carry it. Self-hides the moment an enabled method exists (no nagging).
  const showAddPaymentHint =
    !!ownerSummary &&
    ownerSummary.receivableCents > 0 &&
    enabledPaymentMethods(settings?.paymentMethods ?? []).length === 0;

  // C23/DEC-306 · DEC-360 (G9): the trip's group divisions feed a single
  // discoverability POINTER to /groups (the canonical list). No second list and
  // no money is restated here — the breakdown lives inside /groups.
  const tripGroupEvents = groupEvents.filter((e) => e.tripId === trip.id);
  const activeGroupNames = tripGroupEvents.slice(0, 2).map((e) => e.name).join(', ');

  // G9 · DEC-356 — the settle screen recomposes into Variante O's intent zones
  // (Situação → Resolver → Pessoas → Atividade → Divisões → Mais) under a sticky
  // header. The zones are sequenced with flex `order` so the re-composition is a
  // low-risk overlay on the existing, tested blocks (no ledger logic moved).
  // DEC-388 (G6): the "Resolver" badge counts only what the owner can actually
  // settle (owner-involved debts) + inbound items — third-party records are not
  // the owner's to resolve.
  const resolverCount = inboundItems.length + ownerDebts.length;

  return (
    <div className="flex flex-col gap-4 pb-4 pt-2">
      {/* G9 · DEC-356 — sticky header so "Acerto de contas" + a fixed Meu QR stay
          reachable while scrolling. The body below is sequenced into Variante O's
          intent zones with flex `order` (a low-risk overlay on tested blocks). */}
      <div className="order-[0] flex items-center gap-3 sticky top-0 z-20 bg-surface py-2">
        {/* R5-08: same back-button header pattern as the other "More" subpages. */}
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface flex-1">{t('shared.hub_title')}</h1>
        {/* D05 · DEC-347: "Meu QR" is a fixed top-right action — someone can always
            add me in one tap, instead of it hiding at the bottom of Conexões. */}
        <button
          onClick={() => setShowMyQr(true)}
          className="btn-press flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-surface-container"
          aria-label={t('sync.my_qr')}
        >
          <Icon name="qr_code_2" size={18} className="text-primary" />
          <span className="text-xs font-semibold text-on-surface">{t('sync.my_qr')}</span>
        </button>
      </div>

      {/* (z2) Resolver agora — the action zone directly under the balance hero. One
          umbrella label over the accept-first inbox + pending debts; each row keeps
          its OWN labelled action (Aceitar / Liquidar / Lembrar / Confirmar), never
          merged into one ambiguous tap (DEC-356 — four distinct authority models). */}
      {resolverCount > 0 && (
        <p className="order-[18] text-xs text-on-surface-faint font-semibold uppercase tracking-wider px-1 -mb-2">
          {t('shared.resolve_now', { count: resolverCount })}
        </p>
      )}

      {/* DEC-345/346 (G7) — accept-first inbox: inbound debts/payments wait here
          PENDING and fold into the ledger ONLY on an explicit tap. */}
      {inboundItems.length > 0 && (
        <section className="order-[20] flex flex-col gap-2" data-p2p-inbox>
          {inboundItems.map((item) => {
            const busy = p2pBusy === item.itemId;
            if (item.kind === 'debt' && item.debt) {
              return (
                <div
                  key={item.itemId}
                  className="rounded-2xl p-4 bg-surface-container border border-[var(--border-faint)] flex flex-col gap-2"
                >
                  <button
                    type="button"
                    onClick={() => setDetailItem(item)}
                    className="flex items-center gap-3 w-full text-left btn-press"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                      <Icon name="call_received" size={18} className="text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-on-surface truncate">
                        {t('p2p.debt_label', { name: item.fromName })}
                      </p>
                      <p className="text-xs text-on-surface-faint truncate">{item.debt.description}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <SettleStateChip state={settleStateFromInboundKind('debt')} t={t} />
                        <span className="text-[10px] text-on-surface-faint">{t('settle_detail.open_hint')}</span>
                      </div>
                    </div>
                    <p className="text-sm font-extrabold tabular text-on-surface shrink-0">
                      {formatMoney(item.debt.amountCents, item.debt.currency)}
                    </p>
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRejectInbound(item)}
                      disabled={busy}
                      className="flex-1 py-2 rounded-xl bg-surface-high text-on-surface-dim text-xs font-semibold btn-press disabled:opacity-40"
                    >
                      {t('p2p.reject')}
                    </button>
                    <button
                      onClick={() => handleAcceptDebt(item)}
                      disabled={busy}
                      className="flex-1 py-2 rounded-xl bg-success/20 text-success text-xs font-bold btn-press disabled:opacity-40"
                    >
                      {t('settle_detail.accept_division')}
                    </button>
                  </div>
                </div>
              );
            }
            if (item.kind === 'payment' && item.payment) {
              const iReceived = item.payment.direction === 'paid';
              return (
                <div
                  key={item.itemId}
                  className="rounded-2xl p-4 bg-surface-container border border-[var(--border-faint)] flex flex-col gap-2"
                >
                  <button
                    type="button"
                    onClick={() => setDetailItem(item)}
                    className="flex items-center gap-3 w-full text-left btn-press"
                  >
                    <div className="w-9 h-9 rounded-full bg-success/15 flex items-center justify-center shrink-0">
                      <Icon name="payments" size={18} className="text-success" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-on-surface truncate">
                        {iReceived
                          ? t('p2p.payment_in_label', { name: item.fromName })
                          : t('p2p.payment_out_label', { name: item.fromName })}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <SettleStateChip state={settleStateFromInboundKind('payment')} t={t} />
                        <span className="text-[10px] text-on-surface-faint">{t('settle_detail.open_hint')}</span>
                      </div>
                    </div>
                    <p className="text-sm font-extrabold tabular text-success shrink-0">
                      {formatMoney(item.payment.amountCents, item.payment.currency)}
                    </p>
                  </button>
                  {/* DEC-363 (Item D) — proof attached by the payer: review before confirming. */}
                  {(item.payment.proofThumb || item.payment.proof) && (
                    <div className="flex items-center gap-2 pl-12">
                      <ProofThumb proof={item.payment.proof} thumb={item.payment.proofThumb} size={40} />
                      <span className="text-[11px] text-on-surface-faint">{t('payment_proof.label')}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRejectInbound(item)}
                      disabled={busy}
                      className="flex-1 py-2 rounded-xl bg-surface-high text-on-surface-dim text-xs font-semibold btn-press disabled:opacity-40"
                    >
                      {t('p2p.dismiss')}
                    </button>
                    <button
                      onClick={() => handleConfirmPayment(item)}
                      disabled={busy}
                      className="flex-1 py-2 rounded-xl bg-success/20 text-success text-xs font-bold btn-press disabled:opacity-40"
                    >
                      {t('settle_detail.confirm_receipt')}
                    </button>
                  </div>
                </div>
              );
            }
            // DEC-355 (G8) — group invite: accept-first. Accept opens the live board
            // (read + claim a name); reject just drops it. No money folds here.
            if (item.kind === 'group_invite' && item.invite) {
              return (
                <div
                  key={item.itemId}
                  className="rounded-2xl p-4 bg-surface-container border border-[var(--border-faint)] flex flex-col gap-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                      <Icon name="groups" size={18} className="text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-on-surface truncate">
                        {t('p2p.invite_label', { name: item.fromName })}
                      </p>
                      <p className="text-xs text-on-surface-faint truncate">{item.invite.groupName}</p>
                    </div>
                  </div>
                  {/* G_last (DEC-355): trust this inviter so FUTURE invites join
                      silently. Hidden for legacy items that carry no actorId. */}
                  {item.fromActorId && (
                    <label className="flex items-center gap-2 text-[11px] text-on-surface-dim select-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={trustedInviters.has(item.fromActorId)}
                        onChange={(e) => toggleAutoAccept(item.fromActorId, item.fromName, e.target.checked)}
                        disabled={busy}
                        className="accent-primary w-4 h-4 shrink-0"
                      />
                      {t('p2p.invite_auto_accept', { name: item.fromName })}
                    </label>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRejectInbound(item)}
                      disabled={busy}
                      className="flex-1 py-2 rounded-xl bg-surface-high text-on-surface-dim text-xs font-semibold btn-press disabled:opacity-40"
                    >
                      {t('p2p.reject')}
                    </button>
                    <button
                      onClick={() => handleAcceptInvite(item)}
                      disabled={busy}
                      className="flex-1 py-2 rounded-xl bg-primary/20 text-primary text-xs font-bold btn-press disabled:opacity-40"
                    >
                      {t('p2p.accept')}
                    </button>
                  </div>
                </div>
              );
            }
            return null;
          })}
        </section>
      )}

      {/* (z6) DEC-360 (G9) — group divisions are discovered via a SINGLE pointer to
          /groups (the canonical list). No second list and no money is restated here;
          the per-group breakdown + settle action live inside the group. */}
      <button
        onClick={() => navigate('/groups')}
        className="order-[50] bg-surface-container rounded-2xl p-4 flex items-center gap-3 text-left btn-press"
      >
        <div className="w-10 h-10 rounded-full bg-surface-high flex items-center justify-center shrink-0">
          <Icon name="groups" size={22} className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-on-surface">
            {tripGroupEvents.length > 0 ? t('shared.group_pointer_title') : t('group_split.title')}
          </p>
          <p className="text-[11px] text-on-surface-faint truncate">
            {tripGroupEvents.length > 0
              ? t('shared.group_pointer_sub', { count: tripGroupEvents.length, names: activeGroupNames })
              : t('group_split.subtitle')}
          </p>
        </div>
        <Icon name="chevron_right" size={20} className="text-on-surface-faint shrink-0" />
      </button>

      {/* DL-3: settle-up hero — opens with the answer ("quem me deve e quanto").
          Pure derivation of calculateDebts via summarizeOwnerDebts (confirmed
          debts only); connected-pending sits in its own group below. */}
      {ownerSummary &&
        (ownerSummary.receivableCents > 0 || ownerSummary.payableCents > 0 ? (
          <div className="order-[10] rounded-2xl p-4 bg-surface-container">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-on-surface-faint">
                  {t('shared.summary_receivable')}
                </p>
                <p className="text-2xl font-extrabold tabular text-success leading-tight mt-0.5">
                  {formatMoney(ownerSummary.receivableCents, trip.baseCurrency)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-on-surface-faint">
                  {t('shared.summary_payable')}
                </p>
                <p className="text-2xl font-extrabold tabular text-error leading-tight mt-0.5">
                  {formatMoney(ownerSummary.payableCents, trip.baseCurrency)}
                </p>
              </div>
            </div>
            {ownerSummary.netCents !== 0 && (
              <p className="text-xs font-semibold mt-3 pt-3 border-t border-[var(--border-faint)] text-on-surface-dim">
                {ownerSummary.netCents > 0
                  ? t('shared.summary_net_positive', {
                      amount: formatMoney(ownerSummary.netCents, trip.baseCurrency),
                    })
                  : t('shared.summary_net_negative', {
                      amount: formatMoney(Math.abs(ownerSummary.netCents), trip.baseCurrency),
                    })}
              </p>
            )}
          </div>
        ) : settlementStanding?.allSettled ? (
          // DEC-294 (M18): the proud "tudo acertado ✓" seal — shown exactly when
          // real splitting happened and the whole group's balance has zeroed.
          <div className="order-[10] rounded-2xl p-5 text-center bg-success/10 border border-success/30" data-all-settled-seal>
            <Icon name="verified" size={30} className="text-success mx-auto mb-1.5" />
            <p className="text-sm font-bold text-success">{t('shared.all_settled_title')}</p>
            <p className="text-xs text-on-surface-faint mt-0.5">{t('shared.all_settled_hint')}</p>
          </div>
        ) : (
          <div className="order-[10] rounded-2xl p-5 bg-surface-container text-center">
            <Icon name="handshake" size={30} className="text-success mx-auto mb-1.5" />
            <p className="text-sm font-bold text-on-surface">{t('shared.summary_net_even')}</p>
            <p className="text-xs text-on-surface-faint mt-0.5">{t('shared.summary_empty')}</p>
          </div>
        ))}

      {/* G4 (DEC-244): one-line nudge to publish a payment method so the
          "Lembrar" message can carry the owner's Pix/Wise/bank. Only when money
          is owed to the owner AND none is configured yet; self-hides after. */}
      {showAddPaymentHint && (
        <button
          onClick={() => navigate('/settings/payment-methods')}
          className="order-[26] flex items-center gap-3 w-full text-left rounded-2xl px-4 py-3 bg-surface-container btn-press"
          data-add-payment-hint
        >
          <Icon name="payments" size={20} className="text-primary shrink-0" />
          <p className="flex-1 text-xs text-on-surface-dim leading-snug">
            {t('shared.add_payment_hint')}
          </p>
          <Icon name="chevron_right" size={18} className="text-on-surface-faint shrink-0" />
        </button>
      )}

      {/* (z3) Pessoas — DEC-357's ONE unified list (status badge + ledger balance,
          deduped). The screen shows a rich 3-row PREVIEW; "ver todas" opens the full
          Pessoas sheet (search + status sections). Connecting lives WITH the people
          (a slim row right below the preview), never a separate "Conexões" list. */}
      <div className="order-[30] flex flex-col gap-2">
        <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider px-1">
          {t('shared.people_section')}
          {peopleView.length > 0 ? ` · ${peopleView.length}` : ''}
        </p>
        {peopleView.length === 0 ? (
          <p className="text-xs text-on-surface-faint px-1 py-2">{t('shared.people_empty')}</p>
        ) : (
          peoplePreview.map((person) => (
            <PersonRow
              key={person.participantId || `actor:${person.linkedActorId}`}
              person={person}
              t={t}
              currency={trip.baseCurrency}
              awaitingCents={awaitingByParticipant.get(person.participantId) ?? 0}
              onTap={() => void handlePersonTap(person)}
            />
          ))
        )}
        {peopleView.length > PEOPLE_PREVIEW && (
          <button
            onClick={() => {
              setPeopleQuery('');
              setPeopleShown(STATEMENT_PAGE);
              setPeopleSheetOpen(true);
            }}
            data-see-all-people
            className="w-full px-3 py-2.5 rounded-xl bg-surface-high text-on-surface-dim text-xs font-bold btn-press flex items-center justify-center gap-1.5"
          >
            <Icon name="search" size={15} className="text-on-surface-dim" />
            {t('shared.see_all_people', { count: peopleView.length })}
          </button>
        )}
        {/* DEC-359 — connect is a VERB that lives with the people (Meu QR · Ler QR ·
            Adicionar), right below the list — never a separate tab or "Conectar" card. */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setShowMyQr(true)}
            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-surface-container btn-press"
          >
            <Icon name="qr_code_2" size={18} className="text-primary" />
            <span className="text-[11px] font-semibold text-on-surface">{t('sync.my_qr')}</span>
          </button>
          <button
            onClick={() => setShowQrAdd(true)}
            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-surface-container btn-press"
          >
            <Icon name="qr_code_scanner" size={18} className="text-primary" />
            <span className="text-[11px] font-semibold text-on-surface">{t('shared.connect_read_qr')}</span>
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-surface-container btn-press"
          >
            <Icon name="person_add" size={18} className="text-primary" />
            <span className="text-[11px] font-semibold text-on-surface">{t('shared.connect_add')}</span>
          </button>
        </div>
        {showForm && (
          <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-3">
            {/* B2 wave 3 — reuse a connected friend in one tap (mirrors the split's
                add-person picker). Linking by actorId means debts ride the mirror. */}
            {availableFriends.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] font-semibold text-on-surface-faint uppercase tracking-wide">
                  {t('split.friends_title')}
                </p>
                <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto">
                  {availableFriends.map((conn) => (
                    <button
                      key={conn.actorId}
                      onClick={() => handleAddFriend(conn)}
                      disabled={saving}
                      className="flex items-center gap-2.5 w-full rounded-xl px-3 py-2 bg-surface-high btn-press text-left disabled:opacity-40"
                    >
                      <span className="w-8 h-8 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                        {conn.displayName.trim().slice(0, 2).toUpperCase()}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-on-surface truncate">
                          {conn.displayName}
                        </span>
                        <span className="flex items-center gap-1.5 text-[10px] text-on-surface-faint">
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: CONNECTION_STATUS_DOT[conn.status] }}
                          />
                          {t(`connections.status_${conn.status}`)}
                        </span>
                      </span>
                      <Icon name="add" size={18} className="text-primary shrink-0" />
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="flex-1 h-px bg-surface-high" />
                  <span className="text-[10px] text-on-surface-faint">{t('split.friends_or_new')}</span>
                  <span className="flex-1 h-px bg-surface-high" />
                </div>
              </div>
            )}
            <div>
              <label className="text-xs text-on-surface-faint mb-1 block">
                {t('shared.participant_name')}
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-on-surface-faint mb-1 block">
                {t('shared.participant_nickname')}
              </label>
              <input
                type="text"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAddParticipant}
                disabled={!newName.trim() || saving}
                className="flex-1 py-2.5 rounded-xl bg-primary text-on-surface font-medium text-sm btn-press disabled:opacity-40"
              >
                {saving ? t('common.loading') : t('common.add')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DL-3: connected-pending shares, surfaced explicitly so nothing is ever
          hidden. Display-only — the counterparty accepts on THEIR phone/link;
          the owner's debt total (hero) is already real and unaffected. */}
      {awaitingShares.length > 0 && (
        <div className="order-[22] rounded-2xl p-4" style={{ background: '#D4A84312', border: '1px solid #D4A84320' }}>
          <div className="flex items-center gap-2">
            <Icon name="schedule" size={18} className="text-warning" />
            <p className="text-sm font-bold text-warning flex-1">
              {t('shared.awaiting_title', { count: awaitingShares.length })}
            </p>
            <p className="text-sm font-extrabold tabular text-warning">
              {formatMoney(
                awaitingShares.reduce((sum, s) => sum + s.shareAmountCents, 0),
                trip.baseCurrency,
              )}
            </p>
          </div>
          <p className="text-[11px] text-on-surface-faint leading-snug mt-1.5">
            {t('shared.awaiting_hint')}
          </p>
        </div>
      )}

      {/* (z7) Mais — collapsed-but-on-screen. Gastos compartilhados (one tap, NOT
          removed — statuses kept) + the device-backup pointer that MOVED OUT to
          Settings (connecting a friend ≠ backing up your own devices). DEC-356. */}
      <p className="order-[58] text-xs text-on-surface-faint font-semibold uppercase tracking-wider px-1 mt-1">
        {t('shared.more_section')}
      </p>

      {/* DEC-071 (FIELD-03): shared expenses with per-share confirmation status,
          collapsed by default so the screen opens on intent, not on a long dump. */}
      {(() => {
        const sharedTxs = transactions.filter(
          (tx) => tx.isShared && tx.type === 'expense' && tx.deletedAt === null,
        );
        if (sharedTxs.length === 0) return null;
        const nameById = new Map(participants.map((p) => [p.id, p.nickname ?? p.name]));
        // DEC-206: collapse same-receipt items into ONE expandable event row so a
        // 40-item import stops flooding the list with unreadable single lines.
        const groups = groupSharedExpenses(sharedTxs);
        const visibleGroups = showAllShared ? groups : groups.slice(0, SHARED_LIST_PAGE);
        return (
          <div className="order-[60] bg-surface-container rounded-2xl overflow-hidden">
            <button
              onClick={() => setSharedOpen((v) => !v)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left btn-press"
            >
              <Icon name="receipt_long" size={20} className="text-on-surface-dim shrink-0" />
              <span className="flex-1 text-sm font-semibold text-on-surface">
                {t('shared.shared_expenses_collapsed')}
              </span>
              <span className="text-xs text-on-surface-faint tabular">{groups.length}</span>
              <Icon
                name={sharedOpen ? 'expand_less' : 'expand_more'}
                size={20}
                className="text-on-surface-faint shrink-0"
              />
            </button>
            {sharedOpen && (
              <div className="px-3 pb-3">
                {/* M1: spell out what the status pills mean. */}
                <p className="text-[11px] text-on-surface-faint leading-snug mb-2 px-1">
                  {t('shared.status_hint')}
                </p>
                {visibleGroups.map((group) => (
                  <SharedExpenseRow
                    key={group.key}
                    group={group}
                    sessionName={group.sessionId ? (sessionNameById[group.sessionId] ?? null) : null}
                    shares={shares}
                    nameById={nameById}
                    onOpenTx={(id) => navigate(`/expenses/${id}`)}
                    t={t}
                  />
                ))}
                {groups.length > SHARED_LIST_PAGE && (
                  <button
                    onClick={() => setShowAllShared((v) => !v)}
                    className="w-full mt-1 p-2.5 rounded-xl text-xs font-bold text-primary btn-press flex items-center justify-center gap-1"
                  >
                    <Icon name={showAllShared ? 'expand_less' : 'expand_more'} size={16} />
                    {showAllShared
                      ? t('common.show_less')
                      : t('shared.show_all_count', { count: groups.length })}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* DEC-356 — backup MOVED OUT of the settle screen (connect a friend ≠ back up
          your own devices). A pointer keeps the path discoverable (→ device backup). */}
      <button
        onClick={() => navigate('/sync')}
        className="order-[64] text-[11px] text-on-surface-faint leading-relaxed px-1 flex items-center gap-1.5 text-left btn-press"
      >
        <Icon name="devices" size={14} className="text-on-surface-faint shrink-0" />
        <span className="flex-1">{t('shared.backup_moved')}</span>
        <Icon name="chevron_right" size={14} className="text-on-surface-faint shrink-0" />
      </button>

      {/* DEC-388 (G6 · S-EGO): the MAIN settle list shows only what is MINE —
          debts where the owner is the debtor or creditor. */}
      {ownerDebts.length > 0 && (
        <div className="order-[24]">
          {ownerDebts.map((debt, i) => {
            // DL-5: "Lembrar" only makes sense when someone owes the OWNER.
            const ownerIsCreditor = debt.creditorId === ownerParticipant?.id;
            return (
              <div key={i} className="bg-surface-container rounded-xl p-4 mb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-on-surface-dim truncate">
                      {debt.debtorName} → {debt.creditorName}
                    </p>
                    <p className="text-sm font-semibold text-on-surface tabular">
                      {formatMoney(debt.amountCents, trip.baseCurrency)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {ownerIsCreditor && (
                      <button
                        onClick={() => handleRemind(debt)}
                        className="px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-medium btn-press flex items-center gap-1"
                      >
                        <Icon name="notifications" size={14} />
                        {t('shared.remind')}
                      </button>
                    )}
                    <button
                      onClick={() => openSettleSheet(debt)}
                      className="px-3 py-1.5 rounded-lg bg-success/20 text-success text-xs font-medium btn-press"
                    >
                      {t('shared.settle')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DEC-388 (G6 · S-EGO) + DEC-394 (G4): debts between OTHER people that the
          owner only sees because they recorded the expense. Display-only registry,
          collapsed by default and moved BELOW the people list (order-[61]) — never
          the owner's debt (out of the hero/main list), but never lost either (A4). */}
      {otherDebts.length > 0 && (
        <div className="order-[61]">
          <button
            onClick={() => setShowThirdParty((v) => !v)}
            className="w-full p-3 rounded-xl flex items-center gap-2.5 btn-press text-left bg-surface-container"
            aria-expanded={showThirdParty}
          >
            <Icon name="group" size={16} className="text-on-surface-faint shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-on-surface">
                {t('shared.third_party_title')}
              </span>
              <span className="block text-[11px] text-on-surface-faint">
                {t('shared.third_party_subtitle', { count: otherDebts.length })}
              </span>
            </span>
            <Icon
              name={showThirdParty ? 'expand_less' : 'expand_more'}
              size={18}
              className="text-on-surface-faint shrink-0"
            />
          </button>

          {showThirdParty && (
            <div className="mt-2 flex flex-col gap-2">
              <p className="text-[11px] text-on-surface-faint leading-relaxed px-1">
                {t('shared.third_party_hint')}
              </p>
              {otherDebts.map((debt, i) => (
                <div key={i} className="bg-surface-container rounded-xl p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-on-surface-dim truncate min-w-0">
                      {debt.debtorName} → {debt.creditorName}
                    </p>
                    <p className="text-sm font-semibold text-on-surface tabular shrink-0">
                      {formatMoney(debt.amountCents, trip.baseCurrency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* GAP-032: settle confirmation with partial amount */}
      <BottomSheet
        open={settleTarget !== null}
        onClose={() => setSettleTarget(null)}
        title={t('shared.settle_confirm_title')}
      >
        {settleTarget && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-on-surface-dim">
              {t('shared.settle_confirm_body', {
                debtor: settleTarget.debtorName,
                creditor: settleTarget.creditorName,
                amount: formatMoney(settleTarget.amountCents, trip.baseCurrency),
              })}
            </p>
            <div>
              <label className="text-xs text-on-surface-faint mb-1 block">
                {t('shared.settle_amount_label')}
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full tabular"
              />
              {settleAmountCents !== null && settleAmountCents < settleTarget.amountCents && (
                <p className="text-[10px] text-on-surface-faint mt-1">
                  {t('shared.settle_partial_hint', {
                    remaining: formatMoney(settleTarget.amountCents - settleAmountCents, trip.baseCurrency),
                  })}
                </p>
              )}
            </div>
            {/* FB-27 (DEC-277): optional structured "how it was paid" — Pix/Wise/
                bank/cash/other. Tap again to clear; staying null is allowed. */}
            <div>
              <label className="text-xs text-on-surface-faint mb-1.5 block">
                {t('shared.settle_method_label')}
              </label>
              <div className="flex flex-wrap gap-2">
                {SETTLEMENT_METHOD_KINDS.map((kind) => {
                  const selected = settleMethod === kind;
                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setSettleMethod(selected ? null : kind)}
                      aria-pressed={selected}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press flex items-center gap-1.5 ${
                        selected
                          ? 'bg-primary/20 text-primary'
                          : 'bg-surface-high text-on-surface-dim'
                      }`}
                    >
                      <Icon name={SETTLEMENT_METHOD_ICONS[kind]} size={14} />
                      {t(`payment.kind_${kind}`)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setSettleTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleConfirmSettle}
                disabled={settleAmountCents === null}
                className="flex-1 py-2.5 rounded-xl bg-success/20 text-success font-medium text-sm btn-press disabled:opacity-40"
              >
                {t('shared.settle')}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* DEC-102 (R-25): itemized statement — where each cent came from */}
      <BottomSheet
        open={statementTarget !== null}
        onClose={() => setStatementTarget(null)}
        title={statementTarget?.nickname ?? statementTarget?.name ?? ''}
      >
        {statementTarget && (() => {
          const owner = participants.find((p) => p.isOwner);
          if (!owner) return null;
          // DEC-394 (G4 · S-EGO-PEOPLE): show only what is between THIS person and
          // me — owner-involved lines/settlements — so a third-party debt I merely
          // recorded never surfaces inside their profile. Net then matches their
          // faithful pairwise balance in the list.
          const statement = filterStatementToCounterparty(
            buildParticipantStatement(
              statementTarget.id,
              transactions,
              shares,
              participants,
              settlements,
              owner.id,
            ),
            owner.id,
          );
          const lineLabel = (line: (typeof statement.lines)[number]): string => {
            const sub = findSubcategory(line.subcategoryId);
            if (sub) return t(sub.labelKey as never);
            if (line.description) return line.description;
            if (line.category) return t(`categories.${line.category}` as never);
            return t('shared.statement_unnamed');
          };
          // G6 · DEC-369 (F1) — surface the SAME pending action inside the person's
          // profile: a connected peer's awaiting debt/payment shows here too (not only
          // in the top resolver), and tapping it opens the shared detail screen.
          const pendingFromPerson = statementTarget.linkedActorId
            ? inboundItems.filter(
                (i) =>
                  i.fromActorId === statementTarget.linkedActorId &&
                  (i.kind === 'debt' || i.kind === 'payment'),
              )
            : [];
          return (
            <div className="flex flex-col gap-3">
              <p
                className={`text-lg font-extrabold tabular ${
                  statement.netCents < 0
                    ? 'text-error'
                    : statement.netCents > 0
                      ? 'text-success'
                      : 'text-on-surface-dim'
                }`}
              >
                {statement.netCents < 0
                  ? t('shared.balance_owes', {
                      amount: formatMoney(Math.abs(statement.netCents), trip.baseCurrency),
                    })
                  : statement.netCents > 0
                    ? t('shared.balance_owed', {
                        amount: formatMoney(statement.netCents, trip.baseCurrency),
                      })
                    : t('shared.balance_zero')}
              </p>

              {pendingFromPerson.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-on-surface-faint">
                    {t('settle_detail.pending_from_person')}
                  </p>
                  {pendingFromPerson.map((item) => {
                    const amountCents =
                      item.kind === 'debt'
                        ? (item.debt?.amountCents ?? 0)
                        : (item.payment?.amountCents ?? 0);
                    const itemCurrency =
                      (item.kind === 'debt' ? item.debt?.currency : item.payment?.currency) ??
                      trip.baseCurrency;
                    return (
                      <button
                        key={item.itemId}
                        onClick={() => {
                          setStatementTarget(null);
                          setDetailItem(item);
                        }}
                        className="w-full flex items-center justify-between gap-2 bg-warning/10 rounded-xl px-3 py-2.5 btn-press text-left"
                      >
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="text-xs font-semibold text-on-surface truncate">
                            {item.kind === 'debt'
                              ? t('p2p.debt_label', { name: item.fromName })
                              : t('p2p.payment_in_label', { name: item.fromName })}
                          </span>
                          <SettleStateChip state={settleStateFromInboundKind(item.kind === 'debt' ? 'debt' : 'payment')} t={t} />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-sm font-bold tabular text-on-surface">
                            {formatMoney(amountCents, itemCurrency)}
                          </span>
                          <Icon name="chevron_right" size={16} className="text-on-surface-faint" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {statement.lines.length === 0 && statement.settlements.length === 0 && (
                <p className="text-sm text-on-surface-dim">{t('shared.statement_empty')}</p>
              )}

              {statement.lines.length > 0 && (() => {
                // DEC-206: collapse a receipt's items into one expandable event so
                // tapping a person no longer dumps 40+ raw lines; paginate the rest.
                const lineGroups = groupStatementLines(statement.lines);
                const visibleLineGroups = showAllStatement
                  ? lineGroups
                  : lineGroups.slice(0, STATEMENT_PAGE);
                return (
                  <div className="flex flex-col gap-1.5 max-h-[40vh] overflow-y-auto no-scrollbar">
                    {visibleLineGroups.map((group) => (
                      <StatementGroupRow
                        key={group.key}
                        group={group}
                        sessionName={
                          group.sessionId ? (sessionNameById[group.sessionId] ?? null) : null
                        }
                        currency={trip.baseCurrency}
                        lineLabel={lineLabel}
                        t={t}
                      />
                    ))}
                    {lineGroups.length > STATEMENT_PAGE && (
                      <button
                        onClick={() => setShowAllStatement((v) => !v)}
                        className="w-full mt-1 p-2 rounded-xl text-xs font-bold text-primary btn-press flex items-center justify-center gap-1"
                      >
                        <Icon name={showAllStatement ? 'expand_less' : 'expand_more'} size={16} />
                        {showAllStatement
                          ? t('common.show_less')
                          : t('shared.show_all_count', { count: lineGroups.length })}
                      </button>
                    )}
                  </div>
                );
              })()}

              {statement.settlements.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-on-surface-faint mb-1.5">
                    {t('shared.settlements_done')}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {statement.settlements.map((s) => (
                      <div
                        key={s.id}
                        className="bg-surface-high rounded-xl px-3 py-2 flex items-center justify-between"
                      >
                        <p className="text-[10px] text-on-surface-faint">
                          {formatShortDate(s.settledAt)} ·{' '}
                          {s.debtorParticipantId === statementTarget.id
                            ? t('shared.statement_settled_out')
                            : t('shared.statement_settled_in')}
                        </p>
                        <p className="text-xs font-bold tabular text-success">
                          {formatMoney(s.amountCents, s.currency)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DEC-414 (G6) — debts that were MOVED onto this person: shows the
                  "moved from {name}" origin + one-tap undo (returns it to them). */}
              {(() => {
                const movedHere = debtMovements.filter(
                  (m) => m.undoneAt === null && m.toParticipantId === statementTarget.id,
                );
                if (movedHere.length === 0) return null;
                const nameOf = (id: string): string => {
                  const p = participants.find((x) => x.id === id);
                  return p?.nickname ?? p?.name ?? t('shared.statement_unnamed');
                };
                return (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-on-surface-faint">
                      {t('shared.moved_here_label')}
                    </p>
                    {movedHere.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between gap-2 bg-surface-high rounded-xl px-3 py-2"
                      >
                        <span className="text-xs text-on-surface-dim truncate flex items-center gap-1.5">
                          <Icon name="swap_horiz" size={14} className="text-primary shrink-0" />
                          {t('shared.moved_from', { name: nameOf(m.fromParticipantId) })}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold tabular text-on-surface">
                            {formatMoney(m.amountCents, trip.baseCurrency)}
                          </span>
                          <button
                            onClick={() => handleUndoMove(m)}
                            disabled={movingDebt}
                            className="text-[11px] font-bold text-primary btn-press disabled:opacity-50"
                          >
                            {t('common.undo')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* DEC-207: shared participant link — the no-pairing headline path.
                  Works for ANY non-owner: generate a link, send it, the guest
                  opens it in a browser (no app/account needed). */}
              {!statementTarget.isOwner && (
                <button
                  onClick={() => {
                    setShareTarget(statementTarget);
                    setStatementTarget(null);
                  }}
                  className="w-full py-3 rounded-xl bg-primary text-on-surface font-semibold text-sm flex items-center justify-center gap-2 btn-press"
                >
                  <Icon name="link" size={18} />
                  {t('shareLink.open_action')}
                </button>
              )}

              {/* R4 P2P: retroactive pairing + statement push (DEC-105/106) */}
              {!statementTarget.isOwner && statementTarget.linkedActorId === null && (
                <button
                  onClick={() => {
                    setLinkTarget(statementTarget);
                    setStatementTarget(null);
                  }}
                  className="w-full py-3 rounded-xl flex items-center justify-center gap-2 btn-press font-semibold text-sm"
                  style={{ background: '#C75B3918', color: 'var(--primary)', border: '1px dashed #C75B3940' }}
                >
                  <Icon name="link" size={18} className="text-primary" />
                  {t('sync.connect_by_qr')}
                </button>
              )}
              {!statementTarget.isOwner && statementTarget.linkedActorId !== null && (
                <button
                  onClick={() => {
                    setSendTarget(statementTarget);
                    setStatementTarget(null);
                    setStatementQrText(null);
                  }}
                  className="w-full py-3 rounded-xl bg-surface-high text-on-surface font-semibold text-sm flex items-center justify-center gap-2 btn-press"
                >
                  <Icon name="send" size={18} className="text-primary" />
                  {t('sync.send_statement', {
                    name: statementTarget.nickname ?? statementTarget.name,
                  })}
                </button>
              )}

              {/* DEC-345/346 (G7) — live P2P with a connected peer: charge them or
                  record a real payment. Both seal an E2E message; the peer accepts/
                  confirms on their device. Only for peers we hold a key for. */}
              {!statementTarget.isOwner && peerLinkFor(statementTarget.id)?.publicKey && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const target = statementTarget;
                      setStatementTarget(null);
                      setChargeAmount('');
                      setChargeNote('');
                      setChargeTarget(target);
                    }}
                    className="flex-1 py-3 rounded-xl bg-surface-high text-on-surface font-semibold text-xs flex items-center justify-center gap-1.5 btn-press"
                  >
                    <Icon name="request_quote" size={16} className="text-primary" />
                    {t('p2p.charge_action')}
                  </button>
                  <button
                    onClick={() => {
                      const target = statementTarget;
                      setStatementTarget(null);
                      setPayAmount('');
                      setPayDirection('paid');
                      setPayProof(null);
                      setFundPoolId(defaultFundPoolId());
                      setFundWalletId(wallets.find((w) => w.deletedAt === null)?.id ?? null);
                      setPayTarget(target);
                    }}
                    className="flex-1 py-3 rounded-xl bg-surface-high text-on-surface font-semibold text-xs flex items-center justify-center gap-1.5 btn-press"
                  >
                    <Icon name="payments" size={16} className="text-success" />
                    {t('p2p.pay_action')}
                  </button>
                </div>
              )}

              {/* DEC-414 (G6) — move THIS person's debt to someone else (local
                  people only). Reassigns the shares (net invariant), leaving a
                  "moved from" trail + undo. Shown when they owe me and have an
                  open, non-P2P share to hand off. */}
              {!statementTarget.isOwner &&
                isPersonLocal(statementTarget.id) &&
                statement.netCents < 0 &&
                movableSharesFor(statementTarget.id).length > 0 && (
                  <button
                    onClick={() => {
                      const target = statementTarget;
                      setStatementTarget(null);
                      setMoveDestId(null);
                      setMoveShareIds(new Set(movableSharesFor(target.id).map((s) => s.id)));
                      setMoveFrom(target);
                    }}
                    className="w-full py-2.5 rounded-xl bg-surface-high text-on-surface text-xs font-semibold flex items-center justify-center gap-1.5 btn-press"
                  >
                    <Icon name="swap_horiz" size={16} className="text-primary" />
                    {t('shared.move_debt_action')}
                  </button>
                )}

              {/* I1 / DEC-370 — remove a connected person (history preserved). Only
                  when there is a connection to sever (linked device or a peer link). */}
              {!statementTarget.isOwner &&
                (statementTarget.linkedActorId !== null || peerLinkFor(statementTarget.id)) && (
                  <button
                    onClick={() => {
                      const target = statementTarget;
                      setStatementTarget(null);
                      setRemoveTarget(target);
                    }}
                    className="w-full py-2.5 rounded-xl text-error text-xs font-semibold flex items-center justify-center gap-1.5 btn-press"
                  >
                    <Icon name="person_remove" size={16} className="text-error" />
                    {t('connections.remove_action')}
                  </button>
                )}
            </div>
          );
        })()}
      </BottomSheet>

      {/* DEC-414 (G6) — move a debt to another person. Pick a destination (local
          people) and which items to move; amounts stay, only the holder changes,
          so the owner's total net is invariant (Â-DEBT-TRACEABLE). */}
      <BottomSheet
        open={moveFrom !== null}
        onClose={() => setMoveFrom(null)}
        title={t('shared.move_debt_title', { name: moveFrom?.nickname ?? moveFrom?.name ?? '' })}
      >
        {moveFrom && (() => {
          const movable = movableSharesFor(moveFrom.id);
          const destinations = participants.filter(
            (p) => !p.isOwner && p.id !== moveFrom.id && isPersonLocal(p.id),
          );
          const labelForShare = (s: ParticipantShare): string => {
            const tx = transactions.find((x) => x.id === s.transactionId);
            if (!tx) return t('shared.statement_unnamed');
            const sub = findSubcategory(tx.subcategoryId);
            if (sub) return t(sub.labelKey as never);
            if (tx.description) return tx.description;
            if (tx.category) return t(`categories.${tx.category}` as never);
            return t('shared.statement_unnamed');
          };
          const selectedTotal = movable
            .filter((s) => moveShareIds.has(s.id))
            .reduce((sum, s) => sum + s.shareAmountCents, 0);
          const toggle = (id: string) =>
            setMoveShareIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          const destName = (id: string | null): string => {
            const p = destinations.find((x) => x.id === id);
            return p?.nickname ?? p?.name ?? '';
          };
          return (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-on-surface-dim">{t('shared.move_debt_help')}</p>

              {destinations.length === 0 ? (
                <p className="text-sm text-on-surface-dim">{t('shared.move_debt_no_dest')}</p>
              ) : (
                <>
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-on-surface-faint mb-1.5">
                      {t('shared.move_debt_to')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {destinations.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setMoveDestId(p.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold btn-press ${
                            moveDestId === p.id
                              ? 'bg-primary text-on-surface'
                              : 'bg-surface-high text-on-surface-dim'
                          }`}
                        >
                          {p.nickname ?? p.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-on-surface-faint mb-1.5">
                      {t('shared.move_debt_items')}
                    </p>
                    <div className="flex flex-col gap-1.5 max-h-[36vh] overflow-y-auto no-scrollbar">
                      {movable.map((s) => {
                        const on = moveShareIds.has(s.id);
                        return (
                          <button
                            key={s.id}
                            onClick={() => toggle(s.id)}
                            className="w-full flex items-center justify-between gap-2 bg-surface-high rounded-xl px-3 py-2.5 btn-press text-left"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Icon
                                name={on ? 'check_box' : 'check_box_outline_blank'}
                                size={18}
                                className={on ? 'text-primary shrink-0' : 'text-on-surface-faint shrink-0'}
                              />
                              <span className="text-xs font-semibold text-on-surface truncate">
                                {labelForShare(s)}
                              </span>
                            </div>
                            <span className="text-xs font-bold tabular text-on-surface shrink-0">
                              {formatMoney(s.shareAmountCents, trip.baseCurrency)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-on-surface-dim">{t('shared.move_debt_total')}</span>
                    <span className="text-sm font-extrabold tabular text-on-surface">
                      {formatMoney(selectedTotal, trip.baseCurrency)}
                    </span>
                  </div>

                  <button
                    onClick={handleConfirmMove}
                    disabled={!moveDestId || moveShareIds.size === 0 || movingDebt}
                    className="w-full py-3 rounded-xl bg-primary text-on-surface font-semibold text-sm flex items-center justify-center gap-2 btn-press disabled:opacity-50"
                  >
                    <Icon name="swap_horiz" size={18} />
                    {moveDestId
                      ? t('shared.move_debt_confirm', { name: destName(moveDestId) })
                      : t('shared.move_debt_pick_dest')}
                  </button>
                </>
              )}
            </div>
          );
        })()}
      </BottomSheet>

      {/* I1 / DEC-370 — confirm removing a connected person. Tombstones the peer
          link + unlinks the participant; past divisions stay in the history. */}
      <BottomSheet
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        title={
          removeTarget
            ? t('connections.remove_title', { name: removeTarget.nickname ?? removeTarget.name })
            : ''
        }
      >
        {removeTarget && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-on-surface-dim leading-snug">
              {t('connections.remove_desc', { name: removeTarget.nickname ?? removeTarget.name })}
            </p>
            <button
              onClick={handleRemovePerson}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-error text-white font-semibold text-sm flex items-center justify-center gap-2 btn-press disabled:opacity-40"
            >
              <Icon name="person_remove" size={18} />
              {t('connections.remove_confirm')}
            </button>
            <button
              onClick={() => setRemoveTarget(null)}
              className="w-full py-2.5 rounded-xl bg-surface-high text-on-surface text-sm font-semibold btn-press"
            >
              {t('common.cancel')}
            </button>
          </div>
        )}
      </BottomSheet>

      {/* DEC-105: my identity QR + F19: the same identity as a shareable link */}
      <BottomSheet open={showMyQr} onClose={() => setShowMyQr(false)} title={t('sync.my_qr')}>
        <div className="flex flex-col gap-3">
          <QrCodeDisplay
            value={myIdentityQr ? buildQrUrl('identity', myIdentityQr, getShareOrigin()) : ''}
          />
          <p className="text-xs text-on-surface-dim text-center">{t('sync.my_qr_hint')}</p>

          {/* F19: no camera? send a link instead — opens straight to the
              pairing confirmation on the other device. */}
          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1 h-px bg-[var(--border-faint)]" />
            <span className="text-[10px] uppercase tracking-wider text-on-surface-faint">
              {t('sync.or_share_link')}
            </span>
            <div className="flex-1 h-px bg-[var(--border-faint)]" />
          </div>
          <div className="flex gap-2">
            <button
              onClick={copyPairLink}
              className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface font-medium text-sm btn-press flex items-center justify-center gap-2"
            >
              <Icon name="content_copy" size={16} className="text-primary" />
              {t('sync.copy_link')}
            </button>
            {canShareLink && (
              <button
                onClick={sharePairLink}
                className="flex-1 py-2.5 rounded-xl bg-primary text-on-surface font-medium text-sm btn-press flex items-center justify-center gap-2"
              >
                <Icon name="share" size={16} />
                {t('sync.share_link')}
              </button>
            )}
          </div>
        </div>
      </BottomSheet>

      {/* DEC-105: add participant by scanning their identity QR */}
      <BottomSheet open={showQrAdd} onClose={() => setShowQrAdd(false)} title={t('sync.add_by_qr')}>
        {showQrAdd && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-on-surface-dim">{t('sync.scan_hint')}</p>
            <QrScanner onScan={handlePairScan} />
          </div>
        )}
      </BottomSheet>

      {/* DEC-105: retroactive link of an existing participant */}
      <BottomSheet
        open={linkTarget !== null}
        onClose={() => setLinkTarget(null)}
        title={t('sync.connect_by_qr')}
      >
        {linkTarget && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-on-surface-dim">{t('sync.scan_hint')}</p>
            <QrScanner onScan={handleLinkScan} />
          </div>
        )}
      </BottomSheet>

      {/* DEC-106 (P2P-12): send statement to the paired device */}
      <BottomSheet
        open={sendTarget !== null}
        onClose={() => {
          setSendTarget(null);
          setStatementQrText(null);
        }}
        title={
          sendTarget
            ? t('sync.send_statement', { name: sendTarget.nickname ?? sendTarget.name })
            : ''
        }
      >
        {sendTarget && statementQrText && (
          <div className="flex flex-col gap-3">
            <QrCodeDisplay value={buildQrUrl('statement', statementQrText, getShareOrigin())} />
            <p className="text-xs text-on-surface-dim text-center">{t('sync.scan_hint')}</p>
            <button
              onClick={() => {
                setSendTarget(null);
                setStatementQrText(null);
              }}
              className="w-full py-3 rounded-xl bg-primary text-on-surface text-sm font-medium btn-press"
            >
              {t('common.close')}
            </button>
          </div>
        )}
        {sendTarget && !statementQrText && (() => {
          // DEC-366 (G5, m5) — connected ⇒ the real-time accept-first `debt` IS the
          // way (it lands in notif + home + Acerto + profile on their phone). The
          // live transfer / QR statement is demoted to a secondary, optional
          // "informative extract" (Flow F). For a NON-connected person the link/QR
          // is the only channel we have, so it stays primary with a connect hint.
          const hasKey = !!peerLinkFor(sendTarget.id)?.publicKey;
          const peerName = sendTarget.nickname ?? sendTarget.name;
          const transferBlock = (
            <>
              <SyncTransferFlow
                mode="send"
                purpose="statement"
                actorName={selfShareName}
                buildPayload={async () => {
                  const payload = buildStatementForParticipant(sendTarget, {
                    includeThirdParty: true,
                  });
                  if (!payload) throw new Error('statement_unavailable');
                  return { kind: 'statement', payload };
                }}
                onSent={async (session) => {
                  // The mirror flushes its queued answers on this same session.
                  try {
                    const items = await waitForResponses(session, 30_000);
                    session.send({ t: 'ack', ok: true, error: null });
                    if (items.length > 0) {
                      const applied = await applyPeerResponses(sendTarget.id, items);
                      if (applied > 0) {
                        showToast(
                          t('sync.responses_applied', { count: applied, name: peerName }),
                          'success',
                        );
                      }
                    }
                  } catch {
                    // Peer sent no responses — statement still delivered.
                  }
                  await reload();
                }}
                onDone={() => {
                  setSendTarget(null);
                  showToast(t('sync.statement_sent'), 'success');
                }}
                onCancel={() => setSendTarget(null)}
              />
              {(() => {
                // QR stays ego-only (no third parties) to fit a single frame.
                const payload = buildStatementForParticipant(sendTarget);
                if (!payload) return null;
                const encoded = encodeQrPayload({ v: 1, kind: 'statement', data: payload });
                if (!fitsInSingleQr(encoded)) return null;
                return (
                  <button
                    onClick={() => setStatementQrText(encoded)}
                    className="text-xs text-primary btn-press mx-auto"
                  >
                    {t('sync.show_as_qr')}
                  </button>
                );
              })()}
            </>
          );
          return (
            <div className="flex flex-col gap-3">
              {hasKey ? (
                <>
                  <button
                    onClick={() => handleSendSettlementDebt(sendTarget)}
                    disabled={mailboxSending}
                    className="w-full py-3 rounded-xl bg-primary text-on-surface text-sm font-semibold btn-press flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Icon name="request_quote" size={18} />
                    {t('p2p.settle_send')}
                  </button>
                  <p className="text-xs text-on-surface-dim leading-snug">
                    {t('p2p.settle_desc', { name: peerName })}
                  </p>
                  <details className="rounded-xl border border-outline/40">
                    <summary className="cursor-pointer select-none px-3 py-2 text-xs text-on-surface-dim">
                      {t('p2p.extract_optional')}
                    </summary>
                    <div className="flex flex-col gap-3 p-3 pt-0">{transferBlock}</div>
                  </details>
                </>
              ) : (
                <>
                  <p className="text-xs text-on-surface-dim leading-snug">
                    {t('p2p.link_only_hint', { name: peerName })}
                  </p>
                  {transferBlock}
                </>
              )}
            </div>
          );
        })()}
      </BottomSheet>

      {/* DEC-207: shared participant link — generate/manage from here */}
      <BottomSheet
        open={shareTarget !== null}
        onClose={() => setShareTarget(null)}
        title={
          shareTarget
            ? t('shareLink.title', { name: shareTarget.nickname ?? shareTarget.name })
            : ''
        }
      >
        {shareTarget && ownerParticipant && (
          <ShareLinkSheet
            participantId={shareTarget.id}
            participantName={shareTarget.nickname ?? shareTarget.name}
            buildStatement={() => buildStatementForParticipant(shareTarget, { includeThirdParty: true })}
            tripId={trip.id}
            ownerId={ownerParticipant.id}
            onReconciled={reload}
          />
        )}
      </BottomSheet>

      {/* DEC-345 (G7) — charge a connected peer: amount + what-for → sealed debt.
          My ledger is untouched (data-invariance); it lands when THEY accept. */}
      <BottomSheet
        open={chargeTarget !== null}
        onClose={() => setChargeTarget(null)}
        title={chargeTarget ? t('p2p.charge_title', { name: chargeTarget.nickname ?? chargeTarget.name }) : ''}
      >
        {chargeTarget && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-on-surface-dim">
              {t('p2p.charge_desc', { name: chargeTarget.nickname ?? chargeTarget.name })}
            </p>
            <div>
              <label className="text-xs text-on-surface-faint mb-1 block">{t('p2p.charge_amount')}</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
                className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full tabular"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-on-surface-faint mb-1 block">{t('p2p.charge_note')}</label>
              <input
                type="text"
                value={chargeNote}
                onChange={(e) => setChargeNote(e.target.value)}
                className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
              />
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setChargeTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSendCharge}
                disabled={chargeAmountCents === null || !chargeNote.trim() || p2pSending}
                className="flex-1 py-2.5 rounded-xl bg-primary text-on-surface font-semibold text-sm btn-press disabled:opacity-40"
              >
                {t('p2p.charge_send')}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* DEC-346 (G7, L8) — record a P2P payment. "Eu recebi" credits a chosen
          fund/wallet (real inflow); both directions settle + notify the peer. */}
      <BottomSheet
        open={payTarget !== null}
        onClose={() => {
          setPayTarget(null);
          setPayProof(null);
        }}
        title={payTarget ? t('p2p.pay_title', { name: payTarget.nickname ?? payTarget.name }) : ''}
      >
        {payTarget && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              {(['paid', 'received'] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => setPayDirection(dir)}
                  aria-pressed={payDirection === dir}
                  className={`py-2.5 rounded-xl text-sm font-semibold btn-press ${
                    payDirection === dir ? 'bg-primary/20 text-primary' : 'bg-surface-high text-on-surface-dim'
                  }`}
                >
                  {dir === 'paid' ? t('p2p.pay_i_paid') : t('p2p.pay_i_received')}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-on-surface-faint mb-1 block">{t('p2p.charge_amount')}</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full tabular"
                autoFocus
              />
            </div>
            {payDirection === 'received' && (
              <div className="flex flex-col gap-2 rounded-xl bg-surface-high p-3">
                <p className="text-[11px] text-on-surface-faint leading-snug">{t('p2p.fund_hint')}</p>
                <FundPicker
                  pools={pools}
                  wallets={wallets}
                  poolId={fundPoolId}
                  walletId={fundWalletId}
                  onPool={setFundPoolId}
                  onWallet={setFundWalletId}
                  t={t}
                />
              </div>
            )}
            {/* DEC-363 (Item D) — optional proof for this P2P payment. */}
            <ProofAttachField value={payProof} onChange={setPayProof} />
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => {
                  setPayTarget(null);
                  setPayProof(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAnnouncePayment}
                disabled={payAmountCents === null || p2pSending || (payDirection === 'received' && !fundPoolId)}
                className="flex-1 py-2.5 rounded-xl bg-success/20 text-success font-semibold text-sm btn-press disabled:opacity-40"
              >
                {t('p2p.pay_send')}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* DEC-346 (G7, L8) — confirming a payment I RECEIVED: it is a real inflow,
          so I must pick the fund/wallet it grew before it settles both sides. */}
      <BottomSheet
        open={confirmPayItem !== null}
        onClose={() => setConfirmPayItem(null)}
        title={t('p2p.fund_title')}
      >
        {confirmPayItem?.payment && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-bold text-on-surface">
              {t('p2p.payment_in_label', { name: confirmPayItem.fromName })}
            </p>
            <p className="text-2xl font-extrabold tabular text-success">
              {formatMoney(confirmPayItem.payment.amountCents, confirmPayItem.payment.currency)}
            </p>
            {/* DEC-363 (Item D) — proof recap right before funding the confirmation. */}
            {(confirmPayItem.payment.proofThumb || confirmPayItem.payment.proof) && (
              <div className="flex items-center gap-2">
                <ProofThumb
                  proof={confirmPayItem.payment.proof}
                  thumb={confirmPayItem.payment.proofThumb}
                  size={48}
                />
                <span className="text-[12px] font-semibold text-on-surface-dim">
                  {t('payment_proof.label')}
                </span>
              </div>
            )}
            <p className="text-[11px] text-on-surface-faint leading-snug">{t('p2p.fund_hint')}</p>
            <FundPicker
              pools={pools}
              wallets={wallets}
              poolId={fundPoolId}
              walletId={fundWalletId}
              onPool={setFundPoolId}
              onWallet={setFundWalletId}
              t={t}
            />
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setConfirmPayItem(null)}
                className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleConfirmPaymentWithFund}
                disabled={!fundPoolId || p2pSending}
                className="flex-1 py-2.5 rounded-xl bg-success/20 text-success font-semibold text-sm btn-press disabled:opacity-40"
              >
                {t('settle_detail.confirm_receipt')}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* G6 · DEC-369 (F2/F3) — the per-item detail screen an inbox card opens to:
          who / what / total / date / channel / status (the 15-state chip) + the
          per-state actions, with the verbs kept distinct (F4: accept the split ≠
          confirm receipt ≠ dismiss). Reuses the same accept/confirm/reject paths. */}
      <BottomSheet
        open={detailItem !== null}
        onClose={() => setDetailItem(null)}
        title={
          detailItem?.kind === 'payment'
            ? t('settle_detail.title_payment')
            : t('settle_detail.title_debt')
        }
      >
        {detailItem?.kind === 'debt' && detailItem.debt && (
          <div className="flex flex-col gap-3">
            <p className="text-2xl font-extrabold tabular text-on-surface">
              {formatMoney(detailItem.debt.amountCents, detailItem.debt.currency)}
            </p>
            <div className="flex flex-col gap-2 rounded-xl bg-surface-container p-3">
              <DetailField label={t('settle_detail.field_from')} value={detailItem.fromName} />
              <DetailField
                label={t('settle_detail.field_what')}
                value={detailItem.debt.description || t('shared.statement_unnamed')}
              />
              {detailItem.debt.occurredAt && (
                <DetailField
                  label={t('settle_detail.field_date')}
                  value={formatShortDate(detailItem.debt.occurredAt)}
                />
              )}
              <DetailField label={t('settle_detail.field_channel')} value={t('settle_detail.channel_app')} />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-on-surface-dim">{t('settle_detail.field_status')}</span>
                <SettleStateChip state={settleStateFromInboundKind('debt')} t={t} />
              </div>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => {
                  handleRejectInbound(detailItem);
                  setDetailItem(null);
                }}
                disabled={p2pBusy === detailItem.itemId}
                className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press disabled:opacity-40"
              >
                {t('p2p.reject')}
              </button>
              <button
                onClick={() => {
                  handleAcceptDebt(detailItem);
                  setDetailItem(null);
                }}
                disabled={p2pBusy === detailItem.itemId}
                className="flex-1 py-2.5 rounded-xl bg-success/20 text-success font-semibold text-sm btn-press disabled:opacity-40"
              >
                {t('settle_detail.accept_division')}
              </button>
            </div>
          </div>
        )}
        {detailItem?.kind === 'payment' && detailItem.payment && (
          <div className="flex flex-col gap-3">
            <p className="text-2xl font-extrabold tabular text-success">
              {formatMoney(detailItem.payment.amountCents, detailItem.payment.currency)}
            </p>
            <div className="flex flex-col gap-2 rounded-xl bg-surface-container p-3">
              <DetailField label={t('settle_detail.field_from')} value={detailItem.fromName} />
              <DetailField
                label={t('settle_detail.field_what')}
                value={
                  detailItem.payment.direction === 'paid'
                    ? t('p2p.payment_in_label', { name: detailItem.fromName })
                    : t('p2p.payment_out_label', { name: detailItem.fromName })
                }
              />
              <DetailField label={t('settle_detail.field_channel')} value={t('settle_detail.channel_app')} />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-on-surface-dim">{t('settle_detail.field_status')}</span>
                <SettleStateChip state={settleStateFromInboundKind('payment')} t={t} />
              </div>
            </div>
            {(detailItem.payment.proofThumb || detailItem.payment.proof) && (
              <div className="flex items-center gap-2">
                <ProofThumb proof={detailItem.payment.proof} thumb={detailItem.payment.proofThumb} size={48} />
                <span className="text-[12px] font-semibold text-on-surface-dim">{t('payment_proof.label')}</span>
              </div>
            )}
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => {
                  handleRejectInbound(detailItem);
                  setDetailItem(null);
                }}
                disabled={p2pBusy === detailItem.itemId}
                className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press disabled:opacity-40"
              >
                {t('p2p.dismiss')}
              </button>
              <button
                onClick={() => {
                  handleConfirmPayment(detailItem);
                  setDetailItem(null);
                }}
                disabled={p2pBusy === detailItem.itemId}
                className="flex-1 py-2.5 rounded-xl bg-success/20 text-success font-semibold text-sm btn-press disabled:opacity-40"
              >
                {t('settle_detail.confirm_receipt')}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* (DEC-359) The full "Pessoas" view — shipped as the orchestrator-sanctioned
          full-screen sheet that REUSES the already-loaded ledger (no duplicate data
          path; the dedicated /shared/people route is deferred to G_last). Search +
          connect row + status sections (Precisam de ação → Conectados → Convidados →
          Sem app) + pagination, all over the same unified view-model (DEC-357). */}
      <BottomSheet
        open={peopleSheetOpen}
        onClose={() => setPeopleSheetOpen(false)}
        title={t('shared.people_section')}
      >
        <div className="flex flex-col gap-3 mt-2">
          <div className="flex items-center gap-2 rounded-xl bg-surface-high px-3 py-2">
            <Icon name="search" size={18} className="text-on-surface-faint shrink-0" />
            <input
              type="text"
              value={peopleQuery}
              onChange={(e) => setPeopleQuery(e.target.value)}
              placeholder={t('shared.people_search_placeholder')}
              className="bg-transparent text-on-surface text-sm outline-none w-full"
            />
          </div>
          {/* DEC-359 — connect stays WITH the people in the full view too. */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                setPeopleSheetOpen(false);
                setShowMyQr(true);
              }}
              className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-surface-high btn-press"
            >
              <Icon name="qr_code_2" size={18} className="text-primary" />
              <span className="text-[11px] font-semibold text-on-surface">{t('sync.my_qr')}</span>
            </button>
            <button
              onClick={() => {
                setPeopleSheetOpen(false);
                setShowQrAdd(true);
              }}
              className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-surface-high btn-press"
            >
              <Icon name="qr_code_scanner" size={18} className="text-primary" />
              <span className="text-[11px] font-semibold text-on-surface">{t('shared.connect_read_qr')}</span>
            </button>
            <button
              onClick={() => {
                setPeopleSheetOpen(false);
                setShowForm(true);
              }}
              className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-surface-high btn-press"
            >
              <Icon name="person_add" size={18} className="text-primary" />
              <span className="text-[11px] font-semibold text-on-surface">{t('shared.connect_add')}</span>
            </button>
          </div>
          {(() => {
            const filtered = searchPeople(peopleView, peopleQuery);
            if (filtered.length === 0) {
              return (
                <p className="text-xs text-on-surface-faint px-1 py-4 text-center">
                  {t('shared.people_empty')}
                </p>
              );
            }
            const part = partitionPeople(filtered);
            const ordered: Array<{ key: string; label: string; rows: PersonView[] }> = [
              { key: 'need', label: t('shared.people_sec_need_action'), rows: part.needAction },
              { key: 'con', label: t('shared.people_sec_connected'), rows: part.connected },
              { key: 'inv', label: t('shared.people_sec_invited'), rows: part.invited },
              { key: 'noapp', label: t('shared.people_sec_noapp'), rows: part.noapp },
            ];
            // DEC-359 pagination — a single budget across the status sections so the
            // sheet shows a first page and grows on "ver mais", priority order first.
            let remaining = peopleShown;
            const sections = ordered
              .filter((s) => s.rows.length > 0)
              .map((s) => {
                const take = Math.min(s.rows.length, Math.max(0, remaining));
                remaining -= take;
                return { ...s, rows: s.rows.slice(0, take) };
              })
              .filter((s) => s.rows.length > 0);
            return (
              <>
                {sections.map((section) => (
                  <div key={section.key} className="flex flex-col gap-1.5">
                    <p className="text-[11px] font-semibold text-on-surface-faint uppercase tracking-wide px-1">
                      {section.label}
                    </p>
                    {section.rows.map((person) => {
                      const target = participantById.get(person.participantId);
                      const reconnect =
                        target && !target.isOwner
                          ? findReconnectCandidate(target, peerLinks, Date.now())
                          : null;
                      // DEC-376 — synthetic connect-only rows have no participantId yet;
                      // key them by actor so React never collapses two new friends.
                      const rowKey = person.participantId || `actor:${person.linkedActorId}`;
                      return (
                        <div key={rowKey} className="flex flex-col gap-1">
                          <PersonRow
                            person={person}
                            t={t}
                            currency={trip.baseCurrency}
                            awaitingCents={awaitingByParticipant.get(person.participantId) ?? 0}
                            onTap={() => void handlePersonTap(person)}
                          />
                          {reconnect && (
                            <button
                              onClick={() => handleReconnect(reconnect)}
                              disabled={saving}
                              className="w-full px-3 py-2 rounded-xl bg-warning/10 text-warning text-xs font-semibold flex items-center justify-center gap-1.5 btn-press disabled:opacity-40"
                            >
                              <Icon name="sync" size={15} className="text-warning" />
                              {t('connections.reconnect_device', { name: reconnect.displayName })}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
                {filtered.length > peopleShown && (
                  <button
                    onClick={() => setPeopleShown((n) => n + STATEMENT_PAGE)}
                    className="w-full p-2.5 rounded-xl text-xs font-bold text-primary btn-press flex items-center justify-center gap-1"
                  >
                    <Icon name="expand_more" size={16} />
                    {t('shared.people_see_more', { count: filtered.length - peopleShown })}
                  </button>
                )}
              </>
            );
          })()}
        </div>
      </BottomSheet>

      {/* DEC-106 (P2P-13) — statements received from paired owner devices live in
          "Mais" (a feature, not a people list). The separate device-"Conexões" list
          is GONE (DEC-357): connection is now a per-person badge inside Pessoas, and
          backup moved to Settings (the pointer above keeps it discoverable). */}
      <div className="order-[62]">
        <MirroredStatementsSection />
      </div>

      {settlements.length > 0 && (
        <div className="order-[63]">
          <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
            {t('shared.settlements_done')}
          </p>
          {settlements.map((s) => (
            <div key={s.id} className="bg-surface-container rounded-xl px-4 py-3 mb-1 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-on-surface truncate">
                  {participants.find((p) => p.id === s.debtorParticipantId)?.name} → {participants.find((p) => p.id === s.creditorParticipantId)?.name}
                </p>
                {/* FB-27 (DEC-277): the structured method, when it was recorded. */}
                {s.method && (
                  <p className="text-[10px] text-on-surface-faint mt-0.5 flex items-center gap-1">
                    <Icon name={SETTLEMENT_METHOD_ICONS[s.method]} size={12} />
                    {t(`payment.kind_${s.method}`)}
                  </p>
                )}
              </div>
              <p className="text-sm font-semibold tabular text-success shrink-0">
                {formatMoney(s.amountCents, s.currency)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * DEC-346 (G7, L8): the fund + wallet picker for a received P2P payment — a real
 * inflow must grow a chosen pool (and optionally a wallet). Pure presentational;
 * the parent owns the selection state and the default (active phase's pool).
 */
function FundPicker({
  pools,
  wallets,
  poolId,
  walletId,
  onPool,
  onWallet,
  t,
}: {
  pools: BudgetPool[];
  wallets: Wallet[];
  poolId: string | null;
  walletId: string | null;
  onPool: (id: string) => void;
  onWallet: (id: string | null) => void;
  t: Translate;
}) {
  const activePools = pools.filter((p) => p.deletedAt === null);
  const activeWallets = wallets.filter((w) => w.deletedAt === null);
  return (
    <div className="flex flex-col gap-2">
      <div>
        <label className="text-[11px] text-on-surface-faint mb-1 block uppercase tracking-wide font-semibold">
          {t('p2p.fund_pool')}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {activePools.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPool(p.id)}
              aria-pressed={poolId === p.id}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                poolId === p.id ? 'bg-primary/20 text-primary' : 'bg-surface-container text-on-surface-dim'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[11px] text-on-surface-faint mb-1 block uppercase tracking-wide font-semibold">
          {t('p2p.fund_wallet')}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {activeWallets.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => onWallet(w.id)}
              aria-pressed={walletId === w.id}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                walletId === w.id ? 'bg-primary/20 text-primary' : 'bg-surface-container text-on-surface-dim'
              }`}
            >
              {w.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onWallet(null)}
            aria-pressed={walletId === null}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
              walletId === null ? 'bg-primary/20 text-primary' : 'bg-surface-container text-on-surface-dim'
            }`}
          >
            {t('p2p.fund_no_wallet')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * DEC-206 (device-test 2026-06-20): a row in the "shared expenses" list. A single
 * expense keeps the original rich card (per-share confirmation status). A grouped
 * receipt session collapses into ONE expandable "event" header (merchant + item
 * count + total) that reveals its items on tap — no more 40 unreadable lines.
 */
function SharedExpenseRow({
  group,
  sessionName,
  shares,
  nameById,
  onOpenTx,
  t,
}: {
  group: SharedExpenseGroup;
  sessionName: string | null;
  shares: ParticipantShare[];
  nameById: Map<string, string>;
  onOpenTx: (transactionId: string) => void;
  t: Translate;
}) {
  const [open, setOpen] = useState(false);

  if (group.count === 1) {
    const tx = group.transactions[0]!;
    const txShares = shares.filter((s) => s.transactionId === tx.id && s.deletedAt === null);
    return (
      // R-26: the shared expense card leads to the expense detail.
      <button
        onClick={() => onOpenTx(tx.id)}
        className="bg-surface-container rounded-xl p-4 mb-2 w-full text-left btn-press"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-on-surface truncate">{tx.description}</p>
          <p className="text-sm font-semibold tabular text-on-surface shrink-0">
            {formatMoney(tx.amountCents, tx.currency)}
          </p>
        </div>
        <div className="flex flex-col gap-1 mt-2">
          {txShares.map((share) => {
            const stage = resolveShareStage(share);
            return (
              <div key={share.id} className="flex items-center justify-between">
                <p className="text-xs text-on-surface-dim truncate">
                  {nameById.get(share.participantId) ?? '—'} ·{' '}
                  <span className="tabular">{formatMoney(share.shareAmountCents, tx.currency)}</span>
                </p>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${STATUS_PILL_STYLE[stage]}`}
                >
                  {t(`shared.status_${stage}` as never)}
                </span>
              </div>
            );
          })}
        </div>
      </button>
    );
  }

  return (
    <div className="bg-surface-container rounded-xl mb-2 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full p-4 text-left btn-press flex items-center gap-3"
        aria-expanded={open}
      >
        <Icon name="receipt_long" size={20} className="text-on-surface-faint shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-on-surface truncate">
            {sessionName ?? t('shared.event_fallback')}
          </p>
          <p className="text-[11px] text-on-surface-faint">
            {t('shared.event_items', { count: group.count })}
          </p>
        </div>
        <p className="text-sm font-semibold tabular text-on-surface shrink-0">
          {formatMoney(group.totalCents, group.currency)}
        </p>
        <Icon name={open ? 'expand_less' : 'expand_more'} size={20} className="text-on-surface-faint shrink-0" />
      </button>
      {open && (
        <div className="px-3 pb-2 flex flex-col gap-1">
          {group.transactions.map((tx) => (
            <button
              key={tx.id}
              onClick={() => onOpenTx(tx.id)}
              className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-surface-high btn-press text-left"
            >
              <span className="text-xs text-on-surface-dim truncate">{tx.description}</span>
              <span className="text-xs font-semibold tabular text-on-surface shrink-0">
                {formatMoney(tx.amountCents, tx.currency)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * DEC-206: a row in a participant's itemized statement. A standalone line keeps
 * the original layout; a receipt session collapses into one expandable event that
 * shows the net for that event and, on tap, each underlying line.
 */
function StatementGroupRow({
  group,
  sessionName,
  currency,
  lineLabel,
  t,
}: {
  group: StatementLineGroup;
  sessionName: string | null;
  currency: string;
  lineLabel: (line: StatementLine) => string;
  t: Translate;
}) {
  const [open, setOpen] = useState(false);

  if (group.count === 1) {
    const line = group.lines[0]!;
    return (
      <div className="bg-surface-high rounded-xl px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-on-surface truncate">{lineLabel(line)}</p>
          <p
            className={`text-xs font-bold tabular shrink-0 ${
              line.kind === 'owes' ? 'text-error' : 'text-success'
            }`}
          >
            {line.kind === 'owes' ? '−' : '+'}
            {formatMoney(line.amountCents, currency)}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 mt-1">
          <p className="text-[10px] text-on-surface-faint truncate">
            {formatShortDate(line.occurredAt)} ·{' '}
            {line.kind === 'owes'
              ? t('shared.statement_paid_by', { name: line.counterpartyName })
              : t('shared.statement_owes_you', { name: line.counterpartyName })}
          </p>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${STATUS_PILL_STYLE[resolveShareStage(line)]}`}
          >
            {t(`shared.status_${resolveShareStage(line)}` as never)}
          </span>
        </div>
        {line.reassignedFromName && (
          <p className="text-[10px] text-primary font-semibold mt-1 flex items-center gap-1">
            <Icon name="swap_horiz" size={12} />
            {t('shared.moved_from', { name: line.reassignedFromName })}
          </p>
        )}
      </div>
    );
  }

  // The event's signed net: positive → they owe you, negative → you owe them.
  const owesThem = group.netCents < 0;
  return (
    <div className="bg-surface-high rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2.5 text-left btn-press flex items-center gap-2"
        aria-expanded={open}
      >
        <Icon name="receipt_long" size={16} className="text-on-surface-faint shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-on-surface truncate">
            {sessionName ?? t('shared.event_fallback')}
          </p>
          <p className="text-[10px] text-on-surface-faint">
            {t('shared.event_items', { count: group.count })}
          </p>
        </div>
        <p
          className={`text-xs font-bold tabular shrink-0 ${owesThem ? 'text-error' : 'text-success'}`}
        >
          {owesThem ? '−' : '+'}
          {formatMoney(Math.abs(group.netCents), currency)}
        </p>
        <Icon name={open ? 'expand_less' : 'expand_more'} size={16} className="text-on-surface-faint shrink-0" />
      </button>
      {open && (
        <div className="px-2.5 pb-2 flex flex-col gap-1">
          {group.lines.map((line, i) => (
            <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-surface-container">
              <span className="text-[11px] text-on-surface-dim truncate">
                {lineLabel(line)}
                {line.reassignedFromName && (
                  <span className="text-primary"> · {t('shared.moved_from', { name: line.reassignedFromName })}</span>
                )}
              </span>
              <span
                className={`text-[11px] font-bold tabular shrink-0 ${
                  line.kind === 'owes' ? 'text-error' : 'text-success'
                }`}
              >
                {line.kind === 'owes' ? '−' : '+'}
                {formatMoney(line.amountCents, currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
