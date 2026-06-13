import { describe, it, expect } from 'vitest';
import { nextInsightIndex, shouldAutoRotateInsights } from '@/features/dashboard/dashboard-format';

describe('nextInsightIndex (M2 — auto-rotation)', () => {
  it('advances by one', () => {
    expect(nextInsightIndex(0, 3)).toBe(1);
    expect(nextInsightIndex(1, 3)).toBe(2);
  });

  it('wraps around to the start at the end', () => {
    expect(nextInsightIndex(2, 3)).toBe(0);
  });

  it('stays at 0 with no insights (never divides by zero)', () => {
    expect(nextInsightIndex(0, 0)).toBe(0);
    expect(nextInsightIndex(5, 0)).toBe(0);
  });

  it('single insight always resolves to itself', () => {
    expect(nextInsightIndex(0, 1)).toBe(0);
  });
});

describe('shouldAutoRotateInsights (M2 — accessibility + significance)', () => {
  it('rotates with 2+ insights and motion allowed', () => {
    expect(shouldAutoRotateInsights(2, false)).toBe(true);
    expect(shouldAutoRotateInsights(6, false)).toBe(true);
  });

  it('does not rotate with 0 or 1 insight', () => {
    expect(shouldAutoRotateInsights(0, false)).toBe(false);
    expect(shouldAutoRotateInsights(1, false)).toBe(false);
  });

  it('respects reduced-motion: never rotates when reduced', () => {
    expect(shouldAutoRotateInsights(6, true)).toBe(false);
    expect(shouldAutoRotateInsights(2, true)).toBe(false);
  });
});
