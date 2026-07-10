import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { isOngoing } from '@/domain/spaces/spaces';
import { useScrolled } from '@/hooks/useScrolled';
import { resolveActivePhase, sortPhasesByOrder, localDateString, formatShortDate } from '@/domain/dates';
import { calculateFreeToSpend, classifyBudgetSignal } from '@/domain/budget';
import { filterTransactionsByPool } from '@/domain/transactions';
import { fromCents, sumCents } from '@/domain/money';
import {
  createScenarioPlan,
  createAllocationItem,
  calculateOverAllocationCents,
  listSessionAdditions,
  formatAdditionsList,
} from '@/domain/planning';
import { calculatePlanProgress } from '@/domain/forecasting';
import {
  createCustomActivityProfile,
  isProfileEnabledInPhase,
  createPhaseProfileSetting,
} from '@/domain/profiles';
import { sumSpentInOccurrenceInterval } from '@/domain/planning';
import { createProfileEnabledInPhase } from '@/domain/orchestrators';
import {
  activityProfileRepository,
  scenarioPlanRepository,
  scenarioAllocationItemRepository,
  phaseProfileSettingRepository,
  sessionRepository,
} from '@/data/repositories';
import { getCategoryIcon } from '@/utils/category-icons';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { BreakdownSheet } from '@/components/Breakdown';
import { EmptyState } from '@/components/EmptyState';
import { showToast } from '@/components/Toast';
import { HelpButton } from '@/components/HelpMode';
import { ProfileForm, type ProfileFormData } from '@/components/ProfileForm';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { PhaseProfileSetting } from '@/domain/types/phase-profile-setting';
import type { ScenarioPlan, ScenarioAllocationItem } from '@/domain/types/scenario';
import type { AllocationPriority, ScenarioPreset } from '@/domain/types/common';
import type { Session } from '@/domain/types/session';
import { PlanCopilotFlow } from '@/features/plan-copilot/PlanCopilotFlow';

/* ── types ── */

interface ProfileState {
  count: number;
  isLocked: boolean;
  baselineCount: number;
  /** DEC-100 (R-22): classification lives PER PHASE on the allocation item. */
  priority: AllocationPriority;
}

interface RecommendationChange {
  profileId: string;
  name: string;
  from: number;
  to: number;
}

interface Recommendation {
  title: string;
  description: string;
  changes: RecommendationChange[];
  remainingMarginCents: number;
}

/* ── helpers ── */

const PRIORITY_BY_CATEGORY: Record<string, AllocationPriority> = {
  market: 'essential',
  accommodation: 'essential',
  health: 'essential',
  communication: 'essential',
  outing: 'planned',
  transport: 'planned',
  bar: 'optional',
  restaurant: 'optional',
  festival: 'optional',
  entertainment: 'optional',
};

function getPriority(category: string): AllocationPriority {
  return PRIORITY_BY_CATEGORY[category] ?? 'optional';
}

const COLOR_VAR: Record<string, string> = {
  '#6B8F71': 'var(--success)',
  '#C75B39': 'var(--primary)',
  '#D4A843': 'var(--warning)',
  '#D94040': 'var(--error)',
};

function colorVar(hex: string | null): string {
  if (!hex) return 'var(--on-surface-dim)';
  return COLOR_VAR[hex] ?? hex;
}

const CURRENCY_SYMBOL: Record<string, string> = {
  EUR: '€',
  USD: '$',
  BRL: 'R$',
  GBP: '£',
};

function sym(currency: string): string {
  return CURRENCY_SYMBOL[currency] ?? currency;
}

function splitMoney(
  cents: number,
  currency: string,
): { integer: string; decimal: string } {
  const value = fromCents(cents);
  const abs = Math.abs(value);
  const intPart = Math.floor(abs);
  const decPart = Math.round((abs - intPart) * 100);
  return {
    integer: `${value < 0 ? '-' : ''}${sym(currency)}${intPart}`,
    decimal: `,${decPart.toString().padStart(2, '0')}`,
  };
}

function fmtFull(cents: number, currency: string): string {
  const { integer, decimal } = splitMoney(cents, currency);
  return `${integer}${decimal}`;
}

function fmtCompact(cents: number, currency: string): string {
  const value = Math.abs(Math.round(fromCents(cents)));
  return `${sym(currency)}${value}`;
}

function getPresetMultiplier(priority: AllocationPriority, preset: string): number {
  switch (preset) {
    case 'economico':
      return priority === 'essential' ? 1 : 0.6;
    case 'mais_social':
      return priority === 'optional' ? 1.5 : 1;
    default:
      return 1;
  }
}

const PERSIST_DEBOUNCE_MS = 500;

/* ── component ── */

