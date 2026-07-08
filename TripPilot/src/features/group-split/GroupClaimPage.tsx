import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useLocation } from 'react-router';
import { parseShareKeyFromHash } from '@/domain/sync';
import {
  buildGroupClaimResponse,
  computeGroupBalances,
  computeGroupTransfers,
  foldEventForViewer,
  groupExpenseImages,
  type GroupClaimExpense,
  type GroupClaimResponse,
  type GroupPaymentStatus,
  type GroupSharePayload,
  type GroupSplitEvent,
} from '@/domain/group-split';
import { connectShareSignal, type ShareSignalHandle } from '@/data/sync/share-signal';
import { formatMoney, toCents } from '@/domain/money';
import { PAYMENT_METHOD_ICONS, resolvePaymentLabel, type PaymentMethod } from '@/domain/payment';
import { getShareOrigin } from '@/utils/native/public-origin';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { showToast } from '@/components/Toast';
import type { ImageRef } from '@/domain/media';
import { GroupImage, ImageLightbox } from './GroupImage';
import {
  fetchGroupSplit,
  fetchGroupResponses,
  postGroupClaim,
  loadGuestExpenses,
  saveGuestExpenses,
  newGuestExpenseId,
  type FetchGroupStatus,
} from './group-link';
import { getGuestActorId, getGuestName, setGuestName } from '@/features/split/live-link';
import { ProofAttachField, ProofThumb, type AttachedProof } from '@/features/payment-proof/PaymentProof';
import { useAppData } from '@/hooks/useAppData';
import { createExpenseTransaction } from '@/domain/transactions';
import { resolveActivePhase } from '@/domain/dates';
import { getAvailablePoolsForPhase } from '@/domain/budget';
import { transactionRepository } from '@/data/repositories';

const POLL_FLOOR_MS = 6000;
const POST_DEBOUNCE_MS = 500;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; status: FetchGroupStatus }
  | { kind: 'live'; payload: GroupSharePayload };

/**
 * C23 / DEC-297 — the guest claim board (`/g/:id`). Lives OUTSIDE BootGate
 * so a guest with no trip is never bounced to onboarding. The guest picks which
 * name is them, sees what they owe (or get back) and the exact transfer, and can
 * mark their debt paid; the owner's device stays the single source of truth and
 * confirms receipt. The guest's pick + paid flag are encrypted and posted to the
 * owner; the owner's edits/confirmations flow back here via the poll floor.
 * The AES key comes from the `#k=` fragment (legacy links) or, since DEC-455,
 * from the worker's escrow resolved by the first statement fetch (short links).
 */
