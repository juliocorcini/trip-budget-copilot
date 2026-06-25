import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import '@/i18n';

// The FAB menu and the split sheets pull in a large tree and are irrelevant to
// the nav's a11y state — stub them so we test BottomNav in isolation.
vi.mock('@/components/FAB', () => ({ FABMenu: () => null }));
vi.mock('@/features/split/SplitResumeSheet', () => ({ SplitResumeSheet: () => null }));
vi.mock('@/features/split/DivideChooserSheet', () => ({ DivideChooserSheet: () => null }));
vi.mock('@/features/split/useActiveSplit', () => ({ useActiveSplit: () => null }));

// App mode is mutable per test (C06 covers the simple-mode swap). vi.hoisted so
// the holder exists when the hoisted vi.mock factory runs.
const modeState = vi.hoisted(() => ({ appMode: 'complete' as 'simple' | 'complete' }));
vi.mock('@/hooks/useAppData', () => ({
  useAppData: () => ({ settings: { appMode: modeState.appMode } }),
}));

import { BottomNav } from '@/components/BottomNav';

afterEach(() => {
  modeState.appMode = 'complete';
  cleanup();
});

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

describe('C06 / DEC-298 — symmetric 2+2 bar', () => {
  it('complete mode shows Copiloto on the right and no Ajustes tab (gear owns it)', () => {
    modeState.appMode = 'complete';
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <BottomNav />
      </MemoryRouter>,
    );
    const labels = screen.getAllByRole('button').map((b) => b.textContent ?? '');
    expect(labels.some((l) => /copiloto/i.test(l))).toBe(true);
    expect(labels.some((l) => /ajustes/i.test(l))).toBe(false);
  });

  it('simple mode swaps the advanced Copiloto for Ajustes (still 4 tabs around the FAB)', () => {
    modeState.appMode = 'simple';
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <BottomNav />
      </MemoryRouter>,
    );
    const labels = screen.getAllByRole('button').map((b) => b.textContent ?? '');
    expect(labels.some((l) => /copiloto/i.test(l))).toBe(false);
    expect(labels.some((l) => /ajustes/i.test(l))).toBe(true);
    // Início, Gastos, Viagem, Ajustes + the central FAB toggle = 5 buttons.
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('marks Ajustes active when on /settings in simple mode', () => {
    modeState.appMode = 'simple';
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <BottomNav />
      </MemoryRouter>,
    );
    const current = activeButtons();
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent ?? '').toMatch(/ajustes/i);
  });
});