export function PlannerPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scrolled = useScrolled();
  const { trip, phases, pools, links, envelopes, transactions, occurrences, plannedPurchases, loading } =
    useAppData();

  const [profiles, setProfiles] = useState<ActivityProfile[]>([]);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [phaseSettings, setPhaseSettings] = useState<PhaseProfileSetting[]>([]);
  const [states, setStates] = useState<Record<string, ProfileState>>({});
  const [activePreset, setActivePreset] = useState<ScenarioPreset>('equilibrado');
  // DEC-463: "planejar a partir de agora" — the plan's counting window start
  // (local YYYY-MM-DD). null = whole phase (the historic behavior).
  const [countFrom, setCountFrom] = useState<string | null>(null);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [ready, setReady] = useState(false);
  // DEC-099 (R-21): tap on a category opens its menu (edit value, remove
  // from phase, classification).
  const [menuProfile, setMenuProfile] = useState<ActivityProfile | null>(null);
  const [menuValueDraft, setMenuValueDraft] = useState('');
  // DEC-172: "where the margin comes from" sheet (available − allocated = margin).
  const [marginBreakdownOpen, setMarginBreakdownOpen] = useState(false);
  // M13: one-tap legend explaining the priority tags + the lock affordance.
  const [legendOpen, setLegendOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const copilotAutoStart = searchParams.get('copilot') === '1';
  const [plannerMode, setPlannerMode] = useState<'manual' | 'assisted'>(copilotAutoStart ? 'assisted' : 'manual');
  const [copilotStarted, setCopilotStarted] = useState(copilotAutoStart);

  const profilesRef = useRef<ActivityProfile[]>([]);
  const enabledProfilesRef = useRef<ActivityProfile[]>([]);
  const statesRef = useRef<Record<string, ProfileState>>({});
  const presetRef = useRef<ScenarioPreset>('equilibrado');
  const countFromRef = useRef<string | null>(null);
  const planRef = useRef<ScenarioPlan | null>(null);
  const itemsRef = useRef<Map<string, ScenarioAllocationItem>>(new Map());
  const hydratedRef = useRef(false);
  // FB-25 (DEC-274): opening the Planner must NEVER write. The debounced persist
  // only runs after the traveler actually edits something (a +/−, a lock, a
  // preset, a recommendation, a new category). Merely loading the page —
  // hydration seeding `states` from the profiles' defaults — must not create a
  // ScenarioPlan or allocation items. Reset on every (re)hydration.
  const userEditedRef = useRef(false);

  profilesRef.current = profiles;
  statesRef.current = states;
  presetRef.current = activePreset;
  countFromRef.current = countFrom;

  /* ── phase selection (ISSUE-02: multi-phase support) ── */

  const sortedPhases = useMemo(() => sortPhasesByOrder(phases), [phases]);

  useEffect(() => {
    if (selectedPhaseId || phases.length === 0) return;
    const active = resolveActivePhase(phases);
    setSelectedPhaseId(active?.id ?? sortedPhases[0]?.id ?? null);
  }, [phases, sortedPhases, selectedPhaseId]);

  const selectedPhase = useMemo(
    () => phases.find((p) => p.id === selectedPhaseId) ?? null,
    [phases, selectedPhaseId],
  );

  /* ── pool resolution: each phase uses its own linked fund (DEC-007/DEC-040) ── */

  const phasePool = useMemo(() => {
    if (!selectedPhase) return undefined;
    const linkedIds = new Set(
      links
        .filter((l) => l.phaseId === selectedPhase.id && l.deletedAt === null)
        .map((l) => l.budgetPoolId),
    );
    return (
      pools.find((p) => linkedIds.has(p.id)) ??
      pools.find((p) => p.scope === 'linked_phases') ??
      pools[0]
    );
  }, [selectedPhase, links, pools]);

  const currency = phasePool?.currency ?? trip?.baseCurrency ?? 'EUR';

  /* ── profile loading ── */

  useEffect(() => {
    if (!trip) return;
    activityProfileRepository.getByTripId(trip.id).then((profs) => {
      setProfiles(profs);
      setProfilesLoaded(true);
    });
  }, [trip]);

  // DEC-074: the Planner only sees profiles enabled in the selected phase.
  const enabledProfiles = useMemo(
    () =>
      selectedPhase
        ? profiles.filter((p) => isProfileEnabledInPhase(phaseSettings, selectedPhase.id, p.id))
        : profiles,
    [profiles, phaseSettings, selectedPhase],
  );
  enabledProfilesRef.current = enabledProfiles;

  /* ── scenario hydration (ISSUE-04: load persisted state) ── */

  useEffect(() => {
    if (!trip || !selectedPhase || !phasePool || !profilesLoaded) return;
    let cancelled = false;
    hydratedRef.current = false;
    // FB-25 (DEC-274): a fresh (re)hydration is NOT a user edit — clear the flag
    // so the seeding setStates below can never trigger a persist on open.
    userEditedRef.current = false;
    setReady(false);

    (async () => {
      const [plan, settings] = await Promise.all([
        // DEC-462: pool-preferred, per-phase fallback — a plan whose pool key
        // drifted still hydrates here (and the next persist migrates its key).
        scenarioPlanRepository.getActiveForPhase(trip.id, selectedPhase.id, phasePool.id),
        phaseProfileSettingRepository.getByPhaseId(selectedPhase.id),
      ]);
      const items = plan
        ? await scenarioAllocationItemRepository.getByPlanId(plan.id)
        : [];
      if (cancelled) return;

      planRef.current = plan ?? null;
      itemsRef.current = new Map(items.map((i) => [i.activityProfileId, i]));
      setPhaseSettings(settings);

      // DEC-074 (FIELD-01): only profiles enabled in this phase are hydrated
      // and persisted — disabled profiles never seed allocations again.
      const enabled = profilesRef.current.filter((p) =>
        isProfileEnabledInPhase(settings, selectedPhase.id, p.id),
      );
      const init: Record<string, ProfileState> = {};
      for (const p of enabled) {
        const item = itemsRef.current.get(p.id);
        const base = item?.quantity ?? p.expectedFrequencyPerPhase ?? 3;
        init[p.id] = {
          count: base,
          isLocked: item?.isLocked ?? getPriority(p.category) === 'essential',
          baselineCount: base,
          // DEC-100 (R-22): per-phase classification — the persisted item
          // wins; the category mapping only seeds new items.
          priority: item?.priority ?? getPriority(p.category),
        };
      }
      if (plan) setActivePreset(plan.preset);
      setCountFrom(plan?.countFromIso ?? null);
      setStates(init);
      hydratedRef.current = true;
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [trip, selectedPhase, phasePool, profilesLoaded]);

  /* ── scenario persistence (ISSUE-04: debounced auto-save) ── */

  const persist = useCallback(async () => {
    if (!trip || !selectedPhase || !phasePool) return;

    let plan = planRef.current;
    if (!plan) {
      plan = {
        ...createScenarioPlan({
          tripId: trip.id,
          phaseId: selectedPhase.id,
          budgetPoolId: phasePool.id,
          name: selectedPhase.name,
          preset: presetRef.current,
        }),
        countFromIso: countFromRef.current,
      };
      await scenarioPlanRepository.create(plan);
      planRef.current = plan;
    } else if (
      plan.preset !== presetRef.current ||
      (plan.countFromIso ?? null) !== countFromRef.current ||
      // DEC-462: migrate a drifted pool key to the phase's current fund, so the
      // (phase, pool) readers converge on this plan again.
      plan.budgetPoolId !== phasePool.id
    ) {
      plan = await scenarioPlanRepository.update({
        ...plan,
        preset: presetRef.current,
        countFromIso: countFromRef.current,
        budgetPoolId: phasePool.id,
      });
      planRef.current = plan;
    }

    for (const profile of enabledProfilesRef.current) {
      const s = statesRef.current[profile.id];
      if (!s) continue;
      const existing = itemsRef.current.get(profile.id);
      if (existing) {
        if (
          existing.quantity !== s.count ||
          existing.isLocked !== s.isLocked ||
          existing.priority !== s.priority
        ) {
          const updated = await scenarioAllocationItemRepository.update({
            ...existing,
            quantity: s.count,
            isLocked: s.isLocked,
            priority: s.priority,
          });
          itemsRef.current.set(profile.id, updated);
        }
      } else {
        const item = createAllocationItem({
          scenarioPlanId: plan.id,
          activityProfileId: profile.id,
          quantity: s.count,
          estimatedUnitCostCents: profile.typicalValueCents,
          isLocked: s.isLocked,
          priority: s.priority,
        });
        await scenarioAllocationItemRepository.create(item);
        itemsRef.current.set(profile.id, item);
      }
    }
  }, [trip, selectedPhase, phasePool]);

  // DEC-477: "salvando… / salvo ✓" feedback + flush-on-exit. The debounce used
  // to be cancelled by the unmount cleanup, so edits made <500ms before
  // leaving the page silently vanished — exactly Julio's "mexo no plano e a
  // página anterior não atualiza".
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const persistRef = useRef(persist);
  persistRef.current = persist;
  const pendingSaveRef = useRef(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runPersist = useCallback(() => {
    pendingSaveRef.current = false;
    void persistRef.current().then(() => {
      setSaveState('saved');
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveState('idle'), 2000);
    });
  }, []);

  useEffect(() => {
    // FB-25 (DEC-274): persist only after a real user edit — opening the page
    // (hydration → setStates) must not create a plan or allocations.
    if (!hydratedRef.current || !userEditedRef.current) return;
    pendingSaveRef.current = true;
    setSaveState('saving');
    const timer = setTimeout(runPersist, PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [states, activePreset, countFrom, runPersist]);

  // Flush a pending debounce the moment the page hides or the component
  // unmounts — leaving the Planner can never lose the last taps again.
  useEffect(() => {
    const flushIfPending = () => {
      if (!pendingSaveRef.current || !userEditedRef.current) return;
      pendingSaveRef.current = false;
      void persistRef.current();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushIfPending();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flushIfPending);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flushIfPending);
      flushIfPending(); // unmount — runs AFTER the debounce cleanup above
    };
  }, []);

  /* ── budget math ── */

  const poolTxs = useMemo(
    () =>
      phasePool ? filterTransactionsByPool(transactions, phasePool.id) : [],
    [phasePool, transactions],
  );

  // DEC-477: the home hero feeds `calculateFreeToSpend` the full session set
  // (DEC-400 event netting). The Planner must eat the SAME available number or
  // the margins can never match — so it loads the sessions too.
  const [phaseSessions, setPhaseSessions] = useState<Session[]>([]);
  useEffect(() => {
    if (!trip) return;
    let cancelled = false;
    Promise.all([
      sessionRepository.getActive(trip.id),
      sessionRepository.getCompleted(trip.id),
    ]).then(([active, completed]) => {
      if (cancelled) return;
      setPhaseSessions(active ? [active, ...completed] : completed);
    });
    return () => {
      cancelled = true;
    };
  }, [trip, transactions]);

  const fts = useMemo(
    () =>
      phasePool && selectedPhase
        ? calculateFreeToSpend(
            phasePool,
            envelopes.filter((e) => e.budgetPoolId === phasePool.id),
            poolTxs,
            links,
            selectedPhase.id,
            occurrences,
            plannedPurchases,
            phaseSessions,
          )
        : null,
    [phasePool, selectedPhase, envelopes, poolTxs, links, occurrences, plannedPurchases, phaseSessions],
  );

  const availableCents = fts?.freeToSpendCents ?? 0;

  // DEC-477: the ONE plan-progress ruler (same function as Home/Viagem).
  // Computed LIVE from the stepper state, so every [−]/[+] tap moves the
  // reserve, the per-line "feitas · restantes" and the margin together.
  const liveProgress = useMemo(
    () =>
      selectedPhase
        ? calculatePlanProgress(
            enabledProfiles,
            enabledProfiles.map((p) => ({
              activityProfileId: p.id,
              quantity: states[p.id]?.count ?? 0,
            })),
            transactions,
            selectedPhase.id,
            countFrom,
          )
        : null,
    [selectedPhase, enabledProfiles, states, transactions, countFrom],
  );

  const baselineProgress = useMemo(
    () =>
      selectedPhase
        ? calculatePlanProgress(
            enabledProfiles,
            enabledProfiles.map((p) => ({
              activityProfileId: p.id,
              quantity: states[p.id]?.baselineCount ?? 0,
            })),
            transactions,
            selectedPhase.id,
            countFrom,
          )
        : null,
    [selectedPhase, enabledProfiles, states, transactions, countFrom],
  );

  const baselineAllocatedCents = useMemo(
    () =>
      sumCents(
        enabledProfiles.map(
          (p) => (states[p.id]?.baselineCount ?? 0) * p.typicalValueCents,
        ),
      ),
    [enabledProfiles, states],
  );

  const currentAllocatedCents = useMemo(
    () =>
      sumCents(
        enabledProfiles.map(
          (p) => (states[p.id]?.count ?? 0) * p.typicalValueCents,
        ),
      ),
    [enabledProfiles, states],
  );

  // DEC-477: what the plan still HOLDS (remaining occasions × typical, money-
  // aware) — done occasions and spent money no longer count against the margin
  // (they already left `availableCents`). This is the "−71 vs −19" fix: the
  // old `available − currentAllocated` subtracted the FULL envelope from a
  // free number that had already absorbed the spend (double counting).
  const planReserveCents = liveProgress?.reserveCents ?? 0;
  const planUsedCents = liveProgress?.allocatedSpentCents ?? 0;
  const baselineReserveCents = baselineProgress?.reserveCents ?? 0;

  const freeMarginCents = availableCents - baselineReserveCents;
  // DEC-098 (R-19/R-20): the HEADER margin is live — recalculated on every
  // [-]/[+] tap, and it goes negative when over-committed (never clamped).
  const liveMarginCents = availableCents - planReserveCents;
  const extraCostCents = currentAllocatedCents - baselineAllocatedCents;
  // DEC-112 (R5-07): deficit derives from total over-commitment, not from
  // session deltas — after re-entering the Planner (baseline == count) the
  // plan can still be over budget and the guidance must persist.
  const deficitCents = Math.max(0, -liveMarginCents);
  const hasDeficit = deficitCents > 0;
  const marginForExtrasCents = Math.max(
    0,
    Math.min(freeMarginCents, extraCostCents),
  );

  /* ── over-allocation warning (ISSUE-05) ── */

  // DEC-477: the red warning fires on the RESERVE (what the plan still needs),
  // not the full envelope — 17 bars with 16 done is €255 allocated but only
  // one €15 slot ahead, which is not an over-allocation.
  const overAllocationCents = calculateOverAllocationCents(
    planReserveCents,
    availableCents,
  );

  // C04/DEC-304: reconcile the COPY with the Copilot. The Copilot reads REAL
  // spend pace; this red reads FUTURE allocation. Same words on both screens:
  // the warning is a real problem ONLY when real spend already passed available.
  const overAllocationSignal = classifyBudgetSignal({
    realSpendOverCents: Math.max(0, -availableCents),
    overAllocationCents,
    projectedOverCents: 0,
  });

  const modifiedProfiles = useMemo(
    () =>
      enabledProfiles.filter((p) => {
        const s = states[p.id];
        return s && s.count !== s.baselineCount;
      }),
    [enabledProfiles, states],
  );

  // R5-06: per-category additions for the deficit headline.
  const sessionAdditions = useMemo(
    () => listSessionAdditions(modifiedProfiles, states),
    [modifiedProfiles, states],
  );

  /* ── recommendation ── */

  const recommendation = useMemo((): Recommendation | null => {
    if (!hasDeficit) return null;

    const modifiedIds = new Set(modifiedProfiles.map((p) => p.id));
    // DEC-100 (R-22): essential is NEVER suggested for reduction; optional
    // items are the first candidates; locked items are untouchable.
    const priorityRank: Record<AllocationPriority, number> = {
      optional: 0,
      planned: 1,
      essential: 2,
    };
    const reducible = enabledProfiles
      .filter((p) => {
        const s = states[p.id];
        if (!s || s.isLocked || s.count === 0) return false;
        if (modifiedIds.has(p.id)) return false;
        return s.priority !== 'essential';
      })
      .sort((a, b) => {
        const rankDiff =
          priorityRank[states[a.id]!.priority] - priorityRank[states[b.id]!.priority];
        if (rankDiff !== 0) return rankDiff;
        return b.typicalValueCents - a.typicalValueCents;
      });

    const changes: RecommendationChange[] = [];
    let saved = 0;

    for (const profile of reducible) {
      if (saved >= deficitCents) break;
      const s = states[profile.id]!;
      const needed = Math.ceil(
        (deficitCents - saved) / profile.typicalValueCents,
      );
      const actual = Math.min(needed, s.count);
      if (actual > 0) {
        changes.push({
          profileId: profile.id,
          name: profile.name,
          from: s.count,
          to: s.count - actual,
        });
        saved += actual * profile.typicalValueCents;
      }
    }

    if (changes.length === 0) return null;

    const parts = changes.map(
      (c) => `${c.from - c.to} ${c.name.toLowerCase()}`,
    );

    return {
      title: `${t('planner.reduce')} ${parts.join(` ${t('planner.and_conjunction')} `)}`,
      description: t('planner.recommendation_desc'),
      changes,
      remainingMarginCents: saved - deficitCents,
    };
  }, [hasDeficit, deficitCents, enabledProfiles, states, modifiedProfiles, t]);

  /* ── handlers ── */

  const updateCount = useCallback(
    (id: string, delta: number) => {
      // DEC-100 (R-22): a locked quantity is untouchable — give feedback.
      if (statesRef.current[id]?.isLocked) {
        showToast(t('planner.locked_feedback'), 'warning');
        return;
      }
      userEditedRef.current = true; // FB-25: an explicit edit may now persist.
      setStates((prev) => {
        const s = prev[id];
        if (!s) return prev;
        return { ...prev, [id]: { ...s, count: Math.max(0, s.count + delta) } };
      });
    },
    [t],
  );

  const toggleLock = useCallback((id: string) => {
    userEditedRef.current = true; // FB-25: an explicit edit may now persist.
    setStates((prev) => {
      const s = prev[id];
      if (!s) return prev;
      return { ...prev, [id]: { ...s, isLocked: !s.isLocked } };
    });
  }, []);

  // DEC-463: toggle "planejar a partir de agora" — on sets today as the plan's
  // counting start (past occasions stop consuming it); off counts the whole phase.
  const toggleCountFrom = useCallback(() => {
    userEditedRef.current = true; // FB-25: an explicit edit may now persist.
    setCountFrom((prev) => (prev !== null ? null : localDateString(new Date())));
  }, []);

  const applyPreset = useCallback(
    (preset: ScenarioPreset) => {
      userEditedRef.current = true; // FB-25: an explicit edit may now persist.
      setActivePreset(preset);
      setStates((prev) => {
        const next = { ...prev };
        for (const p of enabledProfiles) {
          const s = next[p.id];
          // DEC-100 (R-22): locked items are ignored by presets.
          if (!s || s.isLocked) continue;
          const base = p.expectedFrequencyPerPhase ?? 3;
          const count = Math.max(1, Math.round(base * getPresetMultiplier(s.priority, preset)));
          next[p.id] = { ...s, count, baselineCount: count };
        }
        return next;
      });
    },
    [enabledProfiles],
  );

  const applyRecommendation = useCallback(() => {
    if (!recommendation) return;
    userEditedRef.current = true; // FB-25: an explicit edit may now persist.
    setStates((prev) => {
      const next = { ...prev };
      for (const c of recommendation.changes) {
        const s = next[c.profileId];
        if (s) next[c.profileId] = { ...s, count: c.to, baselineCount: c.to };
      }
      return next;
    });
  }, [recommendation]);

  /* ── category menu (DEC-099 / R-21) ── */

  const openCategoryMenu = useCallback((profile: ActivityProfile) => {
    setMenuProfile(profile);
    setMenuValueDraft(String(fromCents(profile.typicalValueCents)));
  }, []);

  // Edit typical value: updates the ActivityProfile (e.g. transport €8 → €1)
  // and keeps the phase allocation's unit cost in sync.
  const handleSaveTypicalValue = useCallback(async () => {
    if (!menuProfile) return;
    const parsed = parseFloat(menuValueDraft.replace(',', '.'));
    if (Number.isNaN(parsed) || parsed <= 0) return;
    const typicalValueCents = Math.round(parsed * 100);
    const updated = await activityProfileRepository.update({
      ...menuProfile,
      typicalValueCents,
    });
    setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    const item = itemsRef.current.get(updated.id);
    if (item) {
      const updatedItem = await scenarioAllocationItemRepository.update({
        ...item,
        estimatedUnitCostCents: typicalValueCents,
      });
      itemsRef.current.set(updated.id, updatedItem);
    }
    setMenuProfile(null);
    showToast(t('planner.value_updated'), 'success');
  }, [menuProfile, menuValueDraft, t]);

  // Remove from THIS phase only: explicit disable + drop the allocation.
  const handleRemoveFromPhase = useCallback(async () => {
    if (!menuProfile || !selectedPhase) return;
    const existing = await phaseProfileSettingRepository.getByPhaseAndProfile(
      selectedPhase.id,
      menuProfile.id,
    );
    if (existing) {
      await phaseProfileSettingRepository.update({ ...existing, isEnabled: false });
    } else {
      await phaseProfileSettingRepository.create(
        createPhaseProfileSetting(selectedPhase.id, menuProfile.id, false),
      );
    }
    const item = itemsRef.current.get(menuProfile.id);
    if (item) {
      await scenarioAllocationItemRepository.delete(item.id);
      itemsRef.current.delete(menuProfile.id);
    }
    const settings = await phaseProfileSettingRepository.getByPhaseId(selectedPhase.id);
    setPhaseSettings(settings);
    setStates((prev) => {
      const next = { ...prev };
      delete next[menuProfile.id];
      return next;
    });
    setMenuProfile(null);
    showToast(t('planner.removed_from_phase', { name: menuProfile.name }), 'success');
  }, [menuProfile, selectedPhase, t]);

  // DEC-100 (R-22): per-phase classification, edited from the menu.
  const handleSetPriority = useCallback(
    (priority: AllocationPriority) => {
      if (!menuProfile) return;
      userEditedRef.current = true; // FB-25: an explicit edit may now persist.
      setStates((prev) => {
        const s = prev[menuProfile.id];
        if (!s) return prev;
        return { ...prev, [menuProfile.id]: { ...s, priority } };
      });
    },
    [menuProfile],
  );

  // G2-AC4: soft-delete the entire plan and its allocations for this phase.
  const handleClearPlan = useCallback(async () => {
    const plan = planRef.current;
    if (!plan) return;
    const items = await scenarioAllocationItemRepository.getByPlanId(plan.id);
    for (const item of items) await scenarioAllocationItemRepository.delete(item.id);
    await scenarioPlanRepository.delete(plan.id);
    planRef.current = null;
    setStates({});
    itemsRef.current.clear();
    userEditedRef.current = false;
    showToast(t('planner.plan_cleared'), 'success');
  }, [t]);

  /* ── custom category creation (ISSUE-06) ── */

  const handleAddCategory = useCallback(
    async (data: ProfileFormData) => {
      if (!trip || !selectedPhase) return;
      const profile = createCustomActivityProfile({
        tripId: trip.id,
        name: data.name,
        iconName: data.iconName,
        typicalValueCents: data.typicalValueCents,
      });
      // DEC-074: the new profile is explicitly enabled in the current phase.
      userEditedRef.current = true; // FB-25: an explicit edit may now persist.
      await createProfileEnabledInPhase({ profile, phaseId: selectedPhase.id });
      const settings = await phaseProfileSettingRepository.getByPhaseId(selectedPhase.id);
      setPhaseSettings(settings);
      setProfiles((prev) => [...prev, profile]);
      setStates((prev) => ({
        ...prev,
        [profile.id]: {
          count: 1,
          isLocked: false,
          baselineCount: 1,
          priority: getPriority(profile.category),
        },
      }));
      setShowAddForm(false);
    },
    [trip, selectedPhase],
  );

  /* ── loading ── */

  // DEC-171 (B17): a trip with no phases can never hydrate a scenario (the
  // Planner is phase-scoped), so the bare loading guard below would spin
  // forever. Show a calm, actionable empty state pointing at where phases are
  // created instead of an endless spinner.
  // FB-25 (DEC-274): the Planner is a dated/phase-coupled surface. A continuous
  // "Dia a dia" space has no phases or dates (it reasons per calendar month), so
  // it shows a calm, read-only empty state — never the phase planner that would
  // seed allocations and read as a negative margin. Gated by capability, not by
  // the incidental phase count, and it writes nothing.
  if (!loading && trip && isOngoing(trip)) {
    return (
      <div className="flex flex-col pb-4 pt-6">
        <p
          className="text-[11px] tracking-[0.15em] uppercase font-bold"
          style={{ color: '#C75B39aa' }}
        >
          {t('planner.title')}
        </p>
        <h1 className="text-xl font-extrabold tracking-tight mt-1 mb-5 text-on-surface">
          {t('planner.scenarios')}
        </h1>
        <EmptyState
          icon="event_busy"
          title={t('planner.ongoing_title')}
          body={t('planner.ongoing_body')}
          cta={{
            label: t('planner.ongoing_cta'),
            icon: 'home',
            onClick: () => navigate('/'),
          }}
        />
      </div>
    );
  }

  if (!loading && trip && phases.length === 0) {
    return (
      <div className="flex flex-col pb-4 pt-6">
        <p
          className="text-[11px] tracking-[0.15em] uppercase font-bold"
          style={{ color: '#C75B39aa' }}
        >
          {t('planner.title')}
        </p>
        <h1 className="text-xl font-extrabold tracking-tight mt-1 mb-5 text-on-surface">
          {t('planner.scenarios')}
        </h1>
        <EmptyState
          icon="calendar_month"
          title={t('planner.no_phases_title')}
          body={t('planner.no_phases_body')}
          cta={{
            label: t('planner.no_phases_cta'),
            icon: 'add',
            onClick: () => navigate('/viagem'),
          }}
        />
      </div>
    );
  }

  if (loading || !trip || !ready) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-on-surface-dim">{t('common.loading')}</p>
      </div>
    );
  }

  const phaseName = selectedPhase?.name ?? phases[0]?.name ?? '';
  // DEC-098 (R-20): never clamp — the negative is the information.
  const displayMargin = splitMoney(liveMarginCents, currency);
  const isOverBudget = liveMarginCents < 0;

  return (
    <div className="flex flex-col pb-4">
      {/* ── DEC-084 (R-01): header + phase selector + summary fixed at the top ── */}
      <div className={`page-sticky-header ${scrolled ? 'is-scrolled' : ''} pb-3`}>
      {/* ── HEADER ── */}
      <div className="pt-6 pb-1 flex justify-between items-center">
        <div>
          <p
            className="text-[11px] tracking-[0.15em] uppercase font-bold"
            style={{ color: '#C75B39aa' }}
          >
            {t('planner.title')}
          </p>
          <h1 className="text-xl font-extrabold tracking-tight mt-1 text-on-surface">
            {t('planner.scenarios_of', { phase: phaseName })}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <HelpButton screenId="planner" />
          {/* DEC-477: save feedback — edits auto-save (debounced + flushed on
              exit); the chip tells the traveler the plan is safe to leave. */}
          {saveState !== 'idle' ? (
            <span
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold"
              style={
                saveState === 'saved'
                  ? { background: '#6B8F7118', color: 'var(--success)' }
                  : { background: 'var(--surface-high)', color: 'var(--on-surface-faint)' }
              }
            >
              {t(saveState === 'saved' ? 'planner.saved' : 'planner.saving')}
            </span>
          ) : (
            <div className="flex items-center bg-surface-high rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setPlannerMode('manual')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors ${
                  plannerMode === 'manual'
                    ? 'bg-surface-container text-on-surface'
                    : 'text-on-surface-faint'
                }`}
              >
                {t('planner_copilot.mode_manual')}
              </button>
              <button
                type="button"
                onClick={() => setPlannerMode('assisted')}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors ${
                  plannerMode === 'assisted'
                    ? 'bg-primary/15 text-primary'
                    : 'text-on-surface-faint'
                }`}
              >
                {t('planner_copilot.mode_assisted')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Audit 4.9 (P2): a plain-language "what is this page" line — the light
          guided touch for the app's most conceptual surface. */}
      <p className="text-xs text-on-surface-dim mt-1 leading-snug">
        {t('planner.intro')}{' '}
        {/* M13: a one-tap legend for the tags + lock (P-1: "what does the lock do?"). */}
        <button
          type="button"
          onClick={() => setLegendOpen(true)}
          className="btn-press inline-flex items-center gap-0.5 align-baseline font-semibold text-primary"
        >
          <Icon name="help" size={13} className="align-middle" />
          {t('planner.legend_link')}
        </button>
      </p>

      {/* ── PHASE SELECTOR (multi-phase trips) ── */}
      {sortedPhases.length > 1 && (
        <div className="mt-3">
          <p className="text-[10px] tracking-[0.12em] uppercase font-bold text-on-surface-faint mb-1.5">
            {t('planner.select_phase')}
          </p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {sortedPhases.map((phase) => (
              <button
                key={phase.id}
                onClick={() => setSelectedPhaseId(phase.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold btn-press ${
                  phase.id === selectedPhaseId
                    ? 'bg-primary text-on-surface'
                    : 'bg-surface-container text-on-surface-dim'
                }`}
              >
                {phase.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── BUDGET SUMMARY (DEC-098: live margin, negative when over) ── */}
      <div className="mt-4 p-4 rounded-2xl bg-surface-container" data-help-anchor="planner-free-margin">
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={() => setMarginBreakdownOpen(true)}
            className="text-left btn-press"
            aria-label={t('planner.margin_breakdown_title')}
          >
            <p className="text-xs font-bold text-on-surface-dim flex items-center gap-1">
              {t('planner.free_margin')}
              <span className="flex items-center gap-0.5 text-[10px] font-bold text-on-surface-faint">
                <Icon name="help" size={12} className="text-on-surface-faint" />
                {t('planner.margin_hint')}
              </span>
            </p>
            <p
              className="text-2xl font-extrabold tabular"
              style={{ color: isOverBudget ? 'var(--error)' : 'var(--on-surface)' }}
            >
              {displayMargin.integer}
              <span
                className="text-sm"
                style={{ color: isOverBudget ? 'var(--error)' : 'var(--on-surface-dim)' }}
              >
                {displayMargin.decimal}
              </span>
            </p>
          </button>
          <div className="text-right">
            <p className="text-xs font-bold text-on-surface-dim">
              {t('planner.allocated')}
            </p>
            <p className="text-lg font-bold tabular text-on-surface-dim">
              {fmtFull(currentAllocatedCents, currency)}
            </p>
          </div>
        </div>
        {/* DEC-477: split the envelope — what the plan already consumed vs what
            it still holds. Makes "margem = livre − reservado" auditable and
            explains why 17 bars with 16 done barely move the margin. */}
        {(planUsedCents > 0 || planReserveCents > 0) && (
          <p className="text-[11px] font-semibold text-on-surface-faint mt-1.5 tabular">
            {t('planner.header_used', { amount: fmtCompact(planUsedCents, currency) })}
            {' · '}
            {t('planner.header_reserved', { amount: fmtCompact(planReserveCents, currency) })}
          </p>
        )}
        {/* Future floor as informative constraint (DEC-016 / GAP-008) */}
        {(fts?.futureFloorCents ?? 0) > 0 && (
          <p className="text-[11px] font-semibold text-on-surface-faint mt-2 flex items-center gap-1">
            <Icon name="lock" size={12} className="text-on-surface-faint" />
            {t('planner.future_floor_constraint', {
              amount: fmtFull(fts!.futureFloorCents, currency),
            })}
          </p>
        )}
        {/* Audit 4.9 (P2): name the two numbers in one plain line. */}
        <p className="text-[11px] text-on-surface-faint mt-2 leading-snug">
          {t('planner.summary_hint')}
        </p>
        {/* DEC-463: plan "a partir de agora" — with 15 bar nights already done,
            planning 4 MORE must read "4 restantes", not "0 de 4". The toggle
            sets the plan's counting window to start today. */}
        <div className="mt-2.5 pt-2.5 flex items-center justify-between gap-2 border-t border-[var(--border-faint)]">
          <p className="text-[11px] font-semibold text-on-surface-dim flex items-center gap-1 min-w-0">
            <Icon
              name="today"
              size={13}
              className={countFrom !== null ? 'text-primary shrink-0' : 'text-on-surface-faint shrink-0'}
            />
            <span className="truncate">
              {countFrom !== null
                ? t('planner.count_from_active', { date: formatShortDate(countFrom) })
                : t('planner.count_from_whole')}
            </span>
          </p>
          <button
            type="button"
            onClick={toggleCountFrom}
            className="btn-press shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
            style={
              countFrom !== null
                ? { background: 'var(--surface-high)', color: 'var(--on-surface-dim)' }
                : { background: '#C75B3918', color: 'var(--primary)' }
            }
          >
            {countFrom !== null ? t('planner.count_from_reset') : t('planner.count_from_now')}
          </button>
        </div>
        {countFrom !== null && (
          <p className="text-[10px] text-on-surface-faint mt-1.5 leading-snug">
            {t('planner.count_from_hint')}
          </p>
        )}
      </div>

      {/* ── DEC-098 (R-20): over-budget is the FIRST thing on screen —
          emphatic, inside the fixed header, visible without scrolling ── */}
      {overAllocationCents > 0 && (
        <div
          className="mt-2 p-3 rounded-xl flex flex-col gap-1.5"
          style={{ background: '#D9404015', border: '1px solid #D9404030' }}
        >
          <div className="flex items-center gap-2.5">
            <Icon name="error" size={18} className="text-error shrink-0" />
            <p className="text-xs font-bold leading-snug" style={{ color: 'var(--error)' }}>
              {t('planner.over_allocation_warning', {
                amount: fmtFull(overAllocationCents, currency),
              })}
            </p>
          </div>
          {/* C04/DEC-304: name whether this red is the PLAN (future allocation,
              real spend still on track) or REAL (money already over). */}
          <p className="text-[11px] leading-snug pl-[28px] text-on-surface-dim">
            {t(
              overAllocationSignal.isRealProblem
                ? 'planner.over_allocation_real'
                : 'planner.over_allocation_is_plan',
            )}
          </p>
        </div>
      )}
      </div>
      {/* ── end of sticky header block ── */}

      {/* ── DEC-072 (M6.6): planned events of the phase — informative, no sliders ── */}
      {selectedPhase && (() => {
        const phaseEvents = occurrences.filter((o) => o.phaseId === selectedPhase.id);
        if (phaseEvents.length === 0) return null;
        const events = phaseEvents.filter((o) => o.kind === 'event');
        const subDestinations = phaseEvents.filter((o) => o.kind === 'sub_destination');
        const eventDays = (o: (typeof phaseEvents)[number]): number =>
          o.plannedDate && o.endDate
            ? Math.round(
                (new Date(o.endDate).getTime() - new Date(o.plannedDate).getTime()) / 86400000,
              ) + 1
            : 1;
        // DEC-101 (R-23): each event opens ITS edit sheet via deep link.
        return (
          <div className="mt-3 p-3 rounded-xl bg-surface-container space-y-1">
            {events.map((o) => (
              <button
                key={o.id}
                onClick={() => navigate(`/trip/edit?occurrence=${o.id}`)}
                className="w-full text-left btn-press flex items-center gap-1.5"
              >
                <Icon name="celebration" size={13} className="text-primary shrink-0" />
                <span className="text-[11px] font-semibold text-on-surface-dim flex-1">
                  {o.name}
                  {eventDays(o) > 1 ? ` (${eventDays(o)}d)` : ''}{' '}
                  {fmtFull(o.reservedCents ?? o.estimatedCostCents, currency)}
                </span>
                <Icon name="chevron_right" size={14} className="text-on-surface-faint shrink-0" />
              </button>
            ))}
            {subDestinations.map((o) => (
              <button
                key={o.id}
                onClick={() => navigate(`/trip/edit?occurrence=${o.id}`)}
                className="w-full text-left btn-press flex items-center gap-1.5"
              >
                <Icon name="location_on" size={13} className="text-primary shrink-0" />
                <span className="text-[11px] font-semibold text-on-surface-dim flex-1">
                  {o.name}: {t('planner.sub_destination_spent', {
                    spent: fmtFull(sumSpentInOccurrenceInterval(o, transactions), currency),
                    budget: fmtFull(o.estimatedCostCents, currency),
                  })}
                </span>
                <Icon name="chevron_right" size={14} className="text-on-surface-faint shrink-0" />
              </button>
            ))}
          </div>
        );
      })()}

      {/* ── PROFILE CARDS ── */}
      <div className="mt-4 space-y-3" data-help-anchor="planner-categories">
        {enabledProfiles.map((profile) => {
          const s = states[profile.id];
          if (!s) return null;

          // DEC-100 (R-22): classification comes from the PHASE state, not
          // from the global category default.
          const priority = s.priority;
          const isModified = s.count !== s.baselineCount;
          // DEC-477: live done/remaining/overspent for this profile.
          const progressLine =
            liveProgress?.lines.find((l) => l.profileId === profile.id) ?? null;
          const cVar = colorVar(profile.color);
          // Theme-aware tint: custom hex colors get alpha; no color → token (DEC-083).
          const tintBg = profile.color ? `${profile.color}18` : 'var(--highlight-soft)';
          const tintBadge = profile.color ? `${profile.color}20` : 'var(--highlight-soft)';
          const total = s.count * profile.typicalValueCents;

          return (
            <div
              key={profile.id}
              className="p-4 rounded-2xl bg-surface-container"
              style={
                isModified
                  ? { border: '1px solid #D4A84325' }
                  : undefined
              }
            >
              {/* header row — tap opens the category menu (DEC-099 / R-21) */}
              <div className="flex items-center justify-between mb-3">
                <button
                  className="flex items-center gap-2.5 btn-press text-left"
                  onClick={() => openCategoryMenu(profile)}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: tintBg }}
                  >
                    <span
                      className="material-symbols-outlined text-base"
                      style={{ color: cVar }}
                    >
                      {profile.iconName ?? getCategoryIcon(profile.category)}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-on-surface">
                    {profile.name}
                  </p>
                  <Icon name="more_horiz" size={14} className="text-on-surface-faint" />
                </button>

                <div className="flex items-center gap-1.5">
                  {isModified && (
                    <span
                      className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                      style={{
                        background: '#D4A84318',
                        color: 'var(--warning)',
                      }}
                    >
                      {t('planner.modified')}
                    </span>
                  )}
                  <span
                    className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                    style={{
                      background:
                        priority === 'essential'
                          ? tintBadge
                          : 'var(--highlight-soft)',
                      color:
                        priority === 'essential'
                          ? cVar
                          : 'var(--on-surface-dim)',
                    }}
                  >
                    {priority === 'essential'
                      ? t('planner.essential')
                      : priority === 'planned'
                        ? t('planner.planned')
                        : t('planner.optional')}
                  </span>
                  {/* DEC-100 (R-22): lock with real effect — highlighted when active */}
                  <button
                    className="btn-press"
                    onClick={() => toggleLock(profile.id)}
                    aria-pressed={s.isLocked}
                  >
                    <span
                      className="material-symbols-outlined text-sm"
                      style={{
                        color: s.isLocked ? cVar : 'var(--on-surface-faint)',
                      }}
                    >
                      {s.isLocked ? 'lock' : 'lock_open'}
                    </span>
                  </button>
                </div>
              </div>

              {/* controls row — dimmed when locked (DEC-100 / R-22) */}
              <div
                className="flex items-center justify-between"
                style={s.isLocked ? { opacity: 0.45 } : undefined}
              >
                <div className="flex items-center gap-3">
                  <button
                    className="btn-press w-8 h-8 rounded-lg flex items-center justify-center bg-surface-high"
                    onClick={() => updateCount(profile.id, -1)}
                    disabled={s.count === 0}
                  >
                    <span className="material-symbols-outlined text-base text-on-surface-dim">
                      remove
                    </span>
                  </button>
                  <span
                    className="text-2xl font-extrabold tabular w-8 text-center"
                    style={{
                      color: isModified
                        ? 'var(--warning)'
                        : 'var(--on-surface)',
                    }}
                  >
                    {s.count}
                  </span>
                  <button
                    className="btn-press w-8 h-8 rounded-lg flex items-center justify-center bg-surface-high"
                    onClick={() => updateCount(profile.id, 1)}
                  >
                    <span className="material-symbols-outlined text-base text-on-surface-dim">
                      add
                    </span>
                  </button>
                </div>
                <p
                  className="text-sm font-bold tabular"
                  style={{
                    color: isModified
                      ? 'var(--warning)'
                      : 'var(--on-surface-dim)',
                  }}
                >
                  {fmtCompact(total, currency)}
                </p>
              </div>

              {/* DEC-477: the missing "done vs remaining" read — the stepper is
                  the TOTAL plan, this line shows how much of it already
                  happened (same windowed ruler as Home/Viagem). */}
              {progressLine &&
                (progressLine.done > 0 ||
                  progressLine.overspentCents > 0 ||
                  progressLine.outOfPlan) && (
                  <p className="flex items-center gap-1.5 flex-wrap mt-2 text-[11px] font-semibold text-on-surface-dim tabular">
                    <span>
                      {t('planner.line_progress', {
                        done: progressLine.done,
                        remaining: progressLine.remaining,
                      })}
                    </span>
                    {progressLine.overspentCents > 0 && (
                      <span style={{ color: 'var(--warning)' }}>
                        {t('planner.line_overspent', {
                          amount: fmtCompact(progressLine.overspentCents, currency),
                        })}
                      </span>
                    )}
                    {progressLine.outOfPlan && (
                      <span
                        className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                        style={{ background: 'var(--highlight-soft)', color: 'var(--on-surface-dim)' }}
                      >
                        {t('planner.out_of_plan')}
                      </span>
                    )}
                  </p>
                )}

              {/* M13: when locked, the dimmed stepper now says WHY (P-1) — and how to
                  undo it — instead of looking like a silently disabled control. */}
              {s.isLocked && (
                <p className="flex items-center gap-1 mt-2 text-[11px] text-on-surface-faint">
                  <Icon name="lock" size={12} className="shrink-0" />
                  {priority === 'essential'
                    ? t('planner.locked_reason_essential')
                    : t('planner.locked_reason')}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* ── ADD CUSTOM CATEGORY (ISSUE-06) ── */}
      <div className="mt-3">
        {showAddForm ? (
          <ProfileForm
            currency={currency}
            onSave={handleAddCategory}
            onCancel={() => setShowAddForm(false)}
          />
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full py-2.5 rounded-xl flex items-center justify-center gap-1.5 btn-press text-xs font-bold"
            style={{ background: 'var(--surface-container)', color: 'var(--on-surface-dim)' }}
          >
            <Icon name="add" size={14} className="text-on-surface-dim" />
            {t('planner.add_category')}
          </button>
        )}
      </div>

      {/* G2-AC4: discreet button to soft-delete the entire scenario plan. */}
      {planRef.current && (
        <button
          type="button"
          onClick={handleClearPlan}
          className="btn-press mt-3 mx-auto flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium"
          style={{ color: 'var(--on-surface-faint)' }}
        >
          <Icon name="delete_sweep" size={14} className="text-on-surface-faint" />
          {t('planner.clear_plan')}
        </button>
      )}

      {/* ── DEFICIT + RECOMMENDATION ── */}
      {/* DEC-112 (R5-07): the block renders for ANY deficit — the session
          headline is optional, the recommendation must survive re-entry. */}
      {hasDeficit && (
        <div
          className="mt-5 p-5 rounded-2xl"
          style={{ background: '#D4A84310', border: '1px solid #D4A84320' }}
        >
          {sessionAdditions.length > 0 && (
          <div className="flex items-start gap-3 mb-4">
            <span
              className="material-symbols-outlined mt-0.5"
              style={{ color: 'var(--warning)' }}
            >
              warning
            </span>
            <div className="flex-1">
              <p
                className="text-sm font-bold"
                style={{ color: 'var(--warning)' }}
              >
                {/* R5-06: itemized per category — never a single mislabeled total */}
                {t('planner.added_breakdown', {
                  items: formatAdditionsList(
                    sessionAdditions,
                    t('planner.and_conjunction'),
                  ),
                })}
              </p>

              <div className="mt-2 grid grid-cols-3 gap-2">
                <div
                  className="p-2 rounded-lg text-center"
                  style={{ background: 'var(--highlight-faint)' }}
                >
                  <p
                    className="text-[9px] font-bold"
                    style={{ color: 'var(--on-surface-faint)' }}
                  >
                    {t('planner.cost_label')}
                  </p>
                  <p
                    className="text-sm font-extrabold tabular"
                    style={{ color: 'var(--warning)' }}
                  >
                    {fmtCompact(extraCostCents, currency)}
                  </p>
                </div>
                <div
                  className="p-2 rounded-lg text-center"
                  style={{ background: 'var(--highlight-faint)' }}
                >
                  <p
                    className="text-[9px] font-bold"
                    style={{ color: 'var(--on-surface-faint)' }}
                  >
                    {t('planner.margin_label')}
                  </p>
                  <p className="text-sm font-extrabold tabular text-on-surface-dim">
                    {fmtCompact(marginForExtrasCents, currency)}
                  </p>
                </div>
                <div
                  className="p-2 rounded-lg text-center"
                  style={{ background: '#D9404008' }}
                >
                  <p
                    className="text-[9px] font-bold"
                    style={{ color: 'var(--on-surface-faint)' }}
                  >
                    {t('planner.missing_label')}
                  </p>
                  <p
                    className="text-sm font-extrabold tabular"
                    style={{ color: 'var(--error)' }}
                  >
                    {fmtCompact(deficitCents, currency)}
                  </p>
                </div>
              </div>
            </div>
          </div>
          )}

          {recommendation && (
            <div className="p-4 rounded-xl bg-surface-container">
              <p
                className="text-[10px] tracking-[0.12em] uppercase font-bold mb-2"
                style={{ color: 'var(--success)' }}
              >
                {t('planner.recommendation')}
              </p>
              <p className="text-sm font-bold mb-2 text-on-surface">
                {recommendation.title}
              </p>
              <p className="text-xs leading-relaxed font-medium text-on-surface-dim">
                {recommendation.description}
              </p>

              <div
                className="mt-3 gap-2"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(recommendation.changes.length, 3)}, 1fr)`,
                }}
              >
                {recommendation.changes.map((c) => (
                  <div
                    key={c.profileId}
                    className="p-2 rounded-lg"
                    style={{ background: 'var(--highlight-faint)' }}
                  >
                    <p
                      className="text-[9px] font-bold uppercase"
                      style={{ color: 'var(--on-surface-faint)' }}
                    >
                      {c.name}
                    </p>
                    <p className="text-xs font-bold">
                      <span style={{ color: 'var(--on-surface-faint)' }}>
                        {c.from} →
                      </span>{' '}
                      <span className="text-on-surface">{c.to}</span>
                    </p>
                  </div>
                ))}
              </div>

              <p
                className="text-xs font-bold mt-2"
                style={{ color: 'var(--success)' }}
              >
                {t('planner.remaining_margin', {
                  amount: fmtCompact(
                    recommendation.remainingMarginCents,
                    currency,
                  ),
                })}
              </p>

              <div className="flex gap-2 mt-4">
                <button
                  className="btn-press flex-1 py-3 rounded-xl font-bold text-xs"
                  style={{
                    background: 'var(--primary)',
                    color: 'var(--surface)',
                  }}
                  onClick={applyRecommendation}
                >
                  {t('planner.apply_recommendation')}
                </button>
                <button
                  onClick={() => setStates((prev) => {
                    const next = { ...prev };
                    for (const p of enabledProfiles) {
                      const s = next[p.id];
                      if (s) next[p.id] = { ...s, count: s.baselineCount };
                    }
                    return next;
                  })}
                  className="btn-press py-3 px-4 rounded-xl font-bold text-xs bg-surface-high text-on-surface-dim"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PRESET BUTTONS ── */}
      {/* Audit 4.9 (P2): explain that presets are starting points, not final. */}
      <p className="text-[11px] text-on-surface-faint mt-4 mb-1.5 px-1 leading-snug">
        {t('planner.presets_hint')}
      </p>
      <div className="flex gap-2">
        {(['economico', 'equilibrado', 'mais_social'] as const).map(
          (preset) => {
            const isActive = activePreset === preset;
            return (
              <button
                key={preset}
                className="btn-press flex-1 py-2.5 rounded-xl text-xs font-bold"
                style={
                  isActive
                    ? {
                        background: '#C75B3918',
                        color: 'var(--primary)',
                        border: '1px solid #C75B3925',
                      }
                    : {
                        background: 'var(--surface-container)',
                        color: 'var(--on-surface-dim)',
                      }
                }
                onClick={() => applyPreset(preset)}
              >
                {t(`planner.preset_${preset}`)}
              </button>
            );
          },
        )}
      </div>

      {/* DEC-172 + DEC-477: margin breakdown — available − still-reserved =
          margin (signed). The consumed part of the plan is informative: it
          already left "available", so it is NOT subtracted again. */}
      <BreakdownSheet
        open={marginBreakdownOpen}
        onClose={() => setMarginBreakdownOpen(false)}
        title={t('planner.margin_breakdown_title')}
        intro={t('planner.margin_breakdown_intro')}
        items={[
          { label: t('planner.bd_available'), cents: availableCents, kind: 'base' },
          { label: t('planner.bd_reserved'), cents: planReserveCents, kind: 'subtract' },
        ]}
        totalLabel={t('planner.free_margin')}
        totalCents={liveMarginCents}
        currency={currency}
        note={
          (fts?.futureFloorCents ?? 0) > 0
            ? t('planner.bd_floor_note', { amount: fmtFull(fts!.futureFloorCents, currency) })
            : undefined
        }
      />

      {/* ── CATEGORY MENU (DEC-099 / R-21 + DEC-100 / R-22) ── */}
      <BottomSheet
        open={menuProfile !== null}
        onClose={() => setMenuProfile(null)}
        title={menuProfile?.name ?? ''}
      >
        {menuProfile && (
          <div className="space-y-4 pb-2">
            {/* edit typical value */}
            <div>
              <p className="text-[10px] tracking-[0.12em] uppercase font-bold text-on-surface-faint mb-1.5">
                {t('planner.menu_typical_value')}
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={menuValueDraft}
                  onChange={(e) => setMenuValueDraft(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-surface-high text-sm font-bold tabular text-on-surface outline-none"
                />
                <button
                  className="btn-press px-4 rounded-xl text-xs font-bold"
                  style={{ background: 'var(--primary)', color: 'var(--surface)' }}
                  onClick={handleSaveTypicalValue}
                >
                  {t('common.save')}
                </button>
              </div>
            </div>

            {/* per-phase classification (DEC-100 / R-22) */}
            <div>
              <p className="text-[10px] tracking-[0.12em] uppercase font-bold text-on-surface-faint mb-1.5">
                {t('planner.menu_classification')}
              </p>
              <div className="flex gap-2">
                {(['essential', 'planned', 'optional'] as const).map((p) => {
                  const active = states[menuProfile.id]?.priority === p;
                  return (
                    <button
                      key={p}
                      className="btn-press flex-1 py-2.5 rounded-xl text-xs font-bold"
                      style={
                        active
                          ? {
                              background: '#C75B3918',
                              color: 'var(--primary)',
                              border: '1px solid #C75B3925',
                            }
                          : {
                              background: 'var(--surface-high)',
                              color: 'var(--on-surface-dim)',
                            }
                      }
                      onClick={() => handleSetPriority(p)}
                    >
                      {t(`planner.${p}`)}
                    </button>
                  );
                })}
              </div>
              {/* Audit 4.9 (P2): say what the classification actually controls. */}
              <p className="text-[11px] text-on-surface-faint mt-1.5 leading-snug">
                {t('planner.classification_hint')}
              </p>
            </div>

            {/* remove from this phase */}
            <button
              className="btn-press w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
              style={{ background: '#D9404012', color: 'var(--error)' }}
              onClick={handleRemoveFromPhase}
            >
              <Icon name="delete" size={14} className="text-error" />
              {t('planner.menu_remove_from_phase')}
            </button>
          </div>
        )}
      </BottomSheet>

      {/* M13: the priority tags + lock explained in one place (P-1). */}
      <BottomSheet open={legendOpen} onClose={() => setLegendOpen(false)} title={t('planner.legend_title')}>
        <div className="px-1 pb-2 flex flex-col gap-3">
          <div className="flex items-start gap-2.5">
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 mt-0.5" style={{ background: 'var(--highlight-soft)', color: 'var(--on-surface-dim)' }}>
              {t('planner.essential')}
            </span>
            <p className="text-xs text-on-surface-dim leading-relaxed">{t('planner.legend_essential')}</p>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 mt-0.5" style={{ background: 'var(--highlight-soft)', color: 'var(--on-surface-dim)' }}>
              {t('planner.optional')}
            </span>
            <p className="text-xs text-on-surface-dim leading-relaxed">{t('planner.legend_optional')}</p>
          </div>
          <div className="flex items-start gap-2.5">
            <Icon name="lock" size={16} className="text-on-surface-faint shrink-0 mt-0.5" />
            <p className="text-xs text-on-surface-dim leading-relaxed">{t('planner.legend_lock')}</p>
          </div>
        </div>
      </BottomSheet>

      {/* G5 (M5.4) + G6 (M6.3): "Assisted mode" — copilot CTA; when mid-trip
          with existing spend, the label reads "Replanejar com IA" and the flow
          passes current_spending + inherited spending_style (DEC-493). */}
      {plannerMode === 'assisted' && !copilotStarted && selectedPhase && phasePool && (() => {
        const hasMidTripSpend = (liveProgress?.lines ?? []).some((l) => l.done > 0);
        const label = hasMidTripSpend
          ? t('planner_copilot.replan_with_ai')
          : t('planner_copilot.generate_with_copilot');
        return (
          <div className="mt-4 p-4 rounded-2xl bg-surface-container text-center">
            <Icon name="auto_awesome" size={28} className="text-primary mx-auto mb-2" />
            <p className="text-sm font-bold text-on-surface mb-1">{label}</p>
            {hasMidTripSpend && (
              <p className="text-xs text-on-surface-dim mb-2">{t('planner_copilot.replan_desc')}</p>
            )}
            <button
              onClick={() => setCopilotStarted(true)}
              className="btn-press mt-2 px-5 py-3 rounded-xl text-sm font-bold"
              style={{ background: 'var(--primary)', color: 'var(--surface)' }}
            >
              <Icon name="auto_awesome" size={16} className="inline-block mr-1 align-text-bottom" />
              {label}
            </button>
          </div>
        );
      })()}

      {copilotStarted && selectedPhase && phasePool && trip && (
        <PlanCopilotFlow
          tripContext={{
            tripId: trip.id,
            phaseId: selectedPhase.id,
            poolId: phasePool.id,
            destination: trip.name,
            durationDays: (() => {
              const start = new Date(selectedPhase.startDate);
              const end = new Date(selectedPhase.endDate);
              return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
            })(),
            budgetCents: phasePool.totalAmountCents,
            reserveCents: 0,
            currency,
            profiles: enabledProfiles,
            currentSpending: liveProgress?.lines
              .filter((l) => l.done > 0)
              .map((l) => ({
                profile_id: l.profileId,
                category: enabledProfiles.find((p) => p.id === l.profileId)?.category ?? 'other',
                occasions_done: l.done,
                avg_cost_cents: l.done > 0 ? Math.round(l.spentCents / l.done) : 0,
                total_spent_cents: l.spentCents,
              })),
            spendingStyle: activePreset,
          }}
          hasSeenDisclosure={false}
          onPlanCreated={() => {
            setCopilotStarted(false);
            setPlannerMode('manual');
            if (searchParams.has('copilot')) {
              searchParams.delete('copilot');
              setSearchParams(searchParams, { replace: true });
            }
          }}
        />
      )}
    </div>
  );
}
