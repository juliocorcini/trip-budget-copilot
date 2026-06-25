import { describe, it, expect } from 'vitest';
import { resolveSavingDestination } from '@/domain/budget';

/**
 * D11/D14 · DEC-313/314 — one destination for the day's saving, never two.
 *
 * The selector is what the check-in uses to show a SINGLE "Destino da economia
 * de hoje": the cofrinho when a phase has dates, the next days otherwise, and
 * nothing when there is nothing saved. Verified with concrete amounts so a
 * future regression (e.g. showing both at once) is caught.
 */
describe('resolveSavingDestination — single saving destination (DEC-313/314)', () => {
  it('routes to the cofrinho when one is active and money was saved', () => {
    expect(resolveSavingDestination({ savedCents: 1500, piggyActive: true })).toBe('piggy');
  });

  it('routes to the next days when there is no cofrinho (ongoing / no-date phase)', () => {
    expect(resolveSavingDestination({ savedCents: 1500, piggyActive: false })).toBe('next_days');
  });

  it('shows no destination when nothing was saved, even with an active cofrinho', () => {
    expect(resolveSavingDestination({ savedCents: 0, piggyActive: true })).toBe('none');
    expect(resolveSavingDestination({ savedCents: -200, piggyActive: true })).toBe('none');
  });

  it('never returns two destinations — the result is exactly one of the three states', () => {
    const cases = [
      { savedCents: 1, piggyActive: true },
      { savedCents: 1, piggyActive: false },
      { savedCents: 0, piggyActive: false },
    ];
    for (const input of cases) {
      const result = resolveSavingDestination(input);
      expect(['piggy', 'next_days', 'none']).toContain(result);
    }
  });
});
