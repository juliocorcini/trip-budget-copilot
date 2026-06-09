import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { createSession, createSessionItem, calculateSessionTotal, getSessionPercentUsed, getProgressiveAlerts, calculateNextDrinkImpact, endSession as endSessionDomain } from '@/domain/outing';
import { createExpenseTransaction } from '@/domain/transactions';
import { findActivePhase } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { sessionRepository } from '@/data/repositories/session-repository';
import { activityProfileRepository } from '@/data/repositories/activity-profile-repository';
import { transactionRepository } from '@/data/repositories';
import type { Session } from '@/domain/types/session';
import type { Transaction } from '@/domain/types/transaction';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import { Icon } from '@/components/Icon';
import { db } from '@/data/db/database';

export function OutingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip, phases, pools, settings, reload } = useAppData();

  const [session, setSession] = useState<Session | null>(null);
  const [sessionTxs, setSessionTxs] = useState<Transaction[]>([]);
  const [profiles, setProfiles] = useState<ActivityProfile[]>([]);
  const [itemCount, setItemCount] = useState(0);

  const activePhase = findActivePhase(phases);

  useEffect(() => {
    if (!trip) return;
    const load = async () => {
      const active = await sessionRepository.getActive(trip.id);
      if (active) {
        setSession(active);
        const txs = await transactionRepository.getBySessionId(active.id);
        setSessionTxs(txs);
        setItemCount(txs.length);
      }
      const profs = await activityProfileRepository.getByTripId(trip.id);
      setProfiles(profs);
    };
    load();
  }, [trip]);

  const handleStartSession = async (profile: ActivityProfile) => {
    if (!trip || !activePhase || !pools[0]) return;
    const quickAdd = profile.quickAddValuesCents ?? settings?.quickAddDefaultValuesCents ?? [300, 500, 1000];
    const sess = createSession(trip.id, activePhase.id, pools[0].id, profile, quickAdd);
    await sessionRepository.create(sess);
    setSession(sess);
    setSessionTxs([]);
    setItemCount(0);
  };

  const handleQuickAdd = async (amountCents: number) => {
    if (!session || !trip || !activePhase) return;
    const tx = createExpenseTransaction({
      tripId: trip.id,
      phaseId: activePhase.id,
      budgetPoolId: session.budgetPoolId,
      walletId: null,
      amountCents,
      currency: trip.baseCurrency,
      category: 'bar',
      description: session.name,
      sessionId: session.id,
    });
    await transactionRepository.create(tx);
    const newCount = itemCount + 1;
    const item = createSessionItem(session.id, tx.id, newCount);
    await db.sessionItems.add(item);
    setSessionTxs((prev) => [...prev, tx]);
    setItemCount(newCount);
  };

  const handleEndSession = async () => {
    if (!session) return;
    const ended = endSessionDomain(session);
    await sessionRepository.update(ended);
    setSession(null);
    setSessionTxs([]);
    await reload();
    navigate('/dashboard');
  };

  if (!trip || !settings) return null;

  if (!session) {
    return (
      <div className="flex flex-col gap-4 pb-4 pt-2 min-h-screen">
        <div className="flex items-center gap-3 pt-2">
          <button onClick={() => navigate(-1)} className="btn-press p-1">
            <Icon name="arrow_back" size={24} className="text-on-surface" />
          </button>
          <h1 className="text-heading font-bold text-on-surface">Iniciar saída</h1>
        </div>

        <p className="text-sm text-on-surface-dim px-1">Escolha o tipo de saída:</p>
        {profiles.map((profile) => (
          <button
            key={profile.id}
            onClick={() => handleStartSession(profile)}
            className="bg-surface-container rounded-xl p-4 flex items-center gap-3 btn-press text-left"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: profile.color ?? 'var(--primary-subtle)' }}>
              <Icon name={profile.iconName ?? 'local_bar'} size={22} className="text-on-surface" />
            </div>
            <div>
              <p className="text-sm font-semibold text-on-surface">{profile.name}</p>
              <p className="text-xs text-on-surface-faint">
                {t('dashboard.fund_balance')}: {formatMoney(profile.safeValueCents, trip.baseCurrency)}
              </p>
            </div>
          </button>
        ))}

        {profiles.length === 0 && (
          <p className="text-sm text-on-surface-faint text-center py-8">
            Nenhum perfil disponível. Crie perfis no Planejador.
          </p>
        )}
      </div>
    );
  }

  const totalSpent = calculateSessionTotal(sessionTxs);
  const percent = getSessionPercentUsed(totalSpent, session.ceilingCents);
  const alerts = getProgressiveAlerts(totalSpent, session);
  const latestAlert = alerts[alerts.length - 1];
  const drinkImpact = session.avgDrinkPriceCents
    ? calculateNextDrinkImpact(totalSpent, session.avgDrinkPriceCents, session.ceilingCents)
    : null;

  const barColor = percent >= 100 ? 'bg-error' : percent >= 75 ? 'bg-warning' : 'bg-success';

  return (
    <div className="flex flex-col gap-4 pb-4 pt-2 min-h-screen">
      <div className="flex items-center justify-between">
        <h1 className="text-heading font-bold text-on-surface">{session.name}</h1>
        <button onClick={handleEndSession} className="px-3 py-1.5 rounded-lg bg-error/20 text-error text-xs font-medium btn-press">
          Encerrar
        </button>
      </div>

      <div className="bg-surface-container rounded-2xl p-5 text-center">
        <p className="text-sm text-on-surface-dim mb-1">Total gasto</p>
        <p className="text-display font-bold tabular text-on-surface">
          {formatMoney(totalSpent, trip.baseCurrency)}
        </p>

        {session.ceilingCents && (
          <>
            <div className="w-full h-2 bg-surface-high rounded-full mt-3 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${Math.min(100, percent)}%` }} />
            </div>
            <p className="text-xs text-on-surface-faint mt-1 tabular">
              {percent}% do teto ({formatMoney(session.ceilingCents, trip.baseCurrency)})
            </p>
          </>
        )}
      </div>

      {latestAlert && (
        <div className={`rounded-xl p-3 text-center text-sm font-medium ${
          latestAlert.type === 'critical' ? 'bg-error/20 text-error' :
          latestAlert.type === 'danger' ? 'bg-warning/20 text-warning' :
          'bg-primary-subtle text-on-surface-dim'
        }`}>
          {latestAlert.type === 'critical' ? 'Hora de parar. Água agora.' :
           latestAlert.type === 'danger' ? 'Quase no teto! Pense antes do próximo.' :
           `${latestAlert.percent}% do limite alcançado.`}
        </div>
      )}

      {drinkImpact && !drinkImpact.exceedsCeiling && (
        <p className="text-xs text-on-surface-faint text-center">
          Próximo drink: {formatMoney(session.avgDrinkPriceCents!, trip.baseCurrency)} → {drinkImpact.percentAfter}% do teto
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {session.quickAddValuesCents.map((val) => (
          <button
            key={val}
            onClick={() => handleQuickAdd(val)}
            className="py-4 rounded-xl bg-surface-container text-on-surface font-semibold tabular text-lg btn-press active:bg-primary/20"
          >
            +{formatMoney(val, trip.baseCurrency)}
          </button>
        ))}
      </div>

      {sessionTxs.length > 0 && (
        <div>
          <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2">
            Itens ({sessionTxs.length})
          </p>
          {sessionTxs.slice().reverse().map((tx, i) => (
            <div key={tx.id} className="flex justify-between py-1.5 px-1">
              <span className="text-xs text-on-surface-dim">#{sessionTxs.length - i}</span>
              <span className="text-xs font-semibold tabular text-on-surface">
                {formatMoney(tx.amountCents, tx.currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
