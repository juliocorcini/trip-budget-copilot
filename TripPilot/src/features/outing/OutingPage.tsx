import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import {
  createSession,
  createSessionItem,
  calculateSessionTotal,
  calculateNextDrinkImpact,
  calculateReportedTotalDiff,
  endSession as endSessionDomain,
} from '@/domain/outing';
import { createExpenseTransaction } from '@/domain/transactions';
import { resolveActivePhase } from '@/domain/dates';
import { fromCents } from '@/domain/money';
import { createCustomActivityProfile } from '@/domain/profiles';
import { sessionRepository } from '@/data/repositories/session-repository';
import { activityProfileRepository } from '@/data/repositories/activity-profile-repository';
import { transactionRepository } from '@/data/repositories';
import type { Session } from '@/domain/types/session';
import type { Transaction } from '@/domain/types/transaction';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { showToast } from '@/components/Toast';
import { ProfileForm, type ProfileFormData } from '@/components/ProfileForm';
import { getCategoryIcon } from '@/utils/category-icons';
import { db } from '@/data/db/database';

function formatElapsed(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${String(m).padStart(2, '0')}min`;
}

function formatTime(isoDate: string): string {
  const d = new Date(isoDate);
  return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatCurrency(cents: number, currency: string): string {
  const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
  const value = fromCents(cents);
  if (Number.isInteger(value)) return `${symbol}${value}`;
  return `${symbol}${value.toFixed(2).replace('.', ',')}`;
}

function formatCurrencyFull(cents: number, currency: string): string {
  const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
  const value = fromCents(cents);
  return `${symbol}${value.toFixed(2).replace('.', ',')}`;
}

export function OutingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip, phases, pools, settings, reload: reloadAppData } = useAppData();

  const [session, setSession] = useState<Session | null>(null);
  const [sessionTxs, setSessionTxs] = useState<Transaction[]>([]);
  const [profiles, setProfiles] = useState<ActivityProfile[]>([]);
  const [itemCount, setItemCount] = useState(0);
  const [elapsed, setElapsed] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);

  const currentPhase = resolveActivePhase(phases);
  const defaultPool = pools.find((p) => p.scope === 'linked_phases') ?? pools[0] ?? null;

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
  }, [trip, phases]);

  useEffect(() => {
    if (!session) return;
    setElapsed(formatElapsed(session.startedAt));
    const interval = setInterval(() => {
      setElapsed(formatElapsed(session.startedAt));
    }, 10000);
    return () => clearInterval(interval);
  }, [session]);

  const handleStartSession = async (profile: ActivityProfile) => {
    if (!trip || !currentPhase || !defaultPool) {
      showToast(t('outing.start_error'), 'danger');
      return;
    }
    const quickAdd =
      profile.quickAddValuesCents ??
      settings?.quickAddDefaultValuesCents ?? [300, 500, 700, 1000, 1500];
    const sess = createSession(trip.id, currentPhase.id, defaultPool.id, profile, quickAdd);
    await sessionRepository.create(sess);
    setSession(sess);
    setSessionTxs([]);
    setItemCount(0);
  };

  const handleStartCustomSession = async (data: ProfileFormData) => {
    if (!trip) return;
    const profile = createCustomActivityProfile({
      tripId: trip.id,
      name: data.name,
      iconName: data.iconName,
      typicalValueCents: data.typicalValueCents,
    });
    await activityProfileRepository.create(profile);
    setProfiles((prev) => [...prev, profile]);
    setShowCustomForm(false);
    await handleStartSession(profile);
  };

  const addSessionExpense = async (amountCents: number, description: string) => {
    if (!session || !trip || !currentPhase) return;
    const sessionProfile = profiles.find((p) => p.id === session.activityProfileId);
    const tx = createExpenseTransaction({
      tripId: trip.id,
      phaseId: currentPhase.id,
      budgetPoolId: session.budgetPoolId,
      walletId: null,
      amountCents,
      currency: trip.baseCurrency,
      category: sessionProfile?.category ?? 'other',
      description,
      sessionId: session.id,
      activityProfileId: session.activityProfileId,
    });
    await transactionRepository.create(tx);
    const newCount = itemCount + 1;
    const item = createSessionItem(session.id, tx.id, newCount);
    await db.sessionItems.add(item);
    setSessionTxs((prev) => [...prev, tx]);
    setItemCount(newCount);
  };

  const handleQuickAdd = async (amountCents: number) => {
    if (!session) return;
    await addSessionExpense(amountCents, session.name);
  };

  // DEC-046: reported total creates an adjustment for the DIFFERENCE,
  // never replacing logged items.
  const handleRegisterTotal = async (diffCents: number) => {
    await addSessionExpense(diffCents, t('outing.total_adjustment_desc'));
  };

  const handleEndSession = async () => {
    if (!session) return;
    const ended = endSessionDomain(session);
    await sessionRepository.update(ended);
    setSession(null);
    setSessionTxs([]);
    await reloadAppData();
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
          <h1 className="text-heading font-bold text-on-surface">
            {t('outing.start_title')}
          </h1>
        </div>

        <p className="text-sm text-on-surface-dim px-1">{t('outing.choose_type')}</p>
        {profiles.map((profile) => (
          <button
            key={profile.id}
            onClick={() => handleStartSession(profile)}
            className="bg-surface-container rounded-xl p-4 flex items-center gap-3 btn-press text-left"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: profile.color ?? 'var(--primary-subtle)' }}
            >
              <Icon
                name={profile.iconName ?? getCategoryIcon(profile.category)}
                size={22}
                className="text-on-surface"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-on-surface">{profile.name}</p>
              <p className="text-xs text-on-surface-faint">
                {t('outing.safe_value')}: {formatCurrency(profile.safeValueCents, trip.baseCurrency)}
              </p>
            </div>
          </button>
        ))}

        {showCustomForm ? (
          <ProfileForm
            currency={trip.baseCurrency}
            onSave={handleStartCustomSession}
            onCancel={() => setShowCustomForm(false)}
          />
        ) : (
          <button
            onClick={() => setShowCustomForm(true)}
            className="rounded-xl p-4 flex items-center gap-3 btn-press text-left"
            style={{ background: '#C75B3910', border: '1px dashed #C75B3940' }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: '#C75B3918' }}
            >
              <Icon name="add" size={22} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-on-surface">{t('outing.custom_type')}</p>
              <p className="text-xs text-on-surface-faint">{t('outing.custom_type_desc')}</p>
            </div>
          </button>
        )}

        {profiles.length === 0 && (
          <p className="text-sm text-on-surface-faint text-center py-8">
            {t('outing.no_profiles')}
          </p>
        )}
      </div>
    );
  }

  const sessionProfile = profiles.find((p) => p.id === session.activityProfileId) ?? null;
  const sessionIcon =
    sessionProfile?.iconName ?? getCategoryIcon(sessionProfile?.category ?? null);
  const sessionCategory = sessionProfile?.category ?? 'other';

  return <ActiveSession
    session={session}
    sessionTxs={sessionTxs}
    trip={trip}
    elapsed={elapsed}
    sessionIcon={sessionIcon}
    sessionCategory={sessionCategory}
    onQuickAdd={handleQuickAdd}
    onRegisterTotal={handleRegisterTotal}
    onEnd={handleEndSession}
    onBack={() => navigate(-1)}
  />;
}

interface ActiveSessionProps {
  session: Session;
  sessionTxs: Transaction[];
  trip: { baseCurrency: string };
  elapsed: string;
  sessionIcon: string;
  sessionCategory: string;
  onQuickAdd: (cents: number) => void;
  onRegisterTotal: (diffCents: number) => void;
  onEnd: () => void;
  onBack: () => void;
}

function ActiveSession({ session, sessionTxs, trip, elapsed, sessionIcon, sessionCategory, onQuickAdd, onRegisterTotal, onEnd, onBack }: ActiveSessionProps) {
  const { t } = useTranslation();
  const currency = trip.baseCurrency;

  const [activeSheet, setActiveSheet] = useState<'other' | 'total' | null>(null);
  const [sheetAmount, setSheetAmount] = useState('');
  const [negativeConfirmed, setNegativeConfirmed] = useState(false);

  const closeSheet = () => {
    setActiveSheet(null);
    setSheetAmount('');
    setNegativeConfirmed(false);
  };

  const totalSpent = useMemo(() => calculateSessionTotal(sessionTxs), [sessionTxs]);
  const targetCents = session.targetCents ?? 0;
  const ceilingCents = session.ceilingCents ?? 0;
  const maxCents = session.maxCents ?? ceilingCents;
  const avgDrink = session.avgDrinkPriceCents ?? 0;

  const remainingComfort = Math.max(0, targetCents - totalSpent);
  const drinksRemaining = avgDrink > 0 ? Math.floor(remainingComfort / avgDrink) : 0;

  const gaugePercent = maxCents > 0 ? Math.min(100, (totalSpent / maxCents) * 100) : 0;

  const drinkImpact = avgDrink > 0
    ? calculateNextDrinkImpact(totalSpent, avgDrink, ceilingCents || null)
    : null;

  const totalDrinksSegments = avgDrink > 0 ? Math.ceil(targetCents / avgDrink) : 5;
  const filledDrinks = avgDrink > 0 ? Math.floor(totalSpent / avgDrink) : 0;
  const currentDrink = totalSpent > 0 && totalSpent < targetCents ? 1 : 0;

  const zoneLabel = totalSpent <= targetCents
    ? t('outing.zone_on_target')
    : totalSpent <= ceilingCents
      ? t('outing.zone_above_target')
      : t('outing.zone_over_ceiling');

  const zoneColor = totalSpent <= targetCents
    ? 'var(--success)'
    : totalSpent <= ceilingCents
      ? 'var(--primary)'
      : 'var(--error)';

  const zoneBg = totalSpent <= targetCents
    ? '#6B8F7118'
    : totalSpent <= ceilingCents
      ? '#C75B3918'
      : '#D9404018';

  const comfortColor = totalSpent <= targetCents ? 'var(--success)' : 'var(--primary)';

  const quickValues = session.quickAddValuesCents.length >= 5
    ? session.quickAddValuesCents.slice(0, 5)
    : [300, 500, 700, 1000, 1500];

  const recentTxs = sessionTxs.slice().reverse().slice(0, 4);

  return (
    <div
      className="max-w-[430px] mx-auto flex flex-col"
      style={{ background: 'var(--surface-deep)', minHeight: '100vh' }}
    >
      {/* 1. HEADER */}
      <div className="px-5 pt-5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="btn-press w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: '#EDE8E00a' }}
          >
            <Icon name="arrow_back" size={18} className="text-on-surface-dim" />
          </button>
          <div>
            <p
              className="text-[10px] tracking-[0.15em] uppercase font-bold"
              style={{ color: '#C75B39aa' }}
            >
              {t('outing.active_label')}
            </p>
            <p className="text-sm font-bold" style={{ color: 'var(--on-surface)' }}>
              {session.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: 'var(--on-surface-dim)' }}>
            {elapsed}
          </span>
          <button
            onClick={onEnd}
            className="btn-press px-3 py-2 rounded-xl text-xs font-bold"
            style={{ background: '#D9404015', color: 'var(--error)' }}
          >
            {t('outing.end_button')}
          </button>
        </div>
      </div>

      {/* 2. CENTRAL VALUE */}
      <div className="text-center pt-4 pb-1">
        <p className="text-xs font-bold" style={{ color: 'var(--on-surface-dim)' }}>
          {t('outing.personal_spent')}
        </p>
        <p
          className="text-[56px] font-extrabold tracking-tighter leading-none mt-1 tabular"
          style={{ color: 'var(--on-surface)' }}
        >
          {formatCurrency(totalSpent, currency)}
        </p>
      </div>

      {/* 3. COMFORT ZONE LABEL */}
      <div className="text-center pb-2">
        <p className="text-sm font-bold" style={{ color: comfortColor }}>
          {t('outing.comfort_remaining', { amount: formatCurrency(remainingComfort, currency) })}
        </p>
        {avgDrink > 0 && (
          <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--on-surface-dim)' }}>
            {t('outing.drinks_remaining', { count: drinksRemaining })}
          </p>
        )}
      </div>

      {/* 4. DRINK SEGMENTS */}
      <div className="px-5">
        <div className="flex justify-center gap-2 mb-2.5">
          {Array.from({ length: Math.min(totalDrinksSegments, 7) }).map((_, i) => {
            if (i < filledDrinks) {
              return (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: '#6B8F7120', color: 'var(--success)' }}
                >
                  <Icon name="circle" size={13} filled />
                </div>
              );
            }
            if (i === filledDrinks && currentDrink) {
              return (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: '#C75B3920', color: 'var(--primary)' }}
                >
                  <Icon name={sessionIcon} size={13} filled />
                </div>
              );
            }
            const isPulsing = i === filledDrinks + currentDrink;
            return (
              <div
                key={i}
                className={`${isPulsing ? 'seg-pulse ' : ''}w-7 h-7 rounded-full flex items-center justify-center`}
                style={{ background: '#C75B3920', color: 'var(--primary)' }}
              >
                <Icon name={sessionIcon} size={13} filled />
              </div>
            );
          })}
        </div>

        {/* 5. SEGMENTED GAUGE */}
        <div className="relative mb-1.5">
          <div className="flex gap-[2px] h-3 rounded-md overflow-hidden">
            <div className="flex-[3] rounded-l-md" style={{ background: 'var(--success)' }} />
            <div className="flex-[2]" style={{ background: 'var(--primary)' }} />
            <div className="flex-[1]" style={{ background: '#D4A84360' }} />
            <div className="flex-[1] rounded-r-md" style={{ background: '#D9404030' }} />
          </div>
          <div
            className="absolute top-[-4px]"
            style={{ left: `calc(${gaugePercent}% - 6px)` }}
          >
            <div
              className="w-3 h-3 rounded-full border-2"
              style={{
                background: 'var(--on-surface)',
                borderColor: 'var(--surface-deep)',
                boxShadow: '0 0 6px #EDE8E060',
              }}
            />
            <div className="absolute -bottom-[14px] left-1/2 -translate-x-1/2 whitespace-nowrap">
              <span className="text-[8px] font-bold" style={{ color: 'var(--on-surface)' }}>
                {formatCurrency(totalSpent, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* 6. THREE-LIMIT LABELS */}
        <div className="flex justify-between items-start px-0.5 mt-4 mb-2.5">
          <div>
            <p className="text-[9px] font-bold" style={{ color: 'var(--success)' }}>
              {t('outing.limit_target')}
            </p>
            <p className="text-[11px] font-extrabold tabular" style={{ color: 'var(--success)' }}>
              {formatCurrency(targetCents, currency)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[9px] font-bold" style={{ color: 'var(--primary)' }}>
              {t('outing.limit_ceiling')}
            </p>
            <p className="text-[11px] font-extrabold tabular" style={{ color: 'var(--primary)' }}>
              {formatCurrency(ceilingCents, currency)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-bold" style={{ color: '#D9404080' }}>
              {t('outing.limit_max')}
            </p>
            <p className="text-[11px] font-extrabold tabular" style={{ color: '#D9404080' }}>
              {formatCurrency(maxCents, currency)}
            </p>
          </div>
        </div>

        {/* 7. ZONE CHIP */}
        <div className="text-center mb-3">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold"
            style={{ background: zoneBg, color: zoneColor }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: zoneColor }}
            />
            {zoneLabel}
          </span>
        </div>
      </div>

      {/* 8. SESSION HISTORY */}
      {recentTxs.length > 0 && (
        <div className="mx-5 p-3 rounded-xl mb-2.5" style={{ background: '#EDE8E006' }}>
          <div className="flex items-center justify-between mb-2">
            <p
              className="text-[10px] font-bold tracking-[0.1em] uppercase"
              style={{ color: 'var(--on-surface-faint)' }}
            >
              {t('outing.recent_expenses')}
            </p>
            <span className="text-[10px] font-bold" style={{ color: 'var(--primary)' }}>
              {sessionTxs.length} {t('expenses.title').toLowerCase()}
            </span>
          </div>
          <div className="space-y-2">
            {recentTxs.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: 'var(--primary)' }}
                  />
                  <span className="text-xs font-semibold" style={{ color: 'var(--on-surface-dim)' }}>
                    {tx.description || t(`categories.${sessionCategory}` as never)}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span
                    className="text-[10px] font-semibold tabular"
                    style={{ color: 'var(--on-surface-faint)' }}
                  >
                    {formatTime(tx.date)}
                  </span>
                  <span
                    className="text-xs font-bold tabular"
                    style={{ color: 'var(--on-surface)' }}
                  >
                    {formatCurrencyFull(tx.amountCents, tx.currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 9. NEXT DRINK MESSAGE */}
      {drinkImpact && !drinkImpact.exceedsCeiling && avgDrink > 0 && (
        <div className="mx-5 p-3 rounded-xl mb-2.5" style={{ background: '#C75B390a' }}>
          <p className="text-xs leading-relaxed font-semibold" style={{ color: '#C75B39cc' }}>
            <span className="font-bold" style={{ color: 'var(--primary)' }}>
              {t('outing.next_drink_label', { amount: formatCurrency(avgDrink, currency) })}:
            </span>{' '}
            {t('outing.next_drink_message')}
          </p>
        </div>
      )}

      {/* 10. SPACER */}
      <div className="flex-1 min-h-[4px]" />

      {/* 11. QUICK-ADD BUTTONS */}
      <div className="px-5 pb-3">
        <div className="grid grid-cols-3 gap-2.5 mb-2.5">
          {quickValues.slice(0, 2).map((val) => (
            <button
              key={val}
              onClick={() => onQuickAdd(val)}
              className="btn-press quick-btn rounded-xl font-bold text-lg tabular"
              style={{ background: 'var(--surface-container)', color: 'var(--on-surface)' }}
            >
              +{formatCurrency(val, currency)}
            </button>
          ))}
          {quickValues[2] && (
            <button
              onClick={() => onQuickAdd(quickValues[2]!)}
              className="btn-press quick-btn rounded-xl font-bold text-lg tabular"
              style={{
                background: '#C75B3918',
                color: 'var(--primary)',
                border: '1px solid #C75B3925',
              }}
            >
              +{formatCurrency(quickValues[2], currency)}
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2.5 mb-2.5">
          {quickValues.slice(3, 5).map((val) => (
            <button
              key={val}
              onClick={() => onQuickAdd(val)}
              className="btn-press quick-btn rounded-xl font-bold text-lg tabular"
              style={{ background: 'var(--surface-container)', color: 'var(--on-surface)' }}
            >
              +{formatCurrency(val, currency)}
            </button>
          ))}
          <button
            onClick={() => setActiveSheet('other')}
            className="btn-press quick-btn rounded-xl font-semibold text-sm"
            style={{ background: 'var(--surface-container)', color: 'var(--on-surface-dim)' }}
          >
            {t('outing.other_amount')}
          </button>
        </div>
        <button
          onClick={() => setActiveSheet('total')}
          className="btn-press w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
          style={{ background: 'var(--surface-container)', color: 'var(--on-surface-dim)' }}
        >
          <Icon name="edit_note" size={16} className="text-on-surface-faint" />
          {t('outing.register_total')}
        </button>
      </div>

      {/* "Other amount" sheet (replaces native prompt — GAP-025) */}
      <BottomSheet
        open={activeSheet === 'other'}
        onClose={closeSheet}
        title={t('outing.other_amount')}
      >
        <SheetAmountInput
          currency={currency}
          value={sheetAmount}
          onChange={setSheetAmount}
        />
        <button
          onClick={() => {
            const cents = Math.round(parseFloat(sheetAmount.replace(',', '.')) * 100);
            if (cents > 0) {
              onQuickAdd(cents);
              closeSheet();
            }
          }}
          disabled={!sheetAmount || parseFloat(sheetAmount.replace(',', '.')) <= 0}
          className="w-full py-3 rounded-xl bg-primary text-on-surface font-semibold btn-press disabled:opacity-40 mt-3"
        >
          {t('common.add')}
        </button>
      </BottomSheet>

      {/* "Register current total" sheet — DEC-046: adjustment by difference */}
      <BottomSheet
        open={activeSheet === 'total'}
        onClose={closeSheet}
        title={t('outing.register_total')}
      >
        <p className="text-xs text-on-surface-dim mb-3">
          {t('outing.items_total', { amount: formatCurrencyFull(totalSpent, currency) })}
        </p>
        <SheetAmountInput
          currency={currency}
          value={sheetAmount}
          onChange={(v) => {
            setSheetAmount(v);
            setNegativeConfirmed(false);
          }}
          placeholder={t('outing.informed_total')}
        />
        {(() => {
          const informedCents = sheetAmount
            ? Math.round(parseFloat(sheetAmount.replace(',', '.')) * 100)
            : null;
          if (informedCents === null || informedCents < 0 || Number.isNaN(informedCents)) return null;
          const result = calculateReportedTotalDiff(informedCents, totalSpent);

          if (!result.needsAdjustment) {
            return <p className="text-xs font-semibold text-success mt-3">{t('outing.total_matches')}</p>;
          }
          return (
            <>
              <p
                className={`text-xs font-semibold mt-3 ${result.isNegative ? 'text-warning' : 'text-on-surface-dim'}`}
              >
                {result.isNegative
                  ? t('outing.adjustment_negative_warn', {
                      amount: formatCurrencyFull(result.diffCents, currency),
                    })
                  : t('outing.adjustment_preview', {
                      amount: formatCurrencyFull(result.diffCents, currency),
                    })}
              </p>
              {result.isNegative && (
                <button
                  onClick={() => setNegativeConfirmed((v) => !v)}
                  className="flex items-center gap-2 mt-2 btn-press"
                >
                  <span
                    className="w-4 h-4 rounded flex items-center justify-center"
                    style={{
                      background: negativeConfirmed ? 'var(--warning)' : 'var(--surface-high)',
                    }}
                  >
                    {negativeConfirmed && (
                      <Icon name="check" size={12} style={{ color: 'var(--surface-deep)' }} />
                    )}
                  </span>
                  <span className="text-xs text-on-surface-dim">
                    {t('outing.adjustment_negative_confirm')}
                  </span>
                </button>
              )}
              <button
                onClick={() => {
                  onRegisterTotal(result.diffCents);
                  closeSheet();
                }}
                disabled={result.isNegative && !negativeConfirmed}
                className="w-full py-3 rounded-xl bg-primary text-on-surface font-semibold btn-press disabled:opacity-40 mt-3"
              >
                {t('outing.create_total_adjustment')}
              </button>
            </>
          );
        })()}
      </BottomSheet>
    </div>
  );
}

interface SheetAmountInputProps {
  currency: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function SheetAmountInput({ currency, value, onChange, placeholder }: SheetAmountInputProps) {
  return (
    <div className="flex items-baseline gap-1 bg-surface-high rounded-lg px-3 py-2.5">
      <span className="text-on-surface-faint text-sm">{currency}</span>
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '0,00'}
        className="bg-transparent text-lg font-bold text-on-surface tabular outline-none w-full"
        autoFocus
      />
    </div>
  );
}
