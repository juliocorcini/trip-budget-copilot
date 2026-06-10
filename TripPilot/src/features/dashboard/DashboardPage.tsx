import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppData } from '@/hooks/useAppData';
import { resolveActivePhase, getDayNumber, formatDate } from '@/domain/dates';
import { calculateFreeToSpend, createPoolSummary, calculateSavings, generateAmigoSinceroInsight } from '@/domain/budget';
import { getRecentTransactions, filterTransactionsByPool, groupTransactionsByCategory } from '@/domain/transactions';
import { formatMoney, fromCents, sumCents } from '@/domain/money';
import { getCategoryIcon } from '@/utils/category-icons';
import { Icon } from '@/components/Icon';
import { useNavigate } from 'react-router';
import { sessionRepository } from '@/data/repositories/session-repository';
import { activityProfileRepository } from '@/data/repositories/activity-profile-repository';
import {
  transactionRepository,
  participantShareRepository,
  scenarioPlanRepository,
  scenarioAllocationItemRepository,
  phaseProfileSettingRepository,
  plannedOccurrenceRepository,
} from '@/data/repositories';
import { isProfileEnabledInPhase } from '@/domain/profiles';
import { calculateFreeToSpendPerDay } from '@/domain/phases';
import { isOccurrenceActiveToday, postponeOccurrence } from '@/domain/planning';
import { findPendingConfirmationShares, type PendingShareEntry } from '@/domain/splitting';
import { resolveShareConfirmation } from '@/domain/orchestrators';
import { BottomSheet } from '@/components/BottomSheet';
import { calculateOccasionForecasts, type OccasionForecast } from '@/domain/forecasting';
import { isBackupReminderDue } from '@/domain/backup';
import type { Session } from '@/domain/types/session';
import type { Transaction } from '@/domain/types/transaction';
import type { ActivityProfile } from '@/domain/types/activity-profile';

function splitMoneyDisplay(cents: number, currency: string): { symbol: string; integer: string; decimal: string } {
  const value = fromCents(cents);
  const abs = Math.abs(value);
  const intPart = Math.floor(abs);
  const decPart = Math.round((abs - intPart) * 100);

  const symbolMap: Record<string, string> = { EUR: '€', USD: '$', BRL: 'R$', GBP: '£' };
  const symbol = symbolMap[currency] ?? currency;

  return {
    symbol,
    integer: `${symbol}${intPart}`,
    decimal: `,${decPart.toString().padStart(2, '0')}`,
  };
}

