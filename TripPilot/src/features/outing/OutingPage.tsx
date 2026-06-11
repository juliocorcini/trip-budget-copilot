import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import {
  createSession,
  deriveSessionLimits,
  createSessionItem,
  calculateSessionTotal,
  calculateNextDrinkImpact,
  calculateReportedTotalDiff,
  calculateGaugePosition,
  GAUGE_TARGET_END,
  GAUGE_CEILING_END,
  getProgressiveAlerts,
  DEFAULT_QUICK_ADD_VALUES_CENTS,
  findHighlightedQuickValueIndex,
  ENRICH_AUTO_DISMISS_MS,
  getSubcategories,
  sortSubcategoriesByProximity,
  findSubcategory,
  EVENT_CONTEXTS,
} from '@/domain/outing';
import type {
  SessionLimits,
  OutingAlert,
  EnrichStep,
  ExpenseSubcategory,
  EventContext,
} from '@/domain/outing';
import { createExpenseTransaction } from '@/domain/transactions';
import { buildSharesWithPayer, calculatePersonalCost } from '@/domain/splitting';
import { resolveActivePhase, localDateString } from '@/domain/dates';
import { fromCents } from '@/domain/money';
import { createCustomActivityProfile, isProfileEnabledInPhase } from '@/domain/profiles';
import { createPlannedOccurrence } from '@/domain/planning';
import {
  registerExpense,
  enrichTransactionShares,
  endOutingSession,
  createProfileEnabledInPhase,
  startSessionForOccurrence,
  startOneOffEventSession,
} from '@/domain/orchestrators';
import { requestPersistentStorage } from '@/utils/pwa';
import { sessionRepository } from '@/data/repositories/session-repository';
import { activityProfileRepository } from '@/data/repositories/activity-profile-repository';
import { phaseProfileSettingRepository } from '@/data/repositories/phase-profile-setting-repository';
import { plannedOccurrenceRepository } from '@/data/repositories/planned-occurrence-repository';
import { transactionRepository } from '@/data/repositories';
import type { Session } from '@/domain/types/session';
import type { Transaction } from '@/domain/types/transaction';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';
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

/**
 * DEC-097 (R-18): item label = subcategory when detailed; own description
 * when it carries information; the category as last resort — NEVER the
 * session name repeated.
 */
