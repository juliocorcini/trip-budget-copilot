import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppData } from '@/hooks/useAppData';
import {
  calculateDebts,
  createSettlement,
  createParticipant,
  calculateParticipantBalances,
} from '@/domain/splitting';
import type { DebtSummary } from '@/domain/splitting';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { Settlement } from '@/domain/types/settlement';
import { formatMoney } from '@/domain/money';
import { participantShareRepository } from '@/data/repositories/participant-share-repository';
import { settlementRepository } from '@/data/repositories/settlement-repository';
import { participantRepository } from '@/data/repositories';
import { Icon } from '@/components/Icon';

export function SharedExpensesPage() {
  const { t } = useTranslation();
  const { trip, transactions, participants, reload } = useAppData();
  const [, setShares] = useState<ParticipantShare[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [debtSummary, setDebtSummary] = useState<DebtSummary | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!trip) return;
    const load = async () => {
      const txIds = transactions.filter((tx) => tx.isShared).map((tx) => tx.id);
      const [sh, se] = await Promise.all([
        participantShareRepository.getAllForTrip(txIds),
        settlementRepository.getByTripId(trip.id),
      ]);
      setShares(sh);
      setSettlements(se);

      const owner = participants.find((p) => p.isOwner);
      if (owner) {
        const summary = calculateDebts(transactions, sh, participants, se, owner.id);
        setDebtSummary(summary);
      }
    };
    load();
  }, [trip, transactions, participants]);

  const handleSettle = async (debtorId: string, creditorId: string, amountCents: number) => {
    if (!trip) return;
    const settlement = createSettlement(trip.id, debtorId, creditorId, amountCents, trip.baseCurrency);
    await settlementRepository.create(settlement);
    await reload();
  };

  const handleAddParticipant = async () => {
    if (!trip || !newName.trim()) return;
    setSaving(true);
    try {
      const participant = createParticipant(
        trip.id,
        newName.trim(),
        newNickname.trim() || null,
      );
      await participantRepository.create(participant);
      await reload();
      setNewName('');
      setNewNickname('');
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  if (!trip) return null;

  const balances = debtSummary ? calculateParticipantBalances(debtSummary.debts) : new Map<string, number>();

  return (
    <div className="flex flex-col gap-4 pb-4 pt-2">
      <h1 className="text-heading font-bold text-on-surface">
        {t('more.participants')}
      </h1>

      <div>
        <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
          {t('more.participants')}
        </p>
        {participants.map((p) => {
          const balance = balances.get(p.id) ?? 0;
          return (
            <div key={p.id} className="bg-surface-container rounded-xl px-4 py-3 mb-1 flex items-center gap-3">
              <Icon name="person" size={20} className="text-on-surface-dim" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-on-surface truncate">
                  {p.name}
                  {p.nickname && (
                    <span className="text-on-surface-faint"> · {p.nickname}</span>
                  )}
                </p>
                {p.isOwner && <p className="text-xs text-primary">{t('shared.owner_tag')}</p>}
              </div>
              <p
                className={`text-xs font-semibold tabular shrink-0 ${
                  balance < 0 ? 'text-error' : balance > 0 ? 'text-success' : 'text-on-surface-faint'
                }`}
              >
                {balance < 0
                  ? t('shared.balance_owes', { amount: formatMoney(Math.abs(balance), trip.baseCurrency) })
                  : balance > 0
                    ? t('shared.balance_owed', { amount: formatMoney(balance, trip.baseCurrency) })
                    : t('shared.balance_zero')}
              </p>
            </div>
          );
        })}

        {showForm ? (
          <div className="bg-surface-container rounded-xl p-4 mt-2 flex flex-col gap-3">
            <div>
              <label className="text-xs text-on-surface-faint mb-1 block">
                {t('shared.participant_name')}
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-on-surface-faint mb-1 block">
                {t('shared.participant_nickname')}
              </label>
              <input
                type="text"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAddParticipant}
                disabled={!newName.trim() || saving}
                className="flex-1 py-2.5 rounded-xl bg-primary text-on-surface font-medium text-sm btn-press disabled:opacity-40"
              >
                {saving ? t('common.loading') : t('common.add')}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-3 mt-2 rounded-xl flex items-center justify-center gap-2 btn-press font-semibold text-sm"
            style={{ background: '#C75B3918', color: 'var(--primary)', border: '1px dashed #C75B3940' }}
          >
            <Icon name="person_add" size={18} className="text-primary" />
            {t('shared.add_participant')}
          </button>
        )}
      </div>

      {debtSummary && debtSummary.debts.length > 0 && (
        <div>
          <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
            {t('shared.pending_debts')}
          </p>
          {debtSummary.debts.map((debt, i) => (
            <div key={i} className="bg-surface-container rounded-xl p-4 mb-2">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm text-on-surface">
                    {debt.debtorName} → {debt.creditorName}
                  </p>
                  <p className="text-xs text-on-surface-faint">
                    {formatMoney(debt.amountCents, trip.baseCurrency)}
                  </p>
                </div>
                <button
                  onClick={() => handleSettle(debt.debtorId, debt.creditorId, debt.amountCents)}
                  className="px-3 py-1.5 rounded-lg bg-success/20 text-success text-xs font-medium btn-press"
                >
                  {t('shared.settle')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {debtSummary && debtSummary.debts.length === 0 && (
        <div className="bg-surface-container rounded-xl p-6 text-center">
          <Icon name="handshake" size={32} className="text-success mx-auto mb-2" />
          <p className="text-sm text-on-surface-dim">{t('shared.all_settled')}</p>
        </div>
      )}

      {settlements.length > 0 && (
        <div>
          <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
            {t('shared.settlements_done')}
          </p>
          {settlements.map((s) => (
            <div key={s.id} className="bg-surface-container rounded-xl px-4 py-3 mb-1 flex items-center justify-between">
              <p className="text-sm text-on-surface">
                {participants.find((p) => p.id === s.debtorParticipantId)?.name} → {participants.find((p) => p.id === s.creditorParticipantId)?.name}
              </p>
              <p className="text-sm font-semibold tabular text-success">
                {formatMoney(s.amountCents, s.currency)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
