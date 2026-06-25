import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';
import { formatMoney, toCents, fromCents } from '@/domain/money';
import { buildGroupExpense, expenseShares, validateGroupExpense } from '@/domain/group-split';
import type { AddGroupExpenseInput, GroupExpense, GroupSplitEvent, GroupSplitMode } from '@/domain/group-split';

interface Props {
  event: GroupSplitEvent;
  /** null = a brand-new expense; otherwise the expense being edited. */
  expense: GroupExpense | null;
  onClose: () => void;
  onSave: (expense: GroupExpense) => void;
  onDelete: (expenseId: string) => void;
}

const moneyStr = (cents: number) => (cents === 0 ? '' : String(fromCents(cents)));

/**
 * C23 / DEC-297 — the add/edit-expense sheet for a group split: description,
 * amount, who paid, who shares, and the split mode (equal now; custom per-person
 * in the same form — m2 + m4). Validation + math come from the pure domain.
 */
export function GroupExpenseEditor({ event, expense, onClose, onSave, onDelete }: Props) {
  const { t } = useTranslation();
  const isEdit = expense !== null;

  const [description, setDescription] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(expense ? moneyStr(expense.amountCents) : '');
  const [paidById, setPaidById] = useState(expense?.paidByParticipantId ?? event.ownerParticipantId);
  const [mode, setMode] = useState<GroupSplitMode>(expense?.splitMode ?? 'equal');
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

  const amountCents = toCents(parseFloat(amount) || 0);
  const orderedShareIds = event.participants.map((p) => p.id).filter((id) => shareIds.has(id));

  const buildInput = (): AddGroupExpenseInput => ({
    description,
    amountCents,
    paidByParticipantId: paidById,
    splitMode: mode,
    participantIds: orderedShareIds,
    customAmountsCents:
      mode === 'custom'
        ? Object.fromEntries(orderedShareIds.map((id) => [id, toCents(parseFloat(customById[id] ?? '') || 0)]))
        : {},
  });

  // Live preview of the per-person split so the math is visible before saving.
  const preview = useMemo(() => {
    if (amountCents <= 0 || orderedShareIds.length === 0) return null;
    const probe = buildGroupExpense(buildInput());
    return expenseShares(probe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, mode, JSON.stringify(orderedShareIds), JSON.stringify(customById), paidById]);

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
    const finalExpense: GroupExpense = expense
      ? { ...built, id: expense.id, createdAt: expense.createdAt, source: expense.source }
      : built;
    onSave(finalExpense);
  };

  return (
    <BottomSheet open onClose={onClose} title={isEdit ? t('group_split.edit_expense') : t('group_split.add_expense')}>
      <div className="flex flex-col gap-3 pt-2">
        <Labeled label={t('group_split.expense_description')}>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('group_split.expense_description_ph')}
            autoFocus
            className="bg-transparent text-sm text-on-surface outline-none w-full"
          />
        </Labeled>

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

        <div>
          <p className="text-xs text-on-surface-faint mb-1.5">{t('group_split.paid_by_label')}</p>
          <div className="flex flex-wrap gap-2">
            {event.participants.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPaidById(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
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
                    <span className="text-sm text-on-surface truncate">{p.name}</span>
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
