import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import '@/i18n';
import { PlannerPage } from '@/features/planning/PlannerPage';
import {
  activityProfileRepository,
  scenarioPlanRepository,
  scenarioAllocationItemRepository,
  phaseProfileSettingRepository,
} from '@/data/repositories';
import type { Trip } from '@/domain/types/trip';
import type { Phase } from '@/domain/types/phase';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { ActivityProfile } from '@/domain/types/activity-profile';

/**
 * FB-25 (DEC-274) — the Planner must NEVER persist just by being opened. Before
 * the fix, hydration seeded `states` from the profiles' defaults and the
 * debounced auto-save fired on mount, so simply visiting `/planner` created a
 * ScenarioPlan + allocation items (Julio: "assim que entro já adiciona planos").
 * A "Dia a dia" (ongoing) space has no phases/dates at all, so the Planner shows
 * a capability empty state there instead of an editor. These tests pin both:
 *   1. ongoing → empty state, zero writes;
 *   2. dated trip opened (hydration runs) → zero writes;
 *   3. dated trip + a real +1 edit → the plan IS persisted (no over-correction).
 */

const appDataRef = vi.hoisted(() => ({ value: null as unknown }));

vi.mock('@/hooks/useAppData', () => ({
  useAppData: () => appDataRef.value,
}));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function meta(id: string) {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    revision: 1,
    sourceDeviceId: 'test',
  };
}

const ongoingTrip: Trip = {
  ...meta('t-ongoing'),
  name: 'Dia a dia',
  baseCurrency: 'EUR',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  status: 'active',
  kind: 'ongoing',
  notes: null,
};

const datedTrip: Trip = {
  ...meta('t-dated'),
  name: 'Lisboa',
  baseCurrency: 'EUR',
  startDate: '2026-06-01',
  endDate: '2026-06-30',
  status: 'active',
  kind: 'trip',
  notes: null,
};

// today (env: 2026-06-22) falls inside the phase → it resolves as the active one.
const phase: Phase = {
  ...meta('ph1'),
  tripId: 't-dated',
  name: 'Lisboa',
  startDate: '2026-06-01',
  endDate: '2026-06-30',
  order: 0,
  rhythmPreset: null,
  peakDays: null,
  notes: null,
};

const pool: BudgetPool = {
  ...meta('pool1'),
  tripId: 't-dated',
  name: 'Fundo',
  scope: 'global',
  totalAmountCents: 100_000,
  currency: 'EUR',
  notes: null,
  dateStart: null,
  dateEnd: null,
  goalCents: null,
};

const barProfile: ActivityProfile = {
  ...meta('pf-bar'),
  tripId: 't-dated',
  name: 'Bar',
  category: 'bar',
  iconName: null,
  color: null,
  typicalValueCents: 2_000,
  safeValueCents: 1_500,
  confidence: 'low',
  dataPointCount: 0,
  expectedFrequencyPerPhase: 3,
  isCustom: false,
  defaultTargetCents: null,
  defaultCeilingCents: null,
  defaultMaxCents: null,
  defaultAvgDrinkPriceCents: null,
  quickAddValuesCents: null,
  notes: null,
};

const emptyAppData = {
  pools: [pool],
  links: [],
  envelopes: [],
  transactions: [],
  occurrences: [],
  plannedPurchases: [],
  loading: false,
};

function renderPlanner() {
  return render(
    <MemoryRouter>
      <PlannerPage />
    </MemoryRouter>,
  );
}

// Spies are created via this factory so their precise mock types are inferred
// (a bare `ReturnType<typeof vi.spyOn>` annotation collapses to an unknown-arg
// signature and fails to type-check on assignment).
function installRepoSpies() {
  // reads resolve to "nothing persisted yet" so hydration runs against a clean
  // slate. DEC-462: the Planner reads through `getActiveForPhase` (pool-drift
  // tolerant) — the spy follows the read path.
  const planRead = vi
    .spyOn(scenarioPlanRepository, 'getActiveForPhase')
    .mockResolvedValue(undefined);
  vi.spyOn(phaseProfileSettingRepository, 'getByPhaseId').mockResolvedValue([]);
  vi.spyOn(scenarioAllocationItemRepository, 'getByPlanId').mockResolvedValue([]);
  // writes are spied so the test can assert they never fire on open.
  const planCreate = vi
    .spyOn(scenarioPlanRepository, 'create')
    .mockResolvedValue(undefined as never);
  const itemCreate = vi
    .spyOn(scenarioAllocationItemRepository, 'create')
    .mockResolvedValue(undefined as never);
  return { planRead, planCreate, itemCreate };
}

let spies: ReturnType<typeof installRepoSpies>;

beforeEach(() => {
  spies = installRepoSpies();
});

afterEach(() => {
  vi.restoreAllMocks();
  appDataRef.value = null;
});

describe('PlannerPage — no write on open (FB-25 / DEC-274)', () => {
  it('an ongoing space shows the capability empty state and never writes a plan', async () => {
    vi.spyOn(activityProfileRepository, 'getByTripId').mockResolvedValue([]);
    appDataRef.value = { ...emptyAppData, trip: ongoingTrip, phases: [] };

    renderPlanner();

    expect(
      await screen.findByText(/planejador é para viagens com datas/i),
    ).toBeInTheDocument();

    // give any stray debounced effect more than its window to (not) fire.
    await act(async () => {
      await sleep(700);
    });
    expect(spies.planCreate).not.toHaveBeenCalled();
    expect(spies.itemCreate).not.toHaveBeenCalled();
  });

  it('a dated trip that hydrates on open seeds the editor but writes nothing', async () => {
    vi.spyOn(activityProfileRepository, 'getByTripId').mockResolvedValue([barProfile]);
    appDataRef.value = { ...emptyAppData, trip: datedTrip, phases: [phase] };

    renderPlanner();

    // hydration must actually run (otherwise "no write" is vacuously true).
    await waitFor(() => expect(spies.planRead).toHaveBeenCalled());
    // the seeded card is rendered → the editor is live, not the empty state.
    expect(await screen.findByText('Bar')).toBeInTheDocument();

    await act(async () => {
      await sleep(700);
    });
    expect(spies.planCreate).not.toHaveBeenCalled();
    expect(spies.itemCreate).not.toHaveBeenCalled();
  });

  it('a real +1 edit DOES persist the plan (the fix must not disable saving)', async () => {
    vi.spyOn(activityProfileRepository, 'getByTripId').mockResolvedValue([barProfile]);
    appDataRef.value = { ...emptyAppData, trip: datedTrip, phases: [phase] };

    const { container } = renderPlanner();
    await waitFor(() => expect(spies.planRead).toHaveBeenCalled());
    await screen.findByText('Bar');

    // the "+" control is the compact (w-8) button whose icon glyph reads "add";
    // the add-category button is full-width (w-full), so this stays unambiguous.
    const incButton = await waitFor(() => {
      const btn = Array.from(container.querySelectorAll('button')).find(
        (b) =>
          b.querySelector('span')?.textContent === 'add' &&
          b.className.includes('w-8'),
      );
      if (!btn) throw new Error('increment button not found');
      return btn;
    });

    fireEvent.click(incButton);

    await waitFor(() => expect(spies.planCreate).toHaveBeenCalledTimes(1), {
      timeout: 2_000,
    });
    expect(spies.itemCreate).toHaveBeenCalled();
  });
});
