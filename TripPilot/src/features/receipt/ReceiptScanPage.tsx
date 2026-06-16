import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { v4 as uuidv4 } from 'uuid';
import { useAppData, notifyAppDataChanged } from '@/hooks/useAppData';
import { compressImageFile, blobToDataUrl, type CompressedImage } from '@/utils/image/compress';
import { extractReceiptViaCloud, type ReceiptOcrError } from '@/utils/ai-ocr';
import {
  reconcileReceipt,
  matchItemsToReadTotal,
  type ReceiptPlan,
  type ReceiptDraftItem,
} from '@/domain/receipt';
import { commitReceipt, undoReceiptCommit } from '@/domain/orchestrators';
import { newAttachment } from '@/features/attachments/attachment-utils';
import { attachmentRepository, appSettingsRepository } from '@/data/repositories';
import { resolveActivePhase } from '@/domain/dates';
import { formatMoney, toCents } from '@/domain/money';
import { getCategoryIcon } from '@/utils/category-icons';
import type { Participant } from '@/domain/types/participant';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/EmptyState';
import { DataErrorScreen } from '@/components/DataErrorScreen';
import { BottomSheet } from '@/components/BottomSheet';
import { showToast } from '@/components/Toast';

type Phase = 'capture' | 'reading' | 'review';

/** Curated categories for a receipt line (known icons + i18n keys). */
const RECEIPT_CATEGORIES = [
  'market',
  'restaurant',
  'bar',
  'transport',
  'accommodation',
  'entertainment',
  'gifts',
  'other',
];

const blankItem = (): ReceiptDraftItem => ({
  id: uuidv4(),
  description: '',
  qty: 1,
  amountCents: 0,
  category: 'other',
  include: true,
  participantIds: [],
  paidByParticipantId: null,
});

