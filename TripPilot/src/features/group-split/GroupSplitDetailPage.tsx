import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { groupSplitRepository } from '@/data/repositories';
import { persistGroupSplit, deleteGroupSplit } from '@/domain/orchestrators';
import {
  addExpense,
  addParticipant,
  canRemoveParticipant,
  computeGroupBalances,
  computeGroupTransfers,
  createGroupParticipant,
  groupTotalCents,
  removeExpense,
  removeParticipant,
  setGroupStatus,
  updateExpense,
} from '@/domain/group-split';
import { formatMoney } from '@/domain/money';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';
import { GroupExpenseEditor } from './GroupExpenseEditor';
import type { GroupExpense, GroupSplitEvent } from '@/domain/group-split';

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
  const { settings } = useAppData();
  const photoEnabled = settings?.cloudReceiptOcrEnabled ?? false;
  const aiTextEnabled = settings?.aiQuickEntryEnabled ?? false;

  const [event, setEvent] = useState<GroupSplitEvent | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [newPerson, setNewPerson] = useState('');
  const [editing, setEditing] = useState<GroupExpense | 'new' | null>(null);

  useEffect(() => {
    if (!id) return;
    void groupSplitRepository.getEvent(id).then((e) => {
      setEvent(e ?? null);
      setLoaded(true);
    });
  }, [id]);

  const save = async (next: GroupSplitEvent) => {
    setEvent(next);
    await persistGroupSplit(next);
  };

  const balances = useMemo(() => (event ? computeGroupBalances(event) : []), [event]);
  const transfers = useMemo(() => (event ? computeGroupTransfers(event) : []), [event]);
  const total = event ? groupTotalCents(event) : 0;

  if (loaded && event === null) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <Icon name="group_off" size={32} className="text-on-surface-faint" />
        <p className="text-sm text-on-surface-dim">{t('group_split.not_found')}</p>
        <button onClick={() => navigate('/groups')} className="text-sm text-primary font-semibold btn-press">
          {t('group_split.back_to_list')}
        </button>
      </div>
    );
  }
  if (event === null) return null;

  const nameById = new Map(event.participants.map((p) => [p.id, p.name]));

  const handleAddPerson = () => {
    const trimmed = newPerson.trim();
    if (trimmed.length === 0) return;
    void save(addParticipant(event, createGroupParticipant({ name: trimmed })));
    setNewPerson('');
  };

  const handleRemovePerson = (participantId: string) => {
    if (!canRemoveParticipant(event, participantId)) {
      showToast(t('group_split.person_in_use'), 'danger');
      return;
    }
    void save(removeParticipant(event, participantId));
  };

  const handleSaveExpense = (expense: GroupExpense) => {
    const exists = event.expenses.some((e) => e.id === expense.id);
    void save(exists ? updateExpense(event, expense) : addExpense(event, expense));
    setEditing(null);
  };

  const handleDeleteExpense = (expenseId: string) => {
    void save(removeExpense(event, expenseId));
    setEditing(null);
  };

  const handleToggleSettled = () => {
    void save(setGroupStatus(event, event.status === 'settled' ? 'open' : 'settled'));
  };

  const handleDeleteEvent = async () => {
    await deleteGroupSplit(event.id);
    showToast(t('group_split.deleted'), 'success');
    navigate('/groups');
  };

  return (
    <div className="flex flex-col gap-4 py-6">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/groups')} className="btn-press p-1" aria-label={t('common.back')}>
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

      {/* Balances + transfers — only meaningful once there is money in. */}
      {event.expenses.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-on-surface px-1">{t('group_split.balances_title')}</h2>
          <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-2.5">
            {balances.map((b) => (
              <div key={b.participantId} className="flex items-center justify-between">
                <span className="text-sm text-on-surface truncate">{b.name}</span>
                <span
                  className={`text-sm font-semibold tabular ${
                    b.netCents > 0 ? 'text-success' : b.netCents < 0 ? 'text-on-surface' : 'text-on-surface-faint'
                  }`}
                >
                  {b.netCents > 0
                    ? t('group_split.gets_back', { amount: formatMoney(b.netCents, event.currency) })
                    : b.netCents < 0
                      ? t('group_split.owes', { amount: formatMoney(-b.netCents, event.currency) })
                      : t('group_split.even')}
                </span>
              </div>
            ))}
          </div>

          {transfers.length > 0 && (
            <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-2">
              <h3 className="text-[11px] font-semibold text-on-surface-faint uppercase tracking-wide">
                {t('group_split.transfers_title')}
              </h3>
              {transfers.map((tr, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-on-surface">
                  <span className="font-medium truncate">{tr.fromName}</span>
                  <Icon name="arrow_forward" size={16} className="text-on-surface-faint shrink-0" />
                  <span className="font-medium truncate">{tr.toName}</span>
                  <span className="ml-auto font-bold tabular shrink-0">{formatMoney(tr.amountCents, event.currency)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Expenses */}
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
          <div className="flex flex-col gap-2">
            {event.expenses.map((exp) => (
              <button
                key={exp.id}
                onClick={() => setEditing(exp)}
                className="bg-surface-container rounded-xl p-3.5 flex items-center gap-3 text-left btn-press"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-on-surface truncate">{exp.description}</p>
                  <p className="text-[11px] text-on-surface-faint">
                    {t('group_split.paid_by', { name: nameById.get(exp.paidByParticipantId) ?? '?' })}
                    {' · '}
                    {exp.splitMode === 'equal'
                      ? t('group_split.split_equal_n', { count: exp.participantIds.length })
                      : t('group_split.split_custom_n', { count: exp.participantIds.length })}
                  </p>
                </div>
                <span className="text-sm font-bold tabular text-on-surface shrink-0">
                  {formatMoney(exp.amountCents, event.currency)}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* People */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-on-surface px-1">{t('group_split.people_title')}</h2>
        <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-2.5">
          {event.participants.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-surface-high flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-on-surface-dim">{p.name.slice(0, 1).toUpperCase()}</span>
              </div>
              <span className="text-sm text-on-surface flex-1 truncate">{p.name}</span>
              {p.id === event.ownerParticipantId ? (
                <span className="text-[10px] text-on-surface-faint">{t('group_split.owner_tag')}</span>
              ) : (
                <button
                  onClick={() => handleRemovePerson(p.id)}
                  className="btn-press p-1"
                  aria-label={t('group_split.remove_person')}
                >
                  <Icon name="close" size={16} className="text-on-surface-faint" />
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <input
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
        </div>
      </section>

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
    </div>
  );
}
