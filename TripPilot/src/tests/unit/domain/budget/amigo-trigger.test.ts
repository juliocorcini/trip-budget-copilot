import { describe, it, expect } from 'vitest';
import { selectAmigoTrigger, type AmigoTriggerCandidate } from '@/domain/budget';

/**
 * DEC-417 (G5) — the Amigo Sincero trigger selection. These lock the fix for the
 * complaint "the friend always talks about the same expense": the trigger is now
 * the most RELEVANT recent spend (biggest deviation vs the phase median), rotating
 * across the genuinely notable ones by day, deterministic and flicker-free.
 *
 * The paired G0 proof (`field-fixes-g0-proofs.test.ts` → proof C) documents the OLD
 * `sort(date)[0]` behavior these invert.
 */
const c = (id: string, date: string, costCents: number): AmigoTriggerCandidate => ({
  id,
  date,
  costCents,
});

describe('selectAmigoTrigger — relevance over recency (DEC-417)', () => {
  it('picks a large older expense over a trivial recent one (inverts G0 proof C)', () => {
    // Proof C fixture: €3 coffee is the most recent, €200 the notable spend.
    const bigOld = c('big', '2026-06-01', 20000);
    const tinyRecent = c('tiny', '2026-06-15', 300);
    // The old selection returned `tiny` (latest date). Relevance returns `big`.
    expect(selectAmigoTrigger([bigOld, tinyRecent])?.id).toBe('big');
  });

  it('keeps the notable ticket even when a cheaper expense is newer', () => {
    const ticket = c('ticket', '2026-06-02', 15000); // €150 concert
    const cheaperNewer = c('snack', '2026-06-10', 400); // €4 snack, more recent
    expect(selectAmigoTrigger([ticket, cheaperNewer])?.id).toBe('ticket');
  });

  it('returns null for an empty set', () => {
    expect(selectAmigoTrigger([])).toBeNull();
  });

  it('ignores spends outside the recency window (only the newest N compete)', () => {
    // A huge spend far in the past must not win once it falls out of the window.
    const ancientHuge = c('ancient', '2026-01-01', 90000); // €900 but old
    const recent = Array.from({ length: 8 }, (_, i) =>
      c(`r${i}`, `2026-06-${String(10 + i).padStart(2, '0')}`, 1000 + i * 100),
    );
    const picked = selectAmigoTrigger([ancientHuge, ...recent], { recencyWindow: 8 });
    // The window holds the 8 recent ones; the ancient huge spend is excluded.
    expect(picked?.id).not.toBe('ancient');
    // Within the window, the biggest (r7 = €17) is the most relevant.
    expect(picked?.id).toBe('r7');
  });
});

describe('selectAmigoTrigger — day rotation without flicker (DEC-417)', () => {
  // Four spends: two clearly notable (above the median), two below.
  const set = [
    c('a', '2026-06-10', 10000), // €100  notable
    c('b', '2026-06-11', 9000), //  €90  notable
    c('c', '2026-06-12', 1000), //  €10  below median
    c('d', '2026-06-13', 800), //   €8  below median
  ];

  it('is stable within a day (same seed → same pick, never flickers)', () => {
    const first = selectAmigoTrigger(set, { daySeed: 5 })?.id;
    const again = selectAmigoTrigger(set, { daySeed: 5 })?.id;
    expect(first).toBe(again);
  });

  it('never repeats the previous day (consecutive seeds differ)', () => {
    const day1 = selectAmigoTrigger(set, { daySeed: 1 })?.id;
    const day2 = selectAmigoTrigger(set, { daySeed: 2 })?.id;
    const day3 = selectAmigoTrigger(set, { daySeed: 3 })?.id;
    expect(day1).not.toBe(day2);
    expect(day2).not.toBe(day3);
  });

  it('only rotates across the NOTABLE (above-median) spends, never the trivial ones', () => {
    const picks = new Set(
      [0, 1, 2, 3, 4, 5].map((seed) => selectAmigoTrigger(set, { daySeed: seed })?.id),
    );
    // €100 and €90 are above the median; €10 and €8 never surface as the trigger.
    expect(picks.has('c')).toBe(false);
    expect(picks.has('d')).toBe(false);
    expect([...picks].every((id) => id === 'a' || id === 'b')).toBe(true);
  });

  it('daySeed 0 (or omitted) is deterministic — the single most relevant spend', () => {
    expect(selectAmigoTrigger(set, { daySeed: 0 })?.id).toBe('a');
    expect(selectAmigoTrigger(set)?.id).toBe('a');
  });
});

describe('selectAmigoTrigger — flat spending falls back gracefully (DEC-417)', () => {
  it('with all equal costs, picks one deterministically and never rotates', () => {
    const flat = [
      c('x', '2026-06-10', 5000),
      c('y', '2026-06-11', 5000),
      c('z', '2026-06-12', 5000),
    ];
    // Nothing is strictly above the median → no forced variety; the same stable
    // pick every day (the Critic's "repeat less rather than force" guard).
    const d1 = selectAmigoTrigger(flat, { daySeed: 1 })?.id;
    const d2 = selectAmigoTrigger(flat, { daySeed: 2 })?.id;
    expect(d1).toBe(d2);
    expect(['x', 'y', 'z']).toContain(d1);
  });

  it('a single expense is always the trigger regardless of the day', () => {
    const one = [c('solo', '2026-06-10', 4200)];
    expect(selectAmigoTrigger(one, { daySeed: 7 })?.id).toBe('solo');
    expect(selectAmigoTrigger(one)?.id).toBe('solo');
  });
});