export function GroupClaimPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const location = useLocation();

  const id = params.id ?? null;
  const key = useMemo(() => parseShareKeyFromHash(location.hash), [location.hash]);
  const actorId = useMemo(() => getGuestActorId(), []);
  // DEC-455 — key resolved from the worker escrow (fragment-less short links).
  const resolvedKeyRef = useRef<string | null>(null);

  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [claimedId, setClaimedId] = useState<string | null>(null);
  const [markedPaid, setMarkedPaid] = useState(false);
  // DEC-363 (Item D) — an OPTIONAL proof the guest attaches with their mark-paid;
  // it rides the claim response and the owner folds it onto the timeline.
  const [proof, setProof] = useState<AttachedProof | null>(null);
  // DEC-340 — the guest's own authored expenses (a snapshot the owner folds).
  const [myExpenses, setMyExpenses] = useState<GroupClaimExpense[]>([]);
  // G3 / DEC-349 — every device's claim snapshot, folded locally so the board is
  // LIVE for everyone (a guest's add/remove shows without the owner opening the app).
  const [responses, setResponses] = useState<GroupClaimResponse[]>([]);
  const seededRef = useRef(false);
  const hasPayloadRef = useRef(false);
  const signalRef = useRef<ShareSignalHandle | null>(null);

  const { trip, pools, links, phases, reload: reloadApp } = useAppData();
  const activePhase = useMemo(() => resolveActivePhase(phases), [phases]);
  const expensePools = useMemo(() => {
    if (!activePhase) return [];
    const avail = getAvailablePoolsForPhase(pools, links, activePhase.id);
    return [...avail.operational, ...avail.global, ...avail.otherPhases];
  }, [activePhase, pools, links]);

  const [expensePrompt, setExpensePrompt] = useState<{
    ownerName: string;
    amountCents: number;
  } | null>(null);
  const [expensePoolId, setExpensePoolId] = useState<string | null>(null);
  const [expenseSaving, setExpenseSaving] = useState(false);

  const refetch = useCallback(async () => {
    if (!id) {
      setLoad({ kind: 'error', status: 'bad_key' });
      return;
    }
    const res = await fetchGroupSplit(id, key ?? resolvedKeyRef.current);
    if (res.status === 'ok') {
      resolvedKeyRef.current = res.key;
      // Seed my pick + paid flag from the owner's view of my slot (my last posted
      // state), so a returning guest keeps their choice. Also rehydrate my own
      // authored-expense draft (DEC-340) so a reload keeps my pending additions.
      if (!seededRef.current) {
        const mine = res.payload.event.participants.find((p) => p.claimedByActorId === actorId);
        if (mine) {
          setClaimedId(mine.id);
          setMarkedPaid(mine.paymentStatus !== 'unpaid');
        }
        setMyExpenses(loadGuestExpenses(id));
        seededRef.current = true;
      }
      // Honest sync state: drop any of my drafts the owner has tombstoned (deleted),
      // so a removed expense never lingers as a ghost "pending" on my board.
      const hidden = res.payload.event.hiddenExpenseIds ?? [];
      if (hidden.length > 0) {
        setMyExpenses((prev) => {
          const next = prev.filter((e) => !hidden.includes(e.id));
          if (next.length !== prev.length) saveGuestExpenses(id, next);
          return next;
        });
      }
      // G3 / DEC-349 — pull every device's claim snapshot so we fold the live board
      // locally (F10/F11). The link key already decrypts all /responses. Best-effort:
      // a failed pull keeps the prior folded view instead of dropping to the bare base.
      try {
        setResponses(await fetchGroupResponses(id, res.key));
      } catch {
        /* keep prior responses */
      }
      // Keep the local `markedPaid` in sync with owner-driven transitions
      // that override the guest's optimistic mark (contested, cancelled, unpaid).
      if (seededRef.current) {
        const mine = res.payload.event.participants.find((p) => p.claimedByActorId === actorId);
        if (mine && (mine.paymentStatus === 'contested' || mine.paymentStatus === 'cancelled' || mine.paymentStatus === 'unpaid')) {
          setMarkedPaid(false);
        }
      }
      hasPayloadRef.current = true;
      setLoad({ kind: 'live', payload: res.payload });
      return;
    }
    if (res.status === 'error' && hasPayloadRef.current) return;
    setLoad({ kind: 'error', status: res.status });
  }, [id, key, actorId]);

  useEffect(() => {
    setLoad({ kind: 'loading' });
    hasPayloadRef.current = false;
    seededRef.current = false;
    resolvedKeyRef.current = null;
    void refetch();
  }, [refetch]);

  const isLive = load.kind === 'live';

  // Live channel + poll floor so the owner's confirmations show here promptly.
  useEffect(() => {
    if (!id || !isLive) return;
    const handle = connectShareSignal(id, () => void refetch());
    signalRef.current = handle;
    const interval = setInterval(() => void refetch(), POLL_FLOOR_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refetch();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      handle.close();
      if (signalRef.current === handle) signalRef.current = null;
    };
  }, [id, isLive, refetch]);

  // Post my claim snapshot (debounced) once I have picked a name. The snapshot
  // carries my paid flag AND my authored expenses (DEC-340) — the owner folds the
  // latest one add-or-retract, so this is the single channel for everything I post.
  useEffect(() => {
    if (!isLive || !id || !claimedId) return;
    const timer = setTimeout(() => {
      // isLive guarantees a successful fetch already resolved the key (DEC-455).
      const postKey = key ?? resolvedKeyRef.current;
      if (!postKey) return;
      const response = buildGroupClaimResponse({
        fromActorId: actorId,
        fromName: getGuestName() ?? '',
        claimedParticipantId: claimedId,
        markedPaid,
        expenses: myExpenses,
        proof: proof?.proof ?? null,
        proofThumb: proof?.thumb ?? null,
      });
      void postGroupClaim(id, postKey, response)
        .then(() => signalRef.current?.send({ t: 'resp' }))
        .catch(() => {});
    }, POST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [claimedId, markedPaid, myExpenses, proof, isLive, id, key, actorId]);

  if (load.kind === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-base">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (load.kind === 'error') {
    const msg =
      load.status === 'revoked'
        ? t('group_claim.revoked')
        : load.status === 'not_found'
          ? t('group_claim.not_found')
          : load.status === 'bad_key'
            ? t('group_claim.bad_key')
            : t('group_claim.error');
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-surface-base px-8 text-center gap-3">
        <Icon name="link_off" size={32} className="text-on-surface-faint" />
        <p className="text-sm text-on-surface-dim leading-relaxed">{msg}</p>
      </div>
    );
  }

  const addExpense = (draft: { description: string; amountCents: number; paidByParticipantId: string }) => {
    if (!id || !claimedId) return;
    const participantIds = load.payload.event.participants.map((p) => p.id);
    const expense: GroupClaimExpense = {
      id: newGuestExpenseId(actorId),
      description: draft.description.trim(),
      amountCents: draft.amountCents,
      paidByParticipantId: draft.paidByParticipantId,
      splitMode: 'equal',
      participantIds,
      occurredAt: new Date().toISOString().slice(0, 10),
    };
    setMyExpenses((prev) => {
      const next = [...prev, expense];
      saveGuestExpenses(id, next);
      return next;
    });
  };

  const removeExpense = (expenseId: string) => {
    if (!id) return;
    setMyExpenses((prev) => {
      const next = prev.filter((e) => e.id !== expenseId);
      saveGuestExpenses(id, next);
      return next;
    });
  };

  // G3 / DEC-349 — the live read-fold: project the owner-published base through
  // every pulled snapshot so the board (total, balances, expenses) is live for
  // every viewer. The owner stays the money authority — the base's tombstones +
  // confirmed slots still win inside the fold.
  const liveEvent = foldEventForViewer(load.payload.event, responses);

  const handleTogglePaid = () => {
    setMarkedPaid((v) => {
      if (v) {
        setProof(null);
        return false;
      }
      if (trip && claimedId) {
        const balances = computeGroupBalances(liveEvent);
        const myBal = balances.find((b) => b.participantId === claimedId);
        if (myBal && myBal.netCents < 0) {
          const transfers = computeGroupTransfers(liveEvent);
          const myTransfers = transfers.filter((tr) => tr.fromParticipantId === claimedId);
          const totalOwed = myTransfers.reduce((s, tr) => s + tr.amountCents, 0);
          const ownerName = liveEvent.participants.find(
            (p) => p.id === liveEvent.ownerParticipantId,
          )?.name ?? liveEvent.name;
          if (totalOwed > 0) {
            setExpensePrompt({ ownerName, amountCents: totalOwed });
          }
        }
      }
      return true;
    });
  };

  const handleSaveExpense = async () => {
    if (!expensePrompt || !trip || !activePhase || expenseSaving) return;
    const targetPoolId = expensePoolId ?? expensePools[0]?.id;
    if (!targetPoolId) return;
    setExpenseSaving(true);
    try {
      const tx = createExpenseTransaction({
        tripId: trip.id,
        phaseId: activePhase.id,
        budgetPoolId: targetPoolId,
        walletId: null,
        amountCents: expensePrompt.amountCents,
        currency: liveEvent.currency,
        description: t('group_claim.expense_from_payment', { name: liveEvent.name }),
        category: 'other',
      });
      await transactionRepository.create(tx);
      showToast(
        t('expenses.edited_toast'),
        'success',
      );
      setExpensePrompt(null);
      setExpensePoolId(null);
      await reloadApp();
    } finally {
      setExpenseSaving(false);
    }
  };

  return (
    <>
      <ClaimBoard
        event={liveEvent}
        actorId={actorId}
        claimedId={claimedId}
        markedPaid={markedPaid}
        myExpenses={myExpenses}
        proof={proof}
        onChangeProof={setProof}
        onPick={(pid) => {
          setClaimedId(pid);
          setMarkedPaid(false);
          setProof(null);
        }}
        onChangeName={() => {
          setClaimedId(null);
          setProof(null);
        }}
        onTogglePaid={handleTogglePaid}
        onSaveName={(name) => setGuestName(name)}
        onAddExpense={addExpense}
        onRemoveExpense={removeExpense}
      />

      <BottomSheet
        open={expensePrompt !== null}
        onClose={() => { setExpensePrompt(null); setExpensePoolId(null); }}
        title={t('group_claim.expense_prompt_title')}
      >
        {expensePrompt && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-on-surface-dim">
              {t('group_claim.expense_prompt_body', {
                amount: formatMoney(expensePrompt.amountCents, liveEvent.currency),
                name: expensePrompt.ownerName,
              })}
            </p>

            {expensePools.length > 0 && (
              <div>
                <label className="text-xs text-on-surface-faint mb-2 block">
                  {t('group_claim.expense_prompt_fund')}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {expensePools.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setExpensePoolId(p.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                        (expensePoolId ?? expensePools[0]?.id) === p.id
                          ? 'bg-primary text-on-surface'
                          : 'bg-surface-high text-on-surface-dim'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setExpensePrompt(null); setExpensePoolId(null); }}
                className="flex-1 py-3 rounded-xl bg-surface-high text-on-surface-dim font-medium btn-press"
              >
                {t('group_claim.expense_prompt_skip')}
              </button>
              <button
                onClick={handleSaveExpense}
                disabled={expenseSaving || expensePools.length === 0}
                className="flex-1 py-3 rounded-xl bg-primary text-on-surface font-medium btn-press disabled:opacity-40"
              >
                {expenseSaving ? t('common.loading') : t('group_claim.expense_prompt_save')}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </>
  );
}

interface ClaimBoardProps {
  event: GroupSplitEvent;
  actorId: string;
  claimedId: string | null;
  markedPaid: boolean;
  myExpenses: GroupClaimExpense[];
  proof: AttachedProof | null;
  onChangeProof: (next: AttachedProof | null) => void;
  onPick: (participantId: string) => void;
  onChangeName: () => void;
  onTogglePaid: () => void;
  onSaveName: (name: string) => void;
  onAddExpense: (draft: { description: string; amountCents: number; paidByParticipantId: string }) => void;
  onRemoveExpense: (expenseId: string) => void;
}

function ClaimBoard({
  event,
  actorId,
  claimedId,
  markedPaid,
  myExpenses,
  proof,
  onChangeProof,
  onPick,
  onChangeName,
  onTogglePaid,
  onSaveName,
  onAddExpense,
  onRemoveExpense,
}: ClaimBoardProps) {
  const { t } = useTranslation();
  const balances = useMemo(() => computeGroupBalances(event), [event]);
  const transfers = useMemo(() => computeGroupTransfers(event), [event]);
  const total = useMemo(() => balances.reduce((s, b) => s + b.paidCents, 0), [balances]);
  const nameById = new Map(event.participants.map((p) => [p.id, p.name]));
  // DEC-342/343 — lightbox for a decrypted receipt photo (already-fetched blob URL).
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const claimed = event.participants.find((p) => p.id === claimedId) ?? null;
  const myBalance = balances.find((b) => b.participantId === claimedId) ?? null;
  const myTransfers = transfers.filter(
    (tr) => tr.fromParticipantId === claimedId || tr.toParticipantId === claimedId,
  );

  // The owner's truth trumps the local optimistic flag for terminal states.
  const serverStatus = claimed?.paymentStatus ?? 'unpaid';
  const myStatus: GroupPaymentStatus =
    serverStatus === 'confirmed'
      ? 'confirmed'
      : serverStatus === 'contested'
        ? 'contested'
        : serverStatus === 'cancelled'
          ? 'cancelled'
          : markedPaid
            ? 'marked'
            : serverStatus;

  const iOwe = (myBalance?.netCents ?? 0) < 0;

  // DEC-340 — merge the owner's ledger with my own draft:
  //  • folded = the live expenses, minus my own ones I just retracted locally
  //    (hidden optimistically until the owner's retract round-trips);
  //  • pending = my drafts the owner hasn't folded yet (shown "pending").
  const myDraftIds = new Set(myExpenses.map((e) => e.id));
  const folded = event.expenses.filter(
    (e) => !(e.authoredByActorId === actorId && !myDraftIds.has(e.id)),
  );
  const foldedIds = new Set(event.expenses.map((e) => e.id));
  const pending = myExpenses.filter((e) => !foldedIds.has(e.id));

  return (
    <div className="min-h-screen bg-surface-base px-5 py-8 flex flex-col gap-5 max-w-md mx-auto">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-on-surface-faint">
          <Icon name="group" size={16} className="text-on-surface-faint" />
          <span className="text-[11px] font-semibold uppercase tracking-wide">{t('group_claim.kicker')}</span>
        </div>
        <h1 className="text-heading font-bold text-on-surface">{event.name}</h1>
      </header>

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

      {claimed === null ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-on-surface px-1">{t('group_claim.who_are_you')}</h2>
          <div className="bg-surface-container rounded-xl p-2 flex flex-col gap-1">
            {event.participants.map((p) => {
              const isOwner = p.id === event.ownerParticipantId;
              const takenByOther = p.claimedByActorId !== null;
              return (
                <button
                  key={p.id}
                  disabled={isOwner}
                  onClick={() => onPick(p.id)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left btn-press disabled:opacity-40 hover:bg-surface-high"
                >
                  <div className="w-8 h-8 rounded-full bg-surface-high flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-on-surface-dim">{p.name.slice(0, 1).toUpperCase()}</span>
                  </div>
                  <span className="text-sm text-on-surface flex-1 truncate">{p.name}</span>
                  {isOwner ? (
                    <span className="text-[10px] text-on-surface-faint">{t('group_claim.organizer_tag')}</span>
                  ) : takenByOther ? (
                    <span className="text-[10px] text-on-surface-faint">{t('group_claim.taken')}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-on-surface-faint px-1 leading-relaxed">{t('group_claim.pick_hint')}</p>
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-sm text-on-surface-dim">
                {t('group_claim.you_are', { name: claimed.name })}
              </span>
              <button onClick={onChangeName} className="text-[11px] text-primary font-semibold btn-press">
                {t('group_claim.change')}
              </button>
            </div>

            <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-1">
              {myBalance && myBalance.netCents < 0 ? (
                <p className="text-base font-bold text-on-surface">
                  {t('group_split.owes', { amount: formatMoney(-myBalance.netCents, event.currency) })}
                </p>
              ) : myBalance && myBalance.netCents > 0 ? (
                <p className="text-base font-bold text-success">
                  {t('group_split.gets_back', { amount: formatMoney(myBalance.netCents, event.currency) })}
                </p>
              ) : (
                <p className="text-base font-bold text-on-surface-dim">{t('group_split.even')}</p>
              )}
              {myBalance && (
                <p className="text-[11px] text-on-surface-faint">
                  {t('group_claim.paid_share', {
                    paid: formatMoney(myBalance.paidCents, event.currency),
                    share: formatMoney(myBalance.shareCents, event.currency),
                  })}
                </p>
              )}
            </div>

            {myTransfers.length > 0 && (
              <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-3">
                {myTransfers.map((tr, i) => {
                  const iAmPayer = tr.fromParticipantId === claimedId;
                  // DEC-433 — when I owe this person, show how to pay them + copy the
                  // key, straight from the methods they published on the board.
                  const creditor = iAmPayer
                    ? event.participants.find((p) => p.id === tr.toParticipantId)
                    : undefined;
                  const payMethods = creditor?.paymentMethods ?? [];
                  return (
                    <div key={i} className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-sm text-on-surface">
                        <Icon
                          name={iAmPayer ? 'arrow_upward' : 'arrow_downward'}
                          size={16}
                          className={iAmPayer ? 'text-on-surface-faint shrink-0' : 'text-success shrink-0'}
                        />
                        <span className="truncate">
                          {iAmPayer
                            ? t('group_claim.pay_to', { name: nameById.get(tr.toParticipantId) ?? '?' })
                            : t('group_claim.receive_from', { name: nameById.get(tr.fromParticipantId) ?? '?' })}
                        </span>
                        <span className="ml-auto font-bold tabular shrink-0">
                          {formatMoney(tr.amountCents, event.currency)}
                        </span>
                      </div>
                      {iAmPayer && payMethods.length > 0 && (
                        <PayInstructions name={creditor?.name ?? ''} methods={payMethods} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Mark-as-paid lifecycle — only meaningful when I owe money. */}
            {iOwe && (
              <div className="flex flex-col gap-1.5">
                {myStatus === 'confirmed' ? (
                  <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-success/15 text-success font-semibold">
                    <Icon name="check_circle" size={18} className="text-success" />
                    {t('group_claim.confirmed')}
                  </div>
                ) : myStatus === 'contested' ? (
                  <>
                    <div className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-error/15 text-error font-semibold text-sm text-center">
                      <Icon name="report" size={18} className="text-error shrink-0" />
                      <span className="break-words">{t('group_claim.contested')}</span>
                    </div>
                    <ProofAttachField value={proof} onChange={onChangeProof} />
                    <button
                      onClick={onTogglePaid}
                      className="py-3 rounded-xl bg-primary text-on-surface font-semibold btn-press"
                    >
                      {t('group_claim.remark_paid')}
                    </button>
                  </>
                ) : myStatus === 'marked' ? (
                  <>
                    <div className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-surface-high text-on-surface font-semibold text-sm text-center">
                      <Icon name="schedule" size={18} className="text-on-surface-dim shrink-0" />
                      <span className="break-words">{t('group_claim.awaiting')}</span>
                    </div>
                    {proof && (
                      <div className="flex items-center gap-2">
                        <ProofThumb proof={proof.proof} thumb={proof.thumb} size={40} />
                        <span className="text-[11px] text-on-surface-faint">{t('payment_proof.label')}</span>
                      </div>
                    )}
                    <button onClick={onTogglePaid} className="text-[11px] text-on-surface-faint btn-press py-1">
                      {t('group_claim.undo_paid')}
                    </button>
                  </>
                ) : (
                  <>
                    {/* DEC-363 (Item D) — optionally back the mark-paid with a receipt. */}
                    <ProofAttachField value={proof} onChange={onChangeProof} />
                    <button
                      onClick={onTogglePaid}
                      className="py-3 rounded-xl bg-primary text-on-surface font-semibold btn-press"
                    >
                      {t('group_claim.mark_paid')}
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {/* Expenses — the owner's ledger plus my own pending drafts (DEC-340). */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-on-surface px-1">{t('group_split.expenses_title')}</h2>
        {folded.length === 0 && pending.length === 0 ? (
          <div className="bg-surface-container rounded-xl p-5 text-center">
            <p className="text-sm text-on-surface-dim">{t('group_split.no_expenses')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {folded.map((exp) => {
              // F04 — show the registrant on the board too, when it differs from
              // the payer (e.g. a guest-authored expense someone else paid).
              const reg = exp.createdByParticipantId;
              const registeredByName = reg && reg !== exp.paidByParticipantId ? nameById.get(reg) : undefined;
              return (
                <ClaimExpenseRow
                  key={exp.id}
                  description={exp.description}
                  paidByName={nameById.get(exp.paidByParticipantId) ?? '?'}
                  registeredByName={registeredByName}
                  amountCents={exp.amountCents}
                  currency={event.currency}
                  items={exp.items}
                  imageRefs={groupExpenseImages(exp)}
                  onOpenImage={setLightboxUrl}
                  mine={exp.authoredByActorId === actorId}
                  onRemove={exp.authoredByActorId === actorId ? () => onRemoveExpense(exp.id) : undefined}
                />
              );
            })}
            {pending.map((exp) => (
              <ClaimExpenseRow
                key={exp.id}
                description={exp.description}
                paidByName={nameById.get(exp.paidByParticipantId) ?? '?'}
                amountCents={exp.amountCents}
                currency={event.currency}
                items={exp.items}
                mine
                pending
                onRemove={() => onRemoveExpense(exp.id)}
              />
            ))}
          </div>
        )}

        {/* Everyone contributes — a guest with no app can author an expense; it
            folds into everyone's view once the owner syncs (shown pending here). */}
        {claimed !== null && (
          <AddExpenseInline
            event={event}
            defaultPayerId={claimed.id}
            onAdd={onAddExpense}
          />
        )}
      </section>

      <GetAppCta />

      <footer className="text-center pt-2">
        <span className="text-[11px] text-on-surface-faint">{t('group_claim.made_with')}</span>
      </footer>
      <HiddenNameSync claimedName={claimed?.name ?? null} onSaveName={onSaveName} />
      {/* The blob URL is owned + revoked by the GroupImage that produced it, so the
          lightbox only clears its reference on close (no double-revoke). */}
      {lightboxUrl && <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  );
}

/** One expense row on the guest board: read-only for others, removable + item-aware
 *  for mine, with a "pending" hint while the owner hasn't folded it yet (DEC-340). */
function ClaimExpenseRow({
  description,
  paidByName,
  registeredByName,
  amountCents,
  currency,
  items,
  imageRefs,
  onOpenImage,
  mine,
  pending,
  onRemove,
}: {
  description: string;
  paidByName: string;
  registeredByName?: string;
  amountCents: number;
  currency: string;
  items?: { id: string; description: string; amountCents: number; qty: number }[];
  imageRefs?: ImageRef[];
  onOpenImage?: (url: string) => void;
  mine?: boolean;
  pending?: boolean;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  const [showItems, setShowItems] = useState(false);
  const hasItems = !!items && items.length > 0;
  return (
    <div className={`bg-surface-container rounded-xl p-3.5 flex flex-col gap-2 ${pending ? 'opacity-80' : ''}`}>
      <div className="flex items-center gap-3">
        {imageRefs && imageRefs.length > 0 && (
          <div className="flex gap-1 shrink-0">
            {imageRefs.map((ref) => (
              <GroupImage
                key={ref.r2Id}
                imageRef={ref}
                alt={description}
                className="w-11 h-11 rounded-lg shrink-0"
                onOpen={onOpenImage}
              />
            ))}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-on-surface truncate">{description}</p>
            {mine && (
              <span className="text-[9px] font-bold uppercase tracking-wide text-primary bg-primary/15 rounded px-1 py-0.5 shrink-0">
                {t('group_claim.your_tag')}
              </span>
            )}
          </div>
          <p className="text-[11px] text-on-surface-faint truncate">
            {t('group_split.paid_by', { name: paidByName })}
            {hasItems && (
              <button onClick={() => setShowItems((v) => !v)} className="ml-1.5 text-primary font-semibold btn-press">
                · {items!.length} {t('group_split.items_title').toLowerCase()}
              </button>
            )}
          </p>
          {registeredByName && (
            <p className="text-[11px] text-on-surface-faint truncate">
              {t('group_split.registered_by', { name: registeredByName })}
            </p>
          )}
          {pending && <p className="text-[10px] text-warning mt-0.5">{t('group_claim.pending')}</p>}
        </div>
        <span className="text-sm font-bold tabular text-on-surface shrink-0">
          {formatMoney(amountCents, currency)}
        </span>
        {onRemove && (
          <button
            onClick={onRemove}
            aria-label={t('group_claim.remove')}
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-on-surface-faint hover:text-error hover:bg-error/10 btn-press"
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>
      {hasItems && showItems && (
        <div className="flex flex-col gap-1 pl-1 border-l-2 border-on-surface/10">
          {items!.map((it) => (
            <div key={it.id} className="flex items-center justify-between text-[11px] text-on-surface-dim">
              <span className="truncate">
                {it.qty > 1 ? `${it.qty}× ` : ''}
                {it.description || t('group_split.unnamed_item')}
              </span>
              <span className="tabular shrink-0 ml-2">{formatMoney(it.amountCents, currency)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Inline add-expense form for a no-app guest (DEC-340). Description + amount +
 *  who-paid (defaults to me); the split is equal across everyone, just like the
 *  owner's quick add. Author-stamped on the owner's fold; removable until then. */
function AddExpenseInline({
  event,
  defaultPayerId,
  onAdd,
}: {
  event: GroupSplitEvent;
  defaultPayerId: string;
  onAdd: (draft: { description: string; amountCents: number; paidByParticipantId: string }) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState(defaultPayerId);
  const amountCents = toCents(parseFloat(amount) || 0);
  const canAdd = description.trim().length > 0 && amountCents > 0;

  const reset = () => {
    setDescription('');
    setAmount('');
    setPayerId(defaultPayerId);
    setOpen(false);
  };

  const submit = () => {
    if (!canAdd) return;
    onAdd({ description, amountCents, paidByParticipantId: payerId });
    reset();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-on-surface/20 text-sm font-semibold text-on-surface-dim btn-press"
      >
        <Icon name="add" size={18} className="text-primary" />
        {t('group_claim.add_expense')}
      </button>
    );
  }

  return (
    <div className="mt-1 bg-surface-container rounded-xl p-3 flex flex-col gap-2.5">
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t('group_claim.expense_desc_ph')}
        autoFocus
        className="bg-surface-high rounded-lg px-3 py-2 text-sm text-on-surface outline-none w-full"
      />
      <input
        type="number"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="0.00"
        className="bg-surface-high rounded-lg px-3 py-2 text-sm text-on-surface outline-none w-full"
      />
      <div>
        <p className="text-[11px] text-on-surface-faint mb-1.5">{t('group_claim.who_paid')}</p>
        <div className="flex flex-wrap gap-1.5">
          {event.participants.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPayerId(p.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium btn-press ${
                payerId === p.id ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-0.5">
        <button onClick={reset} className="px-3 py-2 rounded-lg bg-surface-high text-on-surface-dim text-sm font-semibold btn-press">
          {t('common.cancel')}
        </button>
        <button
          onClick={submit}
          disabled={!canAdd}
          className="flex-1 py-2 rounded-lg bg-primary text-on-surface text-sm font-semibold btn-press disabled:opacity-40"
        >
          {t('common.add')}
        </button>
      </div>
      <p className="text-[10px] text-on-surface-faint leading-relaxed">{t('group_claim.add_expense_hint')}</p>
    </div>
  );
}

/**
 * DEC-433 (Field v2) — "Como pagar {name}": the creditor's published repayment
 * methods (Pix/Wise/bank/free-text), each a tap-to-copy row so the debtor grabs the
 * key without leaving the board. Display-only; copies the raw value to the clipboard
 * with a brief "copied" confirmation. Never touches balances.
 */
function PayInstructions({ name, methods }: { name: string; methods: PaymentMethod[] }) {
  const { t } = useTranslation();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const kindLabels = {
    pix: t('payment.kind_pix'),
    wise: t('payment.kind_wise'),
    bank: t('payment.kind_bank'),
    other: t('payment.kind_other'),
  };
  const copy = async (method: PaymentMethod) => {
    try {
      await navigator.clipboard.writeText(method.value);
      setCopiedId(method.id);
      setTimeout(() => setCopiedId((c) => (c === method.id ? null : c)), 1500);
    } catch {
      /* clipboard blocked — the value is visible to copy manually */
    }
  };
  return (
    <div className="flex flex-col gap-1.5 border-t border-on-surface/10 pt-2">
      <p className="text-[11px] text-on-surface-faint">{t('group_claim.how_to_pay', { name })}</p>
      {methods.map((method) => (
        <button
          key={method.id}
          type="button"
          onClick={() => void copy(method)}
          className="flex items-center gap-2 text-left btn-press rounded-lg -mx-1 px-1 py-0.5 hover:bg-surface-high"
        >
          <Icon name={PAYMENT_METHOD_ICONS[method.kind]} size={16} className="text-primary shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-on-surface-faint leading-tight">
              {resolvePaymentLabel(method, kindLabels)}
            </span>
            <span className="block text-sm text-on-surface truncate">{method.value}</span>
          </span>
          <span className="text-[11px] font-semibold text-primary shrink-0 flex items-center gap-0.5">
            <Icon name={copiedId === method.id ? 'check' : 'content_copy'} size={13} className="text-primary" />
            {copiedId === method.id ? t('group_claim.copied_value') : t('group_claim.copy')}
          </span>
        </button>
      ))}
    </div>
  );
}

/** "Baixe o app" — a gentle nudge for the web guest to get TripPilot for their
 *  own trips. Links to the public origin (the PWA), never store-gated. */
function GetAppCta() {
  const { t } = useTranslation();
  return (
    <a
      href={getShareOrigin()}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 bg-primary/10 rounded-xl p-3.5 btn-press"
    >
      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
        <Icon name="travel_explore" size={20} className="text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-on-surface leading-tight">{t('group_claim.get_app_title')}</p>
        <p className="text-[11px] text-primary font-semibold mt-0.5">{t('group_claim.get_app_cta')} →</p>
      </div>
    </a>
  );
}

/**
 * Keep the device's guest name in step with the slot the guest picked, so a later
 * bill-split or re-open reuses the same identity. Side-effect only; renders null.
 */
function HiddenNameSync({ claimedName, onSaveName }: { claimedName: string | null; onSaveName: (n: string) => void }) {
  useEffect(() => {
    if (claimedName && claimedName.trim()) onSaveName(claimedName.trim());
  }, [claimedName, onSaveName]);
  return null;
}
