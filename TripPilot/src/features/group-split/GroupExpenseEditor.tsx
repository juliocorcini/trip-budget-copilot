import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { useImageSourceChooser } from '@/components/ImageSourceChooser';
import { showToast } from '@/components/Toast';
import { formatMoney, toCents, fromCents } from '@/domain/money';
import { buildGroupExpense, expenseShares, groupExpenseImages, validateGroupExpense } from '@/domain/group-split';
import { checkImageBytes, formatFileSize, type FileRef, type ImageRef } from '@/domain/media';
import { compressImageFile } from '@/utils/image/compress';
import { deleteSharedFile, deleteSharedImage, imageUrl, uploadFile, uploadImage } from '@/data/sync/media-link';
import { useDecryptedImage } from './GroupImage';
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

interface Props {
  event: GroupSplitEvent;
  /** null = a brand-new expense; otherwise the expense being edited. */
  expense: GroupExpense | null;
  /** DEC-258/246 opt-ins — show the receipt-scan / ask-AI prefills (m3). */
  photoEnabled: boolean;
  aiTextEnabled: boolean;
  onClose: () => void;
  /** The saved expense already carries its uploaded {@link GroupExpense.imageRefs}. */
  onSave: (expense: GroupExpense) => void;
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
  // DEC-348 (G2) — receipt/proof photos. The editor uploads on attach (plaintext,
  // persists immediately) and supports MANY per expense (F08). `imageRefs` is the
  // working set; `addedRefs` are uploads made THIS session (deleted if the user
  // cancels — orphan cleanup) and `removedExistingRefs` are pre-existing refs the
  // user removed (deleted only when the edit is saved). The expense carries the
  // final `imageRefs` on save, so the detail page no longer uploads on share.
  const [imageRefs, setImageRefs] = useState<ImageRef[]>(() => groupExpenseImages(expense ?? ({} as GroupExpense)));
  const [photoBusy, setPhotoBusy] = useState(false);
  const addedRefsRef = useRef<ImageRef[]>([]);
  const removedExistingRefsRef = useRef<ImageRef[]>([]);
  const savedRef = useRef(false);
  const photoChooser = useImageSourceChooser((file) => {
    void handleAttachPhoto(file);
  });
  // File attachments (PDF, docs) — same lifecycle as image refs.
  const [fileRefs, setFileRefs] = useState<FileRef[]>(() => expense?.fileRefs ?? []);
  const [fileBusy, setFileBusy] = useState(false);
  const addedFileRefsRef = useRef<FileRef[]>([]);
  const removedExistingFileRefsRef = useRef<FileRef[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  // F05 — manual line items: add an item by hand (description + amount) into the
  // same `items` list a scan produces; the amount becomes Σ included lines.
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');

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

  // DEC-348 — compress + upload on attach (plaintext), then append the ref. The
  // upload persists immediately, so the photo survives a reload even before the
  // event is shared (F07). A failed upload surfaces an honest toast.
  const handleAttachPhoto = async (file: File) => {
    setPhotoBusy(true);
    try {
      const compressed = await compressImageFile(file);
      const cap = checkImageBytes(compressed.byteSize);
      if (!cap.ok) {
        showToast(t('group_split.photo_too_large'), 'danger');
        return;
      }
      const result = await uploadImage(compressed.blob, {
        width: compressed.width,
        height: compressed.height,
        mimeType: compressed.mimeType,
      });
      if (!result.ok) {
        showToast(t(result.reason === 'too_large' ? 'group_split.photo_too_large' : 'group_split.ai_failed'), 'danger');
        return;
      }
      addedRefsRef.current.push(result.ref);
      setImageRefs((prev) => [...prev, result.ref]);
    } catch {
      showToast(t('group_split.ai_failed'), 'danger');
    } finally {
      setPhotoBusy(false);
    }
  };

  // Remove a photo: a ref uploaded THIS session is an orphan → delete its blob now;
  // a pre-existing ref is queued to delete only if the edit is saved.
  const handleRemovePhoto = (ref: ImageRef) => {
    setImageRefs((prev) => prev.filter((r) => r.r2Id !== ref.r2Id));
    const addedAt = addedRefsRef.current.findIndex((r) => r.r2Id === ref.r2Id);
    if (addedAt >= 0) {
      addedRefsRef.current.splice(addedAt, 1);
      void deleteSharedImage(ref);
    } else {
      removedExistingRefsRef.current.push(ref);
    }
  };

  const handleAttachFile = async (file: File) => {
    setFileBusy(true);
    try {
      const result = await uploadFile(file);
      if (!result.ok) {
        showToast(t(result.reason === 'too_large' ? 'group_split.file_too_large' : 'group_split.file_upload_failed'), 'danger');
        return;
      }
      addedFileRefsRef.current.push(result.ref);
      setFileRefs((prev) => [...prev, result.ref]);
      showToast(t('group_split.file_added'), 'success');
    } catch {
      showToast(t('group_split.file_upload_failed'), 'danger');
    } finally {
      setFileBusy(false);
    }
  };

  const handleRemoveFile = (ref: FileRef) => {
    setFileRefs((prev) => prev.filter((r) => r.r2Id !== ref.r2Id));
    const addedAt = addedFileRefsRef.current.findIndex((r) => r.r2Id === ref.r2Id);
    if (addedAt >= 0) {
      addedFileRefsRef.current.splice(addedAt, 1);
      void deleteSharedFile(ref);
    } else {
      removedExistingFileRefsRef.current.push(ref);
    }
  };

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

  // F05 — append a hand-typed line; switches into item mode so the amount is the
  // running sum of kept lines (an empty description falls back to "Item").
  const addManualItem = () => {
    const cents = toCents(parseFloat(newItemAmount) || 0);
    if (cents <= 0) return;
    const item: EditorItem = {
      id: `m-${crypto.randomUUID()}`,
      description: newItemDesc.trim(),
      amountCents: cents,
      qty: 1,
      include: true,
    };
    setItems((prev) => [...prev, item]);
    setItemsActive(true);
    setNewItemDesc('');
    setNewItemAmount('');
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
    // Preserve identity on edit so balances/history stay stable.
    let finalExpense: GroupExpense;
    if (expense) {
      finalExpense = { ...built, id: expense.id, createdAt: expense.createdAt, source: expense.source };
    } else {
      finalExpense = built;
    }
    // DEC-348 — attach the uploaded refs; drop the legacy single field (a legacy
    // ref the user kept is already in `imageRefs`, read back via groupExpenseImages).
    delete finalExpense.imageRef;
    if (imageRefs.length > 0) finalExpense.imageRefs = imageRefs;
    if (fileRefs.length > 0) finalExpense.fileRefs = fileRefs;
    // Saving commits removals: delete the pre-existing blobs the user dropped.
    for (const ref of removedExistingRefsRef.current) void deleteSharedImage(ref);
    removedExistingRefsRef.current = [];
    for (const ref of removedExistingFileRefsRef.current) void deleteSharedFile(ref);
    removedExistingFileRefsRef.current = [];
    savedRef.current = true;
    onSave(finalExpense);
  };

  // Cancelling discards this session's uploads (orphan cleanup); a save keeps them.
  const handleCancel = () => {
    if (!savedRef.current) {
      for (const ref of addedRefsRef.current) void deleteSharedImage(ref);
      addedRefsRef.current = [];
      for (const ref of addedFileRefsRef.current) void deleteSharedFile(ref);
      addedFileRefsRef.current = [];
    }
    onClose();
  };

  return (
    <BottomSheet open onClose={handleCancel} title={isEdit ? t('group_split.edit_expense') : t('group_split.add_expense')}>
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
            {/* F05 — add a line item by hand (feeds the same `items` list). */}
            <div className="flex items-center gap-2 pt-1">
              <input
                value={newItemDesc}
                onChange={(e) => setNewItemDesc(e.target.value)}
                placeholder={t('group_split.item_desc_ph')}
                className="flex-1 min-w-0 bg-surface-container rounded-lg px-2.5 py-1.5 text-sm text-on-surface outline-none"
              />
              <input
                type="number"
                inputMode="decimal"
                value={newItemAmount}
                onChange={(e) => setNewItemAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addManualItem()}
                placeholder="0.00"
                className="w-16 bg-surface-container rounded-lg px-2 py-1.5 text-sm text-on-surface outline-none text-right"
              />
              <button
                type="button"
                onClick={addManualItem}
                disabled={toCents(parseFloat(newItemAmount) || 0) <= 0}
                aria-label={t('group_split.add_item')}
                className="btn-press w-8 h-8 rounded-lg bg-primary text-on-surface flex items-center justify-center shrink-0 disabled:opacity-40"
              >
                <Icon name="add" size={18} className="text-on-surface" />
              </button>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-on-surface/10">
              <span className="text-xs font-semibold text-on-surface">{t('group_split.items_total')}</span>
              <span className="text-sm font-bold tabular text-on-surface">
                {formatMoney(itemsTotalCents, event.currency)}
              </span>
            </div>
          </div>
        ) : (
          <>
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
            {/* F05 — itemize a manual expense: switches to item mode (amount = Σ items). */}
            <button
              type="button"
              onClick={() => setItemsActive(true)}
              className="self-start -mt-1 text-[13px] text-primary font-semibold btn-press flex items-center gap-1"
            >
              <Icon name="add" size={16} className="text-primary" />
              {t('group_split.add_item')}
            </button>
          </>
        )}

