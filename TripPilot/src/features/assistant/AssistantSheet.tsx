import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { useImageSourceChooser } from '@/components/ImageSourceChooser';
import { useAppData } from '@/hooks/useAppData';
import { useWalletTracking } from '@/hooks/useWalletTracking';
import { formatMoney, toCents, evaluateAmountExpression } from '@/domain/money';
import { resolveActivePhase, toSafeIsoDate } from '@/domain/dates';
import { getAvailablePoolsForPhase } from '@/domain/budget';
import { EXPENSE_CATEGORY_KEYS, ownerPersonalCostCents } from '@/domain/assistant';
import { getCategoryIcon } from '@/utils/category-icons';
import { PlaceField } from '@/features/location/PlaceField';
import { SplitShareNudgeSheet } from '@/features/shared/SplitShareNudgeSheet';
import { isoToDatetimeLocal, setAssistantQuickAddDraft } from './assistant-quickadd-draft';
import { computeExpenseInsights, type ExpenseInsights } from './assistant-insights';
import { composePreview } from './assistant-preview-text';
import { subscribeAssistantOpen } from './assistant-bus';
import { ASSISTANT_EXAMPLE_GROUPS } from './assistant-examples';
import { useAssistant, type AssistantBatchView } from './useAssistant';
import type { AssistantPreview, ExecOp } from '@/domain/assistant';
import type { Wallet } from '@/domain/types/wallet';
import type { Transaction } from '@/domain/types/transaction';
import type { CurrentPlace } from '@/domain/types/common';

type ExpenseOp = Extract<ExecOp, { kind: 'expense' }>;

/** Everything the in-sheet editor needs to render parity pickers (DEC-246). */
interface EditContext {
  selectablePools: { id: string; name: string }[];
  wallets: Wallet[];
  transactions: Transaction[];
  walletTrackingActive: boolean;
  locationEnabled: boolean;
  rememberedPlace: CurrentPlace | null;
  baseCurrency: string;
}

/**
 * DEC-246 (AI Quick Entry): the single, app-wide quick-entry surface. One box
 * ("o Bruno me pagou uma cerveja de 2 euros") that the cloud router turns into a
 * concrete action the device previews, then commits through the existing engines
 * with one tap and an undo. Voice is first-class (mic → Web Speech or Whisper).
 * Mounted once in the AppShell; opened from anywhere via the assistant bus.
 */
