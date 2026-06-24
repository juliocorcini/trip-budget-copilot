import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import '@/i18n';

// The FAB menu and the resume sheet pull in a large tree and are irrelevant to
// the nav's a11y state — stub them so we test BottomNav in isolation.
vi.mock('@/components/FAB', () => ({ FABMenu: () => null }));
vi.mock('@/features/split/SplitResumeSheet', () => ({ SplitResumeSheet: () => null }));
vi.mock('@/hooks/useAppData', () => ({
  useAppData: () => ({ settings: { appMode: 'complete' } }),
}));

import { BottomNav } from '@/components/BottomNav';

function activeButtons() {
  return screen
    .getAllByRole('button')
    .filter((b) => b.getAttribute('aria-current') === 'page');
}

describe('M11 / A-3 — active tab announced via aria-current', () => {
  it('marks exactly the active tab on /expenses (and labels it Gastos)', () => {
    render(
      <MemoryRouter initialEntries={['/expenses']}>
        <BottomNav />
      </MemoryRouter>,
    );
    const current = activeButtons();
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent ?? '').toMatch(/gastos/i);
    cleanup();
  });

  it('moves aria-current to the dashboard tab on /dashboard', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <BottomNav />
      </MemoryRouter>,
    );
    const current = activeButtons();
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent ?? '').toMatch(/início/i);
  });
});
