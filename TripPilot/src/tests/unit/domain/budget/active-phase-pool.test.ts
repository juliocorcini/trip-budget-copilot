import { describe, it, expect } from 'vitest';
import { selectActivePhasePool } from '@/domain/budget';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';

const baseMeta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test-device',
};

const mkPool = (id: string, scope: BudgetPool['scope'] = 'linked_phases'): BudgetPool => ({
  ...baseMeta,
  id,
  tripId: 'trip-1',
  name: id,
  scope,
  totalAmountCents: 100000,
  currency: 'EUR',
  notes: null,
});

const mkLink = (budgetPoolId: string, phaseId: string): BudgetPoolPhaseLink => ({
  ...baseMeta,
  id: `link-${budgetPoolId}-${phaseId}`,
  budgetPoolId,
  phaseId,
  futureFloorCents: null,
});

describe('selectActivePhasePool (GATE 1 — dashboard follows the active phase)', () => {
  it('legacy trip (ONE linked pool / N phases) returns that pool for any phase (AC1)', () => {
    const pools = [mkPool('pool-1'), mkPool('pots', 'global')];
    const links = [mkLink('pool-1', 'phase-1'), mkLink('pool-1', 'phase-2')];
    expect(selectActivePhasePool(pools, links, 'phase-1')?.id).toBe('pool-1');
    expect(selectActivePhasePool(pools, links, 'phase-2')?.id).toBe('pool-1');
    // No active phase resolved → still the single pool (byte-identical to before).
    expect(selectActivePhasePool(pools, links, null)?.id).toBe('pool-1');
  });

  it('new model (one dedicated pool per phase) returns the active phase pool (AC2)', () => {
    const pools = [mkPool('pool-a'), mkPool('pool-b'), mkPool('pool-c')];
    const links = [
      mkLink('pool-a', 'phase-a'),
      mkLink('pool-b', 'phase-b'),
      mkLink('pool-c', 'phase-c'),
    ];
    expect(selectActivePhasePool(pools, links, 'phase-a')?.id).toBe('pool-a');
    expect(selectActivePhasePool(pools, links, 'phase-b')?.id).toBe('pool-b');
    expect(selectActivePhasePool(pools, links, 'phase-c')?.id).toBe('pool-c');
  });

  it('falls back to the first linked pool when there is no active phase (N pools)', () => {
    const pools = [mkPool('pool-a'), mkPool('pool-b')];
    const links = [mkLink('pool-a', 'phase-a'), mkLink('pool-b', 'phase-b')];
    expect(selectActivePhasePool(pools, links, null)?.id).toBe('pool-a');
  });

  it('falls back to the first linked pool when the active phase has no dedicated pool', () => {
    const pools = [mkPool('pool-a'), mkPool('pool-b')];
    const links = [mkLink('pool-a', 'phase-a'), mkLink('pool-b', 'phase-b')];
    expect(selectActivePhasePool(pools, links, 'phase-orphan')?.id).toBe('pool-a');
  });

  it('ignores global pools — only operational (linked_phases) pools fund a phase', () => {
    const pools = [mkPool('pots', 'global'), mkPool('pool-a')];
    const links = [mkLink('pool-a', 'phase-a')];
    expect(selectActivePhasePool(pools, links, 'phase-a')?.id).toBe('pool-a');
  });

  it('ignores soft-deleted pools', () => {
    const deleted = { ...mkPool('pool-old'), deletedAt: '2026-02-01T00:00:00.000Z' };
    const pools = [deleted, mkPool('pool-a'), mkPool('pool-b')];
    const links = [
      mkLink('pool-old', 'phase-a'),
      mkLink('pool-a', 'phase-a'),
      mkLink('pool-b', 'phase-b'),
    ];
    expect(selectActivePhasePool(pools, links, 'phase-a')?.id).toBe('pool-a');
  });

  it('ignores soft-deleted links when matching the active phase', () => {
    const pools = [mkPool('pool-a'), mkPool('pool-b')];
    const staleLink = { ...mkLink('pool-b', 'phase-a'), deletedAt: '2026-02-01T00:00:00.000Z' };
    const links = [mkLink('pool-a', 'phase-a'), mkLink('pool-b', 'phase-b'), staleLink];
    expect(selectActivePhasePool(pools, links, 'phase-a')?.id).toBe('pool-a');
  });

  it('returns null when there are no operational pools', () => {
    expect(selectActivePhasePool([mkPool('pots', 'global')], [], 'phase-a')).toBeNull();
    expect(selectActivePhasePool([], [], null)).toBeNull();
  });
});