export function ReceiptScanPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip, phases, pools, participants, settings, loading, error, retry, reload } = useAppData();

  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('capture');
  const [plan, setPlan] = useState<ReceiptPlan | null>(null);
  const [name, setName] = useState('');
  const [compressed, setCompressed] = useState<CompressedImage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cloudEnabled = settings?.cloudReceiptOcrEnabled ?? false;
  const owner = useMemo(() => participants.find((p) => p.isOwner) ?? null, [participants]);
  const baseCurrency = trip?.baseCurrency ?? settings?.defaultCurrency ?? 'EUR';
  const currency = plan?.currency ?? baseCurrency;
  const defaultName = t('receiptScan.default_name');

  const included = useMemo(
    () => (plan ? plan.items.filter((i) => i.include && i.amountCents > 0) : []),
    [plan],
  );
  const reconciliation = useMemo(() => (plan ? reconcileReceipt(plan, 0) : null), [plan]);

  // G4 — receipt-level split: presets that split the WHOLE bill at once (the
  // restaurant/round case) plus a single payer, while the per-item sheet stays
  // the override. Only meaningful once there is someone to split with.
  const allParticipantIds = useMemo(() => participants.map((p) => p.id), [participants]);
  const splittable = participants.length >= 2;

  const splitMode = useMemo<'personal' | 'equal' | 'custom'>(() => {
    if (included.length === 0) return 'personal';
    if (included.every((i) => i.participantIds.length === 0)) return 'personal';
    const wholeGroup = included.every(
      (i) =>
        i.participantIds.length === allParticipantIds.length &&
        allParticipantIds.every((id) => i.participantIds.includes(id)),
    );
    return wholeGroup ? 'equal' : 'custom';
  }, [included, allParticipantIds]);

  const receiptPayerId = useMemo(() => {
    const ownerId = owner?.id ?? null;
    const split = included.filter((i) => i.participantIds.length > 0);
    if (split.length === 0) return ownerId;
    const first = split[0]!.paidByParticipantId ?? ownerId;
    return split.every((i) => (i.paidByParticipantId ?? ownerId) === first) ? first : null;
  }, [included, owner]);

  const applyEqualSplit = () =>
    setPlan((p) =>
      p
        ? {
            ...p,
            items: p.items.map((i) =>
              i.include && i.amountCents > 0
                ? { ...i, participantIds: allParticipantIds, paidByParticipantId: receiptPayerId }
                : i,
            ),
          }
        : p,
    );
  const applyAllPersonal = () =>
    setPlan((p) =>
      p
        ? {
            ...p,
            items: p.items.map((i) =>
              i.include && i.amountCents > 0
                ? { ...i, participantIds: [], paidByParticipantId: null }
                : i,
            ),
          }
        : p,
    );
  const setReceiptPayer = (id: string | null) =>
    setPlan((p) =>
      p
        ? { ...p, items: p.items.map((i) => (i.participantIds.length > 0 ? { ...i, paidByParticipantId: id } : i)) }
        : p,
    );
  const applyMatchTotal = () => setPlan((p) => (p ? { ...p, items: matchItemsToReadTotal(p) } : p));

  const segClass = (active: boolean) =>
    `flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-semibold btn-press ${
      active ? 'bg-primary text-on-surface' : 'bg-surface-container text-on-surface-dim'
    }`;

  const openPicker = () => fileRef.current?.click();

  const enableCloudThenPick = async () => {
    await appSettingsRepository.update({ cloudReceiptOcrEnabled: true });
    await reload();
    openPicker();
  };

  const startManual = () => {
    const first = blankItem();
    setPlan({ merchant: null, placeLabel: null, currency: null, readTotalCents: null, items: [first] });
    setName(defaultName);
    setCompressed(null);
    setPhase('review');
    setEditingId(first.id);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhase('reading');
    try {
      const image = await compressImageFile(file);
      setCompressed(image);
      const dataUrl = await blobToDataUrl(image.blob);
      const outcome = await extractReceiptViaCloud(dataUrl);
      if (outcome.ok) {
        setPlan(outcome.plan);
        setName(outcome.plan.merchant ?? defaultName);
        setPhase('review');
        if (outcome.plan.items.length === 0) {
          showToast(t('receiptScan.no_items_found'), 'warning', { durationMs: 6000 });
        }
      } else {
        // Graceful degradation (DEC-206): keep the photo, open an empty review so
        // the traveler can still add the items by hand instead of losing the work.
        const reason: ReceiptOcrError = outcome.error;
        showToast(t(`receiptScan.error_${reason}`), 'warning', { durationMs: 7000 });
        setPlan({
          merchant: null,
          placeLabel: null,
          currency: null,
          readTotalCents: null,
          items: [],
        });
        setName(defaultName);
        setPhase('review');
      }
    } catch (err) {
      console.error('[receipt-scan] read failed', err);
      showToast(t('receiptScan.error_failed'), 'danger');
      setPhase('capture');
    }
  };

  const patchItem = (id: string, patch: Partial<ReceiptDraftItem>) =>
    setPlan((p) => (p ? { ...p, items: p.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) } : p));
  const removeItem = (id: string) =>
    setPlan((p) => (p ? { ...p, items: p.items.filter((i) => i.id !== id) } : p));
  const toggleInclude = (id: string) =>
    setPlan((p) =>
      p ? { ...p, items: p.items.map((i) => (i.id === id ? { ...i, include: !i.include } : i)) } : p,
    );
  const addItem = () => {
    const item = blankItem();
    setPlan((p) => (p ? { ...p, items: [...p.items, item] } : p));
    setEditingId(item.id);
  };

  const handleCommit = async () => {
    if (!trip || !owner || busy || !plan) return;
    if (included.length === 0) {
      showToast(t('receiptScan.commit_empty'), 'warning');
      return;
    }
    const operationalPool = pools.find((p) => p.scope === 'linked_phases') ?? pools[0];
    const fallbackPhase = resolveActivePhase(phases);
    if (!operationalPool || !fallbackPhase) {
      showToast(t('backup.operation_failed'), 'danger');
      return;
    }

    setBusy(true);
    try {
      let attachmentId: string | null = null;
      if (compressed) {
        const attachment = newAttachment(compressed, { sessionId: null, transactionId: null });
        await attachmentRepository.add(attachment);
        attachmentId = attachment.id;
      }

      const result = await commitReceipt({
        tripId: trip.id,
        phaseId: fallbackPhase.id,
        budgetPoolId: operationalPool.id,
        ownerId: owner.id,
        currency,
        name: name.trim() || defaultName,
        items: plan.items,
        attachmentId,
      });

      await reload();

      showToast(t('receiptScan.committed_toast', { count: result.transactionIds.length }), 'success', {
        durationMs: 8000,
        actionLabel: t('common.undo'),
        onTap: () => {
          void undoReceiptCommit({
            sessionId: result.sessionId,
            transactionIds: result.transactionIds,
          }).then(() => {
            notifyAppDataChanged();
            showToast(t('common.undo_done'), 'info');
          });
        },
      });
      navigate('/expenses');
    } catch (err) {
      console.error('[receipt-scan] commit failed', err);
      showToast(t('backup.operation_failed'), 'danger');
    } finally {
      setBusy(false);
    }
  };

  if (!trip) {
    if (error) return <DataErrorScreen onRetry={retry} />;
    if (loading) return <p className="text-on-surface-dim py-8 text-center">{t('common.loading')}</p>;
    return <Navigate to="/welcome" replace />;
  }

  const includedTotalCents = included.reduce((sum, i) => sum + i.amountCents, 0);
  const editingItem = editingId !== null && plan ? plan.items.find((i) => i.id === editingId) : undefined;

  return (
    <div className="max-w-[430px] mx-auto flex flex-col gap-4 px-5 pt-2 pb-28">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />

      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <div>
          <h1 className="text-heading font-bold text-on-surface leading-tight">
            {t('receiptScan.title')}
          </h1>
          <p className="text-[11px] text-on-surface-faint">{t('receiptScan.subtitle')}</p>
        </div>
      </div>

      {/* CAPTURE — consent gate (opt-in) or the picker. */}
      {phase === 'capture' && (
        <div className="flex flex-col gap-3">
          {!cloudEnabled ? (
            <div
              className="rounded-2xl p-5 flex flex-col gap-3"
              style={{ background: 'var(--surface-container)' }}
            >
              <div className="flex items-center gap-2">
                <Icon name="auto_awesome" size={20} className="text-primary" />
                <p className="text-sm font-bold text-on-surface">{t('receiptScan.consent_title')}</p>
              </div>
              <p className="text-xs text-on-surface-dim leading-relaxed">
                {t('receiptScan.consent_body')}
              </p>
              <button
                onClick={() => void enableCloudThenPick()}
                className="w-full py-3 rounded-2xl bg-primary text-on-surface font-bold btn-press"
              >
                {t('receiptScan.consent_enable')}
              </button>
              <button
                onClick={startManual}
                className="w-full py-2.5 rounded-2xl bg-surface-high text-on-surface-dim font-semibold text-sm btn-press"
              >
                {t('receiptScan.add_manually')}
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={openPicker}
                className="rounded-2xl border border-dashed p-6 flex flex-col items-center gap-2 btn-press"
                style={{ borderColor: 'var(--surface-high)', background: 'var(--surface-container)' }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(124,160,255,0.16)' }}
                >
                  <Icon name="document_scanner" size={24} className="text-primary" />
                </div>
                <span className="text-sm font-bold text-on-surface">{t('receiptScan.pick')}</span>
                <span className="text-[11px] text-on-surface-faint text-center leading-relaxed">
                  {t('receiptScan.pick_hint')}
                </span>
              </button>
              <button
                onClick={startManual}
                className="self-center text-[11px] font-semibold text-on-surface-faint btn-press"
              >
                {t('receiptScan.add_manually')}
              </button>
            </>
          )}
        </div>
      )}

      {/* READING — the image is on its way to the model. */}
      {phase === 'reading' && (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-on-surface-dim">{t('receiptScan.reading')}</p>
        </div>
      )}

      {/* REVIEW — edit / select / split, then commit (Wise mold). */}
      {phase === 'review' && plan && (
        <>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-on-surface">{t('receiptScan.name_label')}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={defaultName}
              className="px-3 py-2.5 rounded-xl text-sm bg-surface-container text-on-surface outline-none"
            />
          </div>

          {reconciliation && reconciliation.readTotalCents !== null && (
            <div
              className="rounded-xl px-3 py-2.5 flex flex-col gap-2"
              style={{ background: 'var(--surface-container)' }}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-on-surface-faint">
                  {t('receiptScan.read_total')} {formatMoney(reconciliation.readTotalCents, currency)}
                </span>
                <span
                  className="font-bold tabular"
                  style={{
                    color: reconciliation.matches ? 'var(--success)' : 'var(--warning)',
                  }}
                >
                  {reconciliation.matches
                    ? t('receiptScan.reconciled')
                    : t('receiptScan.diff', {
                        amount: formatMoney(Math.abs(reconciliation.diffCents ?? 0), currency),
                      })}
                </span>
              </div>
              {!reconciliation.matches && included.length > 0 && (
                <button
                  onClick={applyMatchTotal}
                  className="self-start text-[11px] font-semibold text-primary btn-press flex items-center gap-1"
                >
                  <Icon name="balance" size={13} />
                  {t('receiptScan.match_total')}
                </button>
              )}
            </div>
          )}

          {/* G4 — split the whole receipt at once (market / restaurant-round). */}
          {splittable && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-on-surface">
                {t('receiptScan.split_modes_label')}
              </label>
              <div className="flex gap-1.5">
                <button onClick={applyAllPersonal} className={segClass(splitMode === 'personal')}>
                  <Icon name="person" size={13} />
                  {t('receiptScan.mode_personal')}
                </button>
                <button onClick={applyEqualSplit} className={segClass(splitMode === 'equal')}>
                  <Icon name="groups" size={13} />
                  {t('receiptScan.mode_equal')}
                </button>
              </div>
              {splitMode === 'custom' && (
                <p className="text-[11px] text-on-surface-faint flex items-center gap-1">
                  <Icon name="tune" size={12} />
                  {t('receiptScan.mode_custom_hint')}
                </p>
              )}
              {splitMode !== 'personal' && (
                <>
                  <p className="text-[11px] text-on-surface-faint mt-1">
                    {t('receiptScan.paid_by_label')}
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {participants.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setReceiptPayer(p.isOwner ? null : p.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-medium btn-press ${
                          (receiptPayerId ?? owner?.id) === p.id
                            ? 'bg-primary text-on-surface'
                            : 'bg-surface-high text-on-surface-dim'
                        }`}
                      >
                        {p.isOwner ? t('receiptScan.you') : p.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-1">
            <p className="text-xs font-semibold text-on-surface">
              {t('receiptScan.items', { count: included.length })}
            </p>
            <button
              onClick={addItem}
              className="text-[11px] font-semibold text-primary btn-press flex items-center gap-1"
            >
              <Icon name="add" size={14} />
              {t('receiptScan.add_item')}
            </button>
          </div>

          {plan.items.length === 0 ? (
            <EmptyState
              icon="receipt_long"
              title={t('receiptScan.empty_title')}
              body={t('receiptScan.empty_body')}
              cta={{ label: t('receiptScan.add_item'), icon: 'add', onClick: addItem }}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {plan.items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  currency={currency}
                  participants={participants}
                  ownerId={owner?.id ?? null}
                  onToggle={() => toggleInclude(item.id)}
                  onOpen={() => setEditingId(item.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Per-item editor sheet (description, amount, category, split). */}
      {editingItem && (
        <ItemEditSheet
          item={editingItem}
          currency={currency}
          participants={participants}
          ownerId={owner?.id ?? null}
          onPatch={(patch) => patchItem(editingItem.id, patch)}
          onRemove={() => {
            removeItem(editingItem.id);
            setEditingId(null);
          }}
          onClose={() => setEditingId(null)}
        />
      )}

      {phase === 'review' && plan && (
        <div
          className="fixed inset-x-0 bottom-0 px-5"
          style={{
            paddingBottom: 'calc(var(--safe-bottom) + 12px)',
            paddingTop: 12,
            background: 'linear-gradient(to top, var(--surface-base) 70%, transparent)',
          }}
        >
          <div className="max-w-[430px] mx-auto">
            <button
              onClick={() => void handleCommit()}
              disabled={busy || included.length === 0}
              className="w-full py-3.5 rounded-2xl bg-primary text-on-surface font-bold btn-press disabled:opacity-40"
            >
              {busy
                ? t('common.loading')
                : included.length === 0
                  ? t('receiptScan.commit_empty')
                  : t('receiptScan.commit', {
                      count: included.length,
                      total: formatMoney(includedTotalCents, currency),
                    })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function splitSummary(
  item: ReceiptDraftItem,
  participants: Participant[],
  ownerId: string | null,
  t: (k: string, o?: Record<string, unknown>) => string,
): string | null {
  if (item.participantIds.length === 0) return null;
  const payer =
    item.paidByParticipantId && item.paidByParticipantId !== ownerId
      ? (participants.find((p) => p.id === item.paidByParticipantId)?.name ?? '')
      : null;
  const base = t('receiptScan.split_among', { count: item.participantIds.length });
  return payer ? `${base} · ${t('receiptScan.paid_by', { name: payer })}` : base;
}

function ItemRow({
  item,
  currency,
  participants,
  ownerId,
  onToggle,
  onOpen,
}: {
  item: ReceiptDraftItem;
  currency: string;
  participants: Participant[];
  ownerId: string | null;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const summary = splitSummary(item, participants, ownerId, t);

  return (
    <div
      className={`w-full bg-surface-container rounded-xl p-3 flex items-center gap-3 ${
        item.include ? '' : 'opacity-55'
      }`}
    >
      <button
        onClick={onToggle}
        aria-label={t('receiptScan.toggle_include')}
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 border btn-press"
        style={{
          background: item.include ? 'var(--primary)' : 'transparent',
          borderColor: item.include ? 'var(--primary)' : 'var(--surface-high)',
        }}
      >
        {item.include && <Icon name="check" size={15} className="text-on-surface" />}
      </button>

      <button onClick={onOpen} className="flex-1 min-w-0 flex items-center gap-3 text-left btn-press">
        <span
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--surface-high)' }}
        >
          <Icon name={getCategoryIcon(item.category)} size={18} className="text-on-surface-dim" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-on-surface truncate">
            {item.description.trim().length > 0 ? item.description : t('receiptScan.unnamed_item')}
          </span>
          <span className="block text-[11px] text-on-surface-faint truncate">
            {summary ?? t('receiptScan.personal')}
          </span>
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="text-sm font-extrabold tabular text-on-surface">
            {formatMoney(item.amountCents, currency)}
          </span>
          <Icon name="chevron_right" size={16} className="text-on-surface-faint" />
        </span>
      </button>
    </div>
  );
}

function ItemEditSheet({
  item,
  currency,
  participants,
  ownerId,
  onPatch,
  onRemove,
  onClose,
}: {
  item: ReceiptDraftItem;
  currency: string;
  participants: Participant[];
  ownerId: string | null;
  onPatch: (patch: Partial<ReceiptDraftItem>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [amountStr, setAmountStr] = useState((item.amountCents / 100).toFixed(2));
  const isSplit = item.participantIds.length > 0;
  const others = participants.filter((p) => !p.isOwner);

  // Re-sync the amount field only when it changes from outside this input.
  useEffect(() => {
    const parsed = Number(amountStr.replace(',', '.'));
    const localCents = Number.isFinite(parsed) && parsed > 0 ? toCents(parsed) : 0;
    if (localCents !== item.amountCents) setAmountStr((item.amountCents / 100).toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.amountCents]);

  const handleAmount = (value: string) => {
    setAmountStr(value);
    const parsed = Number(value.replace(',', '.'));
    onPatch({ amountCents: Number.isFinite(parsed) && parsed > 0 ? toCents(parsed) : 0 });
  };

  const enableSplit = () => {
    // Default to splitting equally among everyone, paid by the owner.
    onPatch({
      participantIds: participants.map((p) => p.id),
      paidByParticipantId: ownerId,
    });
  };
  const disableSplit = () => onPatch({ participantIds: [], paidByParticipantId: null });

  const toggleParticipant = (id: string) => {
    const next = item.participantIds.includes(id)
      ? item.participantIds.filter((p) => p !== id)
      : [...item.participantIds, id];
    onPatch({ participantIds: next });
  };

  return (
    <BottomSheet open onClose={onClose} title={t('receiptScan.edit_title')}>
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-on-surface">{t('receiptScan.item_name')}</label>
          <input
            autoFocus={item.description.trim().length === 0}
            value={item.description}
            onChange={(e) => onPatch({ description: e.target.value })}
            placeholder={t('receiptScan.unnamed_item')}
            className="px-3 py-2.5 rounded-xl text-sm bg-surface-high text-on-surface outline-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-on-surface">{t('receiptScan.item_amount')}</label>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-on-surface-faint shrink-0">{currency}</span>
            <input
              inputMode="decimal"
              value={amountStr}
              onChange={(e) => handleAmount(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-sm tabular bg-surface-high text-on-surface outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-on-surface">{t('receiptScan.item_category')}</label>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar" data-no-tab-swipe>
            {RECEIPT_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => onPatch({ category: cat })}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium btn-press flex items-center gap-1 shrink-0 ${
                  item.category === cat ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                }`}
              >
                <Icon name={getCategoryIcon(cat)} size={13} />
                {t(`categories.${cat}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Split — personal by default; toggling on splits equally (DEC-114). */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-on-surface">{t('receiptScan.split_label')}</label>
            <button
              onClick={isSplit ? disableSplit : enableSplit}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold btn-press ${
                isSplit ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
              }`}
            >
              {isSplit ? t('receiptScan.split_on') : t('receiptScan.split_off')}
            </button>
          </div>

          {isSplit && (
            <>
              <p className="text-[11px] text-on-surface-faint">{t('receiptScan.split_among_label')}</p>
              <div className="flex gap-1.5 flex-wrap">
                {participants.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => toggleParticipant(p.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium btn-press ${
                      item.participantIds.includes(p.id)
                        ? 'bg-primary text-on-surface'
                        : 'bg-surface-high text-on-surface-dim'
                    }`}
                  >
                    {p.isOwner ? t('receiptScan.you') : p.name}
                  </button>
                ))}
              </div>

              {others.length > 0 && (
                <>
                  <p className="text-[11px] text-on-surface-faint mt-1">{t('receiptScan.paid_by_label')}</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {participants.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => onPatch({ paidByParticipantId: p.isOwner ? null : p.id })}
                        className={`px-3 py-2 rounded-xl text-xs font-medium btn-press ${
                          (item.paidByParticipantId ?? ownerId) === p.id
                            ? 'bg-primary text-on-surface'
                            : 'bg-surface-high text-on-surface-dim'
                        }`}
                      >
                        {p.isOwner ? t('receiptScan.you') : p.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={onRemove}
            className="px-4 py-3 rounded-2xl bg-surface-high text-on-surface-dim font-semibold btn-press flex items-center gap-1.5"
          >
            <Icon name="delete" size={16} />
            {t('common.delete')}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-primary text-on-surface font-bold btn-press"
          >
            {t('receiptScan.item_done')}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
