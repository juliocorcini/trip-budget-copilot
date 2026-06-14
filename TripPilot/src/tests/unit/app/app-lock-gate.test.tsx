import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import '@/i18n';
import type { AppSettings } from '@/domain/types/app-settings';

// E6 (M20): the lock gate decides whether the PIN screen replaces the app.
vi.mock('@/hooks/useLiveSettings', () => ({ useLiveSettings: vi.fn() }));

import { AppLockGate } from '@/app/AppLockGate';
import { useLiveSettings } from '@/hooks/useLiveSettings';

const mockSettings = vi.mocked(useLiveSettings);

function settings(overrides: Partial<AppSettings>): AppSettings {
  return {
    appLockEnabled: false,
    appLockPinHash: null,
    appLockPinSalt: null,
    ...overrides,
  } as AppSettings;
}

function renderGate(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppLockGate>
        <div>PROTECTED CONTENT</div>
      </AppLockGate>
    </MemoryRouter>,
  );
}

const LOCKED = settings({ appLockEnabled: true, appLockPinHash: 'abc', appLockPinSalt: 'def' });

afterEach(() => vi.clearAllMocks());

describe('AppLockGate (E6 M20)', () => {
  it('renders children when the lock is off', () => {
    mockSettings.mockReturnValue(settings({ appLockEnabled: false }));
    renderGate('/dashboard');
    expect(screen.getByText('PROTECTED CONTENT')).toBeInTheDocument();
  });

  it('shows the PIN screen on a protected route when the lock is on', () => {
    mockSettings.mockReturnValue(LOCKED);
    renderGate('/dashboard');
    expect(screen.queryByText('PROTECTED CONTENT')).not.toBeInTheDocument();
    expect(screen.getByText('App bloqueado')).toBeInTheDocument();
  });

  it('NEVER locks recovery/onboarding routes (ÂNCORA 12)', () => {
    mockSettings.mockReturnValue(LOCKED);
    for (const path of ['/', '/welcome', '/onboarding', '/rescue', '/sync']) {
      const { unmount } = renderGate(path);
      expect(screen.getByText('PROTECTED CONTENT')).toBeInTheDocument();
      unmount();
    }
  });

  it('does not lock while settings are still loading', () => {
    mockSettings.mockReturnValue(undefined);
    renderGate('/dashboard');
    expect(screen.getByText('PROTECTED CONTENT')).toBeInTheDocument();
  });
});
