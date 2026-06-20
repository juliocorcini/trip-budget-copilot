import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { useAppData } from '@/hooks/useAppData';
import { formatMoney } from '@/domain/money';
import { subscribeAssistantOpen } from './assistant-bus';
import { useAssistant } from './useAssistant';
import type { AssistantPreview } from '@/domain/assistant';

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
  const { trip } = useAppData();
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

  const openManual = () => {
    setOpen(false);
    navigate('/quick-add');
  };

  const baseCurrency = trip?.baseCurrency ?? 'EUR';
  const money = (cents?: number, currency?: string) =>
    formatMoney(cents ?? 0, currency ?? baseCurrency);

  const busy = assistant.phase === 'thinking' || assistant.phase === 'transcribing' || assistant.phase === 'saving';

  return (
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
                onChange={assistant.setText}
                onSubmit={() => void assistant.submit()}
                onToggleVoice={() => void assistant.toggleVoice()}
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
                onChoosePerson={assistant.choosePerson}
                onCancel={assistant.cancelClarification}
              />
            )}

            {assistant.phase === 'preview' && assistant.preview && (
              <PreviewArea
                preview={assistant.preview}
                money={money}
                onConfirm={() => void assistant.confirm()}
                onCancel={assistant.cancelClarification}
                onManual={openManual}
              />
            )}

            {assistant.phase === 'saving' && <StatusRow label={t('assistant.saving')} />}

            {assistant.phase === 'error' && assistant.errorKey && (
              <ErrorArea
                messageKey={assistant.errorKey}
                onRetry={() => void assistant.submit()}
                onManual={openManual}
              />
            )}

            <p className="text-[11px] text-on-surface-faint leading-snug">{t('assistant.privacy_hint')}</p>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

function InputArea(props: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  disabled: boolean;
  listening: boolean;
  voiceAvailable: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onToggleVoice: () => void;
}) {
  const { t } = useTranslation();
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

function composePreview(preview: AssistantPreview, t: (key: string, opts?: Record<string, unknown>) => string, money: (c?: number, cur?: string) => string): string {
  const amount = money(preview.amountCents, preview.currency);
  if (preview.op === 'navigate') return t(`assistant.nav.${preview.navKey ?? 'open'}`);
  if (preview.op === 'expense') {
    if (preview.debtDirection === 'i_owe') return t('assistant.preview.someone_paid', { person: preview.personName, amount });
    if (preview.debtDirection === 'owes_me') return t('assistant.preview.i_paid_for', { person: preview.personName, amount });
    if (preview.participantNames && preview.participantNames.length > 0) {
      return t('assistant.preview.split', {
        amount,
        count: preview.participantNames.length,
        per: money(preview.perPersonCents, preview.currency),
      });
    }
    return t('assistant.preview.log_expense', { amount });
  }
  if (preview.op === 'income') return t('assistant.preview.income', { amount });
  if (preview.op === 'transfer') return t('assistant.preview.transfer', { amount, from: preview.walletFromName ?? '', to: preview.walletToName ?? '' });
  if (preview.op === 'withdraw') return t('assistant.preview.withdraw', { amount });
  if (preview.op === 'settle') {
    const value = preview.amountCents ? amount : t('assistant.preview.settle_full');
    return preview.debtDirection === 'owes_me'
      ? t('assistant.preview.settle_owes_me', { person: preview.personName, amount: value })
      : t('assistant.preview.settle_i_owe', { person: preview.personName, amount: value });
  }
  if (preview.op === 'plan_purchase') return t('assistant.preview.plan_purchase', { item: preview.itemName, amount });
  return amount;
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
  money: (cents?: number, currency?: string) => string;
  onConfirm: () => void;
  onCancel: () => void;
  onManual: () => void;
}) {
  const { t } = useTranslation();
  const { preview } = props;
  const isNavigate = preview.op === 'navigate';
  const headline = composePreview(preview, t as never, props.money);
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
          <Icon name={PREVIEW_ICON[preview.op] ?? 'auto_awesome'} size={22} className="text-[#818CF8]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-on-surface leading-snug">{headline}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {preview.categoryKey && <Chip>{t(`categories.${preview.categoryKey}`)}</Chip>}
            {preview.placeLabel && <Chip>{preview.placeLabel}</Chip>}
            {preview.description && <Chip>{preview.description}</Chip>}
          </div>
        </div>
      </div>

      <button
        onClick={props.onConfirm}
        className="btn-press w-full h-12 rounded-2xl flex items-center justify-center gap-2 font-bold text-[15px]"
        style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
      >
        <Icon name={isNavigate ? 'arrow_forward' : 'check'} size={18} />
        {t(isNavigate ? 'assistant.action.open' : 'assistant.action.confirm')}
      </button>
      <div className="flex items-center gap-2">
        <button
          onClick={props.onManual}
          className="btn-press flex-1 h-11 rounded-2xl font-semibold text-[14px] text-on-surface-dim"
          style={{ background: 'var(--surface-high)' }}
        >
          {t('assistant.action.manual')}
        </button>
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

function ClarifyArea(props: {
  note: string | null;
  clarification: NonNullable<ReturnType<typeof useAssistant>['clarification']>;
  onAmount: (value: string) => void;
  onAddPerson: () => void;
  onChoosePerson: (id: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { clarification } = props;

  return (
    <div className="flex flex-col gap-3">
      {props.note && <p className="text-[14px] text-on-surface font-semibold leading-snug">{props.note}</p>}

      {clarification.type === 'amount' && <AmountClarify onSubmit={props.onAmount} />}

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

function ErrorArea(props: { messageKey: string; onRetry: () => void; onManual: () => void }) {
  const { t } = useTranslation();
  const transient = props.messageKey.startsWith('error.') &&
    ['error.offline', 'error.rate_limited', 'error.failed'].includes(props.messageKey);
  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded-2xl p-3.5 flex items-start gap-2.5"
        style={{ background: '#D9404015', border: '1px solid #D9404033' }}
      >
        <Icon name="error" size={20} className="text-error shrink-0 mt-0.5" />
        <p className="text-[14px] text-on-surface font-semibold leading-snug">{t(`assistant.${props.messageKey}`)}</p>
      </div>
      <div className="flex items-center gap-2">
        {transient && (
          <button
            onClick={props.onRetry}
            className="btn-press flex-1 h-11 rounded-2xl font-bold text-[14px]"
            style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
          >
            {t('assistant.action.retry')}
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
      className="text-[11px] font-semibold text-on-surface-dim px-2 py-0.5 rounded-lg"
      style={{ background: 'var(--surface-container)' }}
    >
      {children}
    </span>
  );
}
