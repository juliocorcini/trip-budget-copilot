import { describe, it, expect } from 'vitest';
import { extraToInsight } from '@/domain/insights';
import { filterHomeAmigoExtras } from '@/domain/budget';
import type { HonestFriendExtra } from '@/domain/budget';

/**
 * D06 · DEC-317 — the Amigo Sincero is voice-only; its factual extras become
 * neutral insight cards. `extraToInsight` is the pure adapter (same numbers,
 * ÂNCORA 11). De-dup against the analytical insights is done by reusing the
 * existing `filterHomeAmigoExtras` BEFORE mapping (no duplication).
 */
describe('extraToInsight — factual Amigo extra → neutral insight', () => {
  it('maps a cofrinho DEPOSIT (positive) keeping delta + balance + a deposit flag', () => {
    const extra: HonestFriendExtra = {
      id: 'piggy_movement',
      tone: 'positive',
      deltaCents: 1500,
      balanceCents: 8000,
    };
    expect(extraToInsight(extra)).toMatchObject({
      kind: 'piggy_movement',
      tone: 'positive',
      values: { deltaCents: 1500, balanceCents: 8000, deposit: 1 },
    });
  });

  it('maps a cofrinho WITHDRAWAL (steady → neutral) flagging deposit:0', () => {
    const extra: HonestFriendExtra = {
      id: 'piggy_movement',
      tone: 'steady',
      deltaCents: -2000,
      balanceCents: 3000,
    };
    expect(extraToInsight(extra)).toMatchObject({
      kind: 'piggy_movement',
      tone: 'neutral',
      values: { deltaCents: -2000, balanceCents: 3000, deposit: 0 },
    });
  });

  it('maps phase progress (caution → warning) with the percent', () => {
    const extra: HonestFriendExtra = { id: 'phase_progress', tone: 'caution', percent: 95 };
    expect(extraToInsight(extra)).toMatchObject({
      kind: 'phase_progress',
      tone: 'warning',
      values: { percent: 95 },
    });
  });

  it('maps daily-left (neutral) with days + per-day cents', () => {
    const extra: HonestFriendExtra = {
      id: 'daily_left',
      tone: 'neutral',
      days: 3,
      perDayCents: 3333,
    };
    expect(extraToInsight(extra)).toMatchObject({
      kind: 'daily_left',
      tone: 'neutral',
      values: { days: 3, perDayCents: 3333 },
    });
  });

  it('maps the top category with key, amount and percent', () => {
    const extra: HonestFriendExtra = {
      id: 'top_category',
      tone: 'neutral',
      categoryKey: 'food',
      amountCents: 5000,
      percent: 25,
    };
    expect(extraToInsight(extra)).toMatchObject({
      kind: 'top_category',
      tone: 'neutral',
      values: { categoryKey: 'food', amountCents: 5000, percent: 25 },
    });
  });

  it('maps a receivable (positive) with the amount', () => {
    const extra: HonestFriendExtra = { id: 'receivable', tone: 'positive', amountCents: 4200 };
    expect(extraToInsight(extra)).toMatchObject({
      kind: 'receivable',
      tone: 'positive',
      values: { amountCents: 4200 },
    });
  });
});

describe('relocation pipeline — de-dup BEFORE mapping (no duplication)', () => {
  const topCategory: HonestFriendExtra = {
    id: 'top_category',
    tone: 'neutral',
    categoryKey: 'food',
    amountCents: 5000,
    percent: 25,
  };
  const piggy: HonestFriendExtra = {
    id: 'piggy_movement',
    tone: 'positive',
    deltaCents: 1500,
    balanceCents: 8000,
  };

  it('drops a factual extra whose topic an analytical insight already shows', () => {
    // category_rhythm already covers the top-category topic → no relocated card.
    const relocated = filterHomeAmigoExtras([topCategory], ['category_rhythm']).map(extraToInsight);
    expect(relocated).toEqual([]);
  });

  it('relocates a factual extra when no insight covers its topic', () => {
    const relocated = filterHomeAmigoExtras([topCategory], []).map(extraToInsight);
    expect(relocated).toHaveLength(1);
    expect(relocated[0]).toMatchObject({ kind: 'top_category' });
  });

  it('always relocates the cofrinho movement (no analytical insight covers it)', () => {
    const relocated = filterHomeAmigoExtras(
      [piggy],
      ['phase_projection', 'category_rhythm', 'participant_balance', 'end_of_day'],
    ).map(extraToInsight);
    expect(relocated).toHaveLength(1);
    expect(relocated[0]).toMatchObject({ kind: 'piggy_movement' });
  });
});
