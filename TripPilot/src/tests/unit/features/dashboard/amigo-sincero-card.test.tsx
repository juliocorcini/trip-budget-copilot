import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@/i18n';
import { AmigoSinceroCard } from '@/features/dashboard/cards/AmigoSinceroCard';
import type { HonestFriendV2 } from '@/domain/budget';

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
});
