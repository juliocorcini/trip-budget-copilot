import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import {
  createSession,
  deriveSessionLimits,
  createSessionItem,
  calculateSessionTotal,
  calculateNextDrinkImpact,
  calculateReportedTotalDiff,
  getProgressiveAlerts,
} from '@/domain/outing';
import type { SessionLimits, OutingAlert } from '@/domain/outing';
import { createExpenseTransaction } from '@/domain/transactions';
import { buildSharesWithPayer, calculatePersonalCost } from '@/domain/splitting';
import { resolveActivePhase } from '@/domain/dates';
import { fromCents } from '@/domain/money';
import { createCustomActivityProfile } from '@/domain/profiles';
import { registerExpense, endOutingSession } from '@/domain/orchestrators';
import { sessionRepository } from '@/data/repositories/session-repository';
import { activityProfileRepository } from '@/data/repositories/activity-profile-repository';
import { transactionRepository } from '@/data/repositories';
import type { Session } from '@/domain/types/session';
import type { Transaction } from '@/domain/types/transaction';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { AppSettings } from '@/domain/types/app-settings';
import type { Participant } from '@/domain/types/participant';
import type { Wallet } from '@/domain/types/wallet';
import type { ShareType } from '@/domain/types/common';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { showToast, type ToastVariant } from '@/components/Toast';
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

function parseAmountToCents(value: string): number {
  const parsed = parseFloat(value.replace(',', '.'));
  return Number.isNaN(parsed) ? 0 : Math.round(parsed * 100);
}

const ALERT_VARIANT: Record<OutingAlert['type'], ToastVariant> = {
  info: 'info',
  warning: 'warning',
  danger: 'danger',
  critical: 'danger',
};

const ALERT_VIBRATION: Record<OutingAlert['type'], number[]> = {
  info: [80],
  warning: [120, 60, 120],
  danger: [200, 80, 200],
  critical: [300, 100, 300, 100, 300],
};

