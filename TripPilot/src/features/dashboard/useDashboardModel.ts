import { useState, useEffect, useMemo } from 'react';
import type { useAppData } from '@/hooks/useAppData';
import {
  resolveActivePhase,
  getDayNumber,
  getTotalDays,
  localDateString,
  localDayOf,
} from '@/domain/dates';
import {
  calculateFreeToSpend,
  calculateTrueFree,
  createPoolSummary,
  calculateLastOutingSavings,
  buildHonestFriendV2,
  buildHonestFriendExtras,
  filterHomeAmigoExtras,
  calculatePoolSpent,
  projectTripEndSurplus,
  calculateSavingsGoalProgress,
  buildPiggyLedger,
  linearDailyIdealCents,
  buildPiggySpendByDay,
  selectActivePhasePool,
  selectVisiblePots,
} from '@/domain/budget';
import {
  filterTransactionsByPool,
  calculateSpentOnDate,
} from '@/domain/transactions';
import { sumCents } from '@/domain/money';
import { getCategoryIcon } from '@/utils/category-icons';
import { buildSessionFeed } from '@/features/expenses/expense-feed';
import { splitMoneyDisplay } from './dashboard-format';
import { sessionRepository } from '@/data/repositories/session-repository';
import { activityProfileRepository } from '@/data/repositories/activity-profile-repository';
import {
  transactionRepository,
  participantShareRepository,
  scenarioPlanRepository,
  scenarioAllocationItemRepository,
  phaseProfileSettingRepository,
  settlementRepository,
  forecastSnapshotRepository,
} from '@/data/repositories';
import {
  buildYesterdayRecap,
  buildPhaseBurndown,
  buildMonthHeatmap,
  buildOccasionCounters,
} from '@/domain/dashboard';
import { isProfileEnabledInPhase, detectValueSuggestion } from '@/domain/profiles';
import { detectTripPriorsOffer } from '@/domain/templates';
import {
  calculateTodayFreeBudget,
  buildPhaseAllowanceMap,
  findEndedPhaseWithSuccessor,
  detectPhaseLeftover,
} from '@/domain/phases';
import { isOccurrenceActiveToday, selectVisibleEvents } from '@/domain/planning';
import {
  isPlannedPurchaseOpen,
  plannedPurchaseReservedRemainingCents,
} from '@/domain/planning/planned-purchases';
import { findPendingConfirmationShares, calculateDebts, summarizeOwnerDebts } from '@/domain/splitting';
import { calculateOccasionForecasts, orderForecastsByUsage, type OccasionForecast } from '@/domain/forecasting';
import { buildDashboardInsights, extraToInsight, createForecastSnapshot } from '@/domain/insights';
import { calculateSessionTotal, evaluateOutingSuggestion } from '@/domain/outing';
import type { Session } from '@/domain/types/session';
import type { Transaction } from '@/domain/types/transaction';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { Settlement } from '@/domain/types/settlement';

type AppData = ReturnType<typeof useAppData>;

