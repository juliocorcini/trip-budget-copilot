import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@/i18n';
import { HomeAlertsCarousel } from '@/features/dashboard/HomeAlertsCarousel';
import type { HomeAlertSlide } from '@/features/dashboard/HomeAlertsCarousel';

beforeAll(() => {
  // jsdom doesn't implement Element.scrollTo; the carousel calls it on dot taps
  // and auto-advance, so stub it to a no-op for the whole file.
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

const slide = (id: HomeAlertSlide['id'], text: string): HomeAlertSlide => ({
  id,
  node: <div>{text}</div>,
});

describe('HomeAlertsCarousel — single rotating alert slot (DEC-293)', () => {
  it('renders nothing when there are no active alerts', () => {
    const { container } = render(<HomeAlertsCarousel slides={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a single alert inline without tab controls', () => {
    render(<HomeAlertsCarousel slides={[slide('demo', 'Demo notice')]} />);
    expect(screen.getByText('Demo notice')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('renders every active alert plus one dot per slide when multiple are active', () => {
    render(
      <HomeAlertsCarousel
        slides={[slide('storage_warning', 'Back up now'), slide('location_notice', 'Location on')]}
      />,
    );
    // Both alert bodies are present (nothing dropped — Â9).
    expect(screen.getByText('Back up now')).toBeInTheDocument();
    expect(screen.getByText('Location on')).toBeInTheDocument();
    // One navigable dot per slide, the first selected.
    const dots = screen.getAllByRole('tab');
    expect(dots).toHaveLength(2);
    expect(dots[0]).toHaveAttribute('aria-selected', 'true');
    expect(dots[1]).toHaveAttribute('aria-selected', 'false');
  });
});
