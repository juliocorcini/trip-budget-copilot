import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import '@/i18n';
import { db } from '@/data/db/database';
import type { Trip } from '@/domain/types/trip';

// BUG-001/004/009/014: the boot guard and the screen-level guards must never
// drop the user on the destructive onboarding flow when data exists or a read
// fails. These tests drive the real components with a mocked useAppData.
vi.mock('@/hooks/useAppData', () => ({
  useAppData: vi.fn(),
  notifyAppDataChanged: vi.fn(),
  APP_DATA_CHANGED_EVENT: 'trippilot:data-changed',
}));

import { BootGate } from '@/features/onboarding/BootGate';
import { WelcomePage } from '@/features/onboarding/WelcomePage';
import { TripOverviewPage } from '@/features/trip/TripOverviewPage';
import { useAppData } from '@/hooks/useAppData';

const mockUseAppData = vi.mocked(useAppData);

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'dev-1',
};

const TRIP: Trip = {
  ...meta,
  id: 'trip-1',
  name: 'Real Trip',
  baseCurrency: 'EUR',
  startDate: '2031-07-01',
  endDate: '2031-07-10',
  status: 'active',
  notes: null,
};

type AppData = ReturnType<typeof useAppData>;

function appData(overrides: Partial<AppData>): AppData {
  return {
    settings: null,
    trip: null,
    phases: [],
    pools: [],
    links: [],
    envelopes: [],
    transactions: [],
    wallets: [],
    participants: [],
    occurrences: [],
    plannedPurchases: [],
    loading: false,
    error: false,
    reload: vi.fn(async () => {}),
    retry: vi.fn(async () => {}),
    ...overrides,
  };
}

function renderAt(path: string, element: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={element} />
        <Route path="/dashboard" element={<div>DASHBOARD ROUTE</div>} />
        <Route path="/welcome" element={<div>WELCOME ROUTE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function clearAll(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}

beforeEach(clearAll);
afterEach(() => vi.clearAllMocks());

describe('BootGate (BUG-001)', () => {
  it('redirects to /dashboard when an active trip exists', async () => {
    mockUseAppData.mockReturnValue(appData({ trip: TRIP }));
    renderAt('/', <BootGate />);
    await waitFor(() => expect(screen.getByText('DASHBOARD ROUTE')).toBeInTheDocument());
  });

  it('shows the recovery screen (never Welcome) when trips exist but no active trip', async () => {
    await db.trips.add(TRIP);
    mockUseAppData.mockReturnValue(appData({ trip: null }));
    renderAt('/', <BootGate />);
    await waitFor(() => expect(screen.getByText('Real Trip')).toBeInTheDocument());
    expect(screen.queryByText('WELCOME ROUTE')).not.toBeInTheDocument();
  });

  it('redirects to /welcome only when the DB is genuinely empty', async () => {
    mockUseAppData.mockReturnValue(appData({ trip: null }));
    renderAt('/', <BootGate />);
    await waitFor(() => expect(screen.getByText('WELCOME ROUTE')).toBeInTheDocument());
  });

  it('shows the data error screen (never Welcome) on a DB read error', async () => {
    mockUseAppData.mockReturnValue(appData({ trip: null, error: true }));
    renderAt('/', <BootGate />);
    await waitFor(() =>
      expect(screen.getByText(/não foi possível carregar/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText('WELCOME ROUTE')).not.toBeInTheDocument();
  });
});

describe('WelcomePage redirect guard (BUG-001)', () => {
  it('redirects to /dashboard when an active trip is present', async () => {
    mockUseAppData.mockReturnValue(appData({ trip: TRIP }));
    renderAt('/welcome', <WelcomePage />);
    await waitFor(() => expect(screen.getByText('DASHBOARD ROUTE')).toBeInTheDocument());
  });

  it('shows the onboarding menu only when there is no active trip', () => {
    mockUseAppData.mockReturnValue(appData({ trip: null }));
    renderAt('/welcome', <WelcomePage />);
    expect(screen.getByText('Criar viagem')).toBeInTheDocument();
  });
});

describe('Screen guards on DB error (BUG-004/014)', () => {
  it('TripOverviewPage shows DataErrorScreen on error — never redirects to Welcome', async () => {
    mockUseAppData.mockReturnValue(appData({ trip: null, error: true }));
    renderAt('/trip', <TripOverviewPage />);
    await waitFor(() =>
      expect(screen.getByText(/não foi possível carregar/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText('WELCOME ROUTE')).not.toBeInTheDocument();
  });

  it('TripOverviewPage redirects to Welcome only when there is genuinely no trip', async () => {
    mockUseAppData.mockReturnValue(appData({ trip: null, error: false, loading: false }));
    renderAt('/trip', <TripOverviewPage />);
    await waitFor(() => expect(screen.getByText('WELCOME ROUTE')).toBeInTheDocument());
  });
});
