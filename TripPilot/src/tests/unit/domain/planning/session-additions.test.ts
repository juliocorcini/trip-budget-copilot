import { describe, it, expect } from 'vitest';
import { listSessionAdditions, formatAdditionsList } from '@/domain/planning';

describe('listSessionAdditions (R5-06)', () => {
  const profiles = [
    { id: 'cafe', name: 'Café & Padaria' },
    { id: 'transport', name: 'Transporte' },
    { id: 'market', name: 'Mercado' },
    { id: 'bar', name: 'Bar' },
  ];

  it('reports the exact field scenario: 2 café + 16 transporte + 5 mercado', () => {
    const states = {
      cafe: { count: 12, baselineCount: 10 },
      transport: { count: 16, baselineCount: 0 },
      market: { count: 8, baselineCount: 3 },
      bar: { count: 4, baselineCount: 4 },
    };

    const additions = listSessionAdditions(profiles, states);

    expect(additions).toEqual([
      { profileId: 'transport', name: 'Transporte', added: 16 },
      { profileId: 'market', name: 'Mercado', added: 5 },
      { profileId: 'cafe', name: 'Café & Padaria', added: 2 },
    ]);
    // The old bug: total 23 attributed to a single category.
    const total = additions.reduce((sum, a) => sum + a.added, 0);
    expect(total).toBe(23);
  });

  it('ignores reductions and missing states', () => {
    const states = {
      cafe: { count: 5, baselineCount: 10 },
      transport: { count: 3, baselineCount: 1 },
    };

    const additions = listSessionAdditions(profiles, states);

    expect(additions).toEqual([
      { profileId: 'transport', name: 'Transporte', added: 2 },
    ]);
  });

  it('returns empty when nothing was added', () => {
    expect(listSessionAdditions(profiles, {})).toEqual([]);
  });
});

describe('formatAdditionsList (R5-06)', () => {
  it('joins with commas and a final conjunction', () => {
    const items = [
      { profileId: 'transport', name: 'Transporte', added: 16 },
      { profileId: 'market', name: 'Mercado', added: 5 },
      { profileId: 'cafe', name: 'Café & Padaria', added: 2 },
    ];

    expect(formatAdditionsList(items, 'e')).toBe(
      '16 transporte, 5 mercado e 2 café & padaria',
    );
  });

  it('single entry has no separator', () => {
    expect(
      formatAdditionsList([{ profileId: 'bar', name: 'Bar', added: 3 }], 'e'),
    ).toBe('3 bar');
  });

  it('empty list yields empty string', () => {
    expect(formatAdditionsList([], 'e')).toBe('');
  });
});