export function AssistantSheet() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip, pools, links, phases, wallets, transactions, envelopes, occurrences, plannedPurchases, settings } =
    useAppData();
  const walletTrackingActive = useWalletTracking();
  const [open, setOpen] = useState(false);
  const assistant = useAssistant();
  const { reset, setText } = assistant;
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(
    () =>
      subscribeAssistantOpen((prefill) => {
        reset();
        if (prefill) setText(prefill);
        setOpen(true);
      }),
    [reset, setText],
  );

  // Close automatically once an action committed or a navigation fired.
  useEffect(() => {
    if (assistant.phase === 'done') setOpen(false);
  }, [assistant.phase]);

  // Focus the box as soon as the sheet is ready for typing.
  useEffect(() => {
    if (open && assistant.phase === 'input') {
      const id = window.setTimeout(() => inputRef.current?.focus(), 80);
      return () => window.clearTimeout(id);
    }
  }, [open, assistant.phase]);

  const handleClose = () => {
    reset();
    setOpen(false);
  };

  // FB-26: never dead-end. Switching to manual carries the already-typed text as
  // the expense description so a rate-limited (or AI-off) user re-types nothing —
  // QuickAdd ignores the 0 amount, leaving the value field for them to fill.
  const openManual = () => {
    const typed = assistant.text.trim();
    if (typed !== '') {
      setAssistantQuickAddDraft({ type: 'expense', amount: 0, currency: null, description: typed });
    }
    setOpen(false);
    navigate('/quick-add');
  };

  const baseCurrency = trip?.baseCurrency ?? 'EUR';
  const money = (cents?: number, currency?: string) =>
    formatMoney(cents ?? 0, currency ?? baseCurrency);

  // Edit context — the same selectable pools/wallets/place machinery QuickAdd
  // uses, so the in-sheet editor reaches full parity without duplicating logic.
  const currentPhase = resolveActivePhase(phases);
  const availablePools = currentPhase
    ? getAvailablePoolsForPhase(pools, links, currentPhase.id)
    : { operational: [], global: [], autoSelectedPoolId: null };
  const editContext: EditContext = {
    selectablePools: [...availablePools.operational, ...availablePools.global],
    wallets,
    transactions,
    walletTrackingActive,
    locationEnabled: !!settings?.locationCaptureEnabled,
    rememberedPlace: settings?.currentPlace ?? null,
    baseCurrency,
  };

  // Intelligence parity (M5 + DEC-053): the same "is this normal / can I afford
  // it?" hints QuickAdd shows — computed live from the (editable) draft, surfaced
  // as a non-blocking notice in the preview (the AI flow stays one tap).
  const draftExpense = assistant.draftOp?.kind === 'expense' ? assistant.draftOp : null;
  const insights: ExpenseInsights | null =
    draftExpense && !assistant.isForeign && currentPhase
      ? computeExpenseInsights({
          // Budget/anomaly hints must use MY cost, not the full bill — a split
          // someone else paid only spends my slice (parity with the budget
          // engine's personalCost; device-test 2026-06-20).
          amountBaseCents: ownerPersonalCostCents(draftExpense),
          category: draftExpense.category,
          budgetPoolId: draftExpense.budgetPoolId,
          currentPhaseId: currentPhase.id,
          transactions,
          pools,
          envelopes,
          links,
          occurrences,
          plannedPurchases,
        })
      : null;

  const busy = assistant.phase === 'thinking' || assistant.phase === 'transcribing' || assistant.phase === 'saving';

  return (
    <>
    <BottomSheet open={open} onClose={handleClose} title={t('assistant.title')}>
      <div className="flex flex-col gap-4 pb-2">
        {!assistant.enabled ? (
          <DisabledNotice onManual={openManual} onSettings={() => { setOpen(false); navigate('/settings'); }} />
        ) : (
          <>
            {/* The one box — text + voice. Hidden once we move to preview/clarify
                so the user focuses on the single decision in front of them. */}
            {(assistant.phase === 'input' ||
              assistant.phase === 'thinking' ||
              assistant.phase === 'transcribing' ||
              assistant.phase === 'error') && (
              <InputArea
                inputRef={inputRef}
                value={assistant.text}
                disabled={busy}
                listening={assistant.listening}
                voiceAvailable={assistant.voiceAvailable}
                photoEnabled={assistant.photoEnabled}
                onChange={assistant.setText}
                onSubmit={() => void assistant.submit()}
                onToggleVoice={() => void assistant.toggleVoice()}
                onPickPhoto={(file) => void assistant.scanReceiptPhoto(file)}
              />
            )}

            {/* "What can I ask?" — the full catalogue of things the AI handles,
                grouped + collapsible. Tapping an example pre-fills the box so the
                user learns by doing (then sends or edits). Input phase only. */}
            {assistant.phase === 'input' && (
              <ExamplesHelper
                onPick={(example) => {
                  assistant.setText(example);
                  window.setTimeout(() => inputRef.current?.focus(), 0);
                }}
              />
            )}

            {(assistant.phase === 'thinking' || assistant.phase === 'transcribing') && (
              <StatusRow
                label={t(assistant.phase === 'transcribing' ? 'assistant.transcribing' : 'assistant.thinking')}
              />
            )}

            {assistant.phase === 'clarify' && assistant.clarification && (
              <ClarifyArea
                note={assistant.note}
                clarification={assistant.clarification}
                onAmount={assistant.answerAmount}
                onAddPerson={() => void assistant.confirmAddPerson()}
                onAddPeople={() => void assistant.confirmAddPeople()}
                onChoosePerson={assistant.choosePerson}
                onCancel={assistant.cancelClarification}
              />
            )}

            {assistant.phase === 'batch_preview' && assistant.batchView && (
              <BatchPreviewArea
                view={assistant.batchView}
                money={money}
                onConfirm={() => void assistant.confirmBatch()}
                onCancel={assistant.cancelClarification}
              />
            )}

            {assistant.phase === 'preview' && assistant.preview && (
              <PreviewArea
                preview={assistant.preview}
                draftOp={assistant.draftOp}
                isForeign={assistant.isForeign}
                fromPhoto={assistant.fromPhoto}
                edit={editContext}
                insights={insights}
                money={money}
                patchDraft={assistant.patchDraft}
                onConfirm={() => void assistant.confirm()}
                onCancel={assistant.cancelClarification}
                onFullEditor={assistant.openFullEditor}
                onOpenItems={assistant.openReceiptItems}
                onManual={openManual}
              />
            )}

            {assistant.phase === 'saving' && <StatusRow label={t('assistant.saving')} />}

            {assistant.phase === 'error' && assistant.errorKey && (
              <ErrorArea
                messageKey={assistant.errorKey}
                cooldownSec={assistant.aiCooldownSec}
                onRetry={() => void assistant.submit()}
                onManual={openManual}
              />
            )}

            <p className="text-[11px] text-on-surface-faint leading-snug">{t('assistant.privacy_hint')}</p>
          </>
        )}
      </div>
    </BottomSheet>

    {/* B5/DL-5 parity: after an AI split, the same "send their link / remind"
        nudge QuickAdd shows. Rendered as a SIBLING (not nested) so it opens
        cleanly once the assistant sheet has closed on `done`. */}
    <SplitShareNudgeSheet
      open={assistant.splitNudge !== null}
      participants={assistant.splitNudge?.targets ?? []}
      amountByParticipantId={assistant.splitNudge?.amountByParticipantId}
      currency={trip?.baseCurrency}
      tripName={trip?.name}
      onClose={assistant.dismissNudge}
    />
    </>
  );
}

