import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@/i18n';

// DEC-170: the recovery screen must NEVER be a dead end — it keeps retrying on
// its own and always offers a full reload (the reliable WebKit fix) plus an
// emergency export so the user can rescue their data no matter what.
vi.mock('@/data/db/db-recovery', () => ({ hardReloadApp: vi.fn() }));
vi.mock('@/utils/emergency-backup', () => ({ downloadEmergencyBackup: vi.fn(async () => true) }));

import { DataErrorScreen } from '@/components/DataErrorScreen';
import { hardReloadApp } from '@/data/db/db-recovery';
import { downloadEmergencyBackup } from '@/utils/emergency-backup';

describe('DataErrorScreen (DEC-170 — never a dead end)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reassures the data is safe and offers retry, reload and emergency export', () => {
    render(<DataErrorScreen onRetry={vi.fn(async () => {})} />);
    expect(screen.getByText(/não foi possível carregar/i)).toBeInTheDocument();
    expect(screen.getByText(/salvos neste aparelho/i)).toBeInTheDocument();
    expect(screen.getByText(/tentar agora/i)).toBeInTheDocument();
    expect(screen.getByText(/recarregar o app/i)).toBeInTheDocument();
    expect(screen.getByText(/exportar meus dados/i)).toBeInTheDocument();
  });

  it('"reload the app" triggers a full reload (the reliable WebKit recovery)', () => {
    render(<DataErrorScreen onRetry={vi.fn(async () => {})} />);
    fireEvent.click(screen.getByText(/recarregar o app/i));
    expect(hardReloadApp).toHaveBeenCalledTimes(1);
  });

  it('"try now" runs the reconnect callback', async () => {
    const onRetry = vi.fn(async () => {});
    render(<DataErrorScreen onRetry={onRetry} />);
    fireEvent.click(screen.getByText(/tentar agora/i));
    await waitFor(() => expect(onRetry).toHaveBeenCalled());
  });

  it('export rescues the data and confirms the download', async () => {
    render(<DataErrorScreen onRetry={vi.fn(async () => {})} />);
    fireEvent.click(screen.getByText(/exportar meus dados/i));
    await waitFor(() => expect(downloadEmergencyBackup).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/backup baixado/i)).toBeInTheDocument());
  });
});