export function OutingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip, phases, pools, wallets, participants, settings, reload: reloadAppData } = useAppData();

  const [session, setSession] = useState<Session | null>(null);
  const [sessionTxs, setSessionTxs] = useState<Transaction[]>([]);
  const [profiles, setProfiles] = useState<ActivityProfile[]>([]);
  const [itemCount, setItemCount] = useState(0);
  const [elapsed, setElapsed] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [configuringProfile, setConfiguringProfile] = useState<ActivityProfile | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const currentPhase = resolveActivePhase(phases);
  const defaultPool = pools.find((p) => p.scope === 'linked_phases') ?? pools[0] ?? null;
  const owner = participants.find((p) => p.isOwner) ?? null;

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

  // GAP-015: profile selection opens an editable confirmation step.
  const handleChooseProfile = (profile: ActivityProfile) => {
    if (!trip || !currentPhase || !defaultPool) {
      showToast(t('outing.start_error'), 'danger');
      return;
    }
    setConfiguringProfile(profile);
  };

  const handleStartConfigured = async (config: SessionStartConfig) => {
    if (!trip || !currentPhase || !defaultPool || !configuringProfile) return;
    const sess = createSession({
      tripId: trip.id,
      phaseId: currentPhase.id,
      budgetPoolId: defaultPool.id,
      activityProfileId: configuringProfile.id,
      name: config.name,
      limits: config.limits,
      quickAddValuesCents: config.quickAddValuesCents,
    });
    await sessionRepository.create(sess);
    setConfiguringProfile(null);
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
    handleChooseProfile(profile);
  };

  // GAP-005 (DEC-048): fire each milestone once, honoring tone + vibration.
  const fireProgressiveAlerts = async (currentSession: Session, newTotalCents: number) => {
    if (!settings) return;
    const fired = currentSession.firedAlertPercents ?? [];
    const alerts = getProgressiveAlerts(newTotalCents, currentSession, settings.alertTone);
    const newAlerts = alerts.filter((a) => !fired.includes(a.percent));
    if (newAlerts.length === 0) return;

    const topAlert = newAlerts[newAlerts.length - 1]!;
    showToast(
      t(`outing.alerts.${settings.alertTone}.${topAlert.message}` as never),
      ALERT_VARIANT[topAlert.type],
    );
    if (settings.vibrationEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(ALERT_VIBRATION[topAlert.type]);
    }

    const updated = await sessionRepository.update({
      ...currentSession,
      firedAlertPercents: [...fired, ...newAlerts.map((a) => a.percent)],
    });
    setSession(updated);
  };

  const persistSessionItem = async (tx: Transaction, txsAfter: Transaction[]) => {
    if (!session) return;
    const newCount = itemCount + 1;
    const item = createSessionItem(session.id, tx.id, newCount);
    await db.sessionItems.add(item);
    setSessionTxs(txsAfter);
    setItemCount(newCount);
    await fireProgressiveAlerts(session, calculateSessionTotal(txsAfter));
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
    await persistSessionItem(tx, [...sessionTxs, tx]);
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

  // GAP-012 (DEC-047): shared expense inside the session.
  const handleSplitAdd = async (input: SessionSplitInput) => {
    if (!session || !trip || !currentPhase || !owner) return;
    const sessionProfile = profiles.find((p) => p.id === session.activityProfileId);
    const tx = createExpenseTransaction({
      tripId: trip.id,
      phaseId: currentPhase.id,
      budgetPoolId: session.budgetPoolId,
      walletId: null,
      amountCents: input.amountCents,
      currency: trip.baseCurrency,
      category: sessionProfile?.category ?? 'other',
      description: session.name,
      sessionId: session.id,
      activityProfileId: session.activityProfileId,
      isShared: true,
      paidByParticipantId: input.paidByParticipantId,
    });
    const shares = buildSharesWithPayer({
      transactionId: tx.id,
      amountCents: input.amountCents,
      participantIds: input.participantIds,
      paidByParticipantId: input.paidByParticipantId,
      shareType: input.shareType,
      customAmountsCents: input.customAmountsCents,
    });
    tx.personalCostCents = calculatePersonalCost(shares, owner.id);
    if (tx.paidByParticipantId !== owner.id) tx.walletId = null;
    await registerExpense({ transaction: tx, shares });
    await persistSessionItem(tx, [...sessionTxs, tx]);
  };

  // GAP-002 (DEC-049): ending opens the review instead of completing directly.
  const handleConfirmEnd = async (review: SessionReviewResult) => {
    if (!session || !trip || !currentPhase) return;
    const sessionProfile = profiles.find((p) => p.id === session.activityProfileId) ?? null;

    let totalAdjustment: Transaction | null = null;
    if (review.totalAdjustmentCents !== null && review.totalAdjustmentCents !== 0) {
      totalAdjustment = createExpenseTransaction({
        tripId: trip.id,
        phaseId: currentPhase.id,
        budgetPoolId: session.budgetPoolId,
        walletId: review.walletId,
        amountCents: review.totalAdjustmentCents,
        currency: trip.baseCurrency,
        category: sessionProfile?.category ?? 'other',
        description: t('outing.total_adjustment_desc'),
        sessionId: session.id,
        activityProfileId: session.activityProfileId,
      });
    }

    await endOutingSession({
      session,
      transactions: review.transactions,
      walletId: review.walletId,
      isSpecialOccasion: review.isSpecialOccasion,
      excludeFromLearning: review.excludeFromLearning,
      totalAdjustment,
      profile: sessionProfile,
    });

    showToast(t('outing.session_ended'), 'success');
    setReviewing(false);
    setSession(null);
    setSessionTxs([]);
    await reloadAppData();
    navigate('/dashboard');
  };

  if (!trip || !settings) return null;

  if (session && reviewing) {
    return (
      <SessionReview
        session={session}
        sessionTxs={sessionTxs}
        currency={trip.baseCurrency}
        wallets={wallets}
        onCancel={() => setReviewing(false)}
        onConfirm={handleConfirmEnd}
      />
    );
  }

  if (!session) {
    if (configuringProfile) {
      return (
        <SessionStartConfigForm
          profile={configuringProfile}
          currency={trip.baseCurrency}
          settings={settings}
          onCancel={() => setConfiguringProfile(null)}
          onStart={handleStartConfigured}
        />
      );
    }
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
            onClick={() => handleChooseProfile(profile)}
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
    participants={participants}
    owner={owner}
    onQuickAdd={handleQuickAdd}
    onRegisterTotal={handleRegisterTotal}
    onSplitAdd={handleSplitAdd}
    onEnd={() => setReviewing(true)}
    onBack={() => navigate(-1)}
  />;
}

/* ──────────────────────── SESSION START CONFIG (GAP-015) ──────────────────────── */

interface SessionStartConfig {
  name: string;
  limits: SessionLimits;
  quickAddValuesCents: number[];
}

interface SessionStartConfigFormProps {
  profile: ActivityProfile;
  currency: string;
  settings: AppSettings;
  onCancel: () => void;
  onStart: (config: SessionStartConfig) => void;
}

function SessionStartConfigForm({ profile, currency, settings, onCancel, onStart }: SessionStartConfigFormProps) {
  const { t } = useTranslation();
  const derived = useMemo(() => deriveSessionLimits(profile), [profile]);
  const initialQuickAdd =
    profile.quickAddValuesCents ?? settings.quickAddDefaultValuesCents;

  const [name, setName] = useState(profile.name);
  const [target, setTarget] = useState(String(fromCents(derived.targetCents)));
  const [ceiling, setCeiling] = useState(String(fromCents(derived.ceilingCents)));
  const [max, setMax] = useState(String(fromCents(derived.maxCents)));
  const [avgDrink, setAvgDrink] = useState(
    derived.avgDrinkPriceCents !== null ? String(fromCents(derived.avgDrinkPriceCents)) : '',
  );
  const [quickValues, setQuickValues] = useState<string[]>(
    initialQuickAdd.map((v) => String(fromCents(v))),
  );

  const targetCents = parseAmountToCents(target);
  const ceilingCents = parseAmountToCents(ceiling);
  const maxCents = parseAmountToCents(max);
  const limitsValid = targetCents > 0 && ceilingCents >= targetCents && maxCents >= ceilingCents;

  const handleStart = () => {
    if (!limitsValid || !name.trim()) return;
    onStart({
      name: name.trim(),
      limits: {
        targetCents,
        ceilingCents,
        maxCents,
        avgDrinkPriceCents: avgDrink ? parseAmountToCents(avgDrink) : null,
      },
      quickAddValuesCents: quickValues
        .map(parseAmountToCents)
        .filter((v) => v > 0),
    });
  };

  return (
    <div className="flex flex-col gap-4 pb-4 pt-2">
      <div className="flex items-center gap-3 pt-2">
        <button onClick={onCancel} className="btn-press p-1">
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('outing.config_title')}</h1>
      </div>

      <div className="bg-surface-container rounded-xl p-4">
        <label className="text-xs text-on-surface-faint mb-1 block">{t('outing.config_name')}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-transparent text-sm font-semibold text-on-surface outline-none w-full"
        />
      </div>

      <div className="bg-surface-container rounded-xl p-4">
        <p className="text-xs text-on-surface-faint mb-3">{t('outing.config_limits')}</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t('outing.limit_target'), value: target, set: setTarget, color: 'var(--success)' },
            { label: t('outing.limit_ceiling'), value: ceiling, set: setCeiling, color: 'var(--primary)' },
            { label: t('outing.limit_max'), value: max, set: setMax, color: 'var(--error)' },
          ].map((field) => (
            <div key={field.label} className="bg-surface-high rounded-lg p-2.5">
              <p className="text-[9px] font-bold mb-1" style={{ color: field.color }}>
                {field.label}
              </p>
              <div className="flex items-baseline gap-0.5">
                <span className="text-on-surface-faint text-[10px]">{currency}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={field.value}
                  onChange={(e) => field.set(e.target.value)}
                  className="bg-transparent text-sm font-bold text-on-surface tabular outline-none w-full"
                />
              </div>
            </div>
          ))}
        </div>
        {!limitsValid && (
          <p className="text-xs text-warning mt-2">{t('outing.config_invalid')}</p>
        )}
      </div>

      <div className="bg-surface-container rounded-xl p-4">
        <label className="text-xs text-on-surface-faint mb-1 block">{t('outing.config_avg_drink')}</label>
        <div className="flex items-baseline gap-1">
          <span className="text-on-surface-faint text-xs">{currency}</span>
          <input
            type="number"
            inputMode="decimal"
            value={avgDrink}
            onChange={(e) => setAvgDrink(e.target.value)}
            placeholder="—"
            className="bg-transparent text-sm font-bold text-on-surface tabular outline-none w-full"
          />
        </div>
      </div>

      <div className="bg-surface-container rounded-xl p-4">
        <p className="text-xs text-on-surface-faint mb-2">{t('outing.config_quick_values')}</p>
        <div className="grid grid-cols-5 gap-2">
          {quickValues.map((value, i) => (
            <div key={i} className="bg-surface-high rounded-lg px-2 py-1.5 flex items-baseline gap-0.5">
              <span className="text-on-surface-faint text-[10px]">{currency}</span>
              <input
                type="number"
                inputMode="decimal"
                value={value}
                onChange={(e) =>
                  setQuickValues((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                }
                className="bg-transparent text-xs font-bold text-on-surface tabular outline-none w-full"
              />
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleStart}
        disabled={!limitsValid || !name.trim()}
        className="w-full py-3.5 rounded-xl bg-primary text-on-surface font-bold btn-press disabled:opacity-40"
      >
        {t('outing.start_session')}
      </button>
    </div>
  );
}

/* ──────────────────────── END-OF-SESSION REVIEW (GAP-002 / DEC-049) ──────────────────────── */

interface SessionReviewResult {
  transactions: Transaction[];
  walletId: string | null;
  isSpecialOccasion: boolean;
  excludeFromLearning: boolean;
  totalAdjustmentCents: number | null;
}

interface SessionReviewProps {
  session: Session;
  sessionTxs: Transaction[];
  currency: string;
  wallets: Wallet[];
  onCancel: () => void;
  onConfirm: (result: SessionReviewResult) => void;
}

function SessionReview({ session, sessionTxs, currency, wallets, onCancel, onConfirm }: SessionReviewProps) {
  const { t } = useTranslation();
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(sessionTxs.map((tx) => [tx.id, String(fromCents(tx.amountCents))])),
  );
  const [walletId, setWalletId] = useState<string | null>(
    wallets.find((w) => w.isDefault)?.id ?? null,
  );
  const [isSpecial, setIsSpecial] = useState(false);
  const [excludeLearning, setExcludeLearning] = useState(false);
  const [reportedTotal, setReportedTotal] = useState('');
  const [saving, setSaving] = useState(false);

  const finalTxs = useMemo(
    () =>
      sessionTxs.map((tx) => {
        const cents = parseAmountToCents(amounts[tx.id] ?? '');
        if (cents <= 0 || cents === tx.amountCents) return tx;
        // Shared items keep their personal cost; only simple items rescale it.
        const personalCostCents = tx.isShared ? tx.personalCostCents : cents;
        return { ...tx, amountCents: cents, baseCurrencyAmountCents: cents, personalCostCents };
      }),
    [sessionTxs, amounts],
  );

  const total = calculateSessionTotal(finalTxs);
  const reportedCents = reportedTotal ? parseAmountToCents(reportedTotal) : null;
  const totalDiff =
    reportedCents !== null && reportedCents >= 0
      ? calculateReportedTotalDiff(reportedCents, total)
      : null;

  const handleConfirm = () => {
    if (saving) return;
    setSaving(true);
    onConfirm({
      transactions: finalTxs,
      walletId,
      isSpecialOccasion: isSpecial,
      excludeFromLearning: excludeLearning,
      totalAdjustmentCents: totalDiff?.needsAdjustment ? totalDiff.diffCents : null,
    });
  };

  return (
    <div className="max-w-[430px] mx-auto flex flex-col gap-4 pb-6 px-5 pt-2 min-h-screen">
      <div className="flex items-center gap-3 pt-2">
        <button onClick={onCancel} className="btn-press p-1">
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('outing.review_title')}</h1>
      </div>

      <div className="bg-surface-container rounded-2xl p-5 text-center">
        <p className="text-xs text-on-surface-faint">{t('outing.review_total')}</p>
        <p className="text-display font-extrabold tabular text-on-surface mt-1">
          {formatCurrencyFull(total, currency)}
        </p>
        <p className="text-xs text-on-surface-faint mt-1">{session.name}</p>
      </div>

      {/* Items (editable) */}
      <div className="bg-surface-container rounded-xl p-4">
        <p className="text-xs text-on-surface-faint mb-3">
          {t('outing.review_items')} ({sessionTxs.length})
        </p>
        <div className="flex flex-col gap-2">
          {sessionTxs.map((tx) => (
            <div key={tx.id} className="flex items-center gap-2">
              <span className="text-xs text-on-surface-dim flex-1 truncate">
                {tx.description}
                {tx.isShared && (
                  <Icon name="group" size={12} className="text-on-surface-faint ml-1 align-middle" />
                )}
              </span>
              <span className="text-[10px] text-on-surface-faint tabular">{formatTime(tx.date)}</span>
              <div className="flex items-baseline gap-1 bg-surface-high rounded-lg px-2.5 py-1.5 w-24">
                <span className="text-on-surface-faint text-[10px]">{currency}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={amounts[tx.id] ?? ''}
                  onChange={(e) =>
                    setAmounts((prev) => ({ ...prev, [tx.id]: e.target.value }))
                  }
                  className="bg-transparent text-xs font-bold text-on-surface tabular outline-none w-full"
                />
              </div>
            </div>
          ))}
          {sessionTxs.length === 0 && (
            <p className="text-xs text-on-surface-faint">{t('outing.review_no_items')}</p>
          )}
        </div>
      </div>

      {/* Batch wallet assignment */}
      <div className="bg-surface-container rounded-xl p-4">
        <p className="text-xs text-on-surface-faint mb-1">{t('outing.review_wallet')}</p>
        <p className="text-[10px] text-on-surface-faint mb-2">{t('outing.review_wallet_hint')}</p>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setWalletId(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
              walletId === null
                ? 'bg-warning/20 text-warning ring-1 ring-warning'
                : 'bg-surface-high text-on-surface-dim'
            }`}
          >
            {t('expenses.wallet_not_set')}
          </button>
          {wallets.map((wallet) => (
            <button
              key={wallet.id}
              onClick={() => setWalletId(wallet.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                walletId === wallet.id ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
              }`}
            >
              {wallet.name}
            </button>
          ))}
        </div>
      </div>

      {/* Optional cash check (DEC-046 reuse) */}
      <div className="bg-surface-container rounded-xl p-4">
        <p className="text-xs text-on-surface-faint mb-2">{t('outing.review_cash_check')}</p>
        <div className="flex items-baseline gap-1 bg-surface-high rounded-lg px-3 py-2">
          <span className="text-on-surface-faint text-xs">{currency}</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={reportedTotal}
            onChange={(e) => setReportedTotal(e.target.value)}
            placeholder={t('outing.informed_total')}
            className="bg-transparent text-sm font-bold text-on-surface tabular outline-none w-full"
          />
        </div>
        {totalDiff?.needsAdjustment && (
          <p className={`text-xs font-semibold mt-2 ${totalDiff.isNegative ? 'text-warning' : 'text-on-surface-dim'}`}>
            {t('outing.adjustment_preview', {
              amount: formatCurrencyFull(totalDiff.diffCents, currency),
            })}
          </p>
        )}
      </div>

      {/* Classification (DEC-049) */}
      <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-3">
        <p className="text-xs text-on-surface-faint">{t('outing.review_classification')}</p>
        <div className="flex gap-2">
          <button
            onClick={() => setIsSpecial(false)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${
              !isSpecial ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
            }`}
          >
            {t('outing.review_typical')}
          </button>
          <button
            onClick={() => setIsSpecial(true)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${
              isSpecial ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
            }`}
          >
            {t('outing.review_special')}
          </button>
        </div>
        {isSpecial && (
          <p className="text-[10px] text-on-surface-faint">{t('outing.review_special_hint')}</p>
        )}
        <button
          onClick={() => setExcludeLearning((v) => !v)}
          className="flex items-center gap-2 btn-press"
        >
          <span
            className="w-4 h-4 rounded flex items-center justify-center"
            style={{ background: excludeLearning ? 'var(--primary)' : 'var(--surface-high)' }}
          >
            {excludeLearning && (
              <Icon name="check" size={12} style={{ color: 'var(--surface-deep)' }} />
            )}
          </span>
          <span className="text-xs text-on-surface-dim">{t('outing.review_exclude_learning')}</span>
        </button>
      </div>

      <button
        onClick={handleConfirm}
        disabled={saving}
        className="w-full py-3.5 rounded-xl bg-primary text-on-surface font-bold btn-press disabled:opacity-40"
      >
        {saving ? t('common.loading') : t('outing.review_confirm')}
      </button>
    </div>
  );
}