function formatSessionItemLabel(
  tx: Transaction,
  sessionName: string,
  t: (key: never) => string,
): string {
  const subcategory = findSubcategory(tx.subcategoryId);
  if (subcategory) return t(subcategory.labelKey as never);
  if (tx.description !== '' && tx.description !== sessionName) return tx.description;
  return t(`categories.${tx.category ?? 'other'}` as never);
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

// DEC-053(b): over-max confirmation is remembered for 15 minutes.
const OVER_MAX_REMEMBER_MS = 15 * 60 * 1000;

type PhaseChoice = 'keep' | 'move' | 'split';
type PendingPhaseAction = (txPhaseId: string, sess: Session) => Promise<void>;

// DEC-078: enrichment target — the transaction is already persisted.
interface EnrichTarget {
  txId: string;
  amountCents: number;
  step: EnrichStep;
  paidById: string | null;
  /** DEC-096 (R-17): level-2 taxonomy of the chosen event context. */
  contextTaxonomyKey: string | null;
  /** True when re-detailing an item or enriching a split — payer is known. */
  skipPayer: boolean;
}

export function OutingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trip, phases, pools, wallets, participants, settings, reload: reloadAppData } = useAppData();

  const [session, setSession] = useState<Session | null>(null);
  const [sessionTxs, setSessionTxs] = useState<Transaction[]>([]);
  const [profiles, setProfiles] = useState<ActivityProfile[]>([]);
  // null = no active phase → no filtering (permissive default).
  const [enabledProfileIds, setEnabledProfileIds] = useState<Set<string> | null>(null);
  const [itemCount, setItemCount] = useState(0);
  const [elapsed, setElapsed] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [configuringProfile, setConfiguringProfile] = useState<ActivityProfile | null>(null);
  // DEC-072 (M6.3): pre-configured start coming from the day card.
  const [configuringOccurrence, setConfiguringOccurrence] = useState<PlannedOccurrence | null>(null);
  // DEC-073 (M6.5): custom flow asks "is this a one-off event?" first.
  const [showOneOffQuestion, setShowOneOffQuestion] = useState(false);
  const [configuringOneOff, setConfiguringOneOff] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  // DEC-078 (FIELD-08): post-add enrichment stepper — tx already saved.
  const [enrich, setEnrich] = useState<EnrichTarget | null>(null);

  // DEC-053(b)/(c) confirmatory gates
  const [pendingOverMaxAdd, setPendingOverMaxAdd] = useState<{
    amountCents: number;
    txPhaseId: string;
  } | null>(null);
  const [pendingPhaseAction, setPendingPhaseAction] = useState<PendingPhaseAction | null>(null);
  const [phaseChoice, setPhaseChoice] = useState<PhaseChoice | null>(null);

  const currentPhase = resolveActivePhase(phases);
  // DEC-074: the start picker only offers profiles enabled in the active phase.
  const startableProfiles =
    enabledProfileIds === null ? profiles : profiles.filter((p) => enabledProfileIds.has(p.id));
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
      // DEC-074: the start screen only offers profiles enabled in the active phase.
      const phase = resolveActivePhase(phases);
      if (phase) {
        const phaseSettings = await phaseProfileSettingRepository.getByPhaseId(phase.id);
        setEnabledProfileIds(
          new Set(
            profs
              .filter((p) => isProfileEnabledInPhase(phaseSettings, phase.id, p.id))
              .map((p) => p.id),
          ),
        );
      } else {
        setEnabledProfileIds(null);
      }
      // DEC-072 (M6.3): /outings/new?occurrence=<id> pre-configures the start.
      const occurrenceId = searchParams.get('occurrence');
      if (occurrenceId && !active) {
        const occurrence = await plannedOccurrenceRepository.getById(occurrenceId);
        if (occurrence && !occurrence.isConfirmed && occurrence.linkedSessionId === null) {
          setConfiguringOccurrence(occurrence);
        }
      }
    };
    load();
  }, [trip, phases, searchParams]);

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

  // DEC-072 (M6.3): start the session linked to the day-card occurrence —
  // the link is recorded atomically and the reserve stops deducting.
  const handleStartForOccurrence = async (config: SessionStartConfig) => {
    if (!trip || !currentPhase || !defaultPool || !configuringOccurrence) return;
    const sess = createSession({
      tripId: trip.id,
      phaseId: currentPhase.id,
      budgetPoolId: defaultPool.id,
      activityProfileId: null,
      name: config.name,
      limits: config.limits,
      quickAddValuesCents: config.quickAddValuesCents,
    });
    await startSessionForOccurrence({ session: sess, occurrenceId: configuringOccurrence.id });
    setConfiguringOccurrence(null);
    setSession(sess);
    setSessionTxs([]);
    setItemCount(0);
  };

  // DEC-073 (M6.5 / FIELD-04): one-off event creates a linked occurrence,
  // never an ActivityProfile — no Planner/Profiles contamination.
  const handleStartOneOff = async (config: SessionStartConfig) => {
    if (!trip || !currentPhase || !defaultPool) return;
    const sess = createSession({
      tripId: trip.id,
      phaseId: currentPhase.id,
      budgetPoolId: defaultPool.id,
      activityProfileId: null,
      name: config.name,
      limits: config.limits,
      quickAddValuesCents: config.quickAddValuesCents,
    });
    const occurrence = createPlannedOccurrence({
      tripId: trip.id,
      phaseId: currentPhase.id,
      budgetPoolId: defaultPool.id,
      name: config.name,
      plannedDate: localDateString(new Date()),
      endDate: null,
      kind: 'event',
      estimatedCostCents: config.limits.ceilingCents,
      reservedCents: null,
      activityProfileId: null,
    });
    await startOneOffEventSession({ session: sess, occurrence });
    setConfiguringOneOff(false);
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
    // DEC-074: a profile created mid-flow is enabled in the current phase.
    if (currentPhase) {
      await createProfileEnabledInPhase({ profile, phaseId: currentPhase.id });
    } else {
      await activityProfileRepository.create(profile);
    }
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

  const persistSessionItem = async (tx: Transaction, txsAfter: Transaction[], sess: Session) => {
    const newCount = itemCount + 1;
    const item = createSessionItem(sess.id, tx.id, newCount);
    await db.sessionItems.add(item);
    setSessionTxs(txsAfter);
    setItemCount(newCount);
    await fireProgressiveAlerts(sess, calculateSessionTotal(txsAfter));
  };

  const addSessionExpense = async (
    amountCents: number,
    description: string,
    sess: Session,
    txPhaseId: string,
  ): Promise<Transaction | null> => {
    if (!trip) return null;
    const sessionProfile = profiles.find((p) => p.id === sess.activityProfileId);
    const tx = createExpenseTransaction({
      tripId: trip.id,
      phaseId: txPhaseId,
      budgetPoolId: sess.budgetPoolId,
      walletId: null,
      amountCents,
      currency: trip.baseCurrency,
      category: sessionProfile?.category ?? 'other',
      description,
      sessionId: sess.id,
      activityProfileId: sess.activityProfileId,
    });
    await transactionRepository.create(tx);
    await persistSessionItem(tx, [...sessionTxs, tx], sess);
    return tx;
  };

  // DEC-053(c): a session crossing a phase boundary asks once where new
  // expenses should land (keep / move / split). Confirmatory, never blocking.
  const resolveTxPhaseId = (sess: Session): string =>
    phaseChoice === 'keep' ? sess.phaseId : (currentPhase?.id ?? sess.phaseId);

  const runWithPhaseGate = (action: PendingPhaseAction): boolean => {
    if (session && currentPhase && currentPhase.id !== session.phaseId && phaseChoice === null) {
      setPendingPhaseAction(() => action);
      return true;
    }
    return false;
  };

  const handlePhaseChoice = async (choice: PhaseChoice) => {
    if (!session || !currentPhase) return;
    let sess = session;
    if (choice === 'move') {
      sess = await sessionRepository.update({ ...session, phaseId: currentPhase.id });
      setSession(sess);
    }
    setPhaseChoice(choice);
    const action = pendingPhaseAction;
    setPendingPhaseAction(null);
    if (action) {
      const txPhaseId = choice === 'keep' ? sess.phaseId : currentPhase.id;
      await action(txPhaseId, sess);
    }
  };

  // DEC-053(b): quick-add above max asks for confirmation, remembered 15 min.
  const doQuickAdd = async (amountCents: number, sess: Session, txPhaseId: string) => {
    const newTotalCents = calculateSessionTotal(sessionTxs) + amountCents;
    const confirmedRecently =
      sess.overMaxConfirmedAt !== null &&
      Date.now() - new Date(sess.overMaxConfirmedAt).getTime() < OVER_MAX_REMEMBER_MS;
    if (sess.maxCents !== null && sess.maxCents > 0 && newTotalCents > sess.maxCents && !confirmedRecently) {
      setPendingOverMaxAdd({ amountCents, txPhaseId });
      return;
    }
    const tx = await addSessionExpense(amountCents, sess.name, sess, txPhaseId);
    // DEC-078: the stepper only enriches — the expense above is already saved.
    if (tx) setEnrich(buildEnrichTarget(tx.id, amountCents, sess, false));
  };

  const handleQuickAdd = async (amountCents: number) => {
    if (!session) return;
    if (runWithPhaseGate((txPhaseId, sess) => doQuickAdd(amountCents, sess, txPhaseId))) return;
    await doQuickAdd(amountCents, session, resolveTxPhaseId(session));
  };

  const handleConfirmOverMax = async () => {
    if (!session || !pendingOverMaxAdd) return;
    const updated = await sessionRepository.update({
      ...session,
      overMaxConfirmedAt: new Date().toISOString(),
    });
    setSession(updated);
    const pending = pendingOverMaxAdd;
    setPendingOverMaxAdd(null);
    const tx = await addSessionExpense(pending.amountCents, updated.name, updated, pending.txPhaseId);
    if (tx) setEnrich(buildEnrichTarget(tx.id, pending.amountCents, updated, false));
  };

  // DEC-095/096: profile sessions ask the subcategory directly; event
  // sessions (no profile) ask the context first (level 1 → level 2).
  const buildEnrichTarget = (
    txId: string,
    amountCents: number,
    sess: Session,
    skipPayer: boolean,
  ): EnrichTarget => ({
    txId,
    amountCents,
    step: sess.activityProfileId !== null ? 'category' : 'context',
    paidById: null,
    contextTaxonomyKey: null,
    skipPayer,
  });

  // DEC-096 (R-14): 10s without interaction dismisses the stepper; every
  // state object change (including touch bumps) resets the timer.
  useEffect(() => {
    if (enrich === null) return;
    const timer = window.setTimeout(() => setEnrich(null), ENRICH_AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [enrich]);

  // DEC-096 (R-14): any touch/scroll on the stepper resets the idle timer.
  const handleEnrichInteract = () => {
    setEnrich((current) => (current === null ? null : { ...current }));
  };

  const otherParticipants = participants.filter((p) => !p.isOwner);

  const replaceSessionTx = (updated: Transaction) => {
    setSessionTxs((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  // DEC-096 (R-17) level 1: the context is stored as the category.
  const handleEnrichContext = async (context: EventContext) => {
    if (!enrich) return;
    const tx = await transactionRepository.getById(enrich.txId);
    if (tx) {
      const updated = await transactionRepository.update({ ...tx, category: context.category });
      replaceSessionTx(updated);
    }
    setEnrich({ ...enrich, step: 'category', contextTaxonomyKey: context.taxonomyKey });
  };

  // DEC-095 (R-13): the "what was it" answer is a taxonomy subcategory.
  const handleEnrichSubcategory = async (subcategory: ExpenseSubcategory) => {
    if (!enrich) return;
    const tx = await transactionRepository.getById(enrich.txId);
    if (tx) {
      const updated = await transactionRepository.update({ ...tx, subcategoryId: subcategory.id });
      replaceSessionTx(updated);
    }
    if (!enrich.skipPayer && otherParticipants.length > 0) {
      setEnrich({ ...enrich, step: 'payer' });
    } else {
      setEnrich(null);
    }
  };

  const handleEnrichPayer = (participantId: string) => {
    if (!enrich || !owner) return;
    // "Me" is already the default payer of a simple expense — nothing to change.
    if (participantId === owner.id) {
      setEnrich(null);
      return;
    }
    setEnrich({ ...enrich, step: 'split', paidById: participantId });
  };

  const handleEnrichSplit = async (didSplit: boolean) => {
    if (!enrich || !owner || enrich.paidById === null) {
      setEnrich(null);
      return;
    }
    const tx = await transactionRepository.getById(enrich.txId);
    if (tx) {
      const participantIds = didSplit ? [owner.id, enrich.paidById] : [enrich.paidById];
      const shares = buildSharesWithPayer({
        transactionId: tx.id,
        amountCents: tx.amountCents,
        participantIds,
        paidByParticipantId: enrich.paidById,
        shareType: 'equal',
        customAmountsCents: {},
      });
      const updated = await enrichTransactionShares({
        transaction: {
          ...tx,
          isShared: true,
          paidByParticipantId: enrich.paidById,
          // Someone else paid → it never left one of MY wallets.
          walletId: null,
          personalCostCents: calculatePersonalCost(shares, owner.id),
        },
        shares,
      });
      replaceSessionTx(updated);
    }
    setEnrich(null);
  };

  // DEC-046: reported total creates an adjustment for the DIFFERENCE,
  // never replacing logged items.
  const handleRegisterTotal = async (diffCents: number) => {
    if (!session) return;
    const description = t('outing.total_adjustment_desc');
    if (runWithPhaseGate(async (txPhaseId, sess) => { await addSessionExpense(diffCents, description, sess, txPhaseId); })) return;
    await addSessionExpense(diffCents, description, session, resolveTxPhaseId(session));
  };

  // GAP-012 (DEC-047): shared expense inside the session.
  const doSplitAdd = async (input: SessionSplitInput, sess: Session, txPhaseId: string) => {
    if (!trip || !owner) return;
    const sessionProfile = profiles.find((p) => p.id === sess.activityProfileId);
    const tx = createExpenseTransaction({
      tripId: trip.id,
      phaseId: txPhaseId,
      budgetPoolId: sess.budgetPoolId,
      walletId: null,
      amountCents: input.amountCents,
      currency: trip.baseCurrency,
      category: sessionProfile?.category ?? 'other',
      description: sess.name,
      sessionId: sess.id,
      activityProfileId: sess.activityProfileId,
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
    await persistSessionItem(tx, [...sessionTxs, tx], sess);
    // DEC-096 (R-16): the split flow also asks WHAT it was — payer and
    // shares are already set, so the stepper skips those steps.
    setEnrich(buildEnrichTarget(tx.id, input.amountCents, sess, true));
    // GAP-R2-005: idempotent — ensures storage persistence after the first expense.
    requestPersistentStorage();
  };

  const handleSplitAdd = async (input: SessionSplitInput) => {
    if (!session) return;
    if (runWithPhaseGate((txPhaseId, sess) => doSplitAdd(input, sess, txPhaseId))) return;
    await doSplitAdd(input, session, resolveTxPhaseId(session));
  };

  // DEC-045 (GAP-028): quick-add values editable mid-session.
  const handleUpdateQuickValues = async (valuesCents: number[]) => {
    if (!session) return;
    const updated = await sessionRepository.update({ ...session, quickAddValuesCents: valuesCents });
    setSession(updated);
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
      const derived = deriveSessionLimits(configuringProfile);
      return (
        <SessionStartConfigForm
          initialName={configuringProfile.name}
          initialLimits={derived}
          initialQuickAddCents={
            configuringProfile.quickAddValuesCents ?? settings.quickAddDefaultValuesCents
          }
          currency={trip.baseCurrency}
          onCancel={() => setConfiguringProfile(null)}
          onStart={handleStartConfigured}
        />
      );
    }
    if (configuringOccurrence) {
      // DEC-072: ceiling = reserved money; estimated cost is the fallback.
      const baseCents =
        configuringOccurrence.reservedCents ??
        (configuringOccurrence.estimatedCostCents > 0
          ? configuringOccurrence.estimatedCostCents
          : 4000);
      return (
        <SessionStartConfigForm
          initialName={configuringOccurrence.name}
          initialLimits={{
            targetCents: Math.round(baseCents * 0.8),
            ceilingCents: baseCents,
            maxCents: Math.round(baseCents * 1.3),
            avgDrinkPriceCents: null,
          }}
          initialQuickAddCents={settings.quickAddDefaultValuesCents}
          currency={trip.baseCurrency}
          onCancel={() => setConfiguringOccurrence(null)}
          onStart={handleStartForOccurrence}
        />
      );
    }
    if (configuringOneOff) {
      return (
        <SessionStartConfigForm
          initialName=""
          initialLimits={{
            targetCents: 3000,
            ceilingCents: 4000,
            maxCents: 5000,
            avgDrinkPriceCents: null,
          }}
          initialQuickAddCents={settings.quickAddDefaultValuesCents}
          currency={trip.baseCurrency}
          onCancel={() => setConfiguringOneOff(false)}
          onStart={handleStartOneOff}
        />
      );
    }
    return (
      <div className="flex flex-col gap-4 pb-4 pt-2 min-h-screen">
        <div className="flex items-center gap-3 pt-2">
          <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
            <Icon name="arrow_back" size={24} className="text-on-surface" />
          </button>
          <h1 className="text-heading font-bold text-on-surface">
            {t('outing.start_title')}
          </h1>
        </div>

        <p className="text-sm text-on-surface-dim px-1">{t('outing.choose_type')}</p>
        {startableProfiles.map((profile) => (
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
            onClick={() => setShowOneOffQuestion(true)}
            className="rounded-xl p-4 flex items-center gap-3 btn-press text-left"
            style={{ background: 'var(--primary-subtle)', border: '1px dashed var(--primary-dim)' }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--primary-subtle)' }}
            >
              <Icon name="add" size={22} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-on-surface">{t('outing.custom_type')}</p>
              <p className="text-xs text-on-surface-faint">{t('outing.custom_type_desc')}</p>
            </div>
          </button>
        )}

        {startableProfiles.length === 0 && (
          <p className="text-sm text-on-surface-faint text-center py-8">
            {t('outing.no_profiles')}
          </p>
        )}

        {/* DEC-073 (M6.5): one-off event ≠ recurring profile */}
        <BottomSheet
          open={showOneOffQuestion}
          onClose={() => setShowOneOffQuestion(false)}
          title={t('outing.one_off_question')}
        >
          <div className="flex flex-col gap-3">
            <p className="text-xs text-on-surface-dim">{t('outing.one_off_hint')}</p>
            <button
              onClick={() => {
                setShowOneOffQuestion(false);
                setConfiguringOneOff(true);
              }}
              className="w-full py-3 rounded-xl bg-primary text-on-surface font-semibold text-sm btn-press"
            >
              {t('outing.one_off_yes')}
            </button>
            <button
              onClick={() => {
                setShowOneOffQuestion(false);
                setShowCustomForm(true);
              }}
              className="w-full py-3 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
            >
              {t('outing.one_off_no')}
            </button>
          </div>
        </BottomSheet>
      </div>
    );
  }

  const sessionProfile = profiles.find((p) => p.id === session.activityProfileId) ?? null;
  const sessionIcon =
    sessionProfile?.iconName ?? getCategoryIcon(sessionProfile?.category ?? null);

  return (
    <>
      <ActiveSession
        session={session}
        sessionTxs={sessionTxs}
        trip={trip}
        elapsed={elapsed}
        sessionIcon={sessionIcon}
        participants={participants}
        owner={owner}
        onQuickAdd={handleQuickAdd}
        onRegisterTotal={handleRegisterTotal}
        onSplitAdd={handleSplitAdd}
        onUpdateQuickValues={handleUpdateQuickValues}
        onEnd={() => setReviewing(true)}
        onBack={() => navigate(-1)}
        onDetailItem={(tx) =>
          setEnrich(
            buildEnrichTarget(tx.id, tx.personalCostCents ?? tx.amountCents, session, true),
          )
        }
        enrichStepper={
          enrich && (
            <EnrichStepper
              enrich={enrich}
              currency={trip.baseCurrency}
              subcategories={sortSubcategoriesByProximity(
                getSubcategories(enrich.contextTaxonomyKey ?? sessionProfile?.category ?? null),
                enrich.amountCents,
              )}
              owner={owner}
              otherParticipants={otherParticipants}
              onContext={handleEnrichContext}
              onSubcategory={handleEnrichSubcategory}
              onPayer={handleEnrichPayer}
              onSplit={handleEnrichSplit}
              onSkip={() => setEnrich(null)}
              onInteract={handleEnrichInteract}
            />
          )
        }
      />

      {/* DEC-053(b): over-max confirmation */}
      <BottomSheet
        open={pendingOverMaxAdd !== null}
        onClose={() => setPendingOverMaxAdd(null)}
        title={t('outing.over_max_title')}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-on-surface-dim">
            {t('outing.over_max_body', {
              max: formatCurrency(session.maxCents ?? 0, trip.baseCurrency),
            })}
          </p>
          <p className="text-xs text-on-surface-faint">{t('outing.over_max_remember_hint')}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPendingOverMaxAdd(null)}
              className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleConfirmOverMax}
              className="flex-1 py-2.5 rounded-xl bg-warning/20 text-warning ring-1 ring-warning font-semibold text-sm btn-press"
            >
              {t('outing.over_max_confirm')}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* DEC-053(c): phase boundary choice */}
      <BottomSheet
        open={pendingPhaseAction !== null}
        onClose={() => setPendingPhaseAction(null)}
        title={t('outing.phase_change_title')}
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-on-surface-dim">{t('outing.phase_change_body')}</p>
          <button
            onClick={() => handlePhaseChoice('keep')}
            className="w-full py-2.5 rounded-xl bg-surface-high text-on-surface font-medium text-sm btn-press"
          >
            {t('outing.phase_keep')}
          </button>
          <button
            onClick={() => handlePhaseChoice('move')}
            className="w-full py-2.5 rounded-xl bg-surface-high text-on-surface font-medium text-sm btn-press"
          >
            {t('outing.phase_move')}
          </button>
          <button
            onClick={() => handlePhaseChoice('split')}
            className="w-full py-2.5 rounded-xl bg-primary text-on-surface font-semibold text-sm btn-press"
          >
            {t('outing.phase_split')}
          </button>
        </div>
      </BottomSheet>
    </>
  );
}

/* ──────────────────────── SESSION START CONFIG (GAP-015) ──────────────────────── */

interface SessionStartConfig {
  name: string;
  limits: SessionLimits;
  quickAddValuesCents: number[];
}

interface SessionStartConfigFormProps {
  initialName: string;
  initialLimits: SessionLimits;
  initialQuickAddCents: number[];
  currency: string;
  onCancel: () => void;
  onStart: (config: SessionStartConfig) => void;
}

function SessionStartConfigForm({ initialName, initialLimits, initialQuickAddCents, currency, onCancel, onStart }: SessionStartConfigFormProps) {
  const { t } = useTranslation();

  const [name, setName] = useState(initialName);
  const [target, setTarget] = useState(String(fromCents(initialLimits.targetCents)));
  const [ceiling, setCeiling] = useState(String(fromCents(initialLimits.ceilingCents)));
  const [max, setMax] = useState(String(fromCents(initialLimits.maxCents)));
  const [avgDrink, setAvgDrink] = useState(
    initialLimits.avgDrinkPriceCents !== null ? String(fromCents(initialLimits.avgDrinkPriceCents)) : '',
  );
  const [quickValues, setQuickValues] = useState<string[]>(
    initialQuickAddCents.map((v) => String(fromCents(v))),
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

/* ──────────────────────── POST-ADD ENRICHMENT STEPPER (DEC-078 / FIELD-08) ──────────────────────── */

interface EnrichStepperProps {
  enrich: EnrichTarget;
  currency: string;
  /** DEC-095: already sorted by proximity to the logged amount. */
  subcategories: ExpenseSubcategory[];
  owner: Participant | null;
  otherParticipants: Participant[];
  onContext: (context: EventContext) => void;
  onSubcategory: (subcategory: ExpenseSubcategory) => void;
  onPayer: (participantId: string) => void;
  onSplit: (didSplit: boolean) => void;
  onSkip: () => void;
  /** DEC-096 (R-14): any touch/scroll resets the auto-dismiss timer. */
  onInteract: () => void;
}

const ENRICH_QUESTION_KEY: Record<EnrichStep, string> = {
  context: 'outing.enrich_where',
  category: 'outing.enrich_what',
  payer: 'outing.enrich_who_paid',
  split: 'outing.enrich_split',
};

function EnrichStepper({ enrich, currency, subcategories, owner, otherParticipants, onContext, onSubcategory, onPayer, onSplit, onSkip, onInteract }: EnrichStepperProps) {
  const { t } = useTranslation();

  const chipStyle = {
    background: 'var(--surface-high)',
    color: 'var(--on-surface-dim)',
  };

  return (
    <div
      className="mx-5 mb-2.5 p-3 rounded-xl"
      style={{ background: 'var(--surface-container)', border: '1px solid var(--highlight-subtle)' }}
      onPointerDown={onInteract}
      onScrollCapture={onInteract}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold" style={{ color: 'var(--success)' }}>
          {t('outing.enrich_saved', { amount: formatCurrency(enrich.amountCents, currency) })}
        </p>
        <button
          onClick={onSkip}
          aria-label={t('outing.enrich_skip')}
          className="btn-press text-[10px] font-bold px-2 py-0.5 rounded-lg"
          style={{ color: 'var(--on-surface-faint)' }}
        >
          {t('outing.enrich_skip')}
        </button>
      </div>
      <p className="text-xs font-bold mb-2" style={{ color: 'var(--on-surface)' }}>
        {t(ENRICH_QUESTION_KEY[enrich.step] as never)}
      </p>

      {/* DEC-096 (R-17) level 1: event context — stored as category */}
      {enrich.step === 'context' && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {EVENT_CONTEXTS.map((context) => (
            <button
              key={context.category}
              onClick={() => onContext(context)}
              className="btn-press shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl"
              style={chipStyle}
            >
              <Icon name={context.icon} size={18} className="text-on-surface-dim" />
              <span className="text-[10px] font-semibold">
                {t(`categories.${context.category}` as never)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* DEC-095 (R-13): subcategories of the outing type, closest first */}
      {enrich.step === 'category' && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {subcategories.map((subcategory) => (
            <button
              key={subcategory.id}
              onClick={() => onSubcategory(subcategory)}
              className="btn-press shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl"
              style={chipStyle}
            >
              <Icon name={subcategory.icon} size={18} className="text-on-surface-dim" />
              <span className="text-[10px] font-semibold">{t(subcategory.labelKey as never)}</span>
            </button>
          ))}
        </div>
      )}

      {enrich.step === 'payer' && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {owner && (
            <button
              onClick={() => onPayer(owner.id)}
              className="btn-press shrink-0 px-4 py-2 rounded-xl text-xs font-semibold"
              style={chipStyle}
            >
              {t('outing.enrich_me')}
            </button>
          )}
          {otherParticipants.map((p) => (
            <button
              key={p.id}
              onClick={() => onPayer(p.id)}
              className="btn-press shrink-0 px-4 py-2 rounded-xl text-xs font-semibold"
              style={chipStyle}
            >
              {p.nickname ?? p.name}
            </button>
          ))}
        </div>
      )}

      {enrich.step === 'split' && (
        <div className="flex gap-2">
          <button
            onClick={() => onSplit(false)}
            className="btn-press flex-1 py-2 rounded-xl text-xs font-semibold"
            style={chipStyle}
          >
            {t('outing.enrich_split_no')}
          </button>
          <button
            onClick={() => onSplit(true)}
            className="btn-press flex-1 py-2 rounded-xl text-xs font-semibold bg-primary text-on-surface"
          >
            {t('outing.enrich_split_half')}
          </button>
        </div>
      )}
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
                {/* DEC-097 (R-18): show WHAT it was — never the session name */}
                {formatSessionItemLabel(tx, session.name, t)}
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
  participants: Participant[];
  owner: Participant | null;
  onQuickAdd: (cents: number) => void;
  onRegisterTotal: (diffCents: number) => void;
  onSplitAdd: (input: SessionSplitInput) => void;
  onUpdateQuickValues: (valuesCents: number[]) => void;
  onEnd: () => void;
  onBack: () => void;
  /** DEC-097 (R-15): re-opens the stepper for an item without subcategory. */
  onDetailItem: (tx: Transaction) => void;
  /** Post-add enrichment stepper slot (DEC-078) — rendered above quick-add. */
  enrichStepper: React.ReactNode;
}

function ActiveSession({ session, sessionTxs, trip, elapsed, sessionIcon, participants, owner, onQuickAdd, onRegisterTotal, onSplitAdd, onUpdateQuickValues, onEnd, onBack, onDetailItem, enrichStepper }: ActiveSessionProps) {
  const { t } = useTranslation();
  const currency = trip.baseCurrency;

  const [activeSheet, setActiveSheet] = useState<'other' | 'total' | 'split' | 'editValues' | null>(null);
  const [sheetAmount, setSheetAmount] = useState('');
  const [negativeConfirmed, setNegativeConfirmed] = useState(false);
  const [editValuesDraft, setEditValuesDraft] = useState<string[]>([]);

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

  // DEC-045 (GAP-028): quick-add values stay editable during the session.
  const openEditValuesSheet = () => {
    setEditValuesDraft(quickValues.map((v) => String(fromCents(v))));
    setActiveSheet('editValues');
  };

  const handleSaveQuickValues = () => {
    const parsed = editValuesDraft.map(parseAmountToCents);
    if (parsed.some((v) => v <= 0)) return;
    onUpdateQuickValues(parsed);
    closeSheet();
  };

  const totalSpent = useMemo(() => calculateSessionTotal(sessionTxs), [sessionTxs]);
  const targetCents = session.targetCents ?? 0;
  const ceilingCents = session.ceilingCents ?? 0;
  const maxCents = session.maxCents ?? ceilingCents;
  const avgDrink = session.avgDrinkPriceCents ?? 0;

  const remainingComfort = Math.max(0, targetCents - totalSpent);
  const drinksRemaining = avgDrink > 0 ? Math.floor(remainingComfort / avgDrink) : 0;

  // DEC-113 (R5-09): piecewise mapping onto the fixed visual segments.
  const gaugePercent = calculateGaugePosition(totalSpent, targetCents, ceilingCents, maxCents);

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

  // DEC-045 (GAP-028): session values with the single domain default as
  // fallback; highlight follows the avg drink price.
  const quickValues = session.quickAddValuesCents.length >= 5
    ? session.quickAddValuesCents.slice(0, 5)
    : DEFAULT_QUICK_ADD_VALUES_CENTS;
  const highlightIndex = findHighlightedQuickValueIndex(quickValues, session.avgDrinkPriceCents);

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
            style={{ background: 'var(--highlight-subtle)' }}
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

        {/* 5. SEGMENTED GAUGE — DEC-113 (R5-09): piecewise dot + value pill */}
        <div className="relative mb-1.5 pt-6">
          {/* Value pill above the dot, clamped so it never overflows the bar */}
          <div
            className="absolute top-0 whitespace-nowrap"
            style={{
              left: `${gaugePercent}%`,
              transform: `translateX(${gaugePercent < 8 ? '0%' : gaugePercent > 92 ? '-100%' : '-50%'})`,
            }}
          >
            <span
              className="px-2 py-0.5 rounded-full text-[9px] font-bold tabular inline-block"
              style={{
                background: 'var(--surface-high)',
                color: 'var(--on-surface)',
                border: '1px solid var(--border-faint)',
              }}
            >
              {formatCurrency(totalSpent, currency)}
            </span>
          </div>
          <div className="flex gap-[2px] h-3 rounded-md overflow-hidden">
            <div className="flex-[3] rounded-l-md" style={{ background: 'var(--success)' }} />
            <div className="flex-[2]" style={{ background: 'var(--primary)' }} />
            <div className="flex-[1]" style={{ background: '#D4A84360' }} />
            <div className="flex-[1] rounded-r-md" style={{ background: '#D9404030' }} />
          </div>
          {/* R6-12 (R5-09): ticks on the REAL segment boundaries, in the limit color */}
          <div
            className="absolute w-[2px] h-[18px] top-[19px] rounded-full"
            style={{ left: `calc(${GAUGE_TARGET_END}% - 1px)`, background: 'var(--success)', opacity: 0.85 }}
          />
          <div
            className="absolute w-[2px] h-[18px] top-[19px] rounded-full"
            style={{ left: `calc(${GAUGE_CEILING_END}% - 1px)`, background: 'var(--primary)', opacity: 0.85 }}
          />
          <div
            className="absolute bottom-[-2px] w-4 h-4 rounded-full border-2"
            style={{
              left: `clamp(0px, calc(${gaugePercent}% - 8px), calc(100% - 16px))`,
              background: 'var(--on-surface)',
              borderColor: 'var(--surface-deep)',
              boxShadow: '0 0 6px var(--glow)',
            }}
          />
        </div>

        {/* 6. THREE-LIMIT LABELS — R6-12 (R5-09): each label is anchored on the
            real boundary of its segment so value, color and position agree. */}
        <div className="relative mt-4 mb-2.5 h-[26px]">
          <div
            className="absolute top-0"
            style={{
              left: `${GAUGE_TARGET_END}%`,
              transform: 'translateX(-50%)',
              maxWidth: '40%',
            }}
          >
            <p className="text-[9px] font-bold text-center whitespace-nowrap" style={{ color: 'var(--success)' }}>
              {t('outing.limit_target')}
            </p>
            <p className="text-[11px] font-extrabold tabular text-center" style={{ color: 'var(--success)' }}>
              {formatCurrency(targetCents, currency)}
            </p>
          </div>
          <div
            className="absolute top-0"
            style={{
              left: `${GAUGE_CEILING_END}%`,
              transform: 'translateX(-50%)',
              maxWidth: '34%',
            }}
          >
            <p className="text-[9px] font-bold text-center whitespace-nowrap" style={{ color: 'var(--primary)' }}>
              {t('outing.limit_ceiling')}
            </p>
            <p className="text-[11px] font-extrabold tabular text-center" style={{ color: 'var(--primary)' }}>
              {formatCurrency(ceilingCents, currency)}
            </p>
          </div>
          <div className="absolute top-0 right-0 text-right">
            <p className="text-[9px] font-bold whitespace-nowrap" style={{ color: '#D9404080' }}>
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
        <div className="mx-5 p-3 rounded-xl mb-2.5" style={{ background: 'var(--highlight-faint)' }}>
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
          {/* DEC-097 (R-15): the user already knows WHERE they are — items
              show WHAT was bought; undetailed items re-open the stepper. */}
          <div className="space-y-2">
            {recentTxs.map((tx) => {
              const subcategory = findSubcategory(tx.subcategoryId);
              const hasOwnLabel = tx.description !== '' && tx.description !== session.name;
              return (
                <button
                  key={tx.id}
                  onClick={() => {
                    if (!subcategory) onDetailItem(tx);
                  }}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {subcategory ? (
                      <Icon name={subcategory.icon} size={14} className="text-primary shrink-0" />
                    ) : (
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: 'var(--primary)' }}
                      />
                    )}
                    <span
                      className="text-xs font-semibold truncate"
                      style={{
                        color: subcategory || hasOwnLabel
                          ? 'var(--on-surface-dim)'
                          : 'var(--on-surface-faint)',
                      }}
                    >
                      {subcategory
                        ? t(subcategory.labelKey as never)
                        : hasOwnLabel
                          ? tx.description
                          : t('outing.tap_to_detail')}
                      {tx.isShared && (
                        <Icon name="group" size={11} className="text-on-surface-faint ml-1 align-middle" />
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
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
                </button>
              );
            })}
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

      {/* 10b. POST-ADD ENRICHMENT STEPPER (DEC-078) */}
      {enrichStepper}

      {/* 11. QUICK-ADD BUTTONS (highlight = closest to avg drink, DEC-045) */}
      <div className="px-5 pb-3">
        <div className="flex justify-end mb-1.5">
          <button
            onClick={openEditValuesSheet}
            className="btn-press flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold"
            style={{ background: 'var(--surface-container)', color: 'var(--on-surface-dim)' }}
          >
            <Icon name="tune" size={12} className="text-on-surface-faint" />
            {t('outing.edit_quick_values')}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2.5 mb-2.5">
          {quickValues.slice(0, 3).map((val, i) => (
            <QuickAddButton
              key={`${val}-${i}`}
              valueCents={val}
              currency={currency}
              highlighted={i === highlightIndex}
              onAdd={onQuickAdd}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2.5 mb-2.5">
          {quickValues.slice(3, 5).map((val, i) => (
            <QuickAddButton
              key={`${val}-${i + 3}`}
              valueCents={val}
              currency={currency}
              highlighted={i + 3 === highlightIndex}
              onAdd={onQuickAdd}
            />
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

      {/* Edit quick-add values during the session (DEC-045 / GAP-028) */}
      <BottomSheet
        open={activeSheet === 'editValues'}
        onClose={closeSheet}
        title={t('outing.edit_quick_values')}
      >
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-5 gap-2">
            {editValuesDraft.map((value, i) => (
              <div key={i} className="flex items-baseline gap-1 bg-surface-high rounded-lg px-2 py-2">
                <span className="text-on-surface-faint text-[10px]">{currency}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={value}
                  onChange={(e) =>
                    setEditValuesDraft((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
                  }
                  className="bg-transparent text-xs font-bold text-on-surface tabular outline-none w-full"
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleSaveQuickValues}
            disabled={editValuesDraft.map(parseAmountToCents).some((v) => v <= 0)}
            className="w-full py-3 rounded-xl bg-primary text-on-surface font-semibold btn-press disabled:opacity-40"
          >
            {t('common.save')}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

function QuickAddButton({
  valueCents,
  currency,
  highlighted,
  onAdd,
}: {
  valueCents: number;
  currency: string;
  highlighted: boolean;
  onAdd: (cents: number) => void;
}) {
  return (
    <button
      onClick={() => onAdd(valueCents)}
      className="btn-press quick-btn rounded-xl font-bold text-lg tabular"
      style={
        highlighted
          ? { background: '#C75B3918', color: 'var(--primary)', border: '1px solid #C75B3925' }
          : { background: 'var(--surface-container)', color: 'var(--on-surface)' }
      }
    >
      +{formatCurrency(valueCents, currency)}
    </button>
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