function InputArea(props: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  disabled: boolean;
  listening: boolean;
  voiceAvailable: boolean;
  photoEnabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onToggleVoice: () => void;
  onPickPhoto: (file: File) => void;
}) {
  const { t } = useTranslation();
  // FB-09 (DEC-258) + CC-IMG: the camera lives beside the mic — same take-photo/
  // gallery chooser used everywhere, only shown when cloud OCR is opted-in.
  const photoChooser = useImageSourceChooser(props.onPickPhoto);
  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={props.inputRef}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            props.onSubmit();
          }
        }}
        rows={2}
        placeholder={t('assistant.placeholder')}
        className="w-full resize-none rounded-2xl px-4 py-3 text-[15px] text-on-surface outline-none"
        style={{ background: 'var(--surface-high)', border: '1px solid var(--border-subtle)' }}
      />
      <div className="flex items-center gap-2">
        {props.voiceAvailable && (
          <button
            onClick={props.onToggleVoice}
            className="btn-press w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: props.listening ? '#C75B3922' : 'var(--surface-high)',
              border: `1px solid ${props.listening ? '#C75B3940' : 'var(--border-subtle)'}`,
            }}
            aria-label={t('assistant.voice')}
          >
            <Icon
              name={props.listening ? 'graphic_eq' : 'mic'}
              size={22}
              className={props.listening ? 'text-primary animate-pulse' : 'text-on-surface-dim'}
            />
          </button>
        )}
        {props.photoEnabled && (
          <button
            onClick={() => photoChooser.open()}
            disabled={props.disabled}
            className="btn-press w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 disabled:opacity-40"
            style={{ background: 'var(--surface-high)', border: '1px solid var(--border-subtle)' }}
            aria-label={t('assistant.photo')}
          >
            <Icon name="photo_camera" size={22} className="text-on-surface-dim" />
          </button>
        )}
        <button
          onClick={props.onSubmit}
          disabled={props.disabled || props.value.trim() === ''}
          className="btn-press flex-1 h-12 rounded-2xl flex items-center justify-center gap-2 font-bold text-[15px] disabled:opacity-40"
          style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
        >
          <Icon name="auto_awesome" size={18} />
          {t('assistant.send')}
        </button>
      </div>
      {photoChooser.element}
    </div>
  );
}

function StatusRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-1 py-2">
      <Icon name="progress_activity" size={20} className="text-primary animate-spin" />
      <span className="text-[14px] text-on-surface-dim font-semibold">{label}</span>
    </div>
  );
}

/**
 * DEC-246 — the "what can I ask?" helper. A collapsible catalogue of every
 * capability the router handles (quick spend → split → multi-event → wallets →
 * debts → navigation), each group expandable to localized example phrases.
 * Tapping an example pre-fills the box (and collapses the helper) so the user
 * sends or edits it — discoverability without a wall of text.
 */
