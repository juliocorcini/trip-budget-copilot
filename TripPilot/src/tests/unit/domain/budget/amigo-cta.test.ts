import { describe, it, expect } from 'vitest';
import { resolveAmigoSlideCtas } from '@/domain/budget';

describe('resolveAmigoSlideCtas (C07/DEC-301 per-slide CTA)', () => {
  it('verdict (calm) → only see-impact', () => {
    expect(
      resolveAmigoSlideCtas({ slideKind: 'verdict', isAlertVerdict: false, hasInlineCta: false }),
    ).toEqual(['impact']);
  });

  it('verdict (alert) → rescue door + see-impact', () => {
    expect(
      resolveAmigoSlideCtas({ slideKind: 'verdict', isAlertVerdict: true, hasInlineCta: false }),
    ).toEqual(['rescue', 'impact']);
  });

  it('top_category → see-impact (the matching read)', () => {
    expect(
      resolveAmigoSlideCtas({ slideKind: 'top_category', isAlertVerdict: false, hasInlineCta: false }),
    ).toEqual(['impact']);
  });

  it('daily_left → simulate (spend against the daily room)', () => {
    expect(
      resolveAmigoSlideCtas({ slideKind: 'daily_left', isAlertVerdict: false, hasInlineCta: false }),
    ).toEqual(['simulate']);
  });

  it('phase_progress and receivable have no useful action → hide the row', () => {
    expect(
      resolveAmigoSlideCtas({ slideKind: 'phase_progress', isAlertVerdict: false, hasInlineCta: false }),
    ).toEqual([]);
    expect(
      resolveAmigoSlideCtas({ slideKind: 'receivable', isAlertVerdict: false, hasInlineCta: false }),
    ).toEqual([]);
  });

  it('a slide with its own in-body CTA (piggy/reveal) never duplicates the row', () => {
    expect(
      resolveAmigoSlideCtas({ slideKind: 'piggy_movement', isAlertVerdict: false, hasInlineCta: true }),
    ).toEqual([]);
    expect(
      resolveAmigoSlideCtas({ slideKind: 'reveal', isAlertVerdict: false, hasInlineCta: true }),
    ).toEqual([]);
  });

  it('inline CTA wins even over an alert verdict (no double rescue)', () => {
    expect(
      resolveAmigoSlideCtas({ slideKind: 'verdict', isAlertVerdict: true, hasInlineCta: true }),
    ).toEqual([]);
  });
});
