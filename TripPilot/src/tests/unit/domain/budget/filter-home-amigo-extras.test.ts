import { describe, it, expect } from 'vitest';
import { filterHomeAmigoExtras, type HonestFriendExtra } from '@/domain/budget';

const topCategory: HonestFriendExtra = {
  id: 'top_category',
  tone: 'neutral',
  categoryKey: 'food',
  amountCents: 5000,
  percent: 40,
};
const phaseProgress: HonestFriendExtra = { id: 'phase_progress', tone: 'neutral', percent: 50 };
const dailyLeft: HonestFriendExtra = { id: 'daily_left', tone: 'neutral', days: 3, perDayCents: 2000 };
const receivable: HonestFriendExtra = { id: 'receivable', tone: 'positive', amountCents: 3000 };
const piggy: HonestFriendExtra = {
  id: 'piggy_movement',
  tone: 'positive',
  deltaCents: 1000,
  balanceCents: 5000,
};

describe('filterHomeAmigoExtras (C08/DEC-301 home de-dupe by topic)', () => {
  it('keeps everything when the insights carousel is empty', () => {
    const extras = [topCategory, phaseProgress, dailyLeft, receivable, piggy];
    expect(filterHomeAmigoExtras(extras, [])).toEqual(extras);
  });

  it('drops top_category when category_rhythm is already shown', () => {
    const out = filterHomeAmigoExtras([topCategory, piggy], ['category_rhythm']);
    expect(out.map((e) => e.id)).toEqual(['piggy_movement']);
  });

  it('drops phase_progress when EITHER phase_projection or phase_countdown is shown', () => {
    expect(filterHomeAmigoExtras([phaseProgress], ['phase_projection'])).toEqual([]);
    expect(filterHomeAmigoExtras([phaseProgress], ['phase_countdown'])).toEqual([]);
  });

  it('drops daily_left when end_of_day is shown and receivable when participant_balance is shown', () => {
    expect(filterHomeAmigoExtras([dailyLeft], ['end_of_day'])).toEqual([]);
    expect(filterHomeAmigoExtras([receivable], ['participant_balance'])).toEqual([]);
  });

  it('always keeps piggy_movement — it is unique to the cofrinho, never an insight', () => {
    const out = filterHomeAmigoExtras(
      [topCategory, piggy],
      ['category_rhythm', 'phase_projection', 'end_of_day', 'participant_balance'],
    );
    expect(out.map((e) => e.id)).toEqual(['piggy_movement']);
  });

  it('does not mutate the input array', () => {
    const extras = [topCategory, phaseProgress];
    const copy = [...extras];
    filterHomeAmigoExtras(extras, ['category_rhythm']);
    expect(extras).toEqual(copy);
  });
});
