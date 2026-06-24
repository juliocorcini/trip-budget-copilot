import { describe, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import '@/i18n';
import { SpaceSwitcherChip } from '@/features/spaces/SpaceSwitcherChip';
import type { Trip } from '@/domain/types/trip';

/**
 * M09 — "modo" had no on-screen anchor; the persistent chip now leads with the
 * space KIND so the user always knows where they are. These prove the label
 * shows per kind and that a name only echoing the kind is dropped.
 */
const makeTrip = (over: Partial<Trip>): Trip =>
  ({ id: 't1', name: 'Trip', baseCurrency: 'EUR', kind: 'trip', ...over }) as unknown as Trip;

function renderChip(trip: Trip) {
  return render(
    <MemoryRouter>
      <SpaceSwitcherChip trip={trip} />
    </MemoryRouter>,
  );
}

describe('SpaceSwitcherChip — mode label (M09)', () => {
  it('labels a dated trip as "Viagem" and keeps the name', () => {
    renderChip(makeTrip({ name: 'Lisboa', kind: 'trip' }));
    expect(screen.getByText('Viagem')).toBeInTheDocument();
    expect(screen.getByText('Lisboa')).toBeInTheDocument();
    cleanup();
  });

  it('labels an ongoing space as "Dia a dia" and keeps a distinct name', () => {
    renderChip(makeTrip({ name: 'Casa', kind: 'ongoing' }));
    expect(screen.getByText('Dia a dia')).toBeInTheDocument();
    expect(screen.getByText('Casa')).toBeInTheDocument();
    cleanup();
  });

  it('drops a redundant name that only echoes the kind label', () => {
    renderChip(makeTrip({ name: 'Dia a dia', kind: 'ongoing' }));
    expect(screen.getByText('Dia a dia')).toBeInTheDocument();
    // The "·" separator only renders alongside a distinct name.
    expect(screen.queryByText('·')).not.toBeInTheDocument();
    cleanup();
  });
});