// BUG-008: the Dashboard's heavy budget/insight/heatmap math used to run on every
// render — including UI-only re-renders (opening a sheet, swiping a carousel).
// All of it now lives in one memo keyed on the actual data inputs, and the async
// reads (sessions, profiles, shares, forecasts) are colocated here too. The
// page keeps the UI state and the mutation handlers.
export function useDashboardModel(appData: AppData, heatmapMonth: string, heatmapDayIso: string | null) {
  const { trip, phases, pools, links, envelopes, transactions, participants, occurrences, plannedPurchases, settings } = appData;

  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [sessionTxs, setSessionTxs] = useState<Transaction[]>([]);
  const [completedSessions, setCompletedSessions] = useState<Session[]>([]);
  const [profiles, setProfiles] = useState<ActivityProfile[]>([]);
  const [pendingShares, setPendingShares] = useState<ReturnType<typeof findPendingConfirmationShares>>([]);
  const [allShares, setAllShares] = useState<ParticipantShare[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [forecasts, setForecasts] = useState<OccasionForecast[]>([]);
  // R5-03: warn when the OS may evict IndexedDB (storage not persistent).
  const [storageNotPersisted, setStorageNotPersisted] = useState(false);

  useEffect(() => {
    if (navigator.storage?.persisted) {
      navigator.storage
        .persisted()
        .then((persisted) => setStorageNotPersisted(!persisted))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!trip) return;
    const load = async () => {
      const [sess, profs, completed] = await Promise.all([
        sessionRepository.getActive(trip.id),
        activityProfileRepository.getByTripId(trip.id),
        sessionRepository.getCompleted(trip.id),
      ]);
      setProfiles(profs);
      setCompletedSessions(completed);
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
      const [shares, tripSettlements] = await Promise.all([
        participantShareRepository.getAllForTrip(sharedTxIds),
        settlementRepository.getByTripId(trip.id),
      ]);
      setAllShares(shares);
      setSettlements(tripSettlements);
      setPendingShares(findPendingConfirmationShares(transactions, shares, owner.id));
    };
    load();
  }, [trip, transactions, participants]);

  // GAP-020 (DEC-006/043): counters show the forecast ("X remaining").
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
      const [plan, profileSettings] = await Promise.all([
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
        isProfileEnabledInPhase(profileSettings, phase.id, p.id),
      );
      // DEC-076 (FIELD-06): used profiles first, then planned without use.
      setForecasts(
        orderForecastsByUsage(
          calculateOccasionForecasts(enabledProfiles, allocations, transactions, phase.id),
        ),
      );
    };
    load();
  }, [trip, phases, pools, profiles, transactions]);

  // DEC-077 (M8.3): persist ONE forecast snapshot per phase per day.
  useEffect(() => {
    if (!trip) return;
    const phase = resolveActivePhase(phases);
    const pool = pools.find((p) => p.scope === 'linked_phases');
    if (!phase || !pool) return;
    const phaseTxs = transactions.filter((tx) => tx.phaseId === phase.id && tx.deletedAt === null);
    if (phaseTxs.length === 0) return;

    const persist = async () => {
      const todayDate = localDateString(new Date());
      const existing = await forecastSnapshotRepository.getByPhaseAndDate(phase.id, todayDate);
      if (existing) return;

      const snapshotFts = calculateFreeToSpend(
        pool,
        envelopes.filter((e) => e.budgetPoolId === pool.id),
        filterTransactionsByPool(transactions, pool.id),
        links.filter((l) => l.budgetPoolId === pool.id),
        phase.id,
        occurrences,
        plannedPurchases,
      );
      const spentCents = calculatePoolSpent(phaseTxs);
      const daysOfData = Math.max(1, getDayNumber(phase.startDate));
      const avgDailySpendCents = Math.round(spentCents / daysOfData);
      const totalDays = getTotalDays(phase.startDate, phase.endDate);

      await forecastSnapshotRepository.create(
        createForecastSnapshot({
          tripId: trip.id,
          phaseId: phase.id,
          snapshotDate: todayDate,
          totalBudgetCents: snapshotFts.totalBudgetCents,
          totalSpentCents: snapshotFts.totalSpentCents,
          freeToSpendCents: snapshotFts.freeToSpendCents,
          avgDailySpendCents,
          projectedEndSpendCents: avgDailySpendCents * totalDays,
          daysOfData,
        }),
      );
    };
    persist();
  }, [trip, phases, pools, envelopes, links, transactions, occurrences, plannedPurchases]);

  // Heavy derivations — one memo over every real input, so UI-only re-renders
  // (sheets, carousels) never re-run the budget/insight/heatmap math.
  const derived = useMemo(() => {
    const activePhase = resolveActivePhase(phases);
    const dayNum = activePhase ? getDayNumber(activePhase.startDate) : null;
    // D-BUG-13: roll up sessions in the Home preview exactly like the expenses
    // list (a bar night reads as "Bar · N itens", not loose rounds). Built over
    // ALL expenses so a session's count/total is complete, then sliced to 3.
    const recentSessionById = new Map<string, Session>();
    for (const s of completedSessions) recentSessionById.set(s.id, s);
    if (activeSession) recentSessionById.set(activeSession.id, activeSession);
    const recentFeed = buildSessionFeed(
      transactions
        .filter((tx) => tx.type === 'expense' && tx.deletedAt === null)
        .sort((a, b) => b.date.localeCompare(a.date)),
      recentSessionById,
      true,
    ).slice(0, 3);

    // GATE 1 (DEC canonical model): the hero must reflect the ACTIVE phase's
    // budget, not a fixed `linkedPools[0]`. For a legacy trip (one shared pool)
    // this resolves to that same pool, so existing trips stay byte-identical.
    const primaryPool = selectActivePhasePool(pools, links, activePhase?.id ?? null);
    const fts =
      primaryPool && activePhase
        ? calculateFreeToSpend(
            primaryPool,
            envelopes.filter((e) => e.budgetPoolId === primaryPool.id),
            filterTransactionsByPool(transactions, primaryPool.id),
            links.filter((l) => l.budgetPoolId === primaryPool.id),
            activePhase.id,
            occurrences,
            plannedPurchases,
          )
        : null;

    // Local date, not UTC — toISOString() would skip to tomorrow after 21:00 in UTC-3.
    const todayIso = localDateString(new Date());
    const todayEvents = activePhase
      ? occurrences.filter(
          (o) => o.phaseId === activePhase.id && isOccurrenceActiveToday(o, todayIso),
        )
      : [];

    // GATE 4 (M4.4 / D8): events approaching (owner trecho active OR within the
    // D-7 window) rise onto the Home as a heads-up, minus the ones already shown
    // as today's day-card — so Tomorrowland surfaces "começa em 7 dias" without
    // duplicating the active-today card.
    const upcomingEvents = selectVisibleEvents(occurrences, activePhase, todayIso).filter(
      (o) => !isOccurrenceActiveToday(o, todayIso),
    );

    const hasPendingExpenses = pendingShares.length > 0;
    const pendingImpactCents = pendingShares.reduce(
      (sum, entry) => sum + entry.share.shareAmountCents,
      0,
    );
    const participantNameById = new Map(participants.map((p) => [p.id, p.nickname ?? p.name]));

    const owner = participants.find((p) => p.isOwner) ?? null;

    // DEC-077 (FIELD-07): rotating insights — only significant cards, max 4/day.
    const phaseTxsForInsights = activePhase
      ? transactions.filter((tx) => tx.phaseId === activePhase.id && tx.deletedAt === null)
      : [];
    const completedOutingTotalsCents = activePhase
      ? completedSessions
          .filter((s) => s.phaseId === activePhase.id)
          .map((s) => calculateSessionTotal(transactions.filter((tx) => tx.sessionId === s.id)))
      : [];
    const debts = owner
      ? calculateDebts(transactions, allShares, participants, settlements, owner.id).debts
      : [];
    // DL-4: home "te devem / você deve" discoverability card — confirmed debts
    // only (real money), derived from the same engine as the /shared hero.
    const ownerDebtSummary = owner ? summarizeOwnerDebts(debts, owner.id) : null;
    const receivableCents = ownerDebtSummary?.receivableCents ?? 0;
    const payableCents = ownerDebtSummary?.payableCents ?? 0;
    // M4: per-category plan (planned occasions × typical value) vs real spend,
    // grouped by the profile's category — feeds the "category rhythm" builder.
    // FIELD-18: the same loop accumulates the phase's scenario allocation
    // (Σ planned, matching the Planner) and the real spend already made on those
    // planned profiles (capped per profile so an overspend on one never offsets
    // another's reserve) — the inputs for the hero's "truly free" number.
    const categoryRhythmMap = new Map<string, { plannedCents: number; spentCents: number }>();
    let allocatedCents = 0;
    let allocatedSpentCents = 0;
    for (const profile of profiles) {
      const forecast = forecasts.find((f) => f.profileId === profile.id);
      if (!forecast) continue;
      const plannedCents = forecast.totalPlanned * profile.typicalValueCents;
      const spentCents = sumCents(
        phaseTxsForInsights
          .filter((tx) => tx.activityProfileId === profile.id && tx.type === 'expense')
          .map((tx) => tx.personalCostCents ?? tx.amountCents),
      );
      if (plannedCents > 0) {
        allocatedCents += plannedCents;
        allocatedSpentCents += Math.min(spentCents, plannedCents);
      }
      if (plannedCents <= 0 && spentCents <= 0) continue;
      const prev = categoryRhythmMap.get(profile.category) ?? { plannedCents: 0, spentCents: 0 };
      categoryRhythmMap.set(profile.category, {
        plannedCents: prev.plannedCents + plannedCents,
        spentCents: prev.spentCents + spentCents,
      });
    }
    // FIELD-18: phaseFree (the old hero) minus the plan still reserved ahead.
    const trueFree = fts ? calculateTrueFree(fts.freeToSpendCents, allocatedCents, allocatedSpentCents) : null;
    const categoryRhythm = [...categoryRhythmMap.entries()].map(([category, v]) => ({
      category,
      ...v,
    }));
    // M11: the immediate upcoming phase (earliest start after today) feeds the
    // between-phases countdown. Days-until is calendar-inclusive minus one.
    const upcomingPhases = phases
      .filter((p) => p.deletedAt === null && p.startDate.slice(0, 10) > todayIso)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const nextPhaseForCountdown = upcomingPhases[0]
      ? {
          name: upcomingPhases[0].name,
          daysUntilStart: getTotalDays(todayIso, upcomingPhases[0].startDate.slice(0, 10)) - 1,
        }
      : null;

    const insights =
      activePhase && fts && owner
        ? buildDashboardInsights({
            todayDate: todayIso,
            phase: activePhase,
            phaseTransactions: phaseTxsForInsights,
            phaseBudgetCents: fts.freeToSpendCents + calculatePoolSpent(phaseTxsForInsights),
            completedOutingTotalsCents,
            debts,
            ownerId: owner.id,
            occurrences,
            categoryRhythm,
            nowHour: new Date().getHours(),
            nextPhase: nextPhaseForCountdown,
          })
        : [];

    // M9: a just-ended phase's leftover = the free money carried into the next
    // phase. Detector self-censors (positive + not already handled — ÂNCORA 8).
    const leftoverTransition = findEndedPhaseWithSuccessor(phases, todayIso);
    const leftoverCents =
      leftoverTransition && primaryPool
        ? calculateFreeToSpend(
            primaryPool,
            envelopes.filter((e) => e.budgetPoolId === primaryPool.id),
            filterTransactionsByPool(transactions, primaryPool.id),
            links.filter((l) => l.budgetPoolId === primaryPool.id),
            leftoverTransition.next.id,
            occurrences,
            plannedPurchases,
          ).freeToSpendCents
        : 0;
    const phaseLeftover = detectPhaseLeftover({
      phases,
      todayIso,
      leftoverCents,
      handledPhaseIds: settings?.phaseLeftoverHandled ?? [],
    });

    // DEC-175: planned purchases summary — what's still set aside from
    // free-to-spend, plus the top open buys for the dashboard card.
    const openPlannedPurchases = plannedPurchases.filter(isPlannedPurchaseOpen);
    const plannedPurchasesSummary = {
      openCount: openPlannedPurchases.length,
      totalReservedCents: openPlannedPurchases.reduce(
        (sum, p) => sum + plannedPurchaseReservedRemainingCents(p, transactions),
        0,
      ),
      items: openPlannedPurchases
        .map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          remainingCents:
            p.reservedCents !== null
              ? plannedPurchaseReservedRemainingCents(p, transactions)
              : null,
        }))
        .sort((a, b) => (b.remainingCents ?? 0) - (a.remainingCents ?? 0))
        .slice(0, 3),
    };

    // Global pools (e.g. personal shopping) are detected by scope (GAP-017).
    const globalPools = pools.filter((p) => p.scope === 'global' && p.deletedAt === null);
    const globalPoolSummaries = globalPools.map((pool) => ({
      pool,
      summary: createPoolSummary(pool, filterTransactionsByPool(transactions, pool.id)),
    }));
    // GATE 3 (D8): only the pots RELEVANT now surface on the Home — a dated pot
    // (e.g. Tomorrowland) stays hidden until its owner trecho is active or the
    // D-7 window opens; dateless pots are ambient. The full list lives on the
    // "Potes e planejados" section. `globalPoolSummaries` stays complete for the
    // leftover-move targets (you can park leftovers in any pot).
    const visiblePotIds = new Set(
      selectVisiblePots(globalPools, activePhase, todayIso).map((p) => p.id),
    );
    const visiblePotSummaries = globalPoolSummaries.filter((g) => visiblePotIds.has(g.pool.id));

    const progressPercent =
      fts && fts.totalBudgetCents > 0
        ? Math.round((fts.totalSpentCents / fts.totalBudgetCents) * 100)
        : 0;

    // FIELD-18: the hero shows the TRULY free amount (phase free − plan reserved
    // ahead); the phase total stays visible as the secondary "na fase".
    const heroMoney =
      trueFree && trip ? splitMoneyDisplay(trueFree.trueFreeCents, trip.baseCurrency) : null;

    // DEC-088 (R-06): subtractive "free to use today" — now spread from the TRULY
    // free amount, so the daily number excludes the plan the traveler already made.
    const primaryPoolTxs = primaryPool ? filterTransactionsByPool(transactions, primaryPool.id) : [];
    const todaySpentCents = primaryPool ? calculateSpentOnDate(primaryPoolTxs, todayIso) : 0;
    const todayBudget =
      trueFree && activePhase
        ? calculateTodayFreeBudget(trueFree.trueFreeCents, todaySpentCents, activePhase, todayIso)
        : null;

    // FIELD-19: per-day allowance map — same start-of-day base/weights as the
    // hero, projected over every remaining day so "free today" reads as a point
    // on a distribution, not an absolute. Dated reserves overlay their day.
    const phaseDayMap =
      trueFree && activePhase
        ? buildPhaseAllowanceMap({
            trueFreeCents: trueFree.trueFreeCents,
            todaySpentCents,
            phase: activePhase,
            todayIso,
            occurrences: occurrences.filter(
              (o) => o.phaseId === activePhase.id && o.deletedAt === null,
            ),
            plannedPurchases: plannedPurchases.filter(
              (p) => p.deletedAt === null && (p.phaseId === activePhase.id || p.phaseId === null),
            ),
          })
        : null;

    // DEC-129: yesterday recap mirrors the hero math (pool-scoped, add-back).
    const recap =
      fts && activePhase
        ? buildYesterdayRecap({
            freeToSpendCents: fts.freeToSpendCents,
            todaySpentCents,
            transactions: primaryPoolTxs,
            phase: activePhase,
            todayIso,
          })
        : null;

    // U6 (DEC-180): unified occasion counters — planned metas (remaining/done)
    // first, then per-category item counts for everything else. Scoped to the
    // active phase, mirroring the forecasts ("o que foi feito nessa fase").
    const phaseExpenseTxs = activePhase
      ? transactions.filter(
          (tx) => tx.phaseId === activePhase.id && tx.type === 'expense' && tx.deletedAt === null,
        )
      : [];
    const occasionCounters = buildOccasionCounters({
      forecasts,
      profiles,
      transactions: phaseExpenseTxs,
    });

    // DEC-092 (R-10): savings refer to the LAST closed outing.
    const savings = calculateLastOutingSavings(completedSessions, transactions, profiles, Date.now());

    // E7 (M18/M19): in-trip learning suggestion — the recent occasion average
    // (session = 1 occasion, DEC-115) vs the stored typical. Only PROPOSES;
    // writing happens on accept (ÂNCORA 12). Dismissed profiles stay silent.
    const valueSuggestion = detectValueSuggestion({
      profiles,
      sessions: completedSessions,
      transactions,
      dismissedProfileIds: settings?.valueSuggestionsDismissed ?? [],
    });

    // E7 (M21): the trip is over → offer to save what it learned as priors for
    // the next trip, once. Read-only detection; saving is an explicit accept.
    const tripPriors = detectTripPriorsOffer({
      trip,
      todayIso,
      profiles,
      handledTripIds: settings?.tripPriorsHandled ?? [],
    });

    // E6 (M14/M15): motivation layer — savings goal + piggy bank. Both are
    // READ-ONLY derivations of trip-level under-spend; they never touch the
    // freeToSpend math (ÂNCORA 11 / DEC-088).
    const tripTotalDays = trip ? getTotalDays(trip.startDate, trip.endDate) : 0;
    const tripDaysElapsed = trip ? Math.max(0, Math.min(tripTotalDays, getDayNumber(trip.startDate))) : 0;
    const tripDaysRemaining = Math.max(0, tripTotalDays - tripDaysElapsed);
    const motivationBudgetCents = fts?.totalBudgetCents ?? 0;
    const motivationSpentCents = fts?.totalSpentCents ?? 0;
    // FB-08 · DEC-279 (Model B): the displayed cofrinho is the day-ordered buffer
    // balance, derived purely by replaying each day's pool spend against the
    // constant linear daily ideal. `primaryPoolTxs` is the SAME set that feeds
    // `fts.totalSpentCents`, so Σ daily spend === totalSpentCents — the balance
    // can never diverge from the numbers shown elsewhere. Hidden (null) for
    // ongoing/no-date spaces where there is no daily ideal.
    const piggyDailyIdealCents = linearDailyIdealCents(motivationBudgetCents, tripTotalDays);
    const piggyLedger =
      fts && trip && piggyDailyIdealCents > 0
        ? buildPiggyLedger({
            dailyIdealCents: piggyDailyIdealCents,
            spendByDay: buildPiggySpendByDay({
              transactions: primaryPoolTxs,
              startDateIso: trip.startDate,
              daysElapsed: tripDaysElapsed,
            }),
          })
        : null;
    const piggyBankCents = piggyLedger?.balanceCents ?? 0;
    // FB-08 · DEC-279: the most-recent day's signed movement drives the "your
    // cofrinho just moved" notification in the Amigo Sincero carousel.
    const piggyLastMovementCents =
      piggyLedger && piggyLedger.entries.length > 0
        ? piggyLedger.entries[piggyLedger.entries.length - 1]!.deltaCents
        : 0;
    const savingsGoal =
      fts && settings?.savingsGoalCents != null
        ? calculateSavingsGoalProgress({
            goalCents: settings.savingsGoalCents,
            projectedSurplusCents: projectTripEndSurplus({
              totalBudgetCents: motivationBudgetCents,
              totalSpentCents: motivationSpentCents,
              daysElapsed: tripDaysElapsed,
              daysRemaining: tripDaysRemaining,
            }),
          })
        : null;

    // DEC-093 (R-11) + DEC-236: Honest Friend v2. The trigger is the MOST RECENT
    // expense of the phase — NO LONGER filtered to activity-profile expenses — so
    // a plain "Outros" that drained the budget is finally visible. Phase truth
    // (free ≤ 0 → over_budget) dominates the category read inside the domain.
    const amigoTriggerTx =
      [...phaseTxsForInsights]
        .filter((tx) => tx.type === 'expense')
        .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
    const amigoProfile = amigoTriggerTx?.activityProfileId
      ? profiles.find((p) => p.id === amigoTriggerTx.activityProfileId) ?? null
      : null;
    const amigoForecast = amigoProfile
      ? forecasts.find((f) => f.profileId === amigoProfile.id) ?? null
      : null;
    const phaseSpentCents = calculatePoolSpent(phaseTxsForInsights);
    const amigoV2 =
      activePhase && fts && amigoTriggerTx
        ? buildHonestFriendV2({
            profileId: amigoProfile?.id ?? null,
            profileName: amigoProfile?.name ?? null,
            typicalValueCents: amigoProfile?.typicalValueCents ?? 0,
            plannedQuantity: amigoForecast?.totalPlanned ?? 0,
            doneQuantity: amigoForecast?.spent ?? 0,
            categorySpentCents: amigoProfile
              ? sumCents(
                  phaseTxsForInsights
                    .filter(
                      (tx) => tx.activityProfileId === amigoProfile.id && tx.type === 'expense',
                    )
                    .map((tx) => tx.personalCostCents ?? tx.amountCents),
                )
              : 0,
            recentSpendCents: amigoTriggerTx.personalCostCents ?? amigoTriggerTx.amountCents,
            freeToSpendCents: fts.freeToSpendCents,
            // DEC-236: TRUE free (hero) = pool raw − plan reserved; pool raw is the
            // signed pre-floor free. `allocatedCents − allocatedSpentCents` is the
            // very plan reserve `calculateTrueFree` uses, so this stays consistent.
            trueFreeRawCents: fts.freeToSpendRawCents - Math.max(0, allocatedCents - allocatedSpentCents),
            poolFreeRawCents: fts.freeToSpendRawCents,
            phaseSpentCents,
            phaseBudgetCents: fts.freeToSpendCents + phaseSpentCents,
            todayDate: todayIso,
            phase: activePhase,
          })
        : ({ kind: 'none' } as const);

    // DEC-093 follow-up (device-test 2026-06-20): the Amigo Sincero carousel —
    // extra honest reads so it is never "stuck" on one verdict. Cheap, pure, and
    // gated on being meaningful (the domain returns [] when there is nothing).
    const amigoTopCategory = (() => {
      const byCategory = new Map<string, number>();
      for (const tx of phaseTxsForInsights) {
        if (tx.type !== 'expense' || !tx.category) continue;
        byCategory.set(
          tx.category,
          (byCategory.get(tx.category) ?? 0) + (tx.personalCostCents ?? tx.amountCents),
        );
      }
      let key: string | null = null;
      let cents = 0;
      for (const [categoryKey, categoryCents] of byCategory) {
        if (categoryCents > cents) {
          key = categoryKey;
          cents = categoryCents;
        }
      }
      return { key, cents };
    })();
    const amigoExtras =
      activePhase && fts
        ? buildHonestFriendExtras({
            phaseSpentCents,
            phaseBudgetCents: fts.freeToSpendCents + phaseSpentCents,
            freeToSpendCents: fts.freeToSpendCents,
            daysLeftInPhase: Math.max(0, getTotalDays(todayIso, activePhase.endDate)),
            topCategoryKey: amigoTopCategory.key,
            topCategoryCents: amigoTopCategory.cents,
            receivableCents,
            piggyBalanceCents: piggyBankCents,
            baseDailyIdealCents: piggyDailyIdealCents,
            piggyLastMovementCents,
          })
        : [];

    // D06 · DEC-317: the Amigo Sincero is voice-only now — its factual extras
    // leave the card and become NEUTRAL insight cards. Reuse `filterHomeAmigoExtras`
    // (the existing de-dupe) so a topic already shown by a real insight is dropped
    // (no duplication), then map each survivor with `extraToInsight` (same numbers,
    // ÂNCORA 11) and APPEND after the analytical insights (their order/values stay
    // byte-identical to the baseline; the relocated reads simply follow).
    const insightsWithFactual = [
      ...insights,
      ...filterHomeAmigoExtras(
        amigoExtras,
        insights.map((i) => i.kind),
      ).map(extraToInsight),
    ];

    // DEC-130 + DEC-136: burn-down uses the same phase envelope as the insights.
    const burndown =
      fts && activePhase && primaryPool
        ? buildPhaseBurndown({
            phase: activePhase,
            phaseBudgetCents: fts.freeToSpendCents + phaseSpentCents,
            transactions: phaseTxsForInsights,
            todayIso,
            occurrences: occurrences.filter((o) => o.budgetPoolId === primaryPool.id),
          })
        : null;

    // DEC-131: heatmap is trip-wide (spending behavior, not pool accounting).
    const currentMonth = todayIso.slice(0, 7);
    const tripStartMonth = trip ? trip.startDate.slice(0, 7) : '';
    const heatmap = buildMonthHeatmap(transactions, heatmapMonth, todayIso);
    const heatmapDayTxs = heatmapDayIso
      ? transactions
          .filter(
            (tx) =>
              tx.deletedAt === null &&
              (tx.type === 'expense' || tx.type === 'adjustment') &&
              localDayOf(tx.date) === heatmapDayIso,
          )
          .sort((a, b) => b.date.localeCompare(a.date))
      : [];

    // DEC-114 (R-04): the session card shows MY cost (shares, not raw amounts).
    const sessionTotalCents = calculateSessionTotal(sessionTxs);
    // DEC-117 (R-08): drinks-left counts until the TARGET, not the ceiling.
    const sessionDrinksLeft =
      activeSession?.targetCents && activeSession?.avgDrinkPriceCents
        ? Math.floor(
            Math.max(0, activeSession.targetCents - sessionTotalCents) /
              activeSession.avgDrinkPriceCents,
          )
        : null;
    const sessionProfile = activeSession
      ? profiles.find((p) => p.id === activeSession.activityProfileId) ?? null
      : null;
    const sessionIcon = sessionProfile?.iconName ?? getCategoryIcon(sessionProfile?.category ?? 'bar');

    // C2 (UX-clarity §4.12): calm hint to open an Outing when bar/restaurant
    // expenses land back-to-back. Suppressed while a session is already active —
    // you are already tracking the ceiling. Window measured from real "now"
    // (recomputes whenever transactions change, i.e. right after logging one).
    const outingSuggestion = activeSession
      ? { active: false, count: 0, sinceIso: null }
      : evaluateOutingSuggestion(transactions, { nowIso: new Date().toISOString() });

    return {
      activeSession,
      completedSessions,
      profiles,
      pendingShares,
      allShares,
      settlements,
      forecasts,
      activePhase,
      dayNum,
      recentFeed,
      hasTransactions: transactions.length > 0,
      primaryPool,
      fts,
      trueFree,
      occasionCounters,
      todayIso,
      todayEvents,
      upcomingEvents,
      hasPendingExpenses,
      pendingImpactCents,
      receivableCents,
      payableCents,
      participantNameById,
      owner,
      insights: insightsWithFactual,
      phaseLeftover,
      globalPoolSummaries,
      visiblePotSummaries,
      plannedPurchasesSummary,
      progressPercent,
      heroMoney,
      todayBudget,
      phaseDayMap,
      recap,
      savings,
      savingsGoal,
      piggyBankCents,
      piggyLedger,
      valueSuggestion,
      tripPriors,
      amigoV2,
      amigoExtras,
      burndown,
      currentMonth,
      tripStartMonth,
      heatmap,
      heatmapDayTxs,
      sessionTotalCents,
      sessionDrinksLeft,
      sessionIcon,
      outingSuggestion,
    };
  }, [
    trip,
    phases,
    pools,
    links,
    envelopes,
    transactions,
    participants,
    occurrences,
    plannedPurchases,
    settings,
    activeSession,
    sessionTxs,
    completedSessions,
    profiles,
    pendingShares,
    allShares,
    settlements,
    forecasts,
    heatmapMonth,
    heatmapDayIso,
  ]);

  return { ...derived, storageNotPersisted };
}

export type DashboardModel = ReturnType<typeof useDashboardModel>;
