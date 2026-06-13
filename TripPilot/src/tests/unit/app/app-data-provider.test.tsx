import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AppDataProvider } from '@/app/AppDataProvider';
import { useAppData } from '@/hooks/useAppData';
import { appSettingsRepository } from '@/data/repositories';
import { db } from '@/data/db/database';

// BUG-007: every route used to call useAppData() independently, so the Dashboard
// route alone (page + useNotifications) ran the full loader twice. With the
// shared AppDataProvider, N consumers must trigger exactly ONE load batch.
function Consumer({ label }: { label: string }) {
  const { loading } = useAppData();
  return <span data-testid={label}>{loading ? 'loading' : 'ready'}</span>;
}

async function clearAll(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}

beforeEach(clearAll);
afterEach(() => vi.restoreAllMocks());

describe('AppDataProvider (BUG-007)', () => {
  it('loads the DB once and shares it across every consumer', async () => {
    // loadAll() reads appSettings twice per batch (initial + post-repair); two
    // independent hook instances would therefore produce 4 reads, the shared
    // Provider only 2.
    const getSpy = vi.spyOn(appSettingsRepository, 'get');

    render(
      <AppDataProvider>
        <Consumer label="a" />
        <Consumer label="b" />
        <Consumer label="c" />
      </AppDataProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('a')).toHaveTextContent('ready');
      expect(screen.getByTestId('b')).toHaveTextContent('ready');
      expect(screen.getByTestId('c')).toHaveTextContent('ready');
    });

    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it('throws when useAppData is used without a Provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Consumer label="x" />)).toThrow(/AppDataProvider/);
    consoleSpy.mockRestore();
  });
});
