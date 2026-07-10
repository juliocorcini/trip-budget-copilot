import { useState, useEffect, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { useAppData, notifyAppDataChanged } from '@/hooks/useAppData';
import { useWalletTracking } from '@/hooks/useWalletTracking';
import { calculateOwnerPersonalCost, scaleSharesToTotal, resolvePayerExpense } from '@/domain/splitting';
import { resolvePoolPhaseId } from '@/domain/budget';
import { formatMoney, fromCents, toCents, formatAnchorHint, resolveAnchorRate, convertToBaseCents } from '@/domain/money';
import { formatDate, localDayOf, localClockTime, moveToLocalDay } from '@/domain/dates';
import {
  transactionRepository,
  participantShareRepository,
  splitRepository,
  sessionRepository,
} from '@/data/repositories';
import { SplitHistorySheet } from '@/features/split/SplitHistorySheet';
import type { SplitSession } from '@/domain/split';
import {
  softDeleteTransactionsBatch,
  restoreTransactionsBatch,
  linkExistingExpenseToPlannedPurchase,
  undoLinkExistingExpense,
} from '@/domain/orchestrators';
import {
  compatiblePlannedPurchasesForExpense,
  plannedPurchaseReservedRemainingCents,
} from '@/domain/planning/planned-purchases';
import { buildPriceHistory, type PriceHistory } from '@/domain/shopping';
import { getCategoryIcon } from '@/utils/category-icons';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { showToast } from '@/components/Toast';
import { AttachmentSection } from '@/features/attachments/AttachmentSection';
import { PlaceField } from '@/features/location/PlaceField';
import { placeToTransactionFields, resolveLocationDisplay } from '@/domain/location';
import type { Transaction } from '@/domain/types/transaction';
import type { Session } from '@/domain/types/session';
import type { PlannedPurchase } from '@/domain/types/planned-purchase';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { CurrentPlace, ShareType } from '@/domain/types/common';

// DEC-368 (G8): the Leaflet map is code-split — it only downloads when a detail
// screen with coordinates is actually opened. DEC-398 (G7): the field renders a
// non-interactive preview (no scroll trap) that taps to expand into an interactive
// full-screen map.
const ExpenseLocationMapField = lazy(() =>
  import('@/features/location/ExpenseLocationMap').then((m) => ({
    default: m.ExpenseLocationMapField,
  })),
);

const CATEGORY_KEYS = [
  'bar',
  'restaurant',
  'market',
  'transport',
  'outing',
  'entertainment',
  'health',
  'accommodation',
  'other',
] as const;

export function ExpenseDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { trip, pools, links, wallets, participants, transactions, occurrences, plannedPurchases, settings, loading, reload } =
    useAppData();
  // GATE 5 (D10): the wallet field only shows when wallet tracking is active.
  const walletTrackingActive = useWalletTracking();

  const [tx, setTx] = useState<Transaction | null>(null);
  const [txLoading, setTxLoading] = useState(true);
  const [shares, setShares] = useState<ParticipantShare[]>([]);
  // C02/DEC-302: an item always references its parent outing — the chip below
  // the amount opens the full outing detail ("parte de · [saída]").
  const [parentSession, setParentSession] = useState<Session | null>(null);
  // T1/T16: if this expense came from a committed bill split, the full readable
  // division is one row away (SplitRecord.splitMeta) — "ver a conta toda".
  const [splitSession, setSplitSession] = useState<SplitSession | null>(null);
  const [splitHistoryOpen, setSplitHistoryOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  // DEC-457: publishing the expense's `/x/` share link (photos upload here).
  const [sharing, setSharing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // D-IMP-03: link this already-recorded expense to a planned purchase, from the
  // expense side (the reverse of the picker on the Planned Purchases screen).
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);

  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('other');
  const [editPoolId, setEditPoolId] = useState<string | null>(null);
  const [editWalletId, setEditWalletId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editIsShared, setEditIsShared] = useState(false);
  const [editSplitMode, setEditSplitMode] = useState<ShareType>('equal');
  const [editSelectedParticipantIds, setEditSelectedParticipantIds] = useState<string[]>([]);
  const [editCustomAmounts, setEditCustomAmounts] = useState<Record<string, string>>({});
  const [editPaidById, setEditPaidById] = useState<string | null>(null);
  const [editOtherPaidSplit, setEditOtherPaidSplit] = useState(false);
  // D-BUG-08: the place is edited with the shared <PlaceField> (rename, use my
  // location, nearby, find online, recents) instead of a bare text input.
  const [editPlace, setEditPlace] = useState<CurrentPlace | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const found = await transactionRepository.getById(id);
      const txShares = found ? await participantShareRepository.getByTransactionId(found.id) : [];
      // The division AND the parent outing behind a committed split are both
      // keyed by the expense's session (C02 back-link + "see the whole split").
      const [splitRecord, parent] = found?.sessionId
        ? await Promise.all([
            splitRepository.getBySessionId(found.sessionId),
            sessionRepository.getById(found.sessionId),
          ])
        : [undefined, undefined];
      if (cancelled) return;
      setTx(found ?? null);
      setShares(txShares);
      setSplitSession(splitRecord?.splitMeta ?? null);
      setParentSession(parent && parent.deletedAt === null ? parent : null);
      setTxLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading || txLoading) {
    return <p className="text-on-surface-dim py-8 text-center">{t('common.loading')}</p>;
  }

  if (!trip || !tx) {
    return (
      <div className="flex flex-col gap-4 pb-4 pt-2">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
            <Icon name="arrow_back" size={24} className="text-on-surface" />
          </button>
          <h1 className="text-heading font-bold text-on-surface">{t('expenses.detail_title')}</h1>
        </div>
        <p className="text-sm text-on-surface-dim text-center py-8">{t('expenses.not_found')}</p>
      </div>
    );
  }

  const pool = pools.find((p) => p.id === tx.budgetPoolId) ?? null;
  const wallet = wallets.find((w) => w.id === tx.walletId) ?? null;
  // GATE 6 (D07): how this purchase compares to past buys of the same item
  // (matched by normalized description, compared in base currency). null when
  // there is no prior purchase to compare against.
  const priceHistory = buildPriceHistory({ current: tx, transactions });
  // D-IMP-03: a single expense is attributed to at most one planned purchase.
  // The link lives on the purchase (`linkedTransactionIds`), so we resolve both
  // the current link and the compatible (same-fund, open, not-yet-linked here)
  // candidates from the expense side. Income is never a planned-purchase buy.
  const linkedPurchase =
    tx.type === 'expense'
      ? (plannedPurchases.find((p) => p.linkedTransactionIds.includes(tx.id)) ?? null)
      : null;
  const linkCandidates = linkedPurchase
    ? []
    : compatiblePlannedPurchasesForExpense(tx, plannedPurchases);
  const participantById = new Map(participants.map((p) => [p.id, p]));
  const payer = tx.paidByParticipantId ? participantById.get(tx.paidByParticipantId) : null;
  const owner = participants.find((p) => p.isOwner) ?? null;
  // DEC-421 (G9): a spend attributed to an event (Â-ATTRIBUTION: event XOR outing)
  // points back to its event guide, the same way an outing item links to its
  // parent outing. Pure lookup — no math, no write.
  const occurrence =
    tx.occurrenceId ? (occurrences.find((o) => o.id === tx.occurrenceId) ?? null) : null;

  // DEC-128 + DEC-434: "ver na minha moeda" under the amount ("≈ R$ 124"), rate
  // from the live snapshot (manual fallback keeps a foreign-currency row working).
  const anchorHint = settings
    ? formatAnchorHint(
        tx.amountCents,
        {
          anchorCurrency: settings.anchorCurrency,
          anchorRatePer1: resolveAnchorRate({
            rates: settings.frozenRates ?? null,
            anchorCurrency: settings.anchorCurrency,
            baseCurrency: tx.currency,
            manualRatePer1: settings.anchorRatePer1,
          }),
        },
        tx.currency,
      )
    : null;

  // DEC-367/368 (G8): decide what the location shows. A PROBABLE (auto) name is
  // rendered "provavelmente {name}"; an interactive map renders when coordinates
  // exist, with an "unconfirmed" caption unless the traveler named the place.
  const locationDisplay = resolveLocationDisplay({
    latitude: tx.latitude,
    longitude: tx.longitude,
    placeLabel: tx.placeLabel,
    placeNameSource: tx.placeNameSource,
  });
  const locationRowText =
    locationDisplay.caption.kind === 'probable'
      ? t('expenses.location_probable', { name: locationDisplay.caption.name })
      : locationDisplay.caption.kind === 'named'
        ? locationDisplay.caption.name
        : null;

  const startEdit = () => {
    setEditAmount(fromCents(tx.amountCents).toFixed(2));
    setEditDescription(tx.description);
    setEditCategory(tx.category ?? 'other');
    setEditPoolId(tx.budgetPoolId);
    setEditWalletId(tx.walletId);
    setEditDate(localDayOf(tx.date));
    setEditPlace(
      tx.placeLabel
        ? { label: tx.placeLabel, lat: tx.latitude, lng: tx.longitude, placeId: tx.placeId }
        : null,
    );
    setEditIsShared(tx.isShared);
    setEditSelectedParticipantIds(shares.map((s) => s.participantId));
    setEditSplitMode('equal');
    setEditCustomAmounts({});
    setEditPaidById(tx.paidByParticipantId ?? owner?.id ?? null);
    const txOtherPaid = owner !== null && tx.paidByParticipantId !== null && tx.paidByParticipantId !== owner.id;
    setEditOtherPaidSplit(txOtherPaid && tx.isShared && shares.length > 1);
    setEditing(true);
  };

  const editToggleParticipant = (pid: string) => {
    setEditSelectedParticipantIds((prev) =>
      prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid],
    );
  };

  const editSelectPayer = (id: string) => {
    setEditPaidById(id);
    if (owner && id !== owner.id && editSelectedParticipantIds.length < 2) {
      setEditSelectedParticipantIds([owner.id, id]);
    }
  };

  const handleSaveEdit = async () => {
    const parsed = parseFloat(editAmount.replace(',', '.'));
    if (Number.isNaN(parsed) || parsed <= 0) return;
    setSaving(true);
    try {
      const newAmountCents = toCents(parsed);
      const newDate = moveToLocalDay(tx.date, editDate);
      let newPersonalCost = tx.personalCostCents;
      let newShares = shares;
      let newIsShared = tx.isShared;
      let newPaidById = tx.paidByParticipantId;

      const effectivePaidById = editPaidById ?? owner?.id ?? null;
      const editOtherPaid = owner !== null && effectivePaidById !== null && effectivePaidById !== owner.id;
      const editWantsSplit = editOtherPaid ? editOtherPaidSplit : editIsShared;

      const hasSplitCounterparty =
        editSelectedParticipantIds.length >= 2 ||
        (editSelectedParticipantIds.length === 1 && editSelectedParticipantIds[0] !== owner?.id);
      const splitActive = editWantsSplit && hasSplitCounterparty && effectivePaidById !== null;
      const payerFlowActive = owner !== null && effectivePaidById !== null && (editOtherPaid || splitActive);

      const payerChanged = effectivePaidById !== tx.paidByParticipantId;
      const splitConfigChanged =
        editIsShared !== tx.isShared ||
        editOtherPaidSplit !== (tx.isShared && shares.length > 1 && tx.paidByParticipantId !== owner?.id) ||
        payerChanged ||
        (editWantsSplit && [...editSelectedParticipantIds].sort().join() !== shares.map((s) => s.participantId).sort().join());
      const amountChanged = newAmountCents !== tx.amountCents;

      if (payerFlowActive && (splitConfigChanged || amountChanged)) {
        if (shares.length > 0) {
          await Promise.all(shares.map((s) => participantShareRepository.delete(s.id)));
        }
        const customAmountsCents = Object.fromEntries(
          Object.entries(editCustomAmounts).map(([pid, v]) => {
            const value = parseFloat(v.replace(',', '.'));
            return [pid, Number.isNaN(value) ? 0 : Math.round(value * 100)];
          }),
        );
        const resolution = resolvePayerExpense({
          transactionId: tx.id,
          amountCents: newAmountCents,
          ownerId: owner!.id,
          payerId: effectivePaidById!,
          didSplit: splitActive,
          participantIds: editSelectedParticipantIds,
          shareType: editSplitMode,
          customAmountsCents,
          connectedParticipantIds: participants
            .filter((p) => p.linkedActorId !== null)
            .map((p) => p.id),
        });
        newShares = resolution.shares;
        newPersonalCost = resolution.personalCostCents;
        newIsShared = resolution.isShared;
        newPaidById = effectivePaidById;
        if (!resolution.movesOwnerWallet) {
          setEditWalletId(null);
        }
        await Promise.all(newShares.map((s) => participantShareRepository.create(s)));
      } else if (splitConfigChanged && !editWantsSplit && !editOtherPaid) {
        if (shares.length > 0) {
          await Promise.all(shares.map((s) => participantShareRepository.delete(s.id)));
        }
        newShares = [];
        newPersonalCost = newAmountCents;
        newIsShared = false;
        newPaidById = owner?.id ?? null;
      } else if (!splitConfigChanged && newIsShared && shares.length > 0 && amountChanged) {
        newShares = scaleSharesToTotal(shares, newAmountCents);
        await Promise.all(newShares.map((s) => participantShareRepository.update(s)));
        newPersonalCost = owner
          ? calculateOwnerPersonalCost({ ...tx, amountCents: newAmountCents }, newShares, owner.id)
          : null;
      } else if (!editWantsSplit && !editOtherPaid) {
        newPersonalCost = newAmountCents;
      }

      const movedPoolPhaseId =
        editPoolId !== tx.budgetPoolId ? resolvePoolPhaseId(links, editPoolId) : null;
      const finalWalletId = editWalletId;
      const updated = await transactionRepository.update({
        ...tx,
        amountCents: newAmountCents,
        baseCurrencyAmountCents:
          tx.exchangeRate !== null
            ? convertToBaseCents(newAmountCents, tx.exchangeRate)
            : newAmountCents,
        personalCostCents: newPersonalCost,
        isShared: newIsShared,
        paidByParticipantId: newPaidById,
        description: editDescription.trim() || tx.description,
        category: editCategory,
        budgetPoolId: editPoolId,
        phaseId: movedPoolPhaseId ?? tx.phaseId,
        walletId: finalWalletId,
        date: newDate,
        ...placeToTransactionFields(editPlace),
        placeNameSource: editPlace ? 'user' : null,
      });
      setTx(updated);
      setShares(newShares);
      setEditing(false);
      showToast(t('expenses.edited_toast'), 'success');
      await reload();
    } finally {
      setSaving(false);
    }
  };

  // D-IMP-03: attribute THIS expense to a planned purchase — reuses the exact
  // orchestrator the Planned screen uses (no new transaction, reserve shrinks
  // once). Undo restores the pre-link purchase snapshot.
  const handleLinkToPlanned = async (purchase: PlannedPurchase) => {
    const result = await linkExistingExpenseToPlannedPurchase({ purchase, transaction: tx });
    setLinkPickerOpen(false);
    await reload();
    showToast(t('planned.linked_toast'), 'success', {
      actionLabel: t('common.undo'),
      durationMs: 6000,
      onTap: () => {
        void undoLinkExistingExpense(result.previousPurchase).then(() => {
          notifyAppDataChanged();
          showToast(t('common.undo_done'), 'info');
        });
      },
    });
  };

  // DEC-457: share THIS expense as a `/x/` link (photos included). The heavy
  // transport module is imported on tap so the detail chunk stays lean; the
  // link is minted once and reused (revision bump) on every re-share.
  const handleShareExpense = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const [{ publishExpenseShare }, { resolveSelfShareName }, { shareOrCopyLink }] =
        await Promise.all([
          import('./expense-share'),
          import('@/domain/orchestrators'),
          import('@/utils/native/link-share'),
        ]);
      const ownerName = (await resolveSelfShareName(settings ?? undefined).catch(() => '')) || 'TripPilot';
      const { url } = await publishExpenseShare(tx, ownerName);
      const outcome = await shareOrCopyLink({
        url,
        text: t('expenseShare.message', { description: tx.description, url }),
      });
      if (outcome === 'copied') showToast(t('shareLink.copied'), 'success');
      else if (outcome === 'copy_failed') showToast(t('shareLink.copy_failed'), 'danger');
    } catch {
      showToast(t('expenseShare.error'), 'danger');
    } finally {
      setSharing(false);
    }
  };

  // DEC-126: single delete goes through the same batch orchestrator (shares
  // cascade included) so the undo toast can restore the exact previous state
  // even after navigating back to the list.
  const handleDelete = async () => {
    await softDeleteTransactionsBatch([tx.id]);
    setShowDeleteConfirm(false);
    await reload();
    navigate('/expenses', { replace: true });
    showToast(t('expenses.deleted_toast'), 'success', {
      actionLabel: t('common.undo'),
      durationMs: 8000,
      onTap: () => {
        void restoreTransactionsBatch([tx.id]).then(() => {
          notifyAppDataChanged();
          showToast(t('common.undo_done'), 'info');
        });
      },
    });
  };

  return (
    <div className="flex flex-col gap-4 pb-4 pt-2">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('expenses.detail_title')}</h1>
      </div>

      {!editing ? (
        <>
          <div className="bg-surface-container rounded-2xl p-5 text-center">
            <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 bg-primary/10">
              <Icon name={getCategoryIcon(tx.category)} size={24} className="text-primary" />
            </div>
            <p className="text-display font-extrabold tabular text-on-surface leading-none">
              {formatMoney(tx.amountCents, tx.currency)}
            </p>
            {/* E9 (M9): foreign expense — show the frozen base-currency equivalent. */}
            {tx.exchangeRate !== null && tx.currency !== trip.baseCurrency && (
              <p className="text-sm font-semibold text-on-surface-dim mt-1 tabular">
                ≈ {formatMoney(tx.baseCurrencyAmountCents, trip.baseCurrency)}
              </p>
            )}
            {/* DEC-128: mental anchor under the amount ("≈ R$ 124") */}
            {anchorHint && (
              <p className="text-sm font-semibold text-on-surface-dim mt-1 tabular">{anchorHint}</p>
            )}
            <p className="text-sm text-on-surface-dim mt-2">{tx.description}</p>
          </div>

          {/* C02/DEC-302: the item always points back to its parent outing. */}
          {parentSession && (
            <button
              onClick={() => navigate(`/outings/${parentSession.id}/review`)}
              className="w-full bg-surface-container rounded-xl px-4 py-3 flex items-center gap-3 btn-press text-left"
            >
              <div className="w-9 h-9 rounded-full bg-surface-high flex items-center justify-center shrink-0">
                <Icon name="receipt_long" size={18} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-on-surface-faint">{t('expenses.part_of_outing')}</p>
                <p className="text-sm font-semibold text-on-surface truncate">{parentSession.name}</p>
              </div>
              <Icon name="chevron_right" size={18} className="text-on-surface-faint shrink-0" />
            </button>
          )}

          {/* DEC-421 (G9): spend attributed to an event → open its guide. */}
          {occurrence && (
            <button
              onClick={() => navigate(`/event/${occurrence.id}`)}
              className="w-full bg-surface-container rounded-xl px-4 py-3 flex items-center gap-3 btn-press text-left"
            >
              <div className="w-9 h-9 rounded-full bg-surface-high flex items-center justify-center shrink-0">
                <Icon name="calendar_month" size={18} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-on-surface-faint">{t('expenses.part_of_event')}</p>
                <p className="text-sm font-semibold text-on-surface truncate">{occurrence.name}</p>
              </div>
              <Icon name="chevron_right" size={18} className="text-on-surface-faint shrink-0" />
            </button>
          )}

          <div className="bg-surface-container rounded-xl divide-y divide-on-surface-mute">
            <DetailRow
              label={t('expenses.category')}
              value={tx.category ? t(`categories.${tx.category}` as never) : '—'}
            />
            <DetailRow label={t('expenses.date')} value={formatDate(localDayOf(tx.date))} />
            {/* M5: local wall-clock time + place (place row only when present). */}
            <DetailRow label={t('expenses.time')} value={localClockTime(tx.date)} />
            {locationRowText && (
              <DetailRow label={t('expenses.location_label')} value={locationRowText} />
            )}
            <DetailRow label={t('expenses.fund')} value={pool?.name ?? '—'} />
            <DetailRow
              label={t('expenses.wallet')}
              value={wallet?.name ?? t('expenses.wallet_not_set')}
              warning={!wallet}
            />
            {tx.isShared && (
              <>
                <DetailRow
                  label={t('expenses.financial_flow')}
                  value={formatMoney(tx.amountCents, tx.currency)}
                />
                <DetailRow
                  label={t('expenses.personal_cost')}
                  value={formatMoney(tx.personalCostCents ?? tx.amountCents, tx.currency)}
                />
              </>
            )}
          </div>

          {/* DEC-368 (G8): map for the saved point — lazy Leaflet, so it only
              downloads when an expense with coordinates is opened. DEC-398 (G7):
              the inline preview is static (never traps the page scroll) and taps
              to expand. The caption flags an unconfirmed point unless named. */}
          {locationDisplay.hasMap && (
            <div className="space-y-1">
              <Suspense
                fallback={
                  <div className="w-full h-44 rounded-xl bg-surface-container animate-pulse" />
                }
              >
                <ExpenseLocationMapField
                  lat={tx.latitude as number}
                  lng={tx.longitude as number}
                  label={locationRowText ?? t('expenses.location_label')}
                />
              </Suspense>
              {locationDisplay.caption.kind !== 'named' && (
                <p className="text-[11px] text-on-surface-faint px-1">
                  {t('expenses.location_unverified')}
                </p>
              )}
            </div>
          )}

          {/* G9 (audit §4.5): name the two technical labels in one plain line. */}
          {tx.isShared && (
            <p className="text-[11px] text-on-surface-faint px-1 -mt-2 leading-snug">
              {t('split.flow_vs_cost_hint')}
            </p>
          )}

          {/* GATE 6 (D07): price history for this item — what you paid before. */}
          {priceHistory && (
            <PriceHistoryCard
              history={priceHistory}
              name={tx.description}
              baseCurrency={trip.baseCurrency}
            />
          )}

          {tx.isShared && shares.length > 0 && (
            <div>
              <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
                {t('expenses.shared_with')}
              </p>
              <div className="bg-surface-container rounded-xl divide-y divide-on-surface-mute">
                {shares.map((share) => {
                  const participant = participantById.get(share.participantId);
                  const isPayer = share.participantId === tx.paidByParticipantId;
                  return (
                    <div key={share.id} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon name="person" size={18} className="text-on-surface-dim" />
                        <span className="text-sm text-on-surface">
                          {participant?.isOwner
                            ? t('shared.owner_tag')
                            : (participant?.nickname ?? participant?.name ?? '—')}
                        </span>
                        {isPayer && payer && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-success/15 text-success">
                            {t('expenses.paid_by', {
                              name: payer.isOwner ? t('shared.owner_tag') : payer.name,
                            })}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold tabular text-on-surface">
                        {formatMoney(share.shareAmountCents, tx.currency)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* T1: came from a bill split → open the full who-got-what record. */}
          {splitSession && (
            <button
              onClick={() => setSplitHistoryOpen(true)}
              className="w-full bg-surface-container rounded-xl px-4 py-3 flex items-center gap-3 btn-press text-left"
            >
              <div className="w-9 h-9 rounded-full bg-surface-high flex items-center justify-center shrink-0">
                <Icon name="splitscreen" size={18} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-on-surface-faint">{t('splitHistory.title')}</p>
                <p className="text-sm font-semibold text-on-surface truncate">
                  {t('splitHistory.see_committed')}
                </p>
              </div>
              <Icon name="chevron_right" size={18} className="text-on-surface-faint shrink-0" />
            </button>
          )}

          {tx.notes && (
            <div className="bg-surface-container rounded-xl p-4">
              <p className="text-xs text-on-surface-faint mb-1">{t('expenses.description')}</p>
              <p className="text-sm text-on-surface">{tx.notes}</p>
            </div>
          )}

          {/* DEC-206 (G1): attach receipt/proof photos to this expense. */}
          <AttachmentSection transactionId={tx.id} />

          {/* D-IMP-03: planned-purchase link from the expense side. */}
          {linkedPurchase ? (
            <button
              onClick={() => navigate('/planned')}
              className="w-full bg-surface-container rounded-xl px-4 py-3 flex items-center gap-3 btn-press text-left"
            >
              <div className="w-9 h-9 rounded-full bg-surface-high flex items-center justify-center shrink-0">
                <Icon name="link" size={18} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-on-surface-faint">{t('expenses.linked_planned_label')}</p>
                <p className="text-sm font-semibold text-on-surface truncate">{linkedPurchase.name}</p>
              </div>
              <Icon name="chevron_right" size={18} className="text-on-surface-faint shrink-0" />
            </button>
          ) : (
            linkCandidates.length > 0 && (
              <button
                onClick={() => setLinkPickerOpen(true)}
                className="w-full py-2.5 rounded-xl bg-surface-container text-on-surface-dim font-semibold text-sm btn-press flex items-center justify-center gap-2"
              >
                <Icon name="link" size={18} className="text-on-surface-dim" />
                {t('expenses.link_planned')}
              </button>
            )
          )}

          {/* DEC-457: send this expense (with photos) as a link anyone opens. */}
          <button
            onClick={() => void handleShareExpense()}
            disabled={sharing}
            className="w-full py-2.5 rounded-xl bg-surface-container text-on-surface-dim font-semibold text-sm btn-press flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {sharing ? (
              <span className="w-4 h-4 rounded-full border-2 border-on-surface-dim border-t-transparent animate-spin" />
            ) : (
              <Icon name="share" size={18} className="text-on-surface-dim" />
            )}
            {sharing ? t('expenseShare.sharing') : t('expenseShare.share_button')}
          </button>

          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex-1 py-3 rounded-xl font-medium btn-press bg-error/10 text-error"
            >
              {t('common.delete')}
            </button>
            <button
              onClick={startEdit}
              className="flex-1 py-3 rounded-xl bg-primary text-on-surface font-medium btn-press"
            >
              {t('common.edit')}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="bg-surface-container rounded-2xl p-5">
            <label className="text-xs text-on-surface-faint mb-1 block">{t('expenses.amount')}</label>
            <div className="flex items-baseline gap-1">
              <span className="text-on-surface-dim text-lg">{tx.currency}</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="bg-transparent text-display font-bold text-on-surface tabular outline-none w-full"
                autoFocus
              />
            </div>
          </div>

          <div className="bg-surface-container rounded-xl p-4">
            <label className="text-xs text-on-surface-faint mb-1 block">{t('expenses.description')}</label>
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="bg-transparent text-sm text-on-surface outline-none w-full"
            />
          </div>

          <div>
            <label className="text-xs text-on-surface-faint mb-2 block">{t('expenses.category')}</label>
            <div className="grid grid-cols-5 gap-2">
              {CATEGORY_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => setEditCategory(key)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl btn-press transition-colors ${
                    editCategory === key ? 'bg-primary/20 ring-1 ring-primary' : 'bg-surface-container'
                  }`}
                >
                  <Icon
                    name={getCategoryIcon(key)}
                    size={20}
                    className={editCategory === key ? 'text-primary' : 'text-on-surface-dim'}
                  />
                  {/* R-03: long labels wrap with hyphenation instead of overflowing. */}
                  <span className="w-full text-center text-[10px] leading-tight text-on-surface-faint break-words hyphens-auto line-clamp-2">
                    {t(`categories.${key}` as never)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-surface-container rounded-xl p-4">
            <label className="text-xs text-on-surface-faint mb-1 block">{t('expenses.date')}</label>
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
            />
          </div>

          {/* D-BUG-08: full place apparatus on edit (use my location, nearby,
              find online, recents) — gated GPS/online features by the setting. */}
          <PlaceField
            value={editPlace}
            onChange={setEditPlace}
            category={editCategory}
            transactions={transactions}
            autoCapture={false}
            locationFeaturesEnabled={!!settings?.locationCaptureEnabled}
          />

          {participants.length > 1 && (() => {
            const effectiveEditPaidById = editPaidById ?? owner?.id ?? null;
            const editOtherPaid = owner !== null && effectiveEditPaidById !== null && effectiveEditPaidById !== owner.id;
            const editWantsSplit = editOtherPaid ? editOtherPaidSplit : editIsShared;
            const editPayerName = (() => {
              const p = participants.find((pp) => pp.id === effectiveEditPaidById);
              return p ? (p.nickname ?? p.name) : '';
            })();
            const amountCentsPreview = (() => {
              const v = parseFloat(editAmount.replace(',', '.'));
              return Number.isNaN(v) || v <= 0 ? 0 : toCents(v);
            })();
            const editHasSplitCounterparty =
              editSelectedParticipantIds.length >= 2 ||
              (editSelectedParticipantIds.length === 1 && editSelectedParticipantIds[0] !== owner?.id);
            const editFrontedPreview =
              !editOtherPaid &&
              editWantsSplit &&
              editHasSplitCounterparty &&
              owner !== null &&
              !editSelectedParticipantIds.includes(owner.id);

            return (
          <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-4">
            <div>
              <label className="text-xs text-on-surface-faint mb-2 block">
                {t('expenses.who_paid')}
              </label>
              <div className="flex gap-2 flex-wrap">
                {participants.map((p) => {
                  const connected = p.linkedActorId !== null;
                  const label = p.isOwner ? t('shared.owner_tag') : (p.nickname ?? p.name);
                  return (
                    <button
                      key={p.id}
                      onClick={() => editSelectPayer(p.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press inline-flex items-center gap-1.5 ${
                        effectiveEditPaidById === p.id
                          ? 'bg-primary text-on-surface'
                          : 'bg-surface-high text-on-surface-dim'
                      }`}
                    >
                      {connected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                      )}
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {editOtherPaid && (
              <div>
                <label className="text-xs text-on-surface-faint mb-2 block">
                  {t('expenses.split_mode')}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditOtherPaidSplit(false)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${
                      !editOtherPaidSplit ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                    }`}
                  >
                    {t('expenses.other_paid_full')}
                  </button>
                  <button
                    onClick={() => setEditOtherPaidSplit(true)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${
                      editOtherPaidSplit ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                    }`}
                  >
                    {t('expenses.other_paid_split')}
                  </button>
                </div>
                {!editOtherPaidSplit && amountCentsPreview > 0 && (
                  <p className="text-xs font-semibold text-warning mt-2">
                    {t('expenses.debt_full_hint', {
                      amount: formatMoney(amountCentsPreview, tx.currency),
                      name: editPayerName,
                    })}
                  </p>
                )}
              </div>
            )}

            {!editOtherPaid && (
              <button
                onClick={() => setEditIsShared((v) => {
                  const next = !v;
                  if (next && editSelectedParticipantIds.length === 0 && owner) {
                    setEditSelectedParticipantIds([owner.id]);
                  }
                  return next;
                })}
                className="w-full flex items-center justify-between btn-press"
              >
                <span className="text-sm text-on-surface font-medium flex items-center gap-2">
                  <Icon name="group" size={18} className="text-on-surface-dim" />
                  {t('expenses.shared_toggle')}
                </span>
                <span
                  className="w-10 h-6 rounded-full relative transition-colors"
                  style={{ background: editIsShared ? 'var(--primary)' : 'var(--surface-high)' }}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-on-surface transition-[left]"
                    style={{ left: editIsShared ? '18px' : '2px' }}
                  />
                </span>
              </button>
            )}

            {(editWantsSplit || editOtherPaidSplit) && (
              <>
                <div>
                  <label className="text-xs text-on-surface-faint mb-2 block">
                    {t('expenses.participants_label')}
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {participants.map((p) => {
                      const connected = p.linkedActorId !== null;
                      const label = p.nickname ?? p.name;
                      return (
                        <button
                          key={p.id}
                          onClick={() => editToggleParticipant(p.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press inline-flex items-center gap-1.5 ${
                            editSelectedParticipantIds.includes(p.id)
                              ? 'bg-primary text-on-surface'
                              : 'bg-surface-high text-on-surface-dim'
                          }`}
                        >
                          {connected && (
                            <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                          )}
                          {p.isOwner ? t('shared.owner_tag') : label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-on-surface-faint mb-2 block">
                    {t('expenses.split_mode')}
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditSplitMode('equal')}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${
                        editSplitMode === 'equal' ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                      }`}
                    >
                      {t('expenses.split_equal')}
                    </button>
                    <button
                      onClick={() => setEditSplitMode('custom')}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${
                        editSplitMode === 'custom' ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                      }`}
                    >
                      {t('expenses.split_custom')}
                    </button>
                  </div>
                </div>

                {editSplitMode === 'custom' && (
                  <div className="flex flex-col gap-2">
                    {participants
                      .filter((p) => editSelectedParticipantIds.includes(p.id))
                      .map((p) => (
                        <div key={p.id} className="flex items-center gap-2">
                          <span className="text-xs text-on-surface-dim flex-1 truncate">
                            {p.isOwner ? t('shared.owner_tag') : (p.nickname ?? p.name)}
                          </span>
                          <div className="flex items-baseline gap-1 bg-surface-high rounded-lg px-3 py-1.5 w-28">
                            <span className="text-on-surface-faint text-xs">{tx.currency}</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              value={editCustomAmounts[p.id] ?? ''}
                              onChange={(e) =>
                                setEditCustomAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))
                              }
                              placeholder="0,00"
                              className="bg-transparent text-xs text-on-surface tabular outline-none w-full"
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {editOtherPaid && editOtherPaidSplit && amountCentsPreview > 0 && editSelectedParticipantIds.includes(owner?.id ?? '') && (() => {
                  const shareCount = editSelectedParticipantIds.length;
                  const previewShare = shareCount > 0 ? Math.round(amountCentsPreview / shareCount) : 0;
                  return (
                    <p className="text-xs font-semibold text-warning">
                      {t('expenses.debt_share_hint', {
                        amount: formatMoney(previewShare, tx.currency),
                        name: editPayerName,
                      })}
                    </p>
                  );
                })()}

                {editFrontedPreview && amountCentsPreview > 0 && (
                  <p className="text-xs font-semibold text-success">
                    {t('expenses.fronted_hint', {
                      amount: formatMoney(amountCentsPreview, tx.currency),
                    })}
                  </p>
                )}
              </>
            )}
          </div>
            );
          })()}

          <div className="bg-surface-container rounded-xl p-4">
            <label className="text-xs text-on-surface-faint mb-2 block">{t('expenses.fund')}</label>
            <div className="flex gap-2 flex-wrap">
              {pools.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setEditPoolId(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                    editPoolId === p.id ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {walletTrackingActive && (
          <div className="bg-surface-container rounded-xl p-4">
            <label className="text-xs text-on-surface-faint mb-2 block">{t('expenses.wallet')}</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setEditWalletId(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                  editWalletId === null
                    ? 'bg-warning/20 text-warning ring-1 ring-warning'
                    : 'bg-surface-high text-on-surface-dim'
                }`}
              >
                {t('expenses.wallet_not_set')}
              </button>
              {wallets.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setEditWalletId(w.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                    editWalletId === w.id ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                  }`}
                >
                  {w.name}
                </button>
              ))}
            </div>
          </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setEditing(false)}
              className="flex-1 py-3 rounded-xl bg-surface-high text-on-surface-dim font-medium btn-press"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-primary text-on-surface font-medium btn-press disabled:opacity-40"
            >
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </>
      )}

      {/* D-IMP-03: pick a compatible planned purchase for this expense. */}
      <BottomSheet
        open={linkPickerOpen}
        onClose={() => setLinkPickerOpen(false)}
        title={t('expenses.link_planned_sheet_title')}
      >
        <div className="flex flex-col gap-2">
          <p className="text-xs text-on-surface-faint leading-relaxed mb-1">
            {t('expenses.link_planned_hint')}
          </p>
          {linkCandidates.length === 0 ? (
            <p className="text-sm text-on-surface-dim py-6 text-center">
              {t('expenses.link_planned_empty')}
            </p>
          ) : (
            linkCandidates.map((p) => {
              const remaining = plannedPurchaseReservedRemainingCents(p, transactions);
              return (
                <button
                  key={p.id}
                  onClick={() => handleLinkToPlanned(p)}
                  className="w-full text-left bg-surface-high rounded-lg px-3 py-2.5 btn-press flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center shrink-0">
                      <Icon name={getCategoryIcon(p.category)} size={16} className="text-on-surface-dim" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-on-surface truncate">{p.name}</p>
                      {p.store && (
                        <p className="text-[11px] text-on-surface-faint mt-0.5 truncate">{p.store}</p>
                      )}
                    </div>
                  </div>
                  {p.reservedCents !== null ? (
                    <p className="text-sm font-bold tabular text-primary shrink-0">
                      {formatMoney(remaining, trip.baseCurrency)}
                    </p>
                  ) : (
                    <p className="text-[11px] font-semibold text-on-surface-faint shrink-0">
                      {t('planned.tracking_badge')}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>
      </BottomSheet>

      {/* T1: the full division behind this committed expense. */}
      <SplitHistorySheet
        open={splitHistoryOpen}
        onClose={() => setSplitHistoryOpen(false)}
        session={splitSession}
        ownerName={owner?.name}
      />

      {/* GAP-025: design-system confirmation instead of window.confirm */}
      <BottomSheet
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={t('expenses.delete_title')}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-on-surface-dim">{t('expenses.delete_confirm')}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm btn-press bg-error/10 text-error border border-error/30"
            >
              {t('common.delete')}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

function DetailRow({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <span className="text-xs text-on-surface-faint">{label}</span>
      <span className={`text-sm font-medium ${warning ? 'text-warning' : 'text-on-surface'}`}>
        {value}
      </span>
    </div>
  );
}

// GATE 6 (D07): per-item price history. Reads the pure `buildPriceHistory`
// verdict and renders min/avg/max + a plain-language "vs your average" line, with
// the full purchase list one tap away. Money shown in the trip's base currency.
function PriceHistoryCard({
  history,
  name,
  baseCurrency,
}: {
  history: PriceHistory;
  name: string;
  baseCurrency: string;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const samePrice = history.minCents === history.maxCents;
  const deltaLabel = formatMoney(Math.abs(history.deltaFromAvgCents), baseCurrency);
  const verdict = samePrice
    ? { tone: 'text-on-surface-dim', icon: 'trending_flat', label: t('expenses.price_history_same') }
    : history.isCheapest
      ? { tone: 'text-success', icon: 'trending_down', label: t('expenses.price_history_cheapest') }
      : history.isPriciest
        ? { tone: 'text-warning', icon: 'trending_up', label: t('expenses.price_history_priciest') }
        : history.deltaFromAvgCents > 0
          ? { tone: 'text-warning', icon: 'trending_up', label: t('expenses.price_history_above_avg', { delta: deltaLabel }) }
          : { tone: 'text-success', icon: 'trending_down', label: t('expenses.price_history_below_avg', { delta: deltaLabel }) };

  return (
    <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-3" data-price-history>
      <div className="flex items-center gap-2">
        <Icon name="monitoring" size={18} className="text-primary" />
        <p className="text-sm font-semibold text-on-surface">{t('expenses.price_history_title')}</p>
      </div>
      <p className="text-[11px] text-on-surface-faint -mt-2 leading-snug">
        {t('expenses.price_history_count', { name, count: history.count })}
      </p>

      <div className="grid grid-cols-3 gap-2">
        <PriceStat label={t('expenses.price_history_min')} value={formatMoney(history.minCents, baseCurrency)} tone="text-success" />
        <PriceStat label={t('expenses.price_history_avg')} value={formatMoney(history.avgCents, baseCurrency)} tone="text-on-surface" />
        <PriceStat label={t('expenses.price_history_max')} value={formatMoney(history.maxCents, baseCurrency)} tone="text-warning" />
      </div>

      <div className={`flex items-center gap-1.5 text-xs font-semibold ${verdict.tone}`}>
        <Icon name={verdict.icon} size={16} className={verdict.tone} />
        <span>{verdict.label}</span>
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-[11px] font-semibold text-on-surface-dim btn-press self-start flex items-center gap-1"
      >
        <Icon name={expanded ? 'expand_less' : 'expand_more'} size={14} className="text-on-surface-dim" />
        {expanded ? t('expenses.price_history_hide') : t('expenses.price_history_see_all')}
      </button>

      {expanded && (
        <div className="bg-surface-high rounded-lg divide-y divide-on-surface-mute">
          {history.points.map((p) => (
            <div key={p.transactionId} className="px-3 py-2 flex items-center justify-between">
              <span className={`text-xs ${p.isCurrent ? 'text-primary font-semibold' : 'text-on-surface-dim'}`}>
                {formatDate(localDayOf(p.date))}
                {p.isCurrent ? ` · ${t('expenses.price_history_this_one')}` : ''}
              </span>
              <span className={`text-xs font-semibold tabular ${p.isCurrent ? 'text-primary' : 'text-on-surface'}`}>
                {formatMoney(p.amountCents, baseCurrency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PriceStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="bg-surface-high rounded-lg py-2 text-center">
      <p className="text-[10px] text-on-surface-faint">{label}</p>
      <p className={`text-xs font-bold tabular ${tone}`}>{value}</p>
    </div>
  );
}
