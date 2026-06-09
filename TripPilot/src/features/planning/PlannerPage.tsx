import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppData } from '@/hooks/useAppData';
import { resolveActivePhase, sortPhasesByOrder } from '@/domain/dates';
import { calculateFreeToSpend } from '@/domain/budget';
import { filterTransactionsByPool } from '@/domain/transactions';
import { fromCents, sumCents } from '@/domain/money';
import {
  createScenarioPlan,
  createAllocationItem,
  calculateOverAllocationCents,
} from '@/domain/planning';
import { createCustomActivityProfile } from '@/domain/profiles';
import {
  activityProfileRepository,
  scenarioPlanRepository,
  scenarioAllocationItemRepository,
} from '@/data/repositories';
import { getCategoryIcon } from '@/utils/category-icons';
import { Icon } from '@/components/Icon';
import { ProfileForm, type ProfileFormData } from '@/components/ProfileForm';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { ScenarioPlan, ScenarioAllocationItem } from '@/domain/types/scenario';
import type { AllocationPriority, ScenarioPreset } from '@/domain/types/common';

/* ── types ── */

interface ProfileState {
  count: number;
  isLocked: boolean;
  baselineCount: number;
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

function getPresetMultiplier(category: string, preset: string): number {
  const priority = getPriority(category);
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
  const { trip, phases, pools, links, envelopes, transactions, loading } =
    useAppData();

  const [profiles, setProfiles] = useState<ActivityProfile[]>([]);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [states, setStates] = useState<Record<string, ProfileState>>({});
  const [activePreset, setActivePreset] = useState<ScenarioPreset>('equilibrado');
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [ready, setReady] = useState(false);

  const profilesRef = useRef<ActivityProfile[]>([]);
  const statesRef = useRef<Record<string, ProfileState>>({});
  const presetRef = useRef<ScenarioPreset>('equilibrado');
  const planRef = useRef<ScenarioPlan | null>(null);
  const itemsRef = useRef<Map<string, ScenarioAllocationItem>>(new Map());
  const hydratedRef = useRef(false);

  profilesRef.current = profiles;
  statesRef.current = states;
  presetRef.current = activePreset;

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

  /* ── scenario hydration (ISSUE-04: load persisted state) ── */

  useEffect(() => {
    if (!trip || !selectedPhase || !phasePool || !profilesLoaded) return;
    let cancelled = false;
    hydratedRef.current = false;
    setReady(false);

    (async () => {
      const plan = await scenarioPlanRepository.getActiveByPhaseAndPool(
        trip.id,
        selectedPhase.id,
        phasePool.id,
      );
      const items = plan
        ? await scenarioAllocationItemRepository.getByPlanId(plan.id)
        : [];
      if (cancelled) return;

      planRef.current = plan ?? null;
      itemsRef.current = new Map(items.map((i) => [i.activityProfileId, i]));

      const init: Record<string, ProfileState> = {};
      for (const p of profilesRef.current) {
        const item = itemsRef.current.get(p.id);
        const base = item?.quantity ?? p.expectedFrequencyPerPhase ?? 3;
        init[p.id] = {
          count: base,
          isLocked: item?.isLocked ?? getPriority(p.category) === 'essential',
          baselineCount: base,
        };
      }
      if (plan) setActivePreset(plan.preset);
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
      plan = createScenarioPlan({
        tripId: trip.id,
        phaseId: selectedPhase.id,
        budgetPoolId: phasePool.id,
        name: selectedPhase.name,
        preset: presetRef.current,
      });
      await scenarioPlanRepository.create(plan);
      planRef.current = plan;
    } else if (plan.preset !== presetRef.current) {
      plan = await scenarioPlanRepository.update({
        ...plan,
        preset: presetRef.current,
      });
      planRef.current = plan;
    }

    for (const profile of profilesRef.current) {
      const s = statesRef.current[profile.id];
      if (!s) continue;
      const existing = itemsRef.current.get(profile.id);
      if (existing) {
        if (existing.quantity !== s.count || existing.isLocked !== s.isLocked) {
          const updated = await scenarioAllocationItemRepository.update({
            ...existing,
            quantity: s.count,
            isLocked: s.isLocked,
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
          priority: getPriority(profile.category),
        });
        await scenarioAllocationItemRepository.create(item);
        itemsRef.current.set(profile.id, item);
      }
    }
  }, [trip, selectedPhase, phasePool]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const timer = setTimeout(() => {
      persist();
    }, PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [states, activePreset, persist]);

  /* ── budget math ── */

  const poolTxs = useMemo(
    () =>
      phasePool ? filterTransactionsByPool(transactions, phasePool.id) : [],
    [phasePool, transactions],
  );

  const fts = useMemo(
    () =>
      phasePool && selectedPhase
        ? calculateFreeToSpend(
            phasePool,
            envelopes.filter((e) => e.budgetPoolId === phasePool.id),
            poolTxs,
            links,
            selectedPhase.id,
          )
        : null,
    [phasePool, selectedPhase, envelopes, poolTxs, links],
  );

  const availableCents = fts?.freeToSpendCents ?? 0;

  const baselineAllocatedCents = useMemo(
    () =>
      sumCents(
        profiles.map(
          (p) => (states[p.id]?.baselineCount ?? 0) * p.typicalValueCents,
        ),
      ),
    [profiles, states],
  );

  const currentAllocatedCents = useMemo(
    () =>
      sumCents(
        profiles.map(
          (p) => (states[p.id]?.count ?? 0) * p.typicalValueCents,
        ),
      ),
    [profiles, states],
  );

  const freeMarginCents = availableCents - baselineAllocatedCents;
  const extraCostCents = currentAllocatedCents - baselineAllocatedCents;
  const deficitCents = Math.max(0, extraCostCents - Math.max(0, freeMarginCents));
  const hasDeficit = deficitCents > 0;
  const marginForExtrasCents = Math.max(
    0,
    Math.min(freeMarginCents, extraCostCents),
  );

  /* ── over-allocation warning (ISSUE-05) ── */

  const overAllocationCents = calculateOverAllocationCents(
    currentAllocatedCents,
    availableCents,
  );

  const modifiedProfiles = useMemo(
    () =>
      profiles.filter((p) => {
        const s = states[p.id];
        return s && s.count !== s.baselineCount;
      }),
    [profiles, states],
  );

  /* ── recommendation ── */

  const recommendation = useMemo((): Recommendation | null => {
    if (!hasDeficit) return null;

    const modifiedIds = new Set(modifiedProfiles.map((p) => p.id));
    const reducible = profiles
      .filter((p) => {
        const s = states[p.id];
        if (!s || s.isLocked || s.count === 0) return false;
        if (modifiedIds.has(p.id)) return false;
        return getPriority(p.category) !== 'essential';
      })
      .sort((a, b) => b.typicalValueCents - a.typicalValueCents);

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
  }, [hasDeficit, deficitCents, profiles, states, modifiedProfiles, t]);

  /* ── handlers ── */

  const updateCount = useCallback((id: string, delta: number) => {
    setStates((prev) => {
      const s = prev[id];
      if (!s) return prev;
      return { ...prev, [id]: { ...s, count: Math.max(0, s.count + delta) } };
    });
  }, []);

  const toggleLock = useCallback((id: string) => {
    setStates((prev) => {
      const s = prev[id];
      if (!s) return prev;
      return { ...prev, [id]: { ...s, isLocked: !s.isLocked } };
    });
  }, []);

  const applyPreset = useCallback(
    (preset: ScenarioPreset) => {
      setActivePreset(preset);
      setStates((prev) => {
        const next = { ...prev };
        for (const p of profiles) {
          const s = next[p.id];
          if (!s || s.isLocked) continue;
          const base = p.expectedFrequencyPerPhase ?? 3;
          const count = Math.max(1, Math.round(base * getPresetMultiplier(p.category, preset)));
          next[p.id] = { ...s, count, baselineCount: count };
        }
        return next;
      });
    },
    [profiles],
  );

  const applyRecommendation = useCallback(() => {
    if (!recommendation) return;
    setStates((prev) => {
      const next = { ...prev };
      for (const c of recommendation.changes) {
        const s = next[c.profileId];
        if (s) next[c.profileId] = { ...s, count: c.to, baselineCount: c.to };
      }
      return next;
    });
  }, [recommendation]);

  /* ── custom category creation (ISSUE-06) ── */

  const handleAddCategory = useCallback(
    async (data: ProfileFormData) => {
      if (!trip) return;
      const profile = createCustomActivityProfile({
        tripId: trip.id,
        name: data.name,
        iconName: data.iconName,
        typicalValueCents: data.typicalValueCents,
      });
      await activityProfileRepository.create(profile);
      setProfiles((prev) => [...prev, profile]);
      setStates((prev) => ({
        ...prev,
        [profile.id]: { count: 1, isLocked: false, baselineCount: 1 },
      }));
      setShowAddForm(false);
    },
    [trip],
  );

  /* ── loading ── */

  if (loading || !trip || !ready) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-on-surface-dim">{t('common.loading')}</p>
      </div>
    );
  }

  const phaseName = selectedPhase?.name ?? phases[0]?.name ?? '';
  const displayMargin = splitMoney(Math.max(0, freeMarginCents), currency);

  return (
    <div className="flex flex-col pb-4">
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
        <span
          className="px-2.5 py-1 rounded-lg text-[10px] font-bold"
          style={{ background: '#6B8F7118', color: 'var(--success)' }}
        >
          {t('planner.mode_manual')}
        </span>
      </div>

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

      {/* ── BUDGET SUMMARY ── */}
      <div className="mt-4 p-4 rounded-2xl bg-surface-container">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs font-bold text-on-surface-dim">
              {t('planner.free_margin')}
            </p>
            <p className="text-2xl font-extrabold tabular text-on-surface">
              {displayMargin.integer}
              <span className="text-sm text-on-surface-dim">
                {displayMargin.decimal}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-on-surface-dim">
              {t('planner.allocated')}
            </p>
            <p className="text-lg font-bold tabular text-on-surface-dim">
              {fmtFull(currentAllocatedCents, currency)}
            </p>
          </div>
        </div>
        {/* Future floor as informative constraint (DEC-016 / GAP-008) */}
        {(fts?.futureFloorCents ?? 0) > 0 && (
          <p className="text-[11px] font-semibold text-on-surface-faint mt-2 flex items-center gap-1">
            <Icon name="lock" size={12} className="text-on-surface-faint" />
            {t('planner.future_floor_constraint', {
              amount: fmtFull(fts!.futureFloorCents, currency),
            })}
          </p>
        )}
      </div>

      {/* ── PROFILE CARDS ── */}
      <div className="mt-4 space-y-3">
        {profiles.map((profile) => {
          const s = states[profile.id];
          if (!s) return null;

          const priority = getPriority(profile.category);
          const isModified = s.count !== s.baselineCount;
          const cVar = colorVar(profile.color);
          const cHex = profile.color ?? '#EDE8E0';
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
              {/* header row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: `${cHex}18` }}
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
                </div>

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
                          ? `${cHex}20`
                          : '#EDE8E015',
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
                  <button
                    className="btn-press"
                    onClick={() => toggleLock(profile.id)}
                  >
                    <span
                      className="material-symbols-outlined text-sm"
                      style={{ color: 'var(--on-surface-faint)' }}
                    >
                      {s.isLocked ? 'lock' : 'lock_open'}
                    </span>
                  </button>
                </div>
              </div>

              {/* controls row */}
              <div className="flex items-center justify-between">
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

      {/* ── OVER-ALLOCATION WARNING (ISSUE-05) ── */}
      {overAllocationCents > 0 && (
        <div
          className="mt-4 p-4 rounded-2xl flex items-start gap-3"
          style={{ background: '#D4A84312', border: '1px solid #D4A84325' }}
        >
          <Icon name="warning" size={20} className="text-warning mt-0.5" />
          <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--warning)' }}>
            {t('planner.over_allocation_warning', {
              amount: fmtFull(overAllocationCents, currency),
            })}
          </p>
        </div>
      )}

      {/* ── DEFICIT + RECOMMENDATION ── */}
      {hasDeficit && modifiedProfiles.length > 0 && (
        <div
          className="mt-5 p-5 rounded-2xl"
          style={{ background: '#D4A84310', border: '1px solid #D4A84320' }}
        >
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
                {t('planner.added_count', {
                  count: modifiedProfiles.reduce((sum, p) => {
                    const ms = states[p.id];
                    return (
                      sum +
                      Math.max(0, (ms?.count ?? 0) - (ms?.baselineCount ?? 0))
                    );
                  }, 0),
                  name: modifiedProfiles[0]?.name.toLowerCase() ?? '',
                })}
              </p>

              <div className="mt-2 grid grid-cols-3 gap-2">
                <div
                  className="p-2 rounded-lg text-center"
                  style={{ background: '#EDE8E006' }}
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
                  style={{ background: '#EDE8E006' }}
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
                    style={{ background: '#EDE8E006' }}
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
                    for (const p of profiles) {
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
      <div className="mt-4 flex gap-2">
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
    </div>
  );
}
