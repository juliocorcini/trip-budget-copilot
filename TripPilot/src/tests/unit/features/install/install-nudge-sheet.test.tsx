import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import '@/i18n';
import { InstallNudge } from '@/features/install/InstallNudge';

/**
 * DEC-364 (wave 2026-06-27, A1) — the install nudge must OPEN the sheet, not
 * vanish into nothing. The field bug: tapping the banner CTA hid the banner AND
 * unmounted the sheet in the same render ("clico no aviso e ele some sem levar a
 * lugar nenhum"), because the sheet sat below an early `return null`. The fix
 * mounts the sheet outside that gate; this test locks the behaviour in.
 */
describe('InstallNudge — CTA opens the sheet (DEC-364 A1)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('shows the banner first, with the sheet still closed', () => {
    render(
      <MemoryRouter>
        <InstallNudge />
      </MemoryRouter>,
    );
    expect(screen.getByText('Não mostrar de novo')).toBeInTheDocument();
    // The sheet's "see full comparison" link only exists once the sheet is open.
    expect(screen.queryByText('Ver comparação completa')).not.toBeInTheDocument();
  });

  it('opens the sheet and hides the banner when the CTA is tapped', () => {
    render(
      <MemoryRouter>
        <InstallNudge />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('Ver como'));
    // Sheet is now mounted (its unique link is present)…
    expect(screen.getByText('Ver comparação completa')).toBeInTheDocument();
    // …and the banner's "never" affordance is gone (banner unmounted, sheet stayed).
    expect(screen.queryByText('Não mostrar de novo')).not.toBeInTheDocument();
  });
});
