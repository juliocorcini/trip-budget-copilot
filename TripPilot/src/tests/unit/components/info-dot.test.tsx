import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import '@/i18n';
import { InfoDot } from '@/components/InfoDot';

beforeAll(() => {
  // jsdom doesn't implement Element.scrollTo; the bottom sheet may call it.
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
}

/**
 * DEC-289 (M05) — the InfoDot shows a one-line gloss on tap and deep-links to
 * the concept's help article, and must never trigger a parent tap target.
 */
describe('InfoDot — tap glossary (M05 / DEC-289)', () => {
  it('reveals the gloss only after tapping, with a learn-more link', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <InfoDot term="free_to_spend" />
        <LocationProbe />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/saiba mais na ajuda/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /o que é/i }));
    expect(screen.getByText(/orçamento menos o que já saiu/i)).toBeInTheDocument();
    expect(screen.getByText(/saiba mais na ajuda/i)).toBeInTheDocument();
    cleanup();
  });

  it('deep-links to the concept article in Help (?a=funds)', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <InfoDot term="free_to_spend" />
        <LocationProbe />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /o que é/i }));
    fireEvent.click(screen.getByText(/saiba mais na ajuda/i));
    expect(screen.getByTestId('loc').textContent).toBe('/help?a=funds');
    cleanup();
  });

  it('stops propagation so a parent tap target never fires', () => {
    const onParent = vi.fn();
    render(
      <MemoryRouter>
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
        <div onClick={onParent}>
          <InfoDot term="protected_reserve" />
        </div>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /o que é/i }));
    expect(onParent).not.toHaveBeenCalled();
    cleanup();
  });
});
