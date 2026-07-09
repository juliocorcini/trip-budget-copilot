import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { useScrolled } from '@/hooks/useScrolled';
import { groupSplitRepository } from '@/data/repositories';
import { persistGroupSplit, deleteGroupSplit, registerIncome } from '@/domain/orchestrators';
import { createIncomeTransaction } from '@/domain/transactions';
import { resolveActivePhase } from '@/domain/dates';
import { getAvailablePoolsForPhase } from '@/domain/budget';
import { BottomSheet } from '@/components/BottomSheet';
import {
  addExpense,
  addParticipant,
  appendGroupActivity,
  buildGroupSettlementStatus,
  canRemoveParticipant,
  computeGroupBalances,
  computeGroupTransfers,
  isGroupObligationClosed,
  createGroupParticipant,
  includeParticipantInWholeGroupExpenses,
  groupActivityTimeline,
  groupExpenseImages,
  groupExpensesByDay,
  groupPaymentTone,
  groupPaymentStatusLabelKey,
  groupTotalCents,
  reduceGroupClaims,
  removeExpense,
  removeParticipant,
  setGroupStatus,
  setParticipantPayment,
  updateExpense,
  withOwnerPaymentMethods,
} from '@/domain/group-split';
import type { PaymentMethod } from '@/domain/payment';
import { formatMoney } from '@/domain/money';
import { getActiveIntlLocale } from '@/domain/locale';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';
import { QrCodeDisplay } from '@/components/QrCodeDisplay';
import { shareOrCopyLink } from '@/utils/native/link-share';
import { GroupExpenseEditor } from './GroupExpenseEditor';
import { GroupImage, ImageLightbox } from './GroupImage';
import { deleteSharedImage } from '@/data/sync/media-link';
import {
  publishGroupSplit,
  republishGroupSplit,
  revokeGroupSplit,
  pullGroupClaims,
  buildGroupSplitLink,
  saveGroupLive,
  loadGroupLive,
  clearGroupLive,
  type GroupLiveCreds,
} from './group-link';
import type { GroupActivity, GroupExpense, GroupSplitEvent, GroupPaymentStatus } from '@/domain/group-split';
import { signalGroupSplitUpdate } from '@/utils/group-split-boot';
import { ProofThumb } from '@/features/payment-proof/PaymentProof';

const POLL_FLOOR_MS = 6000;

