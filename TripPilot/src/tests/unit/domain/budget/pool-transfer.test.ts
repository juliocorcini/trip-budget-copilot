import { describe, it, expect } from 'vitest';
import { computePoolTransfer } from '@/domain/budget';

describe('computePoolTransfer (M10 — ÂNCORA 13/15)', () => {
  it('moves money from source to target', () => {
    const result = computePoolTransfer(100_000, 20_000, 12_000);
    expect(result.sourceTotalCents).toBe(88_000);
    expect(result.targetTotalCents).toBe(32_000);
  });

  it('preserves the trip total for any amount', () => {
    const total = 120_000;
    for (const amount of [0, 1, 500, 12_345, 100_000]) {
      const result = computePoolTransfer(100_000, 20_000, amount);
      expect(result.sourceTotalCents + result.targetTotalCents).toBe(total);
    }
  });

  it('is exact in integer cents (no float drift)', () => {
    const result = computePoolTransfer(33_333, 66_667, 11_111);
    expect(result.sourceTotalCents).toBe(22_222);
    expect(result.targetTotalCents).toBe(77_778);
    expect(result.sourceTotalCents + result.targetTotalCents).toBe(100_000);
  });
});