function ExamplesHelper({ onPick }: { onPick: (example: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="btn-press rounded-2xl px-4 py-2.5 flex items-center gap-2.5 text-left"
        style={{ background: 'var(--surface-high)', border: '1px solid var(--border-subtle)' }}
      >
        <Icon name="lightbulb" size={17} className="text-primary shrink-0" />
        <span className="flex-1 text-[13.5px] font-semibold text-on-surface">{t('assistant.examples.cta')}</span>
        <Icon
          name="expand_more"
          size={18}
          className="text-on-surface-faint shrink-0 transition-transform"
          style={open ? { transform: 'rotate(180deg)' } : undefined}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[12px] text-on-surface-faint leading-snug px-1">{t('assistant.examples.subtitle')}</p>
          {ASSISTANT_EXAMPLE_GROUPS.map((group) => {
            const isOpen = openGroup === group.id;
            const raw = t(`assistant.examples.groups.${group.id}.items`, { returnObjects: true });
            const items = Array.isArray(raw) ? (raw as string[]) : [];
            return (
              <div
                key={group.id}
                className="rounded-2xl overflow-hidden"
                style={{ border: '1px solid var(--border-subtle)' }}
              >
                <button
                  type="button"
                  onClick={() => setOpenGroup(isOpen ? null : group.id)}
                  aria-expanded={isOpen}
                  className="btn-press w-full px-3.5 py-2.5 flex items-center gap-2.5 text-left"
                  style={{ background: 'var(--surface-high)' }}
                >
                  <Icon name={group.icon} size={16} className="text-on-surface-dim shrink-0" />
                  <span className="flex-1 text-[13px] font-semibold text-on-surface">
                    {t(`assistant.examples.groups.${group.id}.title`)}
                  </span>
                  <Icon
                    name="expand_more"
                    size={16}
                    className="text-on-surface-faint shrink-0 transition-transform"
                    style={isOpen ? { transform: 'rotate(180deg)' } : undefined}
                  />
                </button>
                {isOpen && (
                  <div className="flex flex-col">
                    {items.map((example, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          onPick(example);
                          setOpen(false);
                        }}
                        className="btn-press w-full px-3.5 py-2.5 flex items-start gap-2 text-left border-t"
                        style={{ background: 'var(--surface-container)', borderColor: 'var(--border-subtle)' }}
                      >
                        <Icon name="north_east" size={14} className="text-primary shrink-0 mt-0.5" />
                        <span className="text-[13px] text-on-surface-dim leading-snug">{example}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const PREVIEW_ICON: Record<string, string> = {
  expense: 'add_card',
  income: 'savings',
  transfer: 'swap_horiz',
  withdraw: 'local_atm',
  settle: 'handshake',
  plan_purchase: 'edit_calendar',
  navigate: 'arrow_forward',
};

function PreviewArea(props: {
  preview: AssistantPreview;
  draftOp: ExecOp | null;
  isForeign: boolean;
  fromPhoto: boolean;
  edit: EditContext;
  insights: ExpenseInsights | null;
  money: (cents?: number, currency?: string) => string;
  patchDraft: (patch: Partial<ExpenseOp>) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onFullEditor: () => void;
  onOpenItems: () => void;
  onManual: () => void;
}) {
  const { t } = useTranslation();
  const { preview, draftOp, isForeign, edit, insights } = props;
  const [showEdit, setShowEdit] = useState(false);

  const expenseOp = draftOp && draftOp.kind === 'expense' ? draftOp : null;
  const isNavigate = preview.op === 'navigate';

  // Show the fund only when there's a real choice (>1 pool — matches QuickAdd),
  // and the wallet only when tracking is on and one was resolved/picked. These
  // keep the "basic info a normal entry has" visible without opening the editor.
  const fundName =
    expenseOp && edit.selectablePools.length > 1
      ? (edit.selectablePools.find((p) => p.id === expenseOp.budgetPoolId)?.name ?? null)
      : null;
  const walletName =
    expenseOp && edit.walletTrackingActive && expenseOp.walletId
      ? (edit.wallets.find((w) => w.id === expenseOp.walletId)?.name ?? null)
      : null;

  // Live headline: reflect the in-sheet edits (amount, category, place, …) so the
  // summary the user confirms always matches the draft they just adjusted.
  const live: AssistantPreview = expenseOp
    ? {
        ...preview,
        amountCents: expenseOp.amountCents,
        currency: expenseOp.currency,
        categoryKey: expenseOp.category,
        description: expenseOp.description.trim() === '' ? undefined : expenseOp.description,
        placeLabel: expenseOp.place?.label ?? null,
        perPersonCents: preview.participantNames
          ? Math.round(expenseOp.amountCents / Math.max(1, expenseOp.participantIds.length))
          : preview.perPersonCents,
      }
    : preview;

  const headline = composePreview(live, t as never, props.money);
  const canEditInSheet = expenseOp !== null && !isForeign;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded-2xl p-4 flex items-start gap-3"
        style={{ background: 'var(--surface-high)', border: '1px solid var(--border-subtle)' }}
      >
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: '#6366F126' }}
        >
          <Icon name={PREVIEW_ICON[live.op] ?? 'auto_awesome'} size={22} className="text-[#818CF8]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-on-surface leading-snug">{headline}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {live.categoryKey && <Chip>{t(`categories.${live.categoryKey}`)}</Chip>}
            {live.placeLabel && <Chip>{live.placeLabel}</Chip>}
            {live.description && <Chip>{live.description}</Chip>}
            {fundName && (
              <Chip>
                <Icon name="savings" size={11} className="text-on-surface-faint" /> {fundName}
              </Chip>
            )}
            {walletName && (
              <Chip>
                <Icon name="account_balance_wallet" size={11} className="text-on-surface-faint" /> {walletName}
              </Chip>
            )}
          </div>
        </div>
      </div>

      {/* Intelligence parity (non-blocking): the same anomaly + budget hints a
          manual entry surfaces, so the AI flow never hides "is this normal / can
          I afford it?". */}
      {expenseOp && !isForeign && insights && <InsightNotice insights={insights} money={props.money} />}

      {/* A foreign-currency expense needs a rate the sheet doesn't handle — the
          confirm becomes "open full editor" so the budget math stays correct. */}
      {expenseOp && isForeign && (
        <div
          className="rounded-2xl p-3.5 flex items-start gap-2.5"
          style={{ background: '#C9A22715', border: '1px solid #C9A22733' }}
        >
          <Icon name="currency_exchange" size={20} className="text-warning shrink-0 mt-0.5" />
          <p className="text-[13px] text-on-surface font-semibold leading-snug">
            {t('assistant.foreign_currency_notice', { currency: expenseOp.currency })}
          </p>
        </div>
      )}

      {/* Progressive disclosure (mirrors QuickAdd): the AI pre-filled everything;
          the user only opens this to tweak what's wrong. */}
      {canEditInSheet && (
        <>
          <button
            type="button"
            onClick={() => setShowEdit((v) => !v)}
            aria-expanded={showEdit}
            className="btn-press rounded-2xl px-4 py-3 flex items-center gap-3 text-left"
            style={{ background: 'var(--surface-high)', border: '1px solid var(--border-subtle)' }}
          >
            <Icon name="tune" size={18} className="text-on-surface-dim shrink-0" />
            <span className="flex-1 text-[14px] font-semibold text-on-surface">
              {t('assistant.edit.toggle')}
            </span>
            <Icon
              name="expand_more"
              size={20}
              className="text-on-surface-faint shrink-0 transition-transform"
              style={showEdit ? { transform: 'rotate(180deg)' } : undefined}
            />
          </button>
          {showEdit && expenseOp && (
            <ExpenseEditor
              op={expenseOp}
              edit={props.edit}
              patchDraft={props.patchDraft}
              onAdjustSplit={props.onFullEditor}
            />
          )}
        </>
      )}

      {isForeign ? (
        <button
          onClick={props.onFullEditor}
          className="btn-press w-full h-12 rounded-2xl flex items-center justify-center gap-2 font-bold text-[15px]"
          style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
        >
          <Icon name="open_in_full" size={18} />
          {t('assistant.action.full_editor')}
        </button>
      ) : (
        <button
          onClick={props.onConfirm}
          className="btn-press w-full h-12 rounded-2xl flex items-center justify-center gap-2 font-bold text-[15px]"
          style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
        >
          <Icon name={isNavigate ? 'arrow_forward' : 'check'} size={18} />
          {t(isNavigate ? 'assistant.action.open' : 'assistant.action.confirm')}
        </button>
      )}

      {props.fromPhoto && expenseOp && (
        <button
          onClick={props.onOpenItems}
          className="btn-press w-full h-11 rounded-2xl flex items-center justify-center gap-2 font-semibold text-[14px] text-primary"
          style={{ background: 'var(--surface-high)' }}
        >
          <Icon name="receipt_long" size={17} />
          {t('assistant.action.open_items')}
        </button>
      )}

      <div className="flex items-center gap-2">
        {expenseOp && !isForeign ? (
          <button
            onClick={props.onFullEditor}
            className="btn-press flex-1 h-11 rounded-2xl font-semibold text-[14px] text-on-surface-dim"
            style={{ background: 'var(--surface-high)' }}
          >
            {t('assistant.action.full_editor')}
          </button>
        ) : (
          !expenseOp && (
            <button
              onClick={props.onManual}
              className="btn-press flex-1 h-11 rounded-2xl font-semibold text-[14px] text-on-surface-dim"
              style={{ background: 'var(--surface-high)' }}
            >
              {t('assistant.action.manual')}
            </button>
          )
        )}
        <button
          onClick={props.onCancel}
          className="btn-press flex-1 h-11 rounded-2xl font-semibold text-[14px] text-on-surface-dim"
          style={{ background: 'var(--surface-high)' }}
        >
          {t('assistant.action.edit')}
        </button>
      </div>
    </div>
  );
}

/** Reason copy for an event the batch can't auto-commit (DEC-246 multi). */
const BATCH_BLOCKED_KEY: Record<string, string> = {
  amount: 'assistant.batch.blocked_amount',
  foreign: 'assistant.batch.blocked_foreign',
  navigate: 'assistant.batch.blocked_navigate',
};

/**
 * DEC-246 (multi-action): the preview of a whole narrated message — a list of
 * the money events it found, each with its own headline (who paid / who owes
 * whom), the total it costs ME, and ONE "add everything" confirm. Events that
 * can't run unattended (missing amount, foreign currency) are listed apart so
 * nothing is silently dropped.
 */
function BatchPreviewArea(props: {
  view: AssistantBatchView;
  money: (cents?: number, currency?: string) => string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { view } = props;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between px-1">
        <p className="text-[15px] font-bold text-on-surface">
          {t('assistant.batch.title', { count: view.count })}
        </p>
        {view.ownerTotalCents > 0 && (
          <p className="text-[13px] font-semibold text-on-surface-dim">
            {t('assistant.batch.your_share', { amount: props.money(view.ownerTotalCents, view.currency) })}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {view.items.map((item, i) => (
          <div
            key={i}
            className="rounded-2xl p-3 flex items-start gap-3"
            style={{ background: 'var(--surface-high)', border: '1px solid var(--border-subtle)' }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: '#6366F126' }}
            >
              <Icon name={PREVIEW_ICON[item.op] ?? 'auto_awesome'} size={18} className="text-[#818CF8]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-on-surface leading-snug">
                {composePreview(item, t as never, props.money)}
              </p>
              {(item.categoryKey || item.placeLabel) && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {item.categoryKey && <Chip>{t(`categories.${item.categoryKey}`)}</Chip>}
                  {item.placeLabel && <Chip>{item.placeLabel}</Chip>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {view.blocked.length > 0 && (
        <div
          className="rounded-2xl p-3 flex flex-col gap-1.5"
          style={{ background: '#C9A22712', border: '1px solid #C9A22730' }}
        >
          <p className="text-[12px] font-bold text-warning">{t('assistant.batch.blocked_title')}</p>
          {view.blocked.map((b, i) => (
            <p key={i} className="text-[12px] text-on-surface-dim leading-snug">
              {b.preview ? `${composePreview(b.preview, t as never, props.money)} — ` : ''}
              {t(BATCH_BLOCKED_KEY[b.reasonKey] ?? 'assistant.batch.blocked_other')}
            </p>
          ))}
        </div>
      )}

      <button
        onClick={props.onConfirm}
        disabled={view.count === 0}
        className="btn-press w-full h-12 rounded-2xl flex items-center justify-center gap-2 font-bold text-[15px] disabled:opacity-40"
        style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
      >
        <Icon name="playlist_add_check" size={18} />
        {t('assistant.batch.confirm', { count: view.count })}
      </button>

      <button
        onClick={props.onCancel}
        className="btn-press w-full h-11 rounded-2xl font-semibold text-[14px] text-on-surface-dim"
        style={{ background: 'var(--surface-high)' }}
      >
        {t('assistant.action.edit')}
      </button>
    </div>
  );
}

function ExpenseEditor(props: {
  op: ExpenseOp;
  edit: EditContext;
  patchDraft: (patch: Partial<ExpenseOp>) => void;
  onAdjustSplit: () => void;
}) {
  const { t } = useTranslation();
  const { op, edit, patchDraft } = props;
  const [amountText, setAmountText] = useState(() => String(op.amountCents / 100));

  const onAmount = (value: string) => {
    setAmountText(value);
    const parsed = evaluateAmountExpression(value);
    if (parsed !== null && parsed > 0) patchDraft({ amountCents: toCents(parsed) });
  };

  const isSplit = op.didSplit || op.payerId !== op.ownerId;

  return (
    <div className="flex flex-col gap-3 max-h-[46vh] overflow-y-auto pr-0.5">
      <Field label={t('expenses.amount')}>
        <div className="flex items-baseline gap-1.5">
          <span className="text-on-surface-dim text-[13px]">{op.currency}</span>
          <input
            inputMode="decimal"
            value={amountText}
            onChange={(e) => onAmount(e.target.value)}
            className="bg-transparent text-[18px] font-bold text-on-surface tabular outline-none w-full"
          />
        </div>
      </Field>

      <Field label={t('expenses.category')}>
        <div className="grid grid-cols-5 gap-1.5">
          {EXPENSE_CATEGORY_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => patchDraft({ category: key })}
              className={`flex flex-col items-center gap-1 p-1.5 rounded-xl btn-press ${
                op.category === key ? 'ring-1 ring-primary' : ''
              }`}
              style={{ background: op.category === key ? '#C75B3920' : 'var(--surface-high)' }}
            >
              <Icon
                name={getCategoryIcon(key)}
                size={18}
                className={op.category === key ? 'text-primary' : 'text-on-surface-dim'}
              />
              <span className="w-full text-center text-[9px] leading-tight text-on-surface-faint break-words hyphens-auto line-clamp-2">
                {t(`categories.${key}` as never)}
              </span>
            </button>
          ))}
        </div>
      </Field>

      <Field label={t('expenses.description')}>
        <input
          type="text"
          value={op.description}
          onChange={(e) => patchDraft({ description: e.target.value })}
          placeholder={t(`categories.${op.category}` as never)}
          className="bg-transparent text-[14px] text-on-surface outline-none w-full"
        />
      </Field>

      <Field label={t('expenses.date_time')}>
        <input
          type="datetime-local"
          value={isoToDatetimeLocal(op.date)}
          onChange={(e) =>
            patchDraft({ date: e.target.value ? toSafeIsoDate(e.target.value) : undefined })
          }
          aria-label={t('expenses.date_time')}
          className="bg-transparent text-[14px] text-on-surface outline-none w-full"
        />
      </Field>

      {edit.locationEnabled && (
        <PlaceField
          value={op.place}
          onChange={(place) => patchDraft({ place })}
          category={op.category}
          transactions={edit.transactions}
          autoCapture={false}
          locationFeaturesEnabled
          rememberedPlace={edit.rememberedPlace}
        />
      )}

      {edit.selectablePools.length > 1 && (
        <Field label={t('expenses.fund')}>
          <ChipPicker
            items={edit.selectablePools.map((p) => ({ id: p.id, label: p.name }))}
            selectedId={op.budgetPoolId}
            onSelect={(id) => patchDraft({ budgetPoolId: id })}
          />
        </Field>
      )}

      {edit.walletTrackingActive && (
        <Field label={t('expenses.wallet')}>
          <ChipPicker
            items={[
              { id: WALLET_NONE, label: t('expenses.wallet_not_set') },
              ...edit.wallets.map((w) => ({ id: w.id, label: w.name })),
            ]}
            selectedId={op.walletId ?? WALLET_NONE}
            onSelect={(id) => patchDraft({ walletId: id === WALLET_NONE ? null : id })}
          />
        </Field>
      )}

      {isSplit && (
        <Field label={t('assistant.edit.split')}>
          <button
            onClick={props.onAdjustSplit}
            className="btn-press w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2"
            style={{ background: 'var(--surface-high)' }}
          >
            <span className="text-[13px] text-on-surface-dim">{t('assistant.edit.adjust_split')}</span>
            <Icon name="open_in_full" size={14} className="text-on-surface-faint" />
          </button>
        </Field>
      )}
    </div>
  );
}

const WALLET_NONE = '__none__';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-3"
      style={{ background: 'var(--surface-high)', border: '1px solid var(--border-subtle)' }}
    >
      <label className="text-[11px] text-on-surface-faint mb-1.5 block font-semibold">{label}</label>
      {children}
    </div>
  );
}

function ChipPicker(props: {
  items: { id: string; label: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {props.items.map((item) => {
        const selected = item.id === props.selectedId;
        return (
          <button
            key={item.id}
            onClick={() => props.onSelect(item.id)}
            className="btn-press px-3 py-1.5 rounded-lg text-[12px] font-medium"
            style={{
              background: selected ? 'var(--primary)' : 'var(--surface-container)',
              color: selected ? 'var(--on-primary)' : 'var(--on-surface-dim)',
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function ClarifyArea(props: {
  note: string | null;
  clarification: NonNullable<ReturnType<typeof useAssistant>['clarification']>;
  onAmount: (value: string) => void;
  onAddPerson: () => void;
  onAddPeople: () => void;
  onChoosePerson: (id: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { clarification } = props;

  return (
    <div className="flex flex-col gap-3">
      {props.note && <p className="text-[14px] text-on-surface font-semibold leading-snug">{props.note}</p>}

      {clarification.type === 'amount' && <AmountClarify onSubmit={props.onAmount} />}

      {clarification.type === 'add_people' && (
        <div className="flex flex-col gap-2">
          <p className="text-[15px] text-on-surface font-semibold">
            {t('assistant.clarify.add_people', { names: clarification.names.join(', ') })}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={props.onAddPeople}
              className="btn-press flex-1 h-11 rounded-2xl font-bold text-[14px]"
              style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
            >
              {t('assistant.clarify.add_people_yes')}
            </button>
            <button
              onClick={props.onCancel}
              className="btn-press flex-1 h-11 rounded-2xl font-semibold text-[14px] text-on-surface-dim"
              style={{ background: 'var(--surface-high)' }}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {clarification.type === 'add_person' && clarification.name !== '' && (
        <div className="flex flex-col gap-2">
          <p className="text-[15px] text-on-surface font-semibold">
            {t('assistant.clarify.add_person', { name: clarification.name })}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={props.onAddPerson}
              className="btn-press flex-1 h-11 rounded-2xl font-bold text-[14px]"
              style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
            >
              {t('assistant.clarify.add_yes', { name: clarification.name })}
            </button>
            <button
              onClick={props.onCancel}
              className="btn-press flex-1 h-11 rounded-2xl font-semibold text-[14px] text-on-surface-dim"
              style={{ background: 'var(--surface-high)' }}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {clarification.type === 'add_person' && clarification.name === '' && (
        <div className="flex flex-col gap-2">
          <p className="text-[15px] text-on-surface font-semibold">{t('assistant.clarify.need_people')}</p>
          <button
            onClick={props.onCancel}
            className="btn-press h-11 rounded-2xl font-semibold text-[14px] text-on-surface-dim"
            style={{ background: 'var(--surface-high)' }}
          >
            {t('common.cancel')}
          </button>
        </div>
      )}

      {clarification.type === 'choose_person' && (
        <div className="flex flex-col gap-2">
          <p className="text-[15px] text-on-surface font-semibold">
            {t('assistant.clarify.choose_person', { name: clarification.name })}
          </p>
          <div className="flex flex-col gap-1.5">
            {clarification.candidates.map((candidate) => (
              <button
                key={candidate.id}
                onClick={() => props.onChoosePerson(candidate.id)}
                className="btn-press h-11 rounded-2xl px-4 text-left font-semibold text-[14px] text-on-surface"
                style={{ background: 'var(--surface-high)' }}
              >
                {candidate.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AmountClarify({ onSubmit }: { onSubmit: (value: string) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[15px] text-on-surface font-semibold">{t('assistant.clarify.amount')}</p>
      <div className="flex items-center gap-2">
        <input
          inputMode="decimal"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit(draft);
          }}
          placeholder={t('assistant.clarify.amount_placeholder')}
          className="flex-1 h-11 rounded-2xl px-4 text-[15px] text-on-surface outline-none"
          style={{ background: 'var(--surface-high)', border: '1px solid var(--border-subtle)' }}
        />
        <button
          onClick={() => onSubmit(draft)}
          disabled={draft.trim() === ''}
          className="btn-press h-11 px-5 rounded-2xl font-bold text-[14px] disabled:opacity-40"
          style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
        >
          {t('common.confirm')}
        </button>
      </div>
    </div>
  );
}

function ErrorArea(props: { messageKey: string; cooldownSec: number; onRetry: () => void; onManual: () => void }) {
  const { t } = useTranslation();
  const transient = props.messageKey.startsWith('error.') &&
    ['error.offline', 'error.rate_limited', 'error.failed'].includes(props.messageKey);
  // FB-26: while a minute-scope cooldown ticks, show an honest countdown and
  // hold the retry disabled until it hits 0. A day-scope outage shows no fake
  // timer — only the manual door. Either way the user is never stuck.
  const cooling = props.cooldownSec > 0;
  const message =
    props.messageKey === 'error.rate_limited' && cooling
      ? t('assistant.error.rate_limited_wait', { seconds: props.cooldownSec })
      : t(`assistant.${props.messageKey}`);
  const showRetry = transient && props.messageKey !== 'error.ai_unavailable_day';
  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded-2xl p-3.5 flex items-start gap-2.5"
        style={{ background: '#D9404015', border: '1px solid #D9404033' }}
      >
        <Icon name="error" size={20} className="text-error shrink-0 mt-0.5" />
        <p className="text-[14px] text-on-surface font-semibold leading-snug">{message}</p>
      </div>
      <div className="flex items-center gap-2">
        {showRetry && (
          <button
            onClick={props.onRetry}
            disabled={cooling}
            className="btn-press flex-1 h-11 rounded-2xl font-bold text-[14px] disabled:opacity-40"
            style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
          >
            {cooling ? t('assistant.error.retry_in', { seconds: props.cooldownSec }) : t('assistant.action.retry')}
          </button>
        )}
        <button
          onClick={props.onManual}
          className="btn-press flex-1 h-11 rounded-2xl font-semibold text-[14px] text-on-surface-dim"
          style={{ background: 'var(--surface-high)' }}
        >
          {t('assistant.action.manual')}
        </button>
      </div>
    </div>
  );
}

function DisabledNotice(props: { onManual: () => void; onSettings: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] text-on-surface-dim leading-snug">{t('assistant.disabled_notice')}</p>
      <div className="flex items-center gap-2">
        <button
          onClick={props.onSettings}
          className="btn-press flex-1 h-11 rounded-2xl font-bold text-[14px]"
          style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
        >
          {t('assistant.action.enable')}
        </button>
        <button
          onClick={props.onManual}
          className="btn-press flex-1 h-11 rounded-2xl font-semibold text-[14px] text-on-surface-dim"
          style={{ background: 'var(--surface-high)' }}
        >
          {t('assistant.action.manual')}
        </button>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-on-surface-dim px-2 py-0.5 rounded-lg"
      style={{ background: 'var(--surface-container)' }}
    >
      {children}
    </span>
  );
}

/**
 * Non-blocking budget/anomaly hints for the previewed expense — the AI-flow
 * mirror of QuickAdd's M5 anomaly + R3-J "after this you'll have X left". Purely
 * informational (the confirm stays one tap); it just makes sure the AI entry is
 * as transparent as a manual one.
 */
function InsightNotice({
  insights,
  money,
}: {
  insights: ExpenseInsights;
  money: (cents?: number, currency?: string) => string;
}) {
  const { t } = useTranslation();
  const rows: { tone: 'warning' | 'error' | 'muted'; icon: string; text: string }[] = [];

  if (insights.anomaly && insights.typicalCents > 0) {
    rows.push({
      tone: 'warning',
      icon: 'trending_up',
      text: t('assistant.insight.anomaly', { typical: money(insights.typicalCents) }),
    });
  }
  if (insights.over && insights.afterCents !== null) {
    rows.push({
      tone: 'error',
      icon: 'warning',
      text: t('assistant.insight.over_budget', {
        amount: money(Math.abs(insights.afterCents)),
        fund: insights.poolName ?? '',
      }),
    });
  } else if (insights.afterCents !== null && insights.poolName) {
    rows.push({
      tone: 'muted',
      icon: 'account_balance_wallet',
      text: t('assistant.insight.after_left', {
        amount: money(insights.afterCents),
        fund: insights.poolName,
      }),
    });
  }

  if (rows.length === 0) return null;

  const TONE: Record<string, { color: string; className: string }> = {
    warning: { color: '#C9A227', className: 'text-warning' },
    error: { color: '#D94040', className: 'text-error' },
    muted: { color: 'var(--on-surface-faint)', className: 'text-on-surface-dim' },
  };

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row, i) => {
        const tone = TONE[row.tone]!;
        return (
          <div key={i} className="flex items-start gap-2 px-1">
            <Icon name={row.icon} size={15} className={`${tone.className} shrink-0 mt-0.5`} />
            <p className={`text-[12px] font-semibold leading-snug ${tone.className}`}>{row.text}</p>
          </div>
        );
      })}
    </div>
  );
}