/* ──────────────────────── ACTIVE SESSION ──────────────────────── */

interface SessionSplitInput {
  amountCents: number;
  participantIds: string[];
  paidByParticipantId: string;
  shareType: ShareType;
  customAmountsCents: Record<string, number>;
}

interface ActiveSessionProps {
  session: Session;
  sessionTxs: Transaction[];
  trip: { baseCurrency: string };
  elapsed: string;
  sessionIcon: string;
  sessionCategory: string;
  participants: Participant[];
  owner: Participant | null;
  onQuickAdd: (cents: number) => void;
  onRegisterTotal: (diffCents: number) => void;
  onSplitAdd: (input: SessionSplitInput) => void;
  onEnd: () => void;
  onBack: () => void;
}

function ActiveSession({ session, sessionTxs, trip, elapsed, sessionIcon, sessionCategory, participants, owner, onQuickAdd, onRegisterTotal, onSplitAdd, onEnd, onBack }: ActiveSessionProps) {
  const { t } = useTranslation();
  const currency = trip.baseCurrency;

  const [activeSheet, setActiveSheet] = useState<'other' | 'total' | 'split' | null>(null);
  const [sheetAmount, setSheetAmount] = useState('');
  const [negativeConfirmed, setNegativeConfirmed] = useState(false);

  const [splitParticipantIds, setSplitParticipantIds] = useState<string[]>([]);
  const [splitPaidById, setSplitPaidById] = useState<string | null>(null);
  const [splitMode, setSplitMode] = useState<ShareType>('equal');
  const [splitCustomAmounts, setSplitCustomAmounts] = useState<Record<string, string>>({});

  const canSplit = participants.length > 1 && owner !== null;

  const closeSheet = () => {
    setActiveSheet(null);
    setSheetAmount('');
    setNegativeConfirmed(false);
    setSplitCustomAmounts({});
  };

  const openSplitSheet = () => {
    setSplitParticipantIds(participants.map((p) => p.id));
    setSplitPaidById(owner?.id ?? null);
    setSplitMode('equal');
    setActiveSheet('split');
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

  const splitAmountCents = parseAmountToCents(sheetAmount);
  const canConfirmSplit =
    splitAmountCents > 0 && splitParticipantIds.length >= 2 && splitPaidById !== null;

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
                    {tx.isShared && (
                      <Icon name="group" size={11} className="text-on-surface-faint ml-1 align-middle" />
                    )}
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
                    {formatCurrencyFull(tx.personalCostCents ?? tx.amountCents, tx.currency)}
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
        <div className="flex gap-2.5">
          <button
            onClick={() => setActiveSheet('total')}
            className="btn-press flex-1 py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
            style={{ background: 'var(--surface-container)', color: 'var(--on-surface-dim)' }}
          >
            <Icon name="edit_note" size={16} className="text-on-surface-faint" />
            {t('outing.register_total')}
          </button>
          {canSplit && (
            <button
              onClick={openSplitSheet}
              className="btn-press flex-1 py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
              style={{ background: 'var(--surface-container)', color: 'var(--on-surface-dim)' }}
            >
              <Icon name="group" size={16} className="text-on-surface-faint" />
              {t('outing.split_action')}
            </button>
          )}
        </div>
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
            const cents = parseAmountToCents(sheetAmount);
            if (cents > 0) {
              onQuickAdd(cents);
              closeSheet();
            }
          }}
          disabled={parseAmountToCents(sheetAmount) <= 0}
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
          const informedCents = sheetAmount ? parseAmountToCents(sheetAmount) : null;
          if (informedCents === null || informedCents < 0) return null;
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

      {/* Split sheet (GAP-012 / DEC-047) */}
      <BottomSheet
        open={activeSheet === 'split'}
        onClose={closeSheet}
        title={t('outing.split_action')}
      >
        <div className="flex flex-col gap-3">
          <SheetAmountInput currency={currency} value={sheetAmount} onChange={setSheetAmount} />

          <div>
            <label className="text-xs text-on-surface-faint mb-2 block">
              {t('expenses.participants_label')}
            </label>
            <div className="flex gap-2 flex-wrap">
              {participants.map((p) => (
                <button
                  key={p.id}
                  onClick={() =>
                    setSplitParticipantIds((prev) =>
                      prev.includes(p.id) ? prev.filter((pid) => pid !== p.id) : [...prev, p.id],
                    )
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                    splitParticipantIds.includes(p.id)
                      ? 'bg-primary text-on-surface'
                      : 'bg-surface-high text-on-surface-dim'
                  }`}
                >
                  {p.isOwner ? t('shared.owner_tag') : (p.nickname ?? p.name)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-on-surface-faint mb-2 block">{t('expenses.who_paid')}</label>
            <div className="flex gap-2 flex-wrap">
              {participants.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSplitPaidById(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                    splitPaidById === p.id ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                  }`}
                >
                  {p.isOwner ? t('shared.owner_tag') : (p.nickname ?? p.name)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-on-surface-faint mb-2 block">{t('expenses.split_mode')}</label>
            <div className="flex gap-2">
              {(['equal', 'custom'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSplitMode(mode)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${
                    splitMode === mode ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                  }`}
                >
                  {t(mode === 'equal' ? 'expenses.split_equal' : 'expenses.split_custom')}
                </button>
              ))}
            </div>
          </div>

          {splitMode === 'custom' && (
            <div className="flex flex-col gap-2">
              {participants
                .filter((p) => splitParticipantIds.includes(p.id))
                .map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="text-xs text-on-surface-dim flex-1 truncate">
                      {p.isOwner ? t('shared.owner_tag') : (p.nickname ?? p.name)}
                    </span>
                    <div className="flex items-baseline gap-1 bg-surface-high rounded-lg px-3 py-1.5 w-28">
                      <span className="text-on-surface-faint text-xs">{currency}</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={splitCustomAmounts[p.id] ?? ''}
                        onChange={(e) =>
                          setSplitCustomAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                        placeholder="0,00"
                        className="bg-transparent text-xs text-on-surface tabular outline-none w-full"
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}

          <button
            onClick={() => {
              if (!canConfirmSplit || !splitPaidById) return;
              onSplitAdd({
                amountCents: splitAmountCents,
                participantIds: splitParticipantIds,
                paidByParticipantId: splitPaidById,
                shareType: splitMode,
                customAmountsCents: Object.fromEntries(
                  splitParticipantIds.map((pid) => [
                    pid,
                    parseAmountToCents(splitCustomAmounts[pid] ?? ''),
                  ]),
                ),
              });
              closeSheet();
            }}
            disabled={!canConfirmSplit}
            className="w-full py-3 rounded-xl bg-primary text-on-surface font-semibold btn-press disabled:opacity-40"
          >
            {t('common.add')}
          </button>
        </div>
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
        autoFocus
        className="bg-transparent text-lg font-bold text-on-surface tabular outline-none w-full"
      />
    </div>
  );
}
