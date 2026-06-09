import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppData } from '@/hooks/useAppData';
import { calculateDebts } from '@/domain/splitting';
import type { DebtSummary } from '@/domain/splitting';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { Settlement } from '@/domain/types/settlement';
import { formatMoney } from '@/domain/money';
import { participantShareRepository } from '@/data/repositories/participant-share-repository';
import { settlementRepository } from '@/data/repositories/settlement-repository';
import { createSettlement } from '@/domain/splitting';
import { Icon } from '@/components/Icon';

export function SharedExpensesPage() {
  const { t } = useTranslation();
  const { trip, transactions, participants, reload } = useAppData();
  const [, setShares] = useState<ParticipantShare[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [debtSummary, setDebtSummary] = useState<DebtSummary | null>(null);

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

  if (!trip) return null;

  return (
    <div className="flex flex-col gap-4 pb-4 pt-2">
      <h1 className="text-heading font-bold text-on-surface">
        {t('more.participants')}
      </h1>

      <div>
        <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
          {t('more.participants')}
        </p>
        {participants.map((p) => (
          <div key={p.id} className="bg-surface-container rounded-xl px-4 py-3 mb-1 flex items-center gap-3">
            <Icon name="person" size={20} className="text-on-surface-dim" />
            <div>
              <p className="text-sm text-on-surface">{p.name}</p>
              {p.isOwner && <p className="text-xs text-primary">Eu</p>}
            </div>
          </div>
        ))}
      </div>

      {debtSummary && debtSummary.debts.length > 0 && (
        <div>
          <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
            Dívidas pendentes
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
                  Liquidar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {debtSummary && debtSummary.debts.length === 0 && (
        <div className="bg-surface-container rounded-xl p-6 text-center">
          <Icon name="handshake" size={32} className="text-success mx-auto mb-2" />
          <p className="text-sm text-on-surface-dim">Tudo acertado! Sem dívidas pendentes.</p>
        </div>
      )}

      {settlements.length > 0 && (
        <div>
          <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
            Liquidações realizadas
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