        <Labeled label={t('group_split.expense_date')}>
          <input
            type="date"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="bg-transparent text-sm text-on-surface outline-none w-full"
          />
        </Labeled>

        {/* DEC-348 (G2) — attach receipt/proof photos; each uploads on attach as
            access-controlled plaintext, so it persists and every member + the
            `/g/` web guest can view/download it. Multiple photos per expense (F08). */}
        <div className="bg-surface-high rounded-xl p-3 flex flex-col gap-2">
          <span className="text-xs text-on-surface-faint">{t('group_split.photos_title')}</span>
          {imageRefs.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {imageRefs.map((ref) => (
                <EditorThumb
                  key={ref.r2Id}
                  imageRef={ref}
                  removeLabel={t('group_split.remove_photo')}
                  onRemove={() => handleRemovePhoto(ref)}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            disabled={photoBusy}
            onClick={() => photoChooser.open()}
            className="py-2.5 rounded-xl bg-surface-container text-on-surface text-sm font-semibold btn-press flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Icon name="add_a_photo" size={18} className="text-primary" />
            {photoBusy ? t('group_split.ai_thinking') : t('group_split.add_photo')}
          </button>
        </div>

        {/* File attachments (PDF, documents) — uploaded on attach, same R2 model. */}
        <div className="bg-surface-high rounded-xl p-3 flex flex-col gap-2">
          <span className="text-xs text-on-surface-faint">{t('group_split.files_title')}</span>
          {fileRefs.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {fileRefs.map((ref) => (
                <div key={ref.r2Id} className="flex items-center gap-2 bg-surface-container rounded-lg px-3 py-2">
                  <Icon name="description" size={18} className="text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-on-surface truncate">{ref.name}</p>
                    {ref.description && (
                      <p className="text-[11px] text-on-surface-faint truncate">{ref.description}</p>
                    )}
                    <p className="text-[10px] text-on-surface-faint">{formatFileSize(ref.byteSize)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(ref)}
                    className="btn-press p-1 rounded-full bg-error/15"
                    aria-label={t('common.delete')}
                  >
                    <Icon name="close" size={14} className="text-error" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="*/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleAttachFile(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={fileBusy}
            onClick={() => fileInputRef.current?.click()}
            className="py-2.5 rounded-xl bg-surface-container text-on-surface text-sm font-semibold btn-press flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Icon name="attach_file" size={18} className="text-primary" />
            {fileBusy ? t('group_split.ai_thinking') : t('group_split.attach_file')}
          </button>
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
          {/* F03 — 2 columns, bigger names + bigger checkboxes + breathing room. */}
          <div className="grid grid-cols-2 gap-2">
            {event.participants.map((p) => {
              const checked = shareIds.has(p.id);
              const shareCents = preview?.[p.id];
              return (
                <div key={p.id} className="bg-surface-high rounded-xl p-2.5 flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleShare(p.id)}
                    className="flex items-center gap-2 btn-press text-left"
                  >
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                        checked ? 'bg-primary' : 'bg-surface-container'
                      }`}
                    >
                      {checked && <Icon name="check" size={16} className="text-on-surface" />}
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
                      className="w-full bg-surface-container rounded-lg px-2 py-1 text-xs text-on-surface outline-none text-right"
                    />
                  ) : checked && shareCents !== undefined ? (
                    <span className="text-xs text-on-surface-faint tabular pl-8">
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

/**
 * One removable photo thumbnail in the editor. A plaintext ref renders from its
 * direct URL; a legacy E2E ref (carries `key`) is decrypted for back-compat.
 */
function EditorThumb({
  imageRef,
  onRemove,
  removeLabel,
}: {
  imageRef: ImageRef;
  onRemove: () => void;
  removeLabel: string;
}) {
  const legacy = !!imageRef.key;
  const decrypted = useDecryptedImage(legacy ? imageRef : null);
  const src = legacy ? (decrypted && decrypted !== 'failed' ? decrypted : null) : imageUrl(imageRef);
  return (
    <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-surface-container">
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 btn-press"
      >
        <Icon name="close" size={14} className="text-white" />
      </button>
    </div>
  );
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
