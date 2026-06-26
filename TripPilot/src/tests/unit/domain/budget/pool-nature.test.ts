import { describe, it, expect } from 'vitest';
import { poolNature, poolNatureLabelKey, type PoolNature } from '@/domain/budget';

describe('poolNature (DEC-228 — nature-aware pool vocabulary)', () => {
  it('a phase-linked pool is a Trecho', () => {
    expect(poolNature({ scope: 'linked_phases' })).toBe('trecho');
  });

  it('a global pool is a Pote', () => {
    expect(poolNature({ scope: 'global' })).toBe('pote');
  });

  it('an unknown/ambiguous scope falls back to the neutral generic nature (never throws)', () => {
    expect(poolNature({ scope: '' })).toBe('generic');
    expect(poolNature({ scope: 'something_else' })).toBe('generic');
  });

  it('never collapses both real natures into one — Trecho and Pote stay distinct', () => {
    const trecho = poolNature({ scope: 'linked_phases' });
    const pote = poolNature({ scope: 'global' });
    expect(trecho).not.toBe(pote);
  });

  it('maps each nature to its own i18n noun key (funds.nature_<nature>)', () => {
    const natures: PoolNature[] = ['trecho', 'pote', 'generic'];
    const keys = natures.map(poolNatureLabelKey);
    expect(keys).toEqual(['funds.nature_trecho', 'funds.nature_pote', 'funds.nature_generic']);
    // keys are unique — no two natures share a label
    expect(new Set(keys).size).toBe(keys.length);
  });
});
