import { describe, it, expect } from 'vitest';
import {
  usagePct,
  fnUserCapacity,
  projectActiveUserCapacity,
  type GroqLimit,
} from '@/domain/admin/ai-governance';

const LIMITS: Record<string, GroqLimit> = {
  assistant: { rpd: 1000, tpm: 6000, label: 'Llama' },
  ocr: { rpd: 1000, tpm: 6000, label: 'Llama' },
  transcribe: { rpd: 2000, tpm: 0, label: 'Whisper' },
};

describe('usagePct (FB-18)', () => {
  it('computes a straight percentage', () => {
    expect(usagePct(250, 1000)).toBe(25);
    expect(usagePct(6000, 6000)).toBe(100);
  });

  it('clamps above 100 and never goes negative', () => {
    expect(usagePct(1500, 1000)).toBe(100);
    expect(usagePct(-5, 1000)).toBe(0);
  });

  it('returns 0 for an unknown/zero limit instead of Infinity', () => {
    expect(usagePct(10, 0)).toBe(0);
    expect(usagePct(10, -1)).toBe(0);
    expect(usagePct(Number.NaN, 1000)).toBe(0);
  });
});

describe('fnUserCapacity (FB-18)', () => {
  it('divides the daily request cap by average requests/user', () => {
    // 200 runs over 10 active users = 20 req/user → 1000 / 20 = 50 users fit.
    expect(fnUserCapacity(1000, 200, 10)).toBe(50);
  });

  it('floors a fractional capacity (honest worst-case)', () => {
    // 30 runs / 10 users = 3 req/user → 1000 / 3 = 333.33 → 333.
    expect(fnUserCapacity(1000, 30, 10)).toBe(333);
  });

  it('returns null when there is no measurable signal', () => {
    expect(fnUserCapacity(1000, 0, 10)).toBeNull(); // no runs
    expect(fnUserCapacity(1000, 200, 0)).toBeNull(); // no active users
    expect(fnUserCapacity(0, 200, 10)).toBeNull(); // no daily cap (e.g. tpm-only)
  });
});

describe('projectActiveUserCapacity (FB-18)', () => {
  it('picks the smallest (binding) per-function capacity', () => {
    // assistant: 200/10=20 → 50 ; ocr: 50/10=5 → 200 ; transcribe: 100/10=10 → 200.
    const result = projectActiveUserCapacity(
      [
        { fn: 'assistant', tokens: 9999, runs: 200 },
        { fn: 'ocr', tokens: 9999, runs: 50 },
        { fn: 'transcribe', tokens: 9999, runs: 100 },
      ],
      LIMITS,
      10,
    );
    expect(result).toEqual({ fn: 'assistant', capacity: 50 });
  });

  it('ignores functions with no limit mapping or no signal', () => {
    const result = projectActiveUserCapacity(
      [
        { fn: 'mystery', tokens: 100, runs: 100 }, // no limit → skipped
        { fn: 'ocr', tokens: 100, runs: 20 }, // 20/10=2 → 500
      ],
      LIMITS,
      10,
    );
    expect(result).toEqual({ fn: 'ocr', capacity: 500 });
  });

  it('returns null when nothing is measurable yet', () => {
    expect(projectActiveUserCapacity([], LIMITS, 10)).toBeNull();
    expect(projectActiveUserCapacity([{ fn: 'assistant', tokens: 0, runs: 0 }], LIMITS, 0)).toBeNull();
  });
});
