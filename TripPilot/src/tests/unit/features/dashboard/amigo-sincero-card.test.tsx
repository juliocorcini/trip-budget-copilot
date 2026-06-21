import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@/i18n';
import { AmigoSinceroCard } from '@/features/dashboard/cards/AmigoSinceroCard';
import type { HonestFriendExtra, HonestFriendV2 } from '@/domain/budget';

beforeAll(() => {
  // jsdom doesn't implement Element.scrollTo; the swipe carousel calls it on dot
  // taps and auto-advance, so stub it to a no-op for the whole file.
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

/**
 * GATE 12 (audit §4.8) — the contextual rescue door. The "honest friend" card
 * surfaces a rescue-mode CTA ONLY in the dire `alert` tone (over plan/pace AND
 * the pace projects into the protected reserve). The tone math itself is proven
 * in honest-friend.test.ts; this asserts the card wires that gate correctly.
 */
const overPlan = (reserveStartDate: string | null): HonestFriendV2 => ({
  kind: 'over_plan',
  profileId: 'bar',
  profileName: 'Bar',
  plannedQuantity: 4,
  doneQuantity: 6,
  reserveStartDate,
});

describe('AmigoSinceroCard — contextual rescue CTA (G12)', () => {
  it('shows the rescue CTA in alert tone (reserve at risk) and calls onRescue', () => {
    const onRescue = vi.fn();
    render(
      <AmigoSinceroCard
        amigo={overPlan('2026-06-15')}
        currency="EUR"
        onSeeImpact={vi.fn()}
        onRescue={onRescue}
      />,
    );
    const cta = screen.getByText(/plano de resgate/i);
    expect(cta).toBeInTheDocument();
    fireEvent.click(cta);
    expect(onRescue).toHaveBeenCalledTimes(1);
  });

  it('hides the rescue CTA when the reserve is still safe (caution tone)', () => {
    render(
      <AmigoSinceroCard
        amigo={overPlan(null)}
        currency="EUR"
        onSeeImpact={vi.fn()}
        onRescue={vi.fn()}
      />,
    );
    expect(screen.queryByText(/plano de resgate/i)).not.toBeInTheDocument();
  });

  it('never shows the rescue CTA when no onRescue handler is provided', () => {
    render(
      <AmigoSinceroCard
        amigo={overPlan('2026-06-15')}
        currency="EUR"
        onSeeImpact={vi.fn()}
      />,
    );
    expect(screen.queryByText(/plano de resgate/i)).not.toBeInTheDocument();
  });

  // DEC-236: the broke state leads with phase truth and a recovery door — it
  // must never reuse the "plano de resgate / save €X" label that Julio flagged.
  it('over_budget → phase-truth message, reserve detail and a recovery CTA', () => {
    const onRescue = vi.fn();
    render(
      <AmigoSinceroCard
        amigo={{
          kind: 'over_budget',
          reserveUsedCents: 56000,
          planShortfallCents: 0,
          intoReserve: true,
        }}
        currency="EUR"
        onSeeImpact={vi.fn()}
        onRescue={onRescue}
      />,
    );
    expect(screen.getByText(/acabou o dinheiro livre/i)).toBeInTheDocument();
    expect(screen.getByText(/560,00/)).toBeInTheDocument();
    expect(screen.queryByText(/plano de resgate/i)).not.toBeInTheDocument();
    const cta = screen.getByText(/como me recuperar/i);
    fireEvent.click(cta);
    expect(onRescue).toHaveBeenCalledTimes(1);
  });

  // Julio's exact case: pool free positive (reserve intact) but the plan
  // reserves more than what's left → the plan-shortfall copy, NOT the reserve copy.
  it('over_budget plan-committed (reserve intact) → plan-shortfall copy', () => {
    render(
      <AmigoSinceroCard
        amigo={{
          kind: 'over_budget',
          reserveUsedCents: 0,
          planShortfallCents: 2254,
          intoReserve: false,
        }}
        currency="EUR"
        onSeeImpact={vi.fn()}
        onRescue={vi.fn()}
      />,
    );
    expect(screen.getByText(/acabou o dinheiro livre/i)).toBeInTheDocument();
    expect(screen.getByText(/reservado pro seu plano/i)).toBeInTheDocument();
    expect(screen.getByText(/22,54/)).toBeInTheDocument();
    expect(screen.queryByText(/reserva protegida/i)).not.toBeInTheDocument();
  });
});

// DEC-093 follow-up + device-test 2026-06-20: the card is a SWIPE carousel of the
// friend's reads (verdict + each extra) — drag to move, dots to jump, like the
// dashboard insights carousel — and it hides entirely when there's nothing to say.
describe('AmigoSinceroCard — swipe carousel of reads', () => {
  const extras: HonestFriendExtra[] = [
    { id: 'phase_progress', tone: 'neutral', percent: 50 },
    { id: 'receivable', tone: 'positive', amountCents: 4200 },
  ];

  const brokeVerdict: HonestFriendV2 = {
    kind: 'over_budget',
    reserveUsedCents: 0,
    planShortfallCents: 2254,
    intoReserve: false,
  };

  it('renders one dot per read (verdict + extras) and shows every read at once', () => {
    render(
      <AmigoSinceroCard amigo={brokeVerdict} extras={extras} currency="EUR" onSeeImpact={vi.fn()} />,
    );
    // verdict + 2 extras = 3 dots; all three reads live in the DOM (they swipe).
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByText(/acabou o dinheiro livre/i)).toBeInTheDocument();
    expect(screen.getByText(/50% do orçamento/i)).toBeInTheDocument();
    expect(screen.getByText(/te devendo/i)).toBeInTheDocument();
  });

  it('a dot tap scrolls the carousel to that read', () => {
    const scrollTo = vi.fn();
    Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo;
    render(
      <AmigoSinceroCard amigo={brokeVerdict} extras={extras} currency="EUR" onSeeImpact={vi.fn()} />,
    );
    fireEvent.click(screen.getAllByRole('tab')[1]!);
    expect(scrollTo).toHaveBeenCalled();
  });

  it('shows no dots when there is a single read (just the verdict)', () => {
    render(<AmigoSinceroCard amigo={brokeVerdict} currency="EUR" onSeeImpact={vi.fn()} />);
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getByText(/acabou o dinheiro livre/i)).toBeInTheDocument();
  });

  it('hides entirely when the friend has nothing to say (no verdict, no extras)', () => {
    const { container } = render(
      <AmigoSinceroCard amigo={{ kind: 'none' }} currency="EUR" onSeeImpact={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('on the Home, hides the reassuring on-plan read when there are no extras', () => {
    const onPlan: HonestFriendV2 = {
      kind: 'on_plan',
      profileId: 'bar',
      profileName: 'Bar',
      plannedQuantity: 4,
      doneQuantity: 2,
      remainingPlanned: 2,
    };
    const { container } = render(
      <AmigoSinceroCard amigo={onPlan} currency="EUR" onSeeImpact={vi.fn()} hideOnPlan />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