/** DEC-336 — a short, locale-aware header for a `YYYY-MM-DD` expense day. */
function formatDayLabel(dayKey: string): string {
  const d = new Date(`${dayKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dayKey;
  return d.toLocaleDateString(getActiveIntlLocale(), { weekday: 'short', day: '2-digit', month: 'short' });
}

/** A loosely-typed `t` that allows interpolation params (for the activity copy). */
type TranslateFn = (key: string, opts?: Record<string, string | number>) => string;

/** DEC-354 — a short, locale-aware timestamp for one history entry. */
function formatActivityTime(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(getActiveIntlLocale(), {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** The Material icon for each activity kind (data-driven, no branching in JSX). */
const ACTIVITY_ICONS: Record<GroupActivity['kind'], string> = {
  expense_added: 'add_circle',
  expense_removed: 'do_not_disturb_on',
  payment_marked: 'schedule',
  payment_confirmed: 'check_circle',
  payment_override: 'gavel',
  payment_contested: 'report',
  payment_cancelled: 'cancel',
  participant_joined: 'person_add',
  share_revoked: 'link_off',
};

function activityIcon(kind: GroupActivity['kind']): string {
  return ACTIVITY_ICONS[kind] ?? 'history';
}

/**
 * G_last (DEC-354) — localizes the prior-state token stored on an organizer-override
 * entry's `detail` ("was unpaid" / "had marked as paid"), so the audit shows what the
 * override changed. Falls back to the raw token for any unmapped state.
 */
function overridePrevLabel(prevToken: string, t: TranslateFn): string {
  const key = `group_split.override_prev_${prevToken}`;
  const label = t(key);
  return label === key ? prevToken : label;
}

/** DEC-354 — the human sentence for one history entry, via `t()` + `formatMoney`. */
function activityText(entry: GroupActivity, t: TranslateFn, currency: string): string {
  return t(`group_split.activity_${entry.kind}`, {
    actor: entry.actorName,
    subject: entry.subjectName ?? '',
    counterpart: entry.counterpartName ?? '',
    detail: entry.detail ?? '',
    amount: typeof entry.amountCents === 'number' ? formatMoney(entry.amountCents, currency) : '',
  });
}

/**
 * C23 / DEC-297 — one Tricount event: people, expenses (manual now; AI/receipt in
 * m3), the live total, per-person balances and the minimum transfers to settle.
 * Mutations go through the pure `group-split` domain; {@link persistGroupSplit}
 * writes each new state.
 */
export function GroupSplitDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { settings, trip, phases, pools, links, participants } = useAppData();
  const scrolled = useScrolled();
  const photoEnabled = settings?.cloudReceiptOcrEnabled ?? false;
  const aiTextEnabled = settings?.aiQuickEntryEnabled ?? false;

  const [event, setEvent] = useState<GroupSplitEvent | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [newPerson, setNewPerson] = useState('');
  const [editing, setEditing] = useState<GroupExpense | 'new' | null>(null);
  const [creds, setCreds] = useState<GroupLiveCreds | null>(null);
  const [publishing, setPublishing] = useState(false);
  // A04/DEC-335 + F01: balances ("Pagamentos") and transfers ("Quem paga quem")
  // live behind buttons — expenses are the primary surface, not the math. Only
  // ONE panel is open at a time (F01 accordion exclusivity).
  const [openPanel, setOpenPanel] = useState<'none' | 'balances' | 'transfers' | 'history'>('none');
  // F23 — show only the most recent activity until the user expands "ver tudo".
  const [historyExpanded, setHistoryExpanded] = useState(false);
  // A02/DEC-338: keep focus on the add-person field after each add.
  const newPersonRef = useRef<HTMLInputElement>(null);

  // DEC-348 (G2) — images now upload on attach in the editor and persist as refs
  // on the expense; the detail page only renders them + cleans blobs on delete/
  // revoke. The lightbox just tracks the URL it is showing.
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  // Tracks a lightbox URL WE created (a local blob) so we revoke only our own.
  const lightboxOwnedRef = useRef<string | null>(null);
  const [incomePrompt, setIncomePrompt] = useState<{
    participantName: string;
    amountCents: number;
  } | null>(null);
  const [incomePoolId, setIncomePoolId] = useState<string | null>(null);
  const [incomeSaving, setIncomeSaving] = useState(false);

  const openLightbox = useCallback((url: string, owned: boolean) => {
    lightboxOwnedRef.current = owned ? url : null;
    setLightboxUrl(url);
  }, []);

  const closeLightbox = useCallback(() => {
    if (lightboxOwnedRef.current) {
      URL.revokeObjectURL(lightboxOwnedRef.current);
      lightboxOwnedRef.current = null;
    }
    setLightboxUrl(null);
  }, []);

  // Refs keep the poller and the save seam reading the latest state without
  // re-subscribing the interval on every keystroke/edit.
  const eventRef = useRef<GroupSplitEvent | null>(null);
  eventRef.current = event;
  const credsRef = useRef<GroupLiveCreds | null>(null);
  // DEC-433 — the owner's repayment methods, read fresh at publish time so the
  // `/g/` board always shows the current Pix/Wise; kept in a ref so the stable
  // `save` seam can read them without re-subscribing on every settings change.
  const ownerMethodsRef = useRef<PaymentMethod[]>([]);
  ownerMethodsRef.current = settings?.paymentMethods ?? [];

  const applyCreds = useCallback((next: GroupLiveCreds | null) => {
    credsRef.current = next;
    setCreds(next);
  }, []);

  useEffect(() => {
    if (!id) return;
    void groupSplitRepository.getEvent(id).then((e) => {
      setEvent(e ?? null);
      setLoaded(true);
    });
    applyCreds(loadGroupLive(id));
  }, [id, applyCreds]);

  /**
   * The single write seam: persist the pure-mutated event and, when the event is
   * being shared, re-publish the encrypted mirror (bumping the revision) so every
   * guest's `/g/` board reflects the owner's latest edits and confirmations.
   */
  const save = useCallback(async (next: GroupSplitEvent) => {
    setEvent(next);
    await persistGroupSplit(next);
    const c = credsRef.current;
    if (!c) return;
    const bumped: GroupLiveCreds = { ...c, revision: c.revision + 1 };
    applyCreds(bumped);
    saveGroupLive(next.id, bumped);
    try {
      // DEC-433 — the published mirror carries the owner's repayment methods; the
      // locally persisted event stays clean (methods live in AppSettings, not here).
      const result = await republishGroupSplit(
        bumped,
        withOwnerPaymentMethods(next, ownerMethodsRef.current),
        bumped.revision,
      );
      // DEC-455 — the republish escrowed the key: pre-escrow events upgrade so
      // their next shared link drops the `#k=` fragment.
      if (result.keyHeld && !bumped.keyOnServer) {
        const upgraded: GroupLiveCreds = { ...bumped, keyOnServer: true };
        applyCreds(upgraded);
        saveGroupLive(next.id, upgraded);
      }
      signalGroupSplitUpdate(bumped.shareId);
    } catch {
      // A transient network failure leaves the link live at the prior revision;
      // the next edit re-publishes. Never block the local edit on the network.
    }
  }, [applyCreds]);

  // Owner poll — fold every guest's claim snapshot (pick name + marked paid +
  // DEC-340 authored expenses) into the live event while it is open and shared.
  // Deterministic + idempotent: only a real change persists/re-publishes, so this
  // converges and never loops.
  useEffect(() => {
    if (!creds || !event || event.status !== 'open') return;
    let cancelled = false;
    const tick = async () => {
      try {
        const claims = await pullGroupClaims(creds);
        const current = eventRef.current;
        if (!current || cancelled) return;
        const next = reduceGroupClaims(current, claims);
        // DEC-340 — the reducer can now fold/retract guest-authored expenses, so a
        // change in EITHER participants or expenses must be persisted + re-published.
        const changed =
          JSON.stringify(next.participants) !== JSON.stringify(current.participants) ||
          JSON.stringify(next.expenses) !== JSON.stringify(current.expenses);
        if (changed) {
          // DEC-354 — log participants who newly claimed a slot via the link this
          // tick (null → actorId, once). The change-guard above keeps it converging.
          const priorClaimed = new Map(current.participants.map((p) => [p.id, p.claimedByActorId]));
          // DEC-363 (Item D) — and log a `payment_marked` the FIRST tick a slot turns
          // marked, carrying the guest's OPTIONAL proof (latest claim for that slot)
          // so the receipt lands in the timeline. Idempotent: the saved 'marked'
          // status stops the next tick from re-logging (same converging guard).
          const priorStatus = new Map(current.participants.map((p) => [p.id, p.paymentStatus]));
          const priorExpenseIds = new Set(current.expenses.map((e) => e.id));
          const nextExpenseIds = new Set(next.expenses.map((e) => e.id));
          const nextTransfers = computeGroupTransfers(next);
          const nameById = new Map(next.participants.map((p) => [p.id, p.name]));
          let logged = next;
          for (const p of next.participants) {
            if ((priorClaimed.get(p.id) ?? null) === null && p.claimedByActorId !== null) {
              logged = appendGroupActivity(logged, {
                kind: 'participant_joined',
                actorId: p.claimedByActorId,
                actorName: p.name,
              });
            }
            if (priorStatus.get(p.id) !== 'marked' && p.paymentStatus === 'marked') {
              const claim = [...claims]
                .filter((c) => c.claimedParticipantId === p.id)
                .sort((a, b) => a.at.localeCompare(b.at))
                .pop();
              const owed =
                nextTransfers
                  .filter((tr) => tr.fromParticipantId === p.id)
                  .reduce((s, tr) => s + tr.amountCents, 0) || undefined;
              logged = appendGroupActivity(logged, {
                kind: 'payment_marked',
                actorId: p.claimedByActorId,
                actorName: p.name,
                amountCents: owed,
                proof: claim?.proof,
                proofThumb: claim?.proofThumb,
              });
            }
          }
          for (const exp of next.expenses) {
            if (!priorExpenseIds.has(exp.id) && exp.authoredByActorId) {
              const authorName = (exp.createdByParticipantId && nameById.get(exp.createdByParticipantId)) || exp.authoredByActorId;
              logged = appendGroupActivity(logged, {
                kind: 'expense_added',
                actorName: authorName,
                detail: exp.description,
                amountCents: exp.amountCents,
              });
            }
          }
          for (const exp of current.expenses) {
            if (!nextExpenseIds.has(exp.id) && exp.authoredByActorId) {
              const authorName = (exp.createdByParticipantId && nameById.get(exp.createdByParticipantId)) || exp.authoredByActorId;
              logged = appendGroupActivity(logged, {
                kind: 'expense_removed',
                actorName: authorName,
                detail: exp.description,
                amountCents: exp.amountCents,
              });
            }
          }
          await save(logged);
        }
      } catch {
        // ignore — the next tick retries.
      }
    };
    void tick();
    const interval = setInterval(tick, POLL_FLOOR_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [creds, event?.id, event?.status, save]);

  const balances = useMemo(() => (event ? computeGroupBalances(event) : []), [event]);
  const transfers = useMemo(() => (event ? computeGroupTransfers(event) : []), [event]);
  // F22 — each transfer tagged with the debtor's lifecycle state + settled/pending counts.
  const settlement = useMemo(() => (event ? buildGroupSettlementStatus(event) : null), [event]);
  // F23 — newest-first movement history (display-only; DEC-354).
  const timeline = useMemo(() => (event ? groupActivityTimeline(event) : []), [event]);
  // DEC-363 (Item D) — the LATEST proof a debtor attached when marking paid, keyed
  // by their actorId (timeline is newest-first, so the first hit per actor wins).
  // Surfaces a receipt thumbnail on that person's row so the owner reviews → confirms.
  const proofByActorId = useMemo(() => {
    const map = new Map<string, GroupActivity>();
    for (const a of timeline) {
      if (a.kind === 'payment_marked' && a.actorId && (a.proofThumb || a.proof) && !map.has(a.actorId)) {
        map.set(a.actorId, a);
      }
    }
    return map;
  }, [timeline]);
  // DEC-336 — expenses bucketed by the day they happened (newest fields fall back to createdAt).
  const expenseDays = useMemo(() => (event ? groupExpensesByDay(event.expenses) : []), [event]);
  const total = event ? groupTotalCents(event) : 0;
  const netByPid = useMemo(() => new Map(balances.map((b) => [b.participantId, b.netCents])), [balances]);
  const activePhase = useMemo(() => resolveActivePhase(phases), [phases]);
  const incomePools = useMemo(() => {
    if (!activePhase) return [];
    const avail = getAvailablePoolsForPhase(pools, links, activePhase.id);
    return [...avail.operational, ...avail.global, ...avail.otherPhases];
  }, [activePhase, pools, links]);

  const handleSaveIncome = async () => {
    if (!incomePrompt || !trip || !activePhase || incomeSaving) return;
    const targetPoolId = incomePoolId ?? incomePools[0]?.id;
    if (!targetPoolId) return;
    setIncomeSaving(true);
    try {
      const tx = createIncomeTransaction({
        tripId: trip.id,
        phaseId: activePhase.id,
        budgetPoolId: targetPoolId,
        walletId: null,
        amountCents: incomePrompt.amountCents,
        currency: event!.currency,
        description: t('group_split.income_from_payment', { name: incomePrompt.participantName }),
      });
      await registerIncome(tx);
      showToast(
        t('income.saved_toast', { amount: formatMoney(incomePrompt.amountCents, event!.currency) }),
        'success',
      );
      setIncomePrompt(null);
      setIncomePoolId(null);
    } finally {
      setIncomeSaving(false);
    }
  };

  const link = creds ? buildGroupSplitLink(creds) : null;
  const isTripLinked = !!event && !!trip && event.tripId === trip.id;
  // Trip teammates not yet in this event (offered as quick linked-add chips).
  const tripPeopleToAdd = useMemo(() => {
    if (!isTripLinked || !event) return [];
    const linkedIds = new Set(event.participants.map((p) => p.linkedParticipantId).filter(Boolean));
    return participants.filter((p) => !p.isOwner && p.deletedAt === null && !linkedIds.has(p.id));
  }, [isTripLinked, event, participants]);

  if (loaded && event === null) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <Icon name="group_off" size={32} className="text-on-surface-faint" />
        <p className="text-sm text-on-surface-dim">{t('group_split.not_found')}</p>
        <button onClick={() => navigate('/groups', { replace: true })} className="text-sm text-primary font-semibold btn-press">
          {t('group_split.back_to_list')}
        </button>
      </div>
    );
  }
  if (event === null) return null;

  const nameById = new Map(event.participants.map((p) => [p.id, p.name]));
  // The owner device is the actor for detail-page actions (DEC-354 activity log).
  const ownerName = nameById.get(event.ownerParticipantId) ?? '';
  // DEC-348 — every image across all expenses (multi-photo), flattened for the gallery.
  const imageItems = event.expenses.flatMap((e) => groupExpenseImages(e).map((ref) => ({ exp: e, ref })));

  const handleAddPerson = () => {
    const trimmed = newPerson.trim();
    if (trimmed.length === 0) return;
    addPersonAndResplit(createGroupParticipant({ name: trimmed }));
    setNewPerson('');
    // DEC-338: a button tap blurs the input — restore focus so the keyboard
    // stays open and the next name can be typed straight away.
    newPersonRef.current?.focus();
  };

  // DEC-432 (Field v2) — a person added AFTER expenses were logged still counts:
  // any equal expense that split the whole group so far grows to include them, so
  // their balance never reads a false 0. Honest toast when it changed the math.
  const addPersonAndResplit = (person: ReturnType<typeof createGroupParticipant>) => {
    const withPerson = addParticipant(event, person);
    const { event: resplit, updatedCount } = includeParticipantInWholeGroupExpenses(withPerson, person.id);
    void save(resplit);
    if (updatedCount > 0) {
      showToast(t('group_split.person_added_resplit', { name: person.name, count: updatedCount }), 'info');
    }
  };

  const handleRemovePerson = (participantId: string) => {
    if (!canRemoveParticipant(event, participantId)) {
      showToast(t('group_split.person_in_use'), 'danger');
      return;
    }
    void save(removeParticipant(event, participantId));
  };

  // C23/DEC-306: add a trip teammate as a LINKED participant so their group net
  // can flow into the trip settle-up. Only offered for a trip-scoped event.
  const handleAddTripPerson = (tripParticipantId: string, name: string) => {
    addPersonAndResplit(
      createGroupParticipant({ name, kind: 'connected', linkedParticipantId: tripParticipantId }),
    );
  };

  const handleSaveExpense = (expense: GroupExpense) => {
    // DEC-348 — the editor already uploaded + attached `imageRefs`; just persist.
    const prior = event.expenses.find((e) => e.id === expense.id);
    const updated = prior ? updateExpense(event, expense) : addExpense(event, expense);
    // DEC-354 — log a NEW expense (edits are not movement-history events).
    const next = prior
      ? updated
      : appendGroupActivity(updated, {
          kind: 'expense_added',
          actorName: ownerName,
          detail: expense.description,
          amountCents: expense.amountCents,
        });
    void save(next);
    setEditing(null);
  };

  const handleDeleteExpense = (expenseId: string) => {
    const prior = event.expenses.find((e) => e.id === expenseId);
    // Best-effort delete the expense's image blobs (hide-never-delete is for the
    // ledger; an orphaned receipt blob has no value and the TTL also reaps it).
    if (prior) for (const ref of groupExpenseImages(prior)) void deleteSharedImage(ref);
    let next = removeExpense(event, expenseId);
    if (prior) {
      next = appendGroupActivity(next, {
        kind: 'expense_removed',
        actorName: ownerName,
        detail: prior.description,
        amountCents: prior.amountCents,
      });
    }
    void save(next);
    setEditing(null);
  };

  const handleToggleSettled = () => {
    void save(setGroupStatus(event, event.status === 'settled' ? 'open' : 'settled'));
  };

  const shareLink = async (url: string) => {
    const outcome = await shareOrCopyLink({ url, text: t('group_split.invite_text', { name: event.name }) });
    if (outcome === 'copied') showToast(t('group_split.link_copied'), 'success');
    else if (outcome === 'copy_failed') showToast(t('group_split.link_error'), 'danger');
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const c = await publishGroupSplit(withOwnerPaymentMethods(event, ownerMethodsRef.current), 1);
      applyCreds(c);
      saveGroupLive(event.id, c);
      await shareLink(buildGroupSplitLink(c));
    } catch {
      showToast(t('group_split.link_error'), 'danger');
    } finally {
      setPublishing(false);
    }
  };

  const handleRevoke = async () => {
    const c = credsRef.current;
    if (!c) return;
    try {
      await revokeGroupSplit(c);
    } catch {
      // Already gone server-side — fall through and clear locally regardless.
    }
    // DEC-343/348 — revoking the link deletes the shared image blobs (best-effort)
    // and strips their now-orphaned refs so the gallery never renders a broken image.
    const refs = event.expenses.flatMap((e) => groupExpenseImages(e));
    for (const ref of refs) void deleteSharedImage(ref);
    const stripped: GroupSplitEvent =
      refs.length > 0
        ? {
            ...event,
            expenses: event.expenses.map((e) => {
              if (!e.imageRef && !e.imageRefs) return e;
              const copy = { ...e };
              delete copy.imageRef;
              delete copy.imageRefs;
              return copy;
            }),
          }
        : event;
    // DEC-354 — record the revoke in the movement history.
    const next = appendGroupActivity(stripped, { kind: 'share_revoked', actorName: ownerName });
    await persistGroupSplit(next);
    setEvent(next);
    clearGroupLive(event.id);
    applyCreds(null);
    showToast(t('group_split.link_revoked'), 'info');
  };

  /**
   * DEC-353/354 — set a debtor's payment state AND log it. The receiver confirms;
   * when the OWNER confirms a payment whose creditor is someone else, that is an
   * organizer **override** and is written to the activity log (never silent). A
   * `marked` payment never closes the obligation (the payer isn't penalised).
   */
  const handleSetPayment = (participantId: string, status: GroupPaymentStatus) => {
    const subject = event.participants.find((p) => p.id === participantId);
    if (!subject) return;
    // G_last (DEC-353/354): capture the prior state BEFORE mutating, so an
    // organizer override records what it overrode (a richer audit trail).
    const prevStatus: GroupPaymentStatus = subject.paymentStatus ?? 'unpaid';
    let next = setParticipantPayment(event, participantId, status);
    if (status === 'confirmed') {
      const currentNet = netByPid.get(participantId) ?? 0;
      next = {
        ...next,
        participants: next.participants.map((p) =>
          p.id === participantId ? { ...p, confirmedNetCents: currentNet } : p,
        ),
      };
    }
    const debtorTransfers = transfers.filter((tr) => tr.fromParticipantId === participantId);
    const amountCents = debtorTransfers.reduce((s, tr) => s + tr.amountCents, 0) || undefined;
    if (status === 'confirmed') {
      const creditorIds = debtorTransfers.map((tr) => tr.toParticipantId);
      const receiverIsOwner = creditorIds.length > 0 && creditorIds.every((cid) => cid === event.ownerParticipantId);
      if (receiverIsOwner) {
        next = appendGroupActivity(next, { kind: 'payment_confirmed', actorName: ownerName, subjectName: subject.name, amountCents });
        if (amountCents && amountCents > 0 && trip) {
          setIncomePrompt({ participantName: subject.name, amountCents });
        }
      } else {
        const creditorName = debtorTransfers.find((tr) => tr.toParticipantId !== event.ownerParticipantId)?.toName;
        // `detail` carries the prior-state token (display-only); rendered as a
        // localized "estava: …" line + an organizer badge in the timeline.
        next = appendGroupActivity(next, {
          kind: 'payment_override',
          actorName: ownerName,
          subjectName: subject.name,
          counterpartName: creditorName,
          detail: prevStatus,
          amountCents,
        });
      }
    } else if (status === 'marked') {
      next = appendGroupActivity(next, { kind: 'payment_marked', actorName: subject.name, amountCents });
    } else if (status === 'contested') {
      next = appendGroupActivity(next, { kind: 'payment_contested', actorName: ownerName, subjectName: subject.name });
    } else if (status === 'cancelled') {
      next = appendGroupActivity(next, { kind: 'payment_cancelled', actorName: ownerName, subjectName: subject.name });
    }
    void save(next);
  };

  const handleDeleteEvent = async () => {
    const hasActivity = event.expenses.length > 0 ||
      event.participants.some((p) => p.paymentStatus !== 'unpaid' && p.id !== event.ownerParticipantId);
    const message = hasActivity
      ? t('group_split.delete_confirm_active', {
          expenses: event.expenses.length,
          total: formatMoney(total, event.currency),
        })
      : t('group_split.delete_confirm');
    if (!window.confirm(message)) return;
    const c = credsRef.current;
    if (c) {
      try { await revokeGroupSplit(c); } catch { /* already gone — fine */ }
      clearGroupLive(event.id);
    }
    await deleteGroupSplit(event.id);
    showToast(t('group_split.deleted'), 'success');
    navigate('/groups', { replace: true });
  };

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* F28 — sticky header so back + status stay reachable while scrolling. */}
      <div className={`page-sticky-header ${scrolled ? 'is-scrolled' : ''} pt-4 pb-3 flex items-center gap-2`}>
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface truncate flex-1">{event.name}</h1>
        {event.status === 'settled' && (
          <span className="text-[11px] font-semibold text-success px-2 py-1 rounded-lg bg-success/15">
            {t('group_split.status_settled')}
          </span>
        )}
      </div>

      <div className="bg-surface-container rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] text-on-surface-faint">{t('group_split.total_label')}</p>
          <p className="text-2xl font-extrabold tabular text-on-surface">{formatMoney(total, event.currency)}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-on-surface-faint">{t('group_split.people_label')}</p>
          <p className="text-lg font-bold text-on-surface">{event.participants.length}</p>
        </div>
      </div>

      {/* Share — invite the group through the public `/g/` link (C23/DEC-297). */}
      <section className="flex flex-col gap-2">
        {creds ? (
          <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Icon name="link" size={18} className="text-success" />
              <span className="text-sm font-semibold text-on-surface">{t('group_split.sharing_on')}</span>
            </div>
            {link && (
              <div className="flex flex-col items-center gap-1.5 pt-1">
                <QrCodeDisplay value={link} size={176} />
                <p className="text-[11px] text-on-surface-faint">{t('group_split.scan_to_join')}</p>
              </div>
            )}
            <p className="text-[11px] text-on-surface-faint break-all">{link}</p>
            {/* DEC-445 — consent awareness: the pasted link renders a summary card. */}
            <p className="text-[10px] text-on-surface-faint leading-snug">
              {t('shareLink.preview_notice')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => link && void shareLink(link)}
                className="flex-1 py-2.5 rounded-lg bg-primary text-on-surface font-semibold btn-press flex items-center justify-center gap-1.5"
              >
                <Icon name="share" size={16} className="text-on-surface" />
                {t('group_split.share_again')}
              </button>
              <button
                onClick={handleRevoke}
                className="py-2.5 px-3 rounded-lg bg-surface-high text-on-surface-dim text-sm btn-press"
              >
                {t('group_split.stop_sharing')}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="bg-surface-container rounded-xl p-4 flex items-center gap-3 text-left btn-press disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Icon name="group_add" size={20} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-on-surface">{t('group_split.invite_cta')}</p>
              <p className="text-[11px] text-on-surface-faint">{t('group_split.invite_hint')}</p>
            </div>
            {publishing && (
              <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
            )}
          </button>
        )}
      </section>

      {/* Expenses — the primary surface (A03/DEC-335), even when empty. */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-on-surface">{t('group_split.expenses_title')}</h2>
          <button
            onClick={() => setEditing('new')}
            className="text-sm text-primary font-semibold btn-press flex items-center gap-1"
          >
            <Icon name="add" size={18} className="text-primary" />
            {t('group_split.add_expense')}
          </button>
        </div>
        {event.expenses.length === 0 ? (
          <div className="bg-surface-container rounded-xl p-5 text-center">
            <p className="text-sm text-on-surface-dim">{t('group_split.no_expenses')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {expenseDays.map((day) => (
              <div key={day.day} className="flex flex-col gap-2">
                {/* DEC-336 — day headers only when the group spans more than one day. */}
                {expenseDays.length > 1 && (
                  <p className="text-[11px] font-semibold text-on-surface-faint px-1 capitalize">
                    {formatDayLabel(day.day)}
                  </p>
                )}
                {day.expenses.map((exp) => {
                  const registrant = exp.createdByParticipantId;
                  const showRegistrant = !!registrant && registrant !== exp.paidByParticipantId;
                  return (
                    <button
                      key={exp.id}
                      onClick={() => setEditing(exp)}
                      className="bg-surface-container rounded-xl p-3.5 flex items-center gap-3 text-left btn-press"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-on-surface truncate flex items-center gap-1.5">
                          <span className="truncate">{exp.description}</span>
                          {!!exp.items && exp.items.length > 0 && (
                            <Icon name="checklist" size={15} className="text-on-surface-faint shrink-0" />
                          )}
                          {groupExpenseImages(exp).length > 0 && (
                            <Icon name="photo" size={15} className="text-on-surface-faint shrink-0" />
                          )}
                        </p>
                        <p className="text-[11px] text-on-surface-faint">
                          {t('group_split.paid_by', { name: nameById.get(exp.paidByParticipantId) ?? '?' })}
                          {' · '}
                          {exp.splitMode === 'equal'
                            ? t('group_split.split_equal_n', { count: exp.participantIds.length })
                            : t('group_split.split_custom_n', { count: exp.participantIds.length })}
                        </p>
                        {showRegistrant && (
                          <p className="text-[11px] text-on-surface-faint">
                            {t('group_split.registered_by', { name: nameById.get(registrant) ?? '?' })}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-bold tabular text-on-surface shrink-0">
                        {formatMoney(exp.amountCents, event.currency)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Fotos (DEC-348) — every expense receipt/proof photo, viewable + downloadable
          by all members + the `/g/` web guest (access-controlled plaintext). */}
      {imageItems.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-on-surface px-1">{t('group_split.photos_title')}</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {imageItems.map(({ exp, ref }) => (
              <GroupImage
                key={ref.r2Id}
                imageRef={ref}
                alt={exp.description}
                className="w-24 h-24 rounded-xl shrink-0"
                onOpen={(url) => openLightbox(url, false)}
              />
            ))}
          </div>
        </section>
      )}

      {/* People */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-on-surface px-1">{t('group_split.people_title')}</h2>
        <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-2.5">
          {event.participants.map((p) => {
            const isOwner = p.id === event.ownerParticipantId;
            const isDebtor = (netByPid.get(p.id) ?? 0) < 0 && event.expenses.length > 0;
            return (
              <div key={p.id} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-surface-high flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-on-surface-dim">{p.name.slice(0, 1).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-base text-on-surface truncate block">{p.name}</span>
                  {p.claimedByActorId !== null && !isOwner && (
                    <span className="text-[10px] text-success">{t('group_split.joined_via_link')}</span>
                  )}
                </div>
                {isOwner ? (
                  <span className="text-[10px] text-on-surface-faint shrink-0">{t('group_split.owner_tag')}</span>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* DEC-363 (Item D) — the receipt the debtor attached when marking
                        paid, shown right by the confirm action so the owner reviews it. */}
                    {p.paymentStatus === 'marked' && p.claimedByActorId && proofByActorId.has(p.claimedByActorId) && (
                      <ProofThumb
                        proof={proofByActorId.get(p.claimedByActorId)?.proof}
                        thumb={proofByActorId.get(p.claimedByActorId)?.proofThumb}
                        size={32}
                      />
                    )}
                    {isDebtor && (
                      <PaymentControl
                        status={p.paymentStatus}
                        stale={p.paymentStatus === 'confirmed' && p.confirmedNetCents !== undefined && p.confirmedNetCents !== (netByPid.get(p.id) ?? 0)}
                        onSet={(s) => handleSetPayment(p.id, s)}
                        t={t}
                      />
                    )}
                    <button
                      onClick={() => handleRemovePerson(p.id)}
                      className="btn-press p-1"
                      aria-label={t('group_split.remove_person')}
                    >
                      <Icon name="close" size={16} className="text-on-surface-faint" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex items-center gap-2 pt-1">
            <input
              ref={newPersonRef}
              value={newPerson}
              onChange={(e) => setNewPerson(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddPerson()}
              placeholder={t('group_split.add_person_ph')}
              className="bg-surface-high rounded-lg px-3 py-2 text-sm text-on-surface outline-none flex-1"
            />
            <button
              onClick={handleAddPerson}
              disabled={newPerson.trim().length === 0}
              className="btn-press px-3 py-2 rounded-lg bg-primary text-on-surface text-sm font-semibold disabled:opacity-40"
            >
              {t('common.add')}
            </button>
          </div>

          {/* C23/DEC-306: quick-add trip teammates as LINKED people so their net
              flows into the trip settle-up. Only for a trip-scoped event. */}
          {tripPeopleToAdd.length > 0 && (
            <div className="flex flex-col gap-1.5 pt-1">
              <p className="text-[11px] text-on-surface-faint">{t('group_split.add_from_trip')}</p>
              <div className="flex flex-wrap gap-1.5">
                {tripPeopleToAdd.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleAddTripPerson(p.id, p.name)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-high text-on-surface-dim text-xs font-medium btn-press"
                  >
                    <Icon name="add" size={14} className="text-on-surface-faint" />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {isTripLinked && (
          <p className="text-[11px] text-on-surface-faint px-1 leading-relaxed">{t('group_split.trip_settle_note')}</p>
        )}
      </section>

      {/* Pagamentos (balances) + Quem paga quem (transfers) behind buttons
          (A04/DEC-335) — only meaningful once there is money in. */}
      {event.expenses.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => setOpenPanel((p) => (p === 'balances' ? 'none' : 'balances'))}
              aria-expanded={openPanel === 'balances'}
              className="flex-1 py-2.5 px-3 rounded-xl bg-surface-container text-on-surface font-semibold text-sm btn-press flex items-center justify-center gap-1.5"
            >
              <Icon name="account_balance_wallet" size={16} className="text-on-surface-dim" />
              {t('group_split.balances_title')}
              <Icon name={openPanel === 'balances' ? 'expand_less' : 'expand_more'} size={16} className="text-on-surface-faint" />
            </button>
            {transfers.length > 0 && (
              <button
                onClick={() => setOpenPanel((p) => (p === 'transfers' ? 'none' : 'transfers'))}
                aria-expanded={openPanel === 'transfers'}
                className="flex-1 py-2.5 px-3 rounded-xl bg-surface-container text-on-surface font-semibold text-sm btn-press flex items-center justify-center gap-1.5"
              >
                <Icon name="swap_horiz" size={16} className="text-on-surface-dim" />
                {t('group_split.transfers_title')}
                <Icon name={openPanel === 'transfers' ? 'expand_less' : 'expand_more'} size={16} className="text-on-surface-faint" />
              </button>
            )}
          </div>

          {openPanel === 'balances' && (
            <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-2.5">
              {balances.map((b) => {
                const settled = b.netCents < 0 && isGroupObligationClosed(b.paymentStatus);
                return (
                  <div key={b.participantId} className="flex items-center justify-between">
                    <span className="text-sm text-on-surface truncate">{b.name}</span>
                    <span
                      className={`text-sm font-semibold tabular ${
                        settled ? 'text-success'
                          : b.netCents > 0 ? 'text-success'
                          : b.netCents < 0 ? 'text-on-surface'
                          : 'text-on-surface-faint'
                      }`}
                    >
                      {settled
                        ? t('group_split.pay_status_confirmed')
                        : b.netCents > 0
                          ? t('group_split.gets_back', { amount: formatMoney(b.netCents, event.currency) })
                          : b.netCents < 0
                            ? t('group_split.owes', { amount: formatMoney(-b.netCents, event.currency) })
                            : t('group_split.even')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {openPanel === 'transfers' && settlement && settlement.lines.length > 0 && (
            <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-3">
              {/* F22 — who already paid vs who is still pending. */}
              <p className="text-[11px] font-semibold text-on-surface-dim">
                {t('group_split.settled_count', { settled: settlement.settledCount, total: settlement.lines.length })}
              </p>
              {settlement.lines.map((line, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-on-surface">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-medium truncate">{line.fromName}</span>
                    <Icon name="arrow_forward" size={14} className="text-on-surface-faint shrink-0" />
                    <span className="font-medium truncate">{line.toName}</span>
                  </div>
                  <div className="ml-auto flex items-center gap-2 shrink-0">
                    <PaymentTone status={line.status} t={t} />
                    <span className="font-bold tabular">{formatMoney(line.amountCents, event.currency)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* F23 / DEC-354 — movement history (display-only). Behind a toggle so it
          never competes with the money; respects F01 exclusivity (one panel). */}
      {timeline.length > 0 && (
        <section className="flex flex-col gap-2">
          <button
            onClick={() => setOpenPanel((p) => (p === 'history' ? 'none' : 'history'))}
            aria-expanded={openPanel === 'history'}
            className="py-2.5 px-3 rounded-xl bg-surface-container text-on-surface font-semibold text-sm btn-press flex items-center justify-center gap-1.5"
          >
            <Icon name="history" size={16} className="text-on-surface-dim" />
            {t('group_split.history_title')}
            <Icon name={openPanel === 'history' ? 'expand_less' : 'expand_more'} size={16} className="text-on-surface-faint" />
          </button>
          {openPanel === 'history' && (
            <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-3">
              {(historyExpanded ? timeline : timeline.slice(0, 8)).map((entry) => {
                const isOverride = entry.kind === 'payment_override';
                return (
                  <div key={entry.id} className="flex items-start gap-2.5">
                    <Icon
                      name={activityIcon(entry.kind)}
                      size={16}
                      className={`shrink-0 mt-0.5 ${isOverride ? 'text-warning' : 'text-on-surface-faint'}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-on-surface leading-snug">{activityText(entry, t, event.currency)}</p>
                      {/* DEC-363 (Item D) — a mark-paid that carried a receipt shows it
                          inline in the history (the durable proof of the event). */}
                      {(entry.proofThumb || entry.proof) && (
                        <div className="mt-1">
                          <ProofThumb proof={entry.proof} thumb={entry.proofThumb} size={40} />
                        </div>
                      )}
                      {/* G_last (DEC-354): an organizer override is a moderation action —
                          flag it + show what state it overrode, so the trail is auditable. */}
                      {isOverride && (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-warning">
                          <Icon name="gavel" size={11} className="text-warning" />
                          {t('group_split.override_badge')}
                          {entry.detail && ` · ${overridePrevLabel(entry.detail, t)}`}
                        </p>
                      )}
                      <p className="text-[10px] text-on-surface-faint">{formatActivityTime(entry.ts)}</p>
                    </div>
                  </div>
                );
              })}
              {!historyExpanded && timeline.length > 8 && (
                <button
                  onClick={() => setHistoryExpanded(true)}
                  className="text-xs font-semibold text-primary btn-press self-start"
                >
                  {t('group_split.history_see_all', { count: timeline.length })}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* Lifecycle actions */}
      <div className="flex flex-col gap-2 pt-2">
        {event.expenses.length > 0 && (
          <button
            onClick={handleToggleSettled}
            className="py-2.5 rounded-xl bg-surface-high text-on-surface font-semibold btn-press"
          >
            {event.status === 'settled' ? t('group_split.reopen') : t('group_split.mark_settled')}
          </button>
        )}
        <button
          onClick={handleDeleteEvent}
          className="py-2.5 rounded-xl text-on-surface-faint text-sm btn-press"
        >
          {t('group_split.delete')}
        </button>
      </div>

      {editing !== null && (
        <GroupExpenseEditor
          event={event}
          expense={editing === 'new' ? null : editing}
          photoEnabled={photoEnabled}
          aiTextEnabled={aiTextEnabled}
          onClose={() => setEditing(null)}
          onSave={handleSaveExpense}
          onDelete={handleDeleteExpense}
        />
      )}

      {lightboxUrl && <ImageLightbox url={lightboxUrl} onClose={closeLightbox} />}

      <BottomSheet
        open={!!incomePrompt}
        onClose={() => { setIncomePrompt(null); setIncomePoolId(null); }}
        title={t('group_split.income_prompt_title')}
      >
        {incomePrompt && (
          <div className="flex flex-col gap-4 pb-2">
            <p className="text-sm text-on-surface-dim">
              {t('group_split.income_prompt_body', {
                name: incomePrompt.participantName,
                amount: formatMoney(incomePrompt.amountCents, event.currency),
              })}
            </p>

            {incomePools.length > 0 && (
              <div>
                <label className="text-xs text-on-surface-faint mb-2 block">
                  {t('group_split.income_prompt_fund')}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {incomePools.map((pool) => (
                    <button
                      key={pool.id}
                      onClick={() => setIncomePoolId(pool.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                        (incomePoolId ?? incomePools[0]?.id) === pool.id
                          ? 'bg-primary text-on-surface'
                          : 'bg-surface-high text-on-surface-dim'
                      }`}
                    >
                      {pool.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setIncomePrompt(null); setIncomePoolId(null); }}
                className="flex-1 py-3 rounded-xl bg-surface-high text-on-surface-dim font-medium btn-press"
              >
                {t('group_split.income_prompt_skip')}
              </button>
              <button
                onClick={handleSaveIncome}
                disabled={incomeSaving || incomePools.length === 0}
                className="flex-1 py-3 rounded-xl bg-primary text-on-surface font-medium btn-press disabled:opacity-40"
              >
                {incomeSaving ? t('common.loading') : t('group_split.income_prompt_save')}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

/**
 * DEC-353 — the owner's settle control for one debtor. The RECEIVER confirms a
 * self-reported "paguei" (`marked → confirmed`) or can **contestar** it; the owner
 * can also mark a cash/in-person settle directly. `marked` is shown neutral
 * (warning, never red) — the payer is never penalised while awaiting. Â9: every
 * state is revertible. Worded, never colour-only.
 */
function PaymentControl({
  status,
  stale,
  onSet,
  t,
}: {
  status: GroupPaymentStatus;
  stale?: boolean;
  onSet: (status: GroupPaymentStatus) => void;
  t: (key: string) => string;
}) {
  if (status === 'confirmed') {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => onSet('unpaid')}
          className="flex items-center gap-1 text-[11px] font-semibold text-success px-2 py-1 rounded-lg bg-success/15 btn-press"
        >
          <Icon name="check_circle" size={14} className="text-success" />
          {t('group_split.received')}
        </button>
        {stale && (
          <span
            className="text-[10px] font-semibold text-warning px-1.5 py-0.5 rounded bg-warning/15"
            title={t('group_split.stale_confirmation')}
          >
            <Icon name="warning" size={12} className="text-warning inline -mt-0.5 mr-0.5" />
            {t('group_split.balance_changed')}
          </span>
        )}
      </div>
    );
  }
  if (status === 'marked') {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => onSet('confirmed')}
          className="text-[11px] font-semibold text-warning px-2 py-1 rounded-lg bg-warning/15 btn-press"
        >
          {t('group_split.confirm_receipt')}
        </button>
        <button
          onClick={() => onSet('contested')}
          className="text-[11px] font-medium text-on-surface-faint px-1.5 py-1 btn-press"
        >
          {t('group_split.contest')}
        </button>
      </div>
    );
  }
  if (status === 'contested') {
    return (
      <button
        onClick={() => onSet('confirmed')}
        className="flex items-center gap-1 text-[11px] font-semibold text-error px-2 py-1 rounded-lg bg-error/15 btn-press"
      >
        <Icon name="report" size={14} className="text-error" />
        {t('group_split.pay_status_contested')}
      </button>
    );
  }
  // unpaid / cancelled — owner marks a cash/in-person settle directly.
  return (
    <button
      onClick={() => onSet('confirmed')}
      className="text-[11px] font-medium text-on-surface-dim px-2 py-1 rounded-lg bg-surface-high btn-press"
    >
      {t('group_split.mark_received')}
    </button>
  );
}

/** A small status pill (F22 who-paid): the lifecycle state in its fairness tone. */
function PaymentTone({ status, t }: { status: GroupPaymentStatus; t: (key: string) => string }) {
  const tone = groupPaymentTone(status);
  const cls =
    tone === 'positive'
      ? 'text-success bg-success/15'
      : tone === 'danger'
        ? 'text-error bg-error/15'
        : tone === 'neutral'
          ? 'text-warning bg-warning/15'
          : 'text-on-surface-faint bg-surface-high';
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg ${cls}`}>
      {t(groupPaymentStatusLabelKey(status))}
    </span>
  );
}