function formatElapsed(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${String(m).padStart(2, '0')}min`;
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { trip, phases, pools, links, envelopes, transactions, participants, occurrences, loading, settings, reload } = useAppData();
  const navigate = useNavigate();

  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [sessionTxs, setSessionTxs] = useState<Transaction[]>([]);
  const [profiles, setProfiles] = useState<ActivityProfile[]>([]);
  const [pendingShares, setPendingShares] = useState<PendingShareEntry[]>([]);
  const [confirmSheetOpen, setConfirmSheetOpen] = useState(false);
  const [shareDrafts, setShareDrafts] = useState<Record<string, string>>({});
  const [forecasts, setForecasts] = useState<OccasionForecast[]>([]);

  useEffect(() => {
    if (!trip) return;
    const load = async () => {
      const [sess, profs] = await Promise.all([
        sessionRepository.getActive(trip.id),
        activityProfileRepository.getByTripId(trip.id),
      ]);
      setProfiles(profs);
      if (sess) {
        setActiveSession(sess);
        const txs = await transactionRepository.getBySessionId(sess.id);
        setSessionTxs(txs);
      } else {
        setActiveSession(null);
        setSessionTxs([]);
      }
    };
    load();
  }, [trip, transactions]);

  // DEC-071 (FIELD-03): pending = third-party shares awaiting confirmation.
  // The card disappears once every share is confirmed, regardless of netting.
  useEffect(() => {
    if (!trip) return;
    const owner = participants.find((p) => p.isOwner);
    if (!owner) {
      setPendingShares([]);
      return;
    }
    const load = async () => {
      const sharedTxIds = transactions
        .filter((tx) => tx.isShared && tx.deletedAt === null)
        .map((tx) => tx.id);
      const shares = await participantShareRepository.getAllForTrip(sharedTxIds);
      setPendingShares(findPendingConfirmationShares(transactions, shares, owner.id));
    };
    load();
  }, [trip, transactions, participants]);

  const owner = participants.find((p) => p.isOwner) ?? null;

  const handleResolveShare = async (shareId: string, status: 'confirmed' | 'rejected') => {
    if (!owner) return;
    const draft = shareDrafts[shareId];
    const parsed = draft !== undefined ? Number(draft.replace(',', '.')) : NaN;
    const adjustedAmountCents =
      status === 'confirmed' && Number.isFinite(parsed) && parsed > 0
        ? Math.round(parsed * 100)
        : null;
    await resolveShareConfirmation({ shareId, status, adjustedAmountCents, ownerId: owner.id });
    setShareDrafts((prev) => {
      const next = { ...prev };
      delete next[shareId];
      return next;
    });
    await reload();
  };

  // DEC-072 (M6.3): "Postpone" pushes the event's date interval +1 day.
  const handlePostponeEvent = async (occurrenceId: string) => {
    const occurrence = await plannedOccurrenceRepository.getById(occurrenceId);
    if (!occurrence) return;
    await plannedOccurrenceRepository.update(postponeOccurrence(occurrence));
    await reload();
  };

  // GAP-020 (DEC-006/043): counters show the forecast ("X remaining") from
  // the active scenario plan of the current phase.
  useEffect(() => {
    if (!trip || profiles.length === 0) {
      setForecasts([]);
      return;
    }
    const phase = resolveActivePhase(phases);
    const pool = pools.find((p) => p.scope === 'linked_phases');
    if (!phase || !pool) {
      setForecasts([]);
      return;
    }
    const load = async () => {
      const [plan, settings] = await Promise.all([
        scenarioPlanRepository.getActiveByPhaseAndPool(trip.id, phase.id, pool.id),
        phaseProfileSettingRepository.getByPhaseId(phase.id),
      ]);
      if (!plan) {
        setForecasts([]);
        return;
      }
      const allocations = await scenarioAllocationItemRepository.getByPlanId(plan.id);
      // DEC-074 (FIELD-01): counters only show profiles enabled in this phase.
      const enabledProfiles = profiles.filter((p) =>
        isProfileEnabledInPhase(settings, phase.id, p.id),
      );
      setForecasts(calculateOccasionForecasts(enabledProfiles, allocations, transactions, phase.id));
    };
    load();
  }, [trip, phases, pools, profiles, transactions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-on-surface-dim">{t('common.loading')}</p>
      </div>
    );
  }

  if (!trip || !settings?.onboardingCompleted) {
    navigate('/welcome');
    return null;
  }

  const activePhase = resolveActivePhase(phases);
  const dayNum = activePhase ? getDayNumber(activePhase.startDate) : null;
  const recent = getRecentTransactions(transactions, 5);

  const linkedPools = pools.filter((p) => p.scope === 'linked_phases');
  const primaryPool = linkedPools[0];
  const fts = primaryPool && activePhase
    ? calculateFreeToSpend(
        primaryPool,
        envelopes.filter((e) => e.budgetPoolId === primaryPool.id),
        filterTransactionsByPool(transactions, primaryPool.id),
        links.filter((l) => l.budgetPoolId === primaryPool.id),
        activePhase.id,
        occurrences,
      )
    : null;

  const categoryGroups = groupTransactionsByCategory(transactions);
  const barCount = categoryGroups['bar']?.length ?? 0;
  const marketCount = categoryGroups['market']?.length ?? 0;
  const restaurantCount = categoryGroups['restaurant']?.length ?? 0;
  const hasOccasionData = barCount > 0 || marketCount > 0 || restaurantCount > 0;

  // DEC-072 (M6.3): today's planned events of the active phase (day card).
  const todayIso = new Date().toISOString();
  const todayEvents = activePhase
    ? occurrences.filter(
        (o) => o.phaseId === activePhase.id && isOccurrenceActiveToday(o, todayIso),
      )
    : [];

  const hasPendingExpenses = pendingShares.length > 0;
  const pendingImpactCents = pendingShares.reduce((sum, entry) => sum + entry.share.shareAmountCents, 0);
  const participantNameById = new Map(participants.map((p) => [p.id, p.nickname ?? p.name]));

  // Global pools (e.g. personal shopping) are detected by scope, not by name (GAP-017).
  const globalPools = pools.filter((p) => p.scope === 'global' && p.deletedAt === null);
  const globalPoolSummaries = globalPools.map((pool) => ({
    pool,
    summary: createPoolSummary(pool, filterTransactionsByPool(transactions, pool.id)),
  }));

  const progressPercent = fts && fts.totalBudgetCents > 0
    ? Math.round((fts.totalSpentCents / fts.totalBudgetCents) * 100)
    : 0;

  const heroMoney = fts ? splitMoneyDisplay(fts.freeToSpendCents, trip.baseCurrency) : null;

  // DEC-075 (FIELD-02): weighted free-to-spend for today + peak microcopy.
  const perDay =
    fts && activePhase
      ? calculateFreeToSpendPerDay(fts.freeToSpendCents, activePhase, new Date().toISOString())
      : null;

  const barProfile = profiles.find((p) => p.category === 'bar');
  const daysElapsed = activePhase ? getDayNumber(activePhase.startDate) : 0;
  const savings = calculateSavings(transactions, barProfile ?? null, daysElapsed);

  const recentBarSpent = sumCents(
    transactions
      .filter((t) => t.category === 'bar' && t.type === 'expense' && t.deletedAt === null)
      .slice(-3)
      .map((t) => t.amountCents),
  );
  const amigoInsight = fts && barProfile
    ? generateAmigoSinceroInsight(fts.freeToSpendCents, fts.protectedReserveCents, barProfile, recentBarSpent)
    : null;

  const sessionTotalCents = sumCents(sessionTxs.filter((t) => t.deletedAt === null).map((t) => t.amountCents));
  const sessionDrinksLeft = activeSession?.ceilingCents && activeSession?.avgDrinkPriceCents
    ? Math.floor(Math.max(0, (activeSession.ceilingCents - sessionTotalCents)) / activeSession.avgDrinkPriceCents)
    : null;

  const sessionProfile = activeSession
    ? profiles.find((p) => p.id === activeSession.activityProfileId) ?? null
    : null;
  const sessionIcon = sessionProfile?.iconName ?? getCategoryIcon(sessionProfile?.category ?? 'bar');

  return (
    <div className="flex flex-col pb-6">
      {/* DEMO BANNER */}
      {settings.isDemo && (
        <div className="mx-5 mt-4 p-3 rounded-xl bg-warning/10 border border-warning/30">
          <p className="text-xs font-semibold text-warning">{t('demo.banner')}</p>
        </div>
      )}

      {/* BACKUP REMINDER (DEC-057 / decision D-J) — discreet, tap → backup */}
      {isBackupReminderDue(settings, Date.now()) && transactions.length > 0 && (
        <button
          onClick={() => navigate('/settings/backup')}
          className="mx-5 mt-4 p-3 rounded-xl flex items-center gap-2.5 btn-press text-left"
          style={{ background: 'var(--surface-container)', border: '1px solid var(--border-faint)' }}
        >
          <Icon name="cloud_upload" size={16} className="text-on-surface-dim" />
          <p className="text-xs font-semibold text-on-surface-dim flex-1">
            {settings.lastBackupDate
              ? t('dashboard.backup_reminder', { days: settings.backupReminderDays })
              : t('dashboard.backup_reminder_never')}
          </p>
          <Icon name="chevron_right" size={14} className="text-on-surface-faint" />
        </button>
      )}

      {/* HEADER */}
      {activePhase && dayNum !== null && (
        <div className="px-5 pt-6 pb-1 flex justify-between items-center">
          {/* DEC-060 (GAP-024): phase name navigates to the trip overview */}
          <button onClick={() => navigate('/trip')} className="text-left btn-press">
            <p
              className="text-[11px] tracking-[0.15em] uppercase font-bold"
              style={{ color: '#C75B39aa' }}
            >
              {t('dashboard.day_counter', {
                current: dayNum,
                end: formatDate(activePhase.endDate, "d 'de' MMMM"),
              })}
            </p>
            <h1 className="text-xl font-extrabold tracking-tight mt-1 text-on-surface">
              {activePhase.name || trip.name}
            </h1>
          </button>
          {/* DEC-060 (GAP-024): notification bell navigates to shared expenses */}
          <button onClick={() => navigate('/shared')} className="relative btn-press">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'var(--surface-container)' }}
            >
              <Icon name="notifications" size={20} className="text-primary" />
            </div>
            {hasPendingExpenses && (
              <div
                className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full"
                style={{ background: 'var(--primary)' }}
              />
            )}
          </button>
        </div>
      )}

      {/* HERO CARD */}
      {fts && heroMoney && (
        <div className="mx-5 mt-5 p-5 rounded-2xl bg-surface-container">
          <p
            className="text-xs font-bold"
            style={{ color: '#C75B39aa' }}
          >
            {t('dashboard.free_to_spend', {
              date: activePhase ? formatDate(activePhase.endDate, "d 'de' MMMM") : '',
            })}
          </p>
          <p className="text-[44px] font-extrabold tracking-tight leading-none mt-2 tabular text-on-surface">
            {heroMoney.integer}
            <span className="text-xl font-bold text-on-surface-dim">{heroMoney.decimal}</span>
          </p>
          {perDay && perDay.perDayCents > 0 && (
            <p
              className={`text-xs font-bold mt-1.5 ${perDay.isPeakDay ? 'text-warning' : 'text-on-surface-dim'}`}
            >
              {perDay.isPeakDay
                ? t('dashboard.peak_day_free', {
                    amount: formatMoney(perDay.perDayCents, trip.baseCurrency),
                  })
                : t('dashboard.free_per_day', {
                    amount: formatMoney(perDay.perDayCents, trip.baseCurrency),
                  })}
            </p>
          )}
          <div
            className="w-full h-2 rounded-full overflow-hidden mt-4"
            style={{ background: 'var(--surface-container-high)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, progressPercent)}%`,
                background: 'linear-gradient(90deg, var(--success), var(--primary))',
              }}
            />
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-xs font-semibold text-on-surface-dim">{t('dashboard.fund_balance')}</span>
              <span className="text-xs font-bold tabular text-on-surface-dim">
                {formatMoney(fts.totalBudgetCents - fts.totalSpentCents, trip.baseCurrency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs font-semibold text-on-surface-dim">{t('dashboard.reserved_future')}</span>
              <span className="text-xs font-bold tabular" style={{ color: '#D4A843bb' }}>
                {formatMoney(fts.futureFloorCents, trip.baseCurrency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs font-semibold text-on-surface-dim">{t('dashboard.protected_reserve')}</span>
              <span className="text-xs font-bold tabular text-on-surface-faint">
                {formatMoney(fts.protectedReserveCents, trip.baseCurrency)}
              </span>
            </div>
            {/* DEC-072: active event reserves deduct from freeToSpend */}
            {fts.eventReservesCents > 0 && (
              <div className="flex justify-between">
                <span className="text-xs font-semibold text-on-surface-dim">
                  {t('dashboard.reserved_events')}
                </span>
                <span className="text-xs font-bold tabular" style={{ color: 'var(--primary-dim)' }}>
                  {formatMoney(fts.eventReservesCents, trip.baseCurrency)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ACTIVE OUTING CARD */}
      {activeSession && (
        <button
          onClick={() => navigate('/outings/active')}
          className="mx-5 mt-4 p-4 rounded-2xl flex items-center gap-4 btn-press text-left"
          style={{ background: 'var(--surface-deep)', border: '1px solid #C75B3925' }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: '#C75B3925' }}
          >
            <Icon name={sessionIcon} size={24} filled className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-primary">
              {t('dashboard.active_outing')} · {formatElapsed(activeSession.startedAt)}
            </p>
            <p className="text-base font-extrabold mt-0.5 text-on-surface truncate">
              {activeSession.name}
            </p>
            <p className="text-xs font-semibold mt-0.5 text-on-surface-dim">
              {t('dashboard.active_outing_spent', { amount: formatMoney(sessionTotalCents, trip.baseCurrency) })}
              {sessionDrinksLeft !== null && ` · ${t('dashboard.session_drinks_left', { count: sessionDrinksLeft })}`}
            </p>
          </div>
          <span
            className="px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0"
            style={{ background: 'var(--primary)', color: 'var(--surface)' }}
          >
            {t('dashboard.active_outing_open')}
          </span>
        </button>
      )}

      {/* DEC-072 (M6.3): DAY CARD — today's planned events without a session */}
      {todayEvents.map((occ) => (
        <div
          key={occ.id}
          className="mx-5 mt-4 p-4 rounded-2xl"
          style={{ background: 'var(--surface-deep)', border: '1px solid var(--border-faint)' }}
        >
          <div className="flex items-center gap-2.5">
            <Icon
              name={occ.kind === 'sub_destination' ? 'location_on' : 'celebration'}
              size={20}
              filled
              className="text-primary"
            />
            <p className="text-sm font-extrabold text-on-surface flex-1 truncate">
              {t('dashboard.event_today', { name: occ.name })}
            </p>
            {occ.reservedCents !== null && (
              <span className="text-xs font-bold tabular text-on-surface-dim">
                {t('dashboard.event_reserved', {
                  amount: formatMoney(occ.reservedCents, trip.baseCurrency),
                })}
              </span>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => navigate(`/outings/new?occurrence=${occ.id}`)}
              className="flex-1 py-2 rounded-xl bg-primary text-on-surface text-xs font-bold btn-press"
            >
              {t('dashboard.event_start_now')}
            </button>
            <button
              onClick={() => handlePostponeEvent(occ.id)}
              className="flex-1 py-2 rounded-xl bg-surface-high text-on-surface-dim text-xs font-semibold btn-press"
            >
              {t('dashboard.event_postpone')}
            </button>
          </div>
        </div>
      ))}

      {/* OCCASION COUNTERS — forecast first (GAP-020), done-count fallback */}
      {forecasts.length > 0 ? (
        <div className="mx-5 mt-4 grid grid-cols-3 gap-3">
          {forecasts.slice(0, 3).map((forecast) => {
            const profile = profiles.find((p) => p.id === forecast.profileId);
            return (
              <OccasionCounter
                key={forecast.profileId}
                icon={profile?.iconName ?? getCategoryIcon(profile?.category ?? 'other')}
                count={forecast.remaining}
                label={t('dashboard.occasion_remaining', { name: forecast.profileName })}
                sublabel={t('dashboard.occasion_done', { count: forecast.spent })}
                iconBg="#C75B3918"
                iconColor="var(--primary)"
                onClick={() => navigate(`/expenses?profile=${forecast.profileId}`)}
              />
            );
          })}
        </div>
      ) : hasOccasionData ? (
        <div className="mx-5 mt-4 grid grid-cols-3 gap-3">
          <OccasionCounter
            icon="local_bar"
            count={barCount}
            label={t('dashboard.occasion_bar')}
            iconBg="#C75B3918"
            iconColor="var(--primary)"
            onClick={() => navigate('/expenses?category=bar')}
          />
          <OccasionCounter
            icon="shopping_cart"
            count={marketCount}
            label={t('dashboard.occasion_market')}
            iconBg="#6B8F7118"
            iconColor="var(--success)"
            onClick={() => navigate('/expenses?category=market')}
          />
          <OccasionCounter
            icon="restaurant"
            count={restaurantCount}
            label={t('dashboard.occasion_restaurant')}
            iconBg="#D4A84318"
            iconColor="var(--warning)"
            onClick={() => navigate('/expenses?category=restaurant')}
          />
        </div>
      ) : null}

      {/* SAVINGS CARD */}
      {savings.hasSavings && (
        <div
          className="mx-5 mt-3 p-3.5 rounded-2xl flex items-center gap-3"
          style={{ background: '#6B8F7112', border: '1px solid #6B8F7118' }}
        >
          <Icon name="trending_up" className="text-success" />
          <p className="text-sm font-semibold text-success">
            {t('dashboard.savings_message', {
              amount: formatMoney(savings.savedCents, trip.baseCurrency),
              percent: savings.percentOfBarNight,
            })}
          </p>
        </div>
      )}

      {/* PENDING SHARE CONFIRMATIONS (DEC-071 / FIELD-03) */}
      {hasPendingExpenses && (
        <button
          onClick={() => setConfirmSheetOpen(true)}
          className="mx-5 mt-4 p-4 rounded-2xl flex items-center gap-3 btn-press text-left"
          style={{ background: '#D4A84312', border: '1px solid #D4A84320' }}
        >
          <Icon name="group" className="text-warning" />
          <div className="flex-1">
            <p className="text-sm font-bold text-warning">
              {t('dashboard.pending_confirmation', { count: pendingShares.length })}
            </p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: '#D4A843aa' }}>
              {t('dashboard.pending_impact', { amount: formatMoney(pendingImpactCents, trip.baseCurrency) })}
            </p>
          </div>
          <Icon name="chevron_right" size={16} className="text-on-surface-faint" />
        </button>
      )}

      {/* Confirmation sheet: confirm / reject / adjust value per share */}
      <BottomSheet
        open={confirmSheetOpen}
        onClose={() => setConfirmSheetOpen(false)}
        title={t('shared.confirm_sheet_title')}
      >
        <div className="flex flex-col gap-3">
          {pendingShares.length === 0 && (
            <p className="text-sm text-on-surface-dim text-center py-4">
              {t('shared.confirm_all_done')}
            </p>
          )}
          {pendingShares.map(({ share, transaction }) => {
            const draft = shareDrafts[share.id] ?? (share.shareAmountCents / 100).toFixed(2);
            return (
              <div key={share.id} className="bg-surface-high rounded-xl p-3.5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-on-surface truncate">{transaction.description}</p>
                    <p className="text-xs text-on-surface-faint mt-0.5">
                      {t('shared.confirm_share_of', {
                        name: participantNameById.get(share.participantId) ?? '—',
                        total: formatMoney(transaction.amountCents, transaction.currency),
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-baseline gap-1 bg-surface-container rounded-lg px-3 py-2 flex-1">
                    <span className="text-on-surface-faint text-xs">{transaction.currency}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={draft}
                      onChange={(e) =>
                        setShareDrafts((prev) => ({ ...prev, [share.id]: e.target.value }))
                      }
                      className="bg-transparent text-sm text-on-surface tabular outline-none w-full"
                      aria-label={t('shared.adjust_value')}
                    />
                  </div>
                  <button
                    onClick={() => handleResolveShare(share.id, 'rejected')}
                    className="px-3 py-2 rounded-lg text-xs font-bold btn-press bg-error/15 text-error"
                  >
                    {t('shared.reject')}
                  </button>
                  <button
                    onClick={() => handleResolveShare(share.id, 'confirmed')}
                    className="px-3 py-2 rounded-lg text-xs font-bold btn-press bg-success/20 text-success"
                  >
                    {t('shared.confirm')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </BottomSheet>

      {/* GLOBAL POOLS (personal shopping etc. — by scope, GAP-017) */}
      {globalPoolSummaries.map(({ pool, summary }) => (
        <div key={pool.id} className="mx-5 mt-5 p-4 rounded-2xl bg-surface-container">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: '#C75B3918' }}
            >
              <Icon name="shopping_bag" size={18} className="text-primary" />
            </div>
            <p className="text-sm font-bold text-on-surface">{pool.name}</p>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[32px] font-extrabold tracking-tight leading-none tabular text-on-surface">
                {formatMoney(summary.remainingCents, pool.currency)}
              </p>
              <p className="text-[11px] font-semibold mt-1 text-on-surface-dim">{t('dashboard.remaining')}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-on-surface-faint">
                {t('dashboard.used_of', {
                  used: formatMoney(summary.spentCents, pool.currency),
                  total: formatMoney(summary.totalCents, pool.currency),
                })}
              </p>
              <div
                className="w-28 h-2 rounded-full overflow-hidden mt-1.5"
                style={{ background: 'var(--surface-container-high)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, summary.percentUsed)}%`,
                    background: 'var(--primary)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* AMIGO SINCERO */}
      {amigoInsight?.hasInsight && barProfile && (
        <div
          className="mx-5 mt-5 p-4 rounded-2xl"
          style={{ background: '#C75B3910', border: '1px solid #C75B3918' }}
        >
          <div className="flex items-start gap-3">
            <Icon name="chat_bubble" className="text-primary mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-bold text-primary">{t('dashboard.amigo_sincero')}</p>
              <p className="text-[13px] mt-1.5 leading-snug font-semibold text-on-surface">
                {t('dashboard.amigo_message', {
                  type: t(`categories.${amigoInsight.category}` as never).toLowerCase(),
                  before: amigoInsight.beforeCount,
                  after: amigoInsight.afterCount,
                })}
              </p>
              <div className="flex items-center gap-4 mt-3">
                <div>
                  <p className="text-[10px] font-bold text-on-surface-faint">{t('dashboard.amigo_before')}</p>
                  <p className="text-sm font-extrabold tabular text-on-surface">
                    {amigoInsight.beforeCount} {t('dashboard.amigo_outings')}
                  </p>
                </div>
                <Icon name="arrow_forward" size={14} className="text-on-surface-faint" />
                <div>
                  <p className="text-[10px] font-bold text-on-surface-faint">{t('dashboard.amigo_after')}</p>
                  <p className="text-sm font-extrabold tabular text-warning">
                    {amigoInsight.afterCount} {t('dashboard.amigo_outings')}
                  </p>
                </div>
                <div className="ml-auto">
                  <p className="text-[10px] font-bold text-on-surface-faint">{t('dashboard.amigo_reserve')}</p>
                  <p className={`text-sm font-bold ${amigoInsight.reserveStatus === 'intact' ? 'text-success' : 'text-error'}`}>
                    {amigoInsight.reserveStatus === 'intact' ? t('dashboard.amigo_reserve_intact') : t('dashboard.amigo_reserve_affected')}
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  navigate(
                    `/simulator?amount=${fromCents(recentBarSpent).toFixed(2)}&source=amigoSincero`,
                  )
                }
                className="btn-press mt-3 px-4 py-2 rounded-lg text-xs font-bold"
                style={{ background: '#C75B3918', color: 'var(--primary)' }}
              >
                {t('dashboard.amigo_see_impact')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECENT EXPENSES */}
      {recent.length > 0 && (
        <div className="mx-5 mt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-on-surface">
              {t('dashboard.recent_expenses')}
            </p>
            <button
              onClick={() => navigate('/expenses')}
              className="text-xs text-primary btn-press font-bold"
            >
              {t('common.view_all')}
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {/* FIELD-13: recent items navigate to the expense detail */}
            {recent.map((tx) => (
              <button
                key={tx.id}
                onClick={() => navigate(`/expenses/${tx.id}`)}
                className="bg-surface-container rounded-xl px-4 py-3 flex items-center justify-between btn-press text-left w-full"
              >
                <div>
                  <p className="text-sm text-on-surface font-semibold">{tx.description}</p>
                  <p className="text-xs text-on-surface-faint">
                    {tx.category ? t(`categories.${tx.category}` as never) : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold tabular text-on-surface">
                    {formatMoney(tx.amountCents, tx.currency)}
                  </p>
                  <Icon name="chevron_right" size={14} className="text-on-surface-faint" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {recent.length === 0 && (
        <div className="mx-5 mt-5">
          <div className="bg-surface-container rounded-xl p-6 text-center">
            <Icon name="receipt_long" size={32} className="text-on-surface-mute mx-auto mb-2" />
            <p className="text-sm text-on-surface-dim">{t('dashboard.no_expenses')}</p>
            <p className="text-xs text-on-surface-faint mt-1">{t('dashboard.no_expenses_desc')}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// FIELD-14: counters navigate to the expense list pre-filtered by profile/category.
function OccasionCounter({
  icon,
  count,
  label,
  sublabel,
  iconBg,
  iconColor,
  onClick,
}: {
  icon: string;
  count: number;
  label: string;
  sublabel?: string;
  iconBg: string;
  iconColor: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="p-3.5 rounded-2xl text-center bg-surface-container btn-press">
      <div
        className="w-9 h-9 mx-auto rounded-full flex items-center justify-center mb-1.5"
        style={{ background: iconBg }}
      >
        <Icon name={icon} size={18} style={{ color: iconColor }} />
      </div>
      <p className="text-xl font-extrabold tabular text-on-surface">{count}</p>
      <p className="text-[10px] font-bold text-on-surface-dim">{label}</p>
      {sublabel && <p className="text-[9px] font-semibold text-on-surface-faint mt-0.5">{sublabel}</p>}
    </button>
  );
}
