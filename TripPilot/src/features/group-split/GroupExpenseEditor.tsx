import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { useImageSourceChooser } from '@/components/ImageSourceChooser';
import { showToast } from '@/components/Toast';
import { formatMoney, toCents, fromCents } from '@/domain/money';
import { buildGroupExpense, expenseShares, validateGroupExpense } from '@/domain/group-split';
import { checkImageBytes } from '@/domain/media';
import { compressImageFile, type CompressedImage } from '@/utils/image/compress';
import { fetchDecryptedImageUrl } from '@/data/sync/media-link';
import { scanReceiptForGroup, scanReceiptItemsForGroup, parseTextForGroup, type GroupAiError } from './group-ai';
import type {
  AddGroupExpenseInput,
  GroupExpense,
  GroupExpenseLineItem,
  GroupExpenseSource,
  GroupSplitEvent,
  GroupSplitMode,
} from '@/domain/group-split';

/** A scanned receipt line plus whether the group keeps it (DEC-337). */
type EditorItem = GroupExpenseLineItem & { include: boolean };

/**
 * DEC-342/343 (G5) — the photo intent the editor hands back on save. The detail
 * page (which owns the share creds) does the encrypt+upload / delete: `pending` is
 * a freshly compressed image to upload; `removeExisting` means drop the currently
 * uploaded one (a plain remove, or the old half of a replace).
 */
export interface GroupExpenseImageIntent {
  pending: CompressedImage | null;
  removeExisting: boolean;
}

interface Props {
  event: GroupSplitEvent;
  /** null = a brand-new expense; otherwise the expense being edited. */
  expense: GroupExpense | null;
  /** DEC-258/246 opt-ins — show the receipt-scan / ask-AI prefills (m3). */
  photoEnabled: boolean;
  aiTextEnabled: boolean;
  /** DEC-342/343 — whether the event is live-shared (drives the upload-on-share hint). */
  isShared: boolean;
  onClose: () => void;
  onSave: (expense: GroupExpense, image: GroupExpenseImageIntent) => void;
  onDelete: (expenseId: string) => void;
}

const moneyStr = (cents: number) => (cents === 0 ? '' : String(fromCents(cents)));

/**
 * C23 / DEC-297 — the add/edit-expense sheet for a group split: description,
 * amount, who paid, who shares, and the split mode (equal now; custom per-person
 * in the same form — m2 + m4). Validation + math come from the pure domain.
 */
