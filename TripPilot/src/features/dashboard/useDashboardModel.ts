import { useState, useEffect, useMemo } from 'react';
import type { useAppData } from '@/hooks/useAppData';
import {
  resolveActivePhase,
  getDayNumber,
  getTotalDays,
  addDaysIso,
  localDateString,
  localDayOf,
} from '@/domain/dates';
import {
  calculateFreeToSpend,
  calculateDailyFreePoolDrop,
  calculateTrueFree,
  createPoolSummary,
  calculateLastOutingSavings,
  buildHonestFriendV2,
  selectAmigoTrigger,
  buildHonestFriendExtras,
  filterHomeAmigoExtras,
  calculatePoolSpent,
  projectTripEndSurplus,
  calculateSavingsGoalProgress,
  buildPiggyLedger,
  piggySettledBalanceCents,
  buildPersonalReconciliation,
  linearDailyIdealCents,
  buildRhythmDailyIdeals,
  buildPiggySpendByDay,
  selectActivePhasePool,
  buildPhaseSpendLens,
  selectVisiblePots,
  selectOtherPhasePots,
  eventReserveRemainingCents,
  eventDailyAllowanceCents,
  selectPendingEventLeftovers,
  buildLiveEventProgress,
} from '@/domain/budget';
import {
  filterTransactionsByPool,
  calculateSpentOnDate,
} from '@/domain/transactions';
import { sumCents } from '@/domain/money';
import { collectReceiptSessionIds } from '@/domain/receipt';
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
  getDaySpendingWeight,
  findEndedPhaseWithSuccessor,
  detectPhaseLeftover,
} from '@/domain/phases';
import {
  isOccurrenceActiveToday,
  selectVisibleEvents,
  selectActiveEventsInProgress,
} from '@/domain/planning';
import {
  isPlannedPurchaseOpen,
  plannedPurchaseReservedRemainingCents,
} from '@/domain/planning/planned-purchases';
import { findPendingConfirmationShares, calculateDebts, summarizeOwnerDebts } from '@/domain/splitting';
import { getInboundP2pItems } from '@/domain/orchestrators';
import { MAILBOX_DRAINED_EVENT } from '@/utils/mailbox-boot';
import {
  calculateOccasionForecasts,
  calculatePlanProgress,
  orderForecastsByUsage,
  type OccasionForecast,
} from '@/domain/forecasting';
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
  // DEC-463: the active plan's "count from" day — the memo below needs it so the
  // plan-reserve money math measures the same window as the occasion counters.
  const [planCountFromIso, setPlanCountFromIso] = useState<string | null>(null);
  // R5-03: warn when the OS may evict IndexedDB (storage not persistent).
  const [storageNotPersisted, setStorageNotPersisted] = useState(false);
  // DEC-352 (F19, G6): inbound P2P charges/payments awaiting accept/confirm —
  // the count behind the home "pending actions" card. Lives in the mailbox inbox
  // (not appData), so it loads separately + refreshes on a real-time drain.
  const [inboundP2pCount, setInboundP2pCount] = useState(0);

  // DEC-400 (G1): the event reserve now nets EVERY outing of an event (its N
  // `Session.occurrenceId` back-links + the legacy single `linkedSessionId`), so
  // every free/reserve computation is fed the full session set (active +
  // completed). With no event outings this is inert — the math stays baseline.
  const allSessions = useMemo<Session[]>(
    () => (activeSession ? [activeSession, ...completedSessions] : completedSessions),
    [activeSession, completedSessions],
  );

  useEffect(() => {
    if (navigator.storage?.persisted) {
      navigator.storage
        .persisted()
        .then((persisted) => setStorageNotPersisted(!persisted))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadInbound = async () => {
      try {
        const items = await getInboundP2pItems();
        if (!cancelled) setInboundP2pCount(items.length);
      } catch {
        if (!cancelled) setInboundP2pCount(0);
      }
    };
    void loadInbound();
    const onDrained = () => void loadInbound();
    window.addEventListener(MAILBOX_DRAINED_EVENT, onDrained);
    return () => {
      cancelled = true;
      window.removeEventListener(MAILBOX_DRAINED_EVENT, onDrained);
    };
  }, [transactions]);

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
    // DEC-462: the ACTIVE phase's own fund — `pools.find(linked_phases)` took the
    // FIRST fund of the trip, so with one fund per phase the plan lookup queried
    // the wrong pool and the whole plan layer read as empty (the zeroed planner).
    const pool = selectActivePhasePool(pools, links, phase?.id ?? null);
    if (!phase || !pool) {
      setForecasts([]);
      return;
    }
    const load = async () => {
      const [plan, profileSettings] = await Promise.all([
        scenarioPlanRepository.getActiveForPhase(trip.id, phase.id, pool.id),
        phaseProfileSettingRepository.getByPhaseId(phase.id),
      ]);
      if (!plan) {
        setForecasts([]);
        setPlanCountFromIso(null);
        return;
      }
      setPlanCountFromIso(plan.countFromIso ?? null);
      const allocations = await scenarioAllocationItemRepository.getByPlanId(plan.id);
      // DEC-074 (FIELD-01): counters only show profiles enabled in this phase.
      const enabledProfiles = profiles.filter((p) =>
        isProfileEnabledInPhase(profileSettings, phase.id, p.id),
      );
      // DEC-076 (FIELD-06): used profiles first, then planned without use.
      // DEC-463: honor the plan's "count from" date — occasions before it no
      // longer consume the plan (planning "a partir de agora").
      setForecasts(
        orderForecastsByUsage(
          calculateOccasionForecasts(
            enabledProfiles,
            allocations,
            transactions,
            phase.id,
            plan.countFromIso ?? null,
          ),
        ),
      );
    };
    load();
  }, [trip, phases, pools, links, profiles, transactions]);

  // DEC-077 (M8.3): persist ONE forecast snapshot per phase per day.
  useEffect(() => {
    if (!trip) return;
    const phase = resolveActivePhase(phases);
    // DEC-462: snapshot the ACTIVE phase's own fund (same fix as the forecasts).
    const pool = selectActivePhasePool(pools, links, phase?.id ?? null);
    if (!phase || !pool) return;
    // DEC-456: the snapshot's daily average measures PHASE MONEY only (the
    // phase's fund), matching the projection scope — pot spends stay out.
    const phaseTxs = transactions.filter(
      (tx) => tx.phaseId === phase.id && tx.budgetPoolId === pool.id && tx.deletedAt === null,
    );
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
        allSessions,
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
  }, [trip, phases, pools, envelopes, links, transactions, occurrences, plannedPurchases, allSessions]);

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
            allSessions,
          )
        : null;

    // Local date, not UTC — toISOString() would skip to tomorrow after 21:00 in UTC-3.
    const todayIso = localDateString(new Date());
    // DEC-390 (parte 2, G1): the day card now hosts only non-event occurrences
    // (sub-destinations) active today without a session — kind 'event' moves to
    // the dedicated live-event block below (with/without an outing), so an
    // in-progress event is never rendered twice (anti-pattern §13: no double count).
    const todayEvents = (
      activePhase
        ? occurrences.filter(
            (o) =>
              o.phaseId === activePhase.id &&
              o.kind !== 'event' &&
              isOccurrenceActiveToday(o, todayIso),
          )
        : []
    ).map((occ) => ({
      occ,
      // DEC-385 (G2): the day card shows the CONSUMABLE reserve — what is still
      // held (shrinks with attributed/outing spend) and the per-day allowance.
      remainingCents: eventReserveRemainingCents(occ, transactions, allSessions),
      perDayCents: eventDailyAllowanceCents(occ, transactions, todayIso, allSessions),
    }));

    // DEC-390 (parte 2, G1): events HAPPENING right now — visible with real
    // progress (consumed/what-when, remaining, per-day, days left) EVEN with an
    // outing started (Â-LIVE-EVENT). `selectActiveEventsInProgress` ignores
    // `linkedSessionId`, so a started event no longer vanishes from the Home; the
    // block coexists with the outing card (no double count — the listed spends net
    // to `consumedCents`).
    const liveEvents = (
      activePhase
        ? selectActiveEventsInProgress(
            occurrences.filter((o) => o.phaseId === activePhase.id),
            todayIso,
          )
        : []
    ).map((occ) => buildLiveEventProgress(occ, transactions, todayIso, allSessions));

    // DEC-409 (G1): when the active outing belongs to a live event, it is shown
    // EMBEDDED inside that event's card — so the standalone active-outing card is
    // suppressed (no 2nd card). False when the active outing is a plain outing.
    const activeOutingEmbedded =
      activeSession != null && liveEvents.some((e) => e.activeSessionId === activeSession.id);

    // DEC-392 (G2): the slice of TODAY that belongs to events — the per-day
    // consumable allowance of every event spanning today. The hero surfaces it
    // as "+X do evento hoje" so the free number is read honestly (free + event),
    // matching the day-detail total. Additive display only; the hero free math is
    // untouched (the reserve already left `trueFree`).
    const todayEventAllowanceCents = liveEvents.reduce((acc, e) => acc + Math.max(0, e.perDayCents), 0);

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
    // DEC-456 (field verdict 2026-07-03): PHASE MONEY = the slice of the phase's
    // attributed transactions paid from the phase's own fund. Every BUDGET number
    // (envelope, projection, rhythm, burndown, amigo comparisons) uses ONLY this
    // scope — a global pot ("Tomorrowland") or another fund can never inflate the
    // phase budget again. Behavioral reads (streaks, danger day, trigger pick)
    // keep the full attributed set: behavior is behavior regardless of the fund.
    const phaseMoneyTxs = primaryPool
      ? phaseTxsForInsights.filter((tx) => tx.budgetPoolId === primaryPool.id)
      : [];
    const phaseMoneySpentCents = calculatePoolSpent(phaseMoneyTxs);
    // DEC-473: a scanned receipt is a completed session too, but it is a
    // purchase, not an outing — keep it out of the "custo médio por saída".
    const receiptSessionIds = collectReceiptSessionIds(transactions);
    const completedOutingTotalsCents = activePhase
      ? completedSessions
          .filter((s) => s.phaseId === activePhase.id && !receiptSessionIds.has(s.id))
          .map((s) => calculateSessionTotal(transactions.filter((tx) => tx.sessionId === s.id)))
      : [];
    const debts = owner
      ? calculateDebts(transactions, allShares, participants, settlements, owner.id).debts
      : [];
    // DEC-466 (INV-1): the "conta do Julio" — reconcile the hero's "Já gasto"
    // (personal cost on the phase's verba) with the bank-statement view:
    // outflow − fronted for others + your share others fronted. Same rows as
    // `phaseMoneySpentCents`, so the total always matches the FTS line.
    const personalRecon =
      phaseMoneyTxs.length > 0
        ? buildPersonalReconciliation(phaseMoneyTxs, owner?.id ?? null)
        : null;
    // DL-4: home "te devem / você deve" discoverability card — confirmed debts
    // only (real money), derived from the same engine as the /shared hero.
    // DEC-474: the per-currency buckets are the display truth; the scalars stay
    // as zero-checks (card visibility) and for mono-currency voice lines.
    const ownerDebtSummary = owner ? summarizeOwnerDebts(debts, owner.id) : null;
    const receivableCents = ownerDebtSummary?.receivableCents ?? 0;
    const payableCents = ownerDebtSummary?.payableCents ?? 0;
    const receivableByCurrency = ownerDebtSummary?.receivableByCurrency ?? [];
    const payableByCurrency = ownerDebtSummary?.payableByCurrency ?? [];
    // DEC-477: the ONE plan-progress ruler — `calculatePlanProgress` replaces
    // the inline loop so Home, Planner and Viagem read the same reserve. The
    // forecasts already carry the plan quantities (totalPlanned) for the
    // enabled profiles, so they double as the allocation input; window
    // (DEC-463) and scope (DEC-472) live inside the function. Key change: a
    // DONE occasion releases its full slot even when it cost less than typical
    // — 17 bars planned/16 done reserves ONE bar, not "255 comendo o resto".
    const planProgress = activePhase
      ? calculatePlanProgress(
          profiles.filter((p) => forecasts.some((f) => f.profileId === p.id)),
          forecasts.map((f) => ({ activityProfileId: f.profileId, quantity: f.totalPlanned })),
          transactions,
          activePhase.id,
          planCountFromIso,
        )
      : null;
    const allocatedCents = planProgress?.allocatedCents ?? 0;
    const allocatedSpentCents = planProgress?.allocatedSpentCents ?? 0;
    // M4: per-category plan vs real spend — feeds the "category rhythm"
    // builder. Money-based (spentCents), same rows as before.
    const categoryRhythmMap = new Map<string, { plannedCents: number; spentCents: number }>();
    for (const line of planProgress?.lines ?? []) {
      if (line.plannedCents <= 0 && line.spentCents <= 0) continue;
      const prev = categoryRhythmMap.get(line.category) ?? { plannedCents: 0, spentCents: 0 };
      categoryRhythmMap.set(line.category, {
        plannedCents: prev.plannedCents + line.plannedCents,
        spentCents: prev.spentCents + line.spentCents,
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
            // DEC-456: budget + its spent term are PHASE-MONEY-ONLY (pot-free).
            phaseBudgetCents: fts.freeToSpendCents + phaseMoneySpentCents,
            phaseMoneySpentCents,
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
            allSessions,
          ).freeToSpendCents
        : 0;
    const phaseLeftover = detectPhaseLeftover({
      phases,
      todayIso,
      leftoverCents,
      handledPhaseIds: settings?.phaseLeftoverHandled ?? [],
    });

    // DEC-387 (G4): an ended event whose reserve still holds money prompts the
    // user to resolve the leftover (free / cofrinho / pote). One at a time
    // (oldest first); never auto-decided — dismissing leaves it pending (A4).
    const eventLeftover =
      selectPendingEventLeftovers(occurrences, transactions, todayIso, allSessions)[0] ?? null;

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
    // GATE 5 (D15 / DEC-314): dated pots owned by another phase are kept OUT of the
    // Home focus but surfaced in a collapsed "Potes de outras fases" area so they
    // stay discoverable (and remain selectable when logging an expense).
    const otherPhasePotIds = new Set(
      selectOtherPhasePots(globalPools, activePhase, todayIso).map((p) => p.id),
    );
    const otherPhasePotSummaries = globalPoolSummaries.filter((g) =>
      otherPhasePotIds.has(g.pool.id),
    );

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
    // DEC-411 (field fix 2026-06-29): the DAILY number must subtract how much the
    // FREE POOL actually dropped today — NOT the gross spend. A spend covered by an
    // event/planned CONSUMABLE reserve (DEC-385) already left `trueFree` when it was
    // set aside, so it must not knock the daily free again (the bug: a Wise import
    // attributed to a live event drove "livre do dia" negative). Only the part that
    // OVERFLOWS the reserve reduces the day. With no reserve in play this equals
    // `todaySpentCents` exactly (Â-MONEY-INVARIANT); the gross value still feeds the
    // recap insight below.
    const freePoolDropTodayCents =
      primaryPool && activePhase
        ? calculateDailyFreePoolDrop(
            primaryPool,
            envelopes.filter((e) => e.budgetPoolId === primaryPool.id),
            primaryPoolTxs,
            links.filter((l) => l.budgetPoolId === primaryPool.id),
            activePhase.id,
            occurrences,
            plannedPurchases,
            todayIso,
            allSessions,
          )
        : todaySpentCents;

    // DEC-427 (Field v2): the per-day allowance map (`phaseDayMap`) is now built
    // AFTER the cofrinho so it can be fed the SAME cap as the hero — see below,
    // right after `todayBudget`. (Moved down from here to fix the 5-vs-14 bug.)

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
    // DEC-472: the card's "done" is whole-phase (same ruler as the tapped
    // list) — the plan window only shapes `remaining` inside the forecasts.
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
    // DEC-464 (INV-2): the piggy horizon follows the POOL, not the whole trip.
    // The buffer's budget is the primary pool's, so its days must be the days
    // that pool funds — the span of its linked phases. Spreading a phase pool
    // (€628) over every trip day handed most of the ideal to OTHER phases' peak
    // days and left ~€5,71/day here, so normal days read as overspends and the
    // statement "lost" them. Legacy single-pool trips: the linked span IS the
    // trip, so behavior is unchanged (fallback to trip dates when no links).
    const poolPhaseIds = primaryPool
      ? new Set(
          links
            .filter((l) => l.budgetPoolId === primaryPool.id && l.deletedAt === null)
            .map((l) => l.phaseId),
        )
      : new Set<string>();
    const poolPhases = phases.filter((p) => poolPhaseIds.has(p.id));
    const piggyWindow =
      poolPhases.length > 0
        ? {
            startDate: poolPhases.reduce(
              (min, p) => (p.startDate < min ? p.startDate : min),
              poolPhases[0]!.startDate,
            ),
            endDate: poolPhases.reduce(
              (max, p) => (p.endDate > max ? p.endDate : max),
              poolPhases[0]!.endDate,
            ),
          }
        : trip
          ? { startDate: trip.startDate, endDate: trip.endDate }
          : null;
    const piggyTotalDays = piggyWindow ? getTotalDays(piggyWindow.startDate, piggyWindow.endDate) : 0;
    const piggyDaysElapsed = piggyWindow
      ? Math.max(0, Math.min(piggyTotalDays, getDayNumber(piggyWindow.startDate)))
      : 0;
    const piggyWeightPhases = poolPhases.length > 0 ? poolPhases : phases;
    // FB-08 · DEC-279 (Model B): the displayed cofrinho is the day-ordered buffer
    // balance, derived purely by replaying each day's pool spend against the
    // daily ideal. `primaryPoolTxs` is the SAME set that feeds
    // `fts.totalSpentCents`, so Σ daily spend === totalSpentCents — the balance
    // can never diverge from the numbers shown elsewhere. Hidden (null) for
    // ongoing/no-date spaces where there is no daily ideal.
    const piggyDailyIdealCents = linearDailyIdealCents(motivationBudgetCents, piggyTotalDays);
    // DEC-393 (G3): the cofrinho measures each day against its REAL pace, not a
    // flat ideal. Distribute the budget across the window's days by the rhythm
    // weight of the phase each day falls in (peak day → larger ideal); days in no
    // phase get the base weight 1.0. Σ ideals == budget, so the buffer still
    // reconciles (C14). NOTE: event-reserve days are NOT yet excluded here — that
    // sub-part needs a dynamic free-budget normalization that destabilizes the
    // path-dependent reconciliation, so it is deferred (the documented L-PIGGY
    // fallback for the unstable part); the rhythm awareness ships now.
    const piggyIdealByDayCents =
      piggyWindow && piggyTotalDays > 0
        ? buildRhythmDailyIdeals(
            motivationBudgetCents,
            Array.from({ length: piggyTotalDays }, (_unused, i) => {
              const dateIso = addDaysIso(piggyWindow.startDate, i);
              const phaseOfDay = piggyWeightPhases.find(
                (p) => dateIso >= p.startDate.slice(0, 10) && dateIso <= p.endDate.slice(0, 10),
              );
              return {
                dateIso,
                weight: phaseOfDay ? getDaySpendingWeight(phaseOfDay, dateIso) : 1,
              };
            }),
          )
        : new Map<string, number>();
    // DEC-465: manual resgates persisted in settings, replayed by day for the
    // active trip + pool.
    const piggyWithdrawalByDay = new Map<string, number>();
    if (trip && primaryPool) {
      for (const w of settings?.piggyWithdrawals ?? []) {
        if (w.tripId !== trip.id || w.poolId !== primaryPool.id) continue;
        piggyWithdrawalByDay.set(
          w.dateIso,
          (piggyWithdrawalByDay.get(w.dateIso) ?? 0) + w.amountCents,
        );
      }
    }
    const piggyLedger =
      fts && piggyWindow && piggyDailyIdealCents > 0
        ? buildPiggyLedger({
            // Every in-window day has a rhythm entry (weights ≥ 1), so the flat
            // fallback would only ever hit out-of-window spend days (e.g. a
            // pre-phase booking) — those must accrue NOTHING, not a free ideal.
            dailyIdealCents: 0,
            idealByDayCents: piggyIdealByDayCents,
            spendByDay: buildPiggySpendByDay({
              transactions: primaryPoolTxs,
              startDateIso: piggyWindow.startDate,
              daysElapsed: piggyDaysElapsed,
            }),
            withdrawalByDay: piggyWithdrawalByDay,
          })
        : null;
    // DEC-464 (INV-2): the DISPLAYED balance (and the daily cap gate) is the
    // SETTLED balance — closed days only, today's provisional deposit backed
    // out. Counting today's own "not spent yet" deposit flipped the cap on in
    // real time and shrank "livre hoje" from €37 to €14 before breakfast.
    const piggyBankCents = piggyLedger ? piggySettledBalanceCents(piggyLedger, todayIso) : 0;
    // FB-08 · DEC-279: the most-recent CLOSED day's signed movement drives the
    // "your cofrinho just moved" notification. Today's provisional entry is
    // excluded — it is a simulation until the day closes (DEC-464).
    const piggyClosedEntries = piggyLedger
      ? piggyLedger.entries.filter((e) => e.dateIso < todayIso)
      : [];
    const piggyLastMovementCents =
      piggyClosedEntries.length > 0
        ? piggyClosedEntries[piggyClosedEntries.length - 1]!.deltaCents
        : 0;

    // DEC-415 (G4): the daily hero, now cofrinho-aware. When the buffer holds a
    // positive balance the day's leftover is already parked there, so cap "livre
    // hoje" at today's ideal-base instead of re-inflating it over fewer days. The
    // cofrinho and this cap share the SAME ideal series (piggyIdealByDayCents /
    // piggyDailyIdealCents), so the reading stays consistent bit-for-bit; the total
    // free is untouched (Â-MONEY-INVARIANT). Absent buffer → identical to before.
    // DEC-427 (Field v2): compute the cofrinho cap ONCE and feed it to BOTH the
    // hero (calculateTodayFreeBudget) and the per-day map (buildPhaseAllowanceMap),
    // so "livre para usar hoje" on the Home equals "livre no dia" of today on the
    // by-day screen bit-for-bit. The 5-vs-14 bug was the map using the UNcapped
    // share while the hero capped it. Same balance + same ideal series here.
    const todayPiggyCap =
      piggyBankCents > 0
        ? {
            balanceCents: piggyBankCents,
            baseDailyIdealCents: piggyIdealByDayCents.get(todayIso) ?? piggyDailyIdealCents,
          }
        : undefined;

    const todayBudget =
      trueFree && activePhase
        ? calculateTodayFreeBudget(
            trueFree.trueFreeCents,
            freePoolDropTodayCents,
            activePhase,
            todayIso,
            todayPiggyCap,
          )
        : null;

    // FIELD-19: per-day allowance map — same start-of-day base/weights as the
    // hero, projected over every remaining day so "free today" reads as a point
    // on a distribution, not an absolute. Dated reserves overlay their day.
    // DEC-427: fed the SAME `todayPiggyCap` as the hero so today's cell matches
    // the Home hero bit-for-bit (the by-day "livre no dia" == "livre para usar hoje").
    const phaseDayMap =
      trueFree && activePhase
        ? buildPhaseAllowanceMap({
            trueFreeCents: trueFree.trueFreeCents,
            todaySpentCents: freePoolDropTodayCents,
            phase: activePhase,
            todayIso,
            occurrences: occurrences.filter(
              (o) => o.phaseId === activePhase.id && o.deletedAt === null,
            ),
            plannedPurchases: plannedPurchases.filter(
              (p) => p.deletedAt === null && (p.phaseId === activePhase.id || p.phaseId === null),
            ),
            transactions,
            piggyCap: todayPiggyCap,
          })
        : null;
    // DEC-465 (resgate): what taking the parked money back actually DOES — the
    // daily cap stops holding days at their rhythm ideal, so each day (when it
    // arrives) reads its full raw share again. Preview per day type so the
    // sheet can say "dias comuns ~+€A · dias de pico ~+€B".
    // FIELD 2026-07-07: the uplift is the piggy balance distributed across
    // remaining days proportional to their rhythm weight, so the preview never
    // shows €0,00 when there IS money to withdraw.
    const piggyWithdrawPreview = (() => {
      if (!piggyLedger || piggyBankCents <= 0 || !phaseDayMap) return null;
      const futureDays = phaseDayMap.days.filter((d) => d.dateIso >= todayIso);
      if (futureDays.length === 0) return null;
      const commonDays = futureDays.filter((d) => !d.isPeakDay);
      const peakDays = futureDays.filter((d) => d.isPeakDay);
      const idealOf = (iso: string): number =>
        piggyIdealByDayCents.get(iso) ?? piggyDailyIdealCents;
      const totalWeight = futureDays.reduce((sum, d) => sum + idealOf(d.dateIso), 0);
      const upliftForType = (days: typeof futureDays): number => {
        if (days.length === 0 || totalWeight <= 0) return 0;
        const typeWeight = days.reduce((sum, d) => sum + idealOf(d.dateIso), 0);
        const avgWeight = typeWeight / days.length;
        return Math.round((piggyBankCents * avgWeight) / totalWeight);
      };
      const uniformUplift = Math.round(piggyBankCents / futureDays.length);
      return {
        availableCents: piggyBankCents,
        commonUpliftCents: commonDays.length > 0 ? upliftForType(commonDays) : uniformUplift,
        peakUpliftCents: peakDays.length > 0 ? upliftForType(peakDays) : uniformUplift,
        hasPeakDay: peakDays.length > 0,
      };
    })();

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

    // DEC-093 (R-11) + DEC-236 + DEC-417 (G5): Honest Friend v2. The trigger is the
    // most RELEVANT recent expense — the biggest deviation from the phase median
    // among the recent window — rotating across the notable ones by day, never just
    // the latest (which fixated the friend on the wrong expense). NO LONGER filtered
    // to activity-profile expenses, so a plain "Outros" that drained the budget is
    // still visible. Phase truth (free ≤ 0 → over_budget) dominates inside the domain.
    const phaseExpenses = phaseTxsForInsights.filter((tx) => tx.type === 'expense');
    const amigoTriggerSelection = selectAmigoTrigger(
      phaseExpenses.map((tx) => ({
        id: tx.id,
        date: tx.date,
        costCents: tx.personalCostCents ?? tx.amountCents,
      })),
      { daySeed: dayNum ?? 0 },
    );
    const amigoTriggerTx = amigoTriggerSelection
      ? phaseExpenses.find((tx) => tx.id === amigoTriggerSelection.id) ?? null
      : null;
    const amigoProfile = amigoTriggerTx?.activityProfileId
      ? profiles.find((p) => p.id === amigoTriggerTx.activityProfileId) ?? null
      : null;
    const amigoForecast = amigoProfile
      ? forecasts.find((f) => f.profileId === amigoProfile.id) ?? null
      : null;
    // DEC-456: the amigo's budget comparisons run on phase money only.
    const phaseSpentCents = phaseMoneySpentCents;
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
      // DEC-456: over phase money, so the % shares the denominator of phaseSpent.
      for (const tx of phaseMoneyTxs) {
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

    // DEC-447 (G3): the PhaseSpendLens — the reconciliation block behind the
    // phase-projection detail. Built from the SAME fts + transactions the
    // insight uses, so the lines explain exactly the numbers on screen.
    const phaseSpendLens =
      fts && activePhase && primaryPool
        ? buildPhaseSpendLens({
            fts,
            transactions,
            phaseId: activePhase.id,
            poolId: primaryPool.id,
          })
        : null;

    // DEC-130 + DEC-136: burn-down uses the same phase envelope as the insights.
    // DEC-456: actual line + envelope are phase-money-only, matching the budget.
    const burndown =
      fts && activePhase && primaryPool
        ? buildPhaseBurndown({
            phase: activePhase,
            phaseBudgetCents: fts.freeToSpendCents + phaseSpentCents,
            transactions: phaseMoneyTxs,
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
      liveEvents,
      activeOutingEmbedded,
      todayEventAllowanceCents,
      eventLeftover,
      upcomingEvents,
      hasPendingExpenses,
      pendingImpactCents,
      receivableCents,
      payableCents,
      receivableByCurrency,
      payableByCurrency,
      personalRecon,
      participantNameById,
      // DEC-453: names for the lens' per-fund sub-lines ("de qual verba veio?").
      poolNameById: new Map(pools.map((p) => [p.id, p.name])),
      owner,
      insights: insightsWithFactual,
      phaseSpendLens,
      phaseLeftover,
      globalPoolSummaries,
      visiblePotSummaries,
      otherPhasePotSummaries,
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
      piggyWithdrawPreview,
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
    allSessions,
    sessionTxs,
    completedSessions,
    profiles,
    pendingShares,
    allShares,
    settlements,
    forecasts,
    planCountFromIso,
    heatmapMonth,
    heatmapDayIso,
  ]);

  return { ...derived, storageNotPersisted, inboundP2pCount };
}

export type DashboardModel = ReturnType<typeof useDashboardModel>;