export function GroupExpenseEditor({
  event,
  expense,
  photoEnabled,
  aiTextEnabled,
  isShared,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const { t, i18n } = useTranslation();
  const isEdit = expense !== null;

  const [description, setDescription] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(expense ? moneyStr(expense.amountCents) : '');
  const [category, setCategory] = useState(expense?.category ?? 'other');
  const [source, setSource] = useState<GroupExpenseSource>(expense?.source ?? 'manual');
  const [paidById, setPaidById] = useState(expense?.paidByParticipantId ?? event.ownerParticipantId);
  const [mode, setMode] = useState<GroupSplitMode>(expense?.splitMode ?? 'equal');
  const [aiBusy, setAiBusy] = useState(false);
  const [showAiText, setShowAiText] = useState(false);
  const [aiText, setAiText] = useState('');
  // DEC-336 — the day the expense happened: the stored day, else (legacy edit) the
  // day it was logged, else today for a brand-new expense. Editing a legacy row
  // therefore keeps its effective day instead of silently jumping to today.
  const [occurredAt, setOccurredAt] = useState(
    expense?.occurredAt ?? (expense ? expense.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)),
  );
  // DEC-337 — "selecionar itens": the receipt lines the group keeps. The included
  // lines' sum becomes the amount. Empty list = whole-bill ("nota completa").
  const [items, setItems] = useState<EditorItem[]>(() =>
    expense?.items ? expense.items.map((it) => ({ ...it, include: true })) : [],
  );
  const [itemsActive, setItemsActive] = useState(() => !!expense?.items && expense.items.length > 0);
  // E13 · DEC-333: the receipt prefill uses the shared camera-or-gallery chooser.
  // DEC-337: two scan modes — whole-bill prefill, or item-selection.
  const fullChooser = useImageSourceChooser((file) => {
    void handleScanFull(file);
  });
  const itemsChooser = useImageSourceChooser((file) => {
    void handleScanItems(file);
  });
  // DEC-342/343 (G5) — attach a receipt/proof photo. `pendingImage` is a freshly
  // compressed blob to upload on save; `removeExisting` drops the uploaded one
  // (plain remove, or the old half of a replace). The detail page does the
  // encrypt+upload / delete (it owns the share key) — the editor only captures.
  const [pendingImage, setPendingImage] = useState<CompressedImage | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [existingUrl, setExistingUrl] = useState<string | null>(null);
  const photoChooser = useImageSourceChooser((file) => {
    void handleAttachPhoto(file);
  });
  const [shareIds, setShareIds] = useState<Set<string>>(
    () => new Set(expense ? expense.participantIds : event.participants.map((p) => p.id)),
  );
  const [customById, setCustomById] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    if (expense?.splitMode === 'custom') {
      for (const id of expense.participantIds) out[id] = moneyStr(expense.customAmountsCents[id] ?? 0);
    }
    return out;
  });

  const includedItems = items.filter((it) => it.include);
  const itemsTotalCents = includedItems.reduce((s, it) => s + it.amountCents, 0);
  // In item-selection mode the amount is the sum of the kept lines; otherwise the typed amount.
  const amountCents = itemsActive ? itemsTotalCents : toCents(parseFloat(amount) || 0);
  const orderedShareIds = event.participants.map((p) => p.id).filter((id) => shareIds.has(id));
  // DEC-336 — the registrant: preserved on edit; the owner on a new owner-authored expense.
  const registrantId = expense?.createdByParticipantId ?? event.ownerParticipantId;

  const buildInput = (): AddGroupExpenseInput => ({
    description,
    amountCents,
    paidByParticipantId: paidById,
    splitMode: mode,
    participantIds: orderedShareIds,
    category,
    source,
    occurredAt,
    createdByParticipantId: registrantId,
    items: itemsActive
      ? includedItems.map((it) => ({ id: it.id, description: it.description, amountCents: it.amountCents, qty: it.qty }))
      : undefined,
    customAmountsCents:
      mode === 'custom'
        ? Object.fromEntries(orderedShareIds.map((id) => [id, toCents(parseFloat(customById[id] ?? '') || 0)]))
        : {},
  });

  const aiErrorKey = (error: GroupAiError): string =>
    error === 'not_configured'
      ? 'group_split.ai_not_configured'
      : error === 'rate_limited'
        ? 'group_split.ai_rate_limited'
        : error === 'empty'
          ? 'group_split.ai_empty'
          : 'group_split.ai_failed';

  const applyPrefill = (p: { description: string; amountCents: number; category: string }, src: GroupExpenseSource) => {
    if (p.description) setDescription(p.description);
    setAmount(moneyStr(p.amountCents));
    setCategory(p.category);
    setSource(src);
  };

  // Show the already-uploaded image (decrypted) when editing, unless the user is
  // replacing or removing it. Revokes the blob URL on cleanup.
  const hasPending = pendingImage !== null;
  useEffect(() => {
    const ref = expense?.imageRef;
    if (!ref || removeExisting || hasPending) {
      setExistingUrl(null);
      return;
    }
    let active = true;
    let created: string | null = null;
    void fetchDecryptedImageUrl(ref).then((u) => {
      if (!active) {
        if (u) URL.revokeObjectURL(u);
        return;
      }
      if (u) {
        created = u;
        setExistingUrl(u);
      }
    });
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [expense?.imageRef, removeExisting, hasPending]);

  const handleAttachPhoto = async (file: File) => {
    setPhotoBusy(true);
    try {
      const compressed = await compressImageFile(file);
      const cap = checkImageBytes(compressed.byteSize);
      if (!cap.ok) {
        showToast(t('group_split.photo_too_large'), 'danger');
        return;
      }
      setPendingImage(compressed);
      // Attaching supersedes any previously uploaded image (replace = delete old).
      setRemoveExisting(true);
    } catch {
      showToast(t('group_split.ai_failed'), 'danger');
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleRemovePhoto = () => {
    setPendingImage(null);
    setRemoveExisting(true);
    setExistingUrl(null);
  };

  const previewUrl = pendingImage?.thumbnailDataUrl ?? existingUrl;

  const handleScanFull = async (file: File) => {
    setAiBusy(true);
    const outcome = await scanReceiptForGroup(file);
    setAiBusy(false);
    if (!outcome.ok) {
      showToast(t(aiErrorKey(outcome.error)), 'danger');
      return;
    }
    // Whole-bill mode clears any item selection so the typed total wins.
    setItemsActive(false);
    setItems([]);
    applyPrefill(outcome.prefill, 'receipt');
    showToast(t('group_split.ai_filled'), 'success');
  };

  const handleScanItems = async (file: File) => {
    setAiBusy(true);
    const outcome = await scanReceiptItemsForGroup(file);
    setAiBusy(false);
    if (!outcome.ok) {
      showToast(t(aiErrorKey(outcome.error)), 'danger');
      return;
    }
    setItems(outcome.items.map((it) => ({ ...it, include: true })));
    setItemsActive(true);
    setSource('receipt');
    if (outcome.merchant && description.trim().length === 0) setDescription(outcome.merchant);
    showToast(t('group_split.ai_filled'), 'success');
  };

  const toggleItem = (id: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, include: !it.include } : it)));
  };

  const clearItems = () => {
    setItemsActive(false);
    setItems([]);
  };

  const handleAskAi = async () => {
    if (aiText.trim().length === 0) return;
    setAiBusy(true);
    const outcome = await parseTextForGroup(aiText, event.currency, i18n.language);
    setAiBusy(false);
    if (!outcome.ok) {
      showToast(t(aiErrorKey(outcome.error)), 'danger');
      return;
    }
    applyPrefill(outcome.prefill, 'ai');
    setShowAiText(false);
    setAiText('');
    showToast(t('group_split.ai_filled'), 'success');
  };

  // Live preview of the per-person split so the math is visible before saving.
  const preview = useMemo(() => {
    if (amountCents <= 0 || orderedShareIds.length === 0) return null;
    const probe = buildGroupExpense(buildInput());
    return expenseShares(probe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, mode, JSON.stringify(orderedShareIds), JSON.stringify(customById), paidById, itemsActive, itemsTotalCents]);

  const customSumCents = orderedShareIds.reduce((s, id) => s + toCents(parseFloat(customById[id] ?? '') || 0), 0);

  const toggleShare = (id: string) => {
    setShareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    const input = buildInput();
    const error = validateGroupExpense(event, input);
    if (error) {
      showToast(t(`group_split.error_${error}`), 'danger');
      return;
    }
    const built = buildGroupExpense(input);
    // Preserve identity on edit so balances/history stay stable. DEC-342/343 —
    // keep the existing imageRef unless the user removed/replaced it; the detail
    // page applies the pending upload + deletes the old blob.
    let finalExpense: GroupExpense;
    if (expense) {
      finalExpense = { ...built, id: expense.id, createdAt: expense.createdAt, source: expense.source };
      if (!removeExisting && expense.imageRef) finalExpense.imageRef = expense.imageRef;
    } else {
      finalExpense = built;
    }
    onSave(finalExpense, { pending: pendingImage, removeExisting });
  };

  return (
    <BottomSheet open onClose={onClose} title={isEdit ? t('group_split.edit_expense') : t('group_split.add_expense')}>
      {fullChooser.element}
      {itemsChooser.element}
      {photoChooser.element}
      <div className="flex flex-col gap-3 pt-2">
        {/* m3 + DEC-337 — AI/receipt prefill for a NEW expense. Two scan modes:
            whole-bill ("nota completa") or item-selection ("selecionar itens").
            Each is opt-in; the user still confirms payer + split. */}
        {!isEdit && (photoEnabled || aiTextEnabled) && (
          <div className="flex flex-col gap-2">
            {photoEnabled && (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={aiBusy}
                  onClick={() => fullChooser.open()}
                  className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface text-sm font-semibold btn-press flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Icon name="receipt_long" size={18} className="text-primary" />
                  {t('group_split.scan_full')}
                </button>
                <button
                  type="button"
                  disabled={aiBusy}
                  onClick={() => itemsChooser.open()}
                  className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface text-sm font-semibold btn-press flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Icon name="checklist" size={18} className="text-primary" />
                  {t('group_split.scan_items')}
                </button>
              </div>
            )}
            {aiTextEnabled && (
              <button
                type="button"
                disabled={aiBusy}
                onClick={() => setShowAiText((v) => !v)}
                className="w-full py-2.5 rounded-xl bg-surface-high text-on-surface text-sm font-semibold btn-press flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Icon name="auto_awesome" size={18} className="text-primary" />
                {t('group_split.ai_ask')}
              </button>
            )}
            {showAiText && (
              <div className="flex items-center gap-2">
                <input
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void handleAskAi()}
                  placeholder={t('group_split.ai_ask_ph')}
                  autoFocus
                  className="bg-surface-high rounded-lg px-3 py-2 text-sm text-on-surface outline-none flex-1"
                />
                <button
                  type="button"
                  onClick={() => void handleAskAi()}
                  disabled={aiBusy || aiText.trim().length === 0}
                  className="btn-press px-3 py-2 rounded-lg bg-primary text-on-surface text-sm font-semibold disabled:opacity-40"
                >
                  {aiBusy ? t('group_split.ai_thinking') : t('common.add')}
                </button>
              </div>
            )}
            {aiBusy && !showAiText && (
              <p className="text-[11px] text-on-surface-faint text-center">{t('group_split.ai_thinking')}</p>
            )}
          </div>
        )}

        <Labeled label={t('group_split.expense_description')}>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('group_split.expense_description_ph')}
            autoFocus
            className="bg-transparent text-sm text-on-surface outline-none w-full"
          />
        </Labeled>

        {/* DEC-337 — item-selection view (when a receipt's lines are kept), else the
            manual amount field. In item mode the amount is the sum of kept lines. */}
        {itemsActive ? (
          <div className="bg-surface-high rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface-faint">{t('group_split.items_title')}</span>
              <button type="button" onClick={clearItems} className="text-[11px] text-primary font-semibold btn-press">
                {t('group_split.use_full_bill')}
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => toggleItem(it.id)}
                  className="flex items-center gap-2 btn-press text-left"
                >
                  <span
                    className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                      it.include ? 'bg-primary' : 'bg-surface-container'
                    }`}
                  >
                    {it.include && <Icon name="check" size={14} className="text-on-surface" />}
                  </span>
                  <span
                    className={`text-sm flex-1 truncate ${
                      it.include ? 'text-on-surface' : 'text-on-surface-faint line-through'
                    }`}
                  >
                    {it.qty > 1 ? `${it.qty}× ` : ''}
                    {it.description || t('group_split.unnamed_item')}
                  </span>
                  <span
                    className={`text-xs tabular shrink-0 ${it.include ? 'text-on-surface-dim' : 'text-on-surface-faint'}`}
                  >
                    {formatMoney(it.amountCents, event.currency)}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-on-surface/10">
              <span className="text-xs font-semibold text-on-surface">{t('group_split.items_total')}</span>
              <span className="text-sm font-bold tabular text-on-surface">
                {formatMoney(itemsTotalCents, event.currency)}
              </span>
            </div>
          </div>
        ) : (
          <Labeled label={t('group_split.expense_amount')}>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="bg-transparent text-sm text-on-surface outline-none w-full"
            />
          </Labeled>
        )}

        <Labeled label={t('group_split.expense_date')}>
          <input
            type="date"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="bg-transparent text-sm text-on-surface outline-none w-full"
          />
        </Labeled>

        {/* DEC-342/343 (G5) — attach a receipt/proof photo; it E2E-uploads to R2
            when the group is shared so every member + the `/g/` guest can view it. */}
        <div className="bg-surface-high rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-on-surface-faint">{t('group_split.photos_title')}</span>
            {previewUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="text-[11px] text-error font-semibold btn-press"
              >
                {t('group_split.remove_photo')}
              </button>
            )}
          </div>
          {previewUrl ? (
            <img src={previewUrl} alt="" className="w-full max-h-48 object-contain rounded-lg bg-surface-container" />
          ) : (
            <button
              type="button"
              disabled={photoBusy}
              onClick={() => photoChooser.open()}
              className="py-2.5 rounded-xl bg-surface-container text-on-surface text-sm font-semibold btn-press flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Icon name="add_a_photo" size={18} className="text-primary" />
              {photoBusy ? t('group_split.ai_thinking') : t('group_split.add_photo')}
            </button>
          )}
          {previewUrl && !isShared && (
            <p className="text-[11px] text-on-surface-faint">{t('group_split.photo_pending_hint')}</p>
          )}
        </div>

        <div>
          <p className="text-xs text-on-surface-faint mb-1.5">{t('group_split.paid_by_label')}</p>
          <div className="flex flex-wrap gap-2">
            {event.participants.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPaidById(p.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium btn-press ${
                  paidById === p.id ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-on-surface-faint">{t('group_split.split_among')}</p>
            <div className="flex gap-1">
              <ModeChip active={mode === 'equal'} label={t('group_split.mode_equal')} onClick={() => setMode('equal')} />
              <ModeChip active={mode === 'custom'} label={t('group_split.mode_custom')} onClick={() => setMode('custom')} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {event.participants.map((p) => {
              const checked = shareIds.has(p.id);
              const shareCents = preview?.[p.id];
              return (
                <div key={p.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleShare(p.id)}
                    className="flex items-center gap-2 flex-1 btn-press text-left"
                  >
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                        checked ? 'bg-primary' : 'bg-surface-high'
                      }`}
                    >
                      {checked && <Icon name="check" size={14} className="text-on-surface" />}
                    </span>
                    <span className="text-base text-on-surface truncate">{p.name}</span>
                  </button>
                  {checked && mode === 'custom' ? (
                    <input
                      type="number"
                      inputMode="decimal"
                      value={customById[p.id] ?? ''}
                      onChange={(e) => setCustomById((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      placeholder="0.00"
                      className="w-20 bg-surface-high rounded-lg px-2 py-1 text-xs text-on-surface outline-none text-right"
                    />
                  ) : checked && shareCents !== undefined ? (
                    <span className="text-xs text-on-surface-faint tabular shrink-0">
                      {formatMoney(shareCents, event.currency)}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
          {mode === 'custom' && amountCents > 0 && (
            <p
              className={`text-[11px] mt-1.5 ${customSumCents > amountCents ? 'text-error' : 'text-on-surface-faint'}`}
            >
              {t('group_split.custom_sum', {
                sum: formatMoney(customSumCents, event.currency),
                total: formatMoney(amountCents, event.currency),
              })}
              {customSumCents < amountCents &&
                ' · ' + t('group_split.custom_remainder', { name: nameOf(event, paidById) })}
            </p>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          {isEdit && (
            <button
              onClick={() => onDelete(expense.id)}
              className="px-4 py-2.5 rounded-xl bg-error/15 text-error font-semibold btn-press"
            >
              {t('common.delete')}
            </button>
          )}
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-primary text-on-surface font-semibold btn-press"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

function nameOf(event: GroupSplitEvent, id: string): string {
  return event.participants.find((p) => p.id === id)?.name ?? '?';
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-high rounded-xl p-3">
      <label className="text-xs text-on-surface-faint block mb-1">{label}</label>
      {children}
    </div>
  );
}

function ModeChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold btn-press ${
        active ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
      }`}
    >
      {label}
    </button>
  );
}
