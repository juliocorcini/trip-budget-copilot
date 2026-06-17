import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { useLiveSettings } from '@/hooks/useLiveSettings';
import { LockScreen } from '@/features/security/LockScreen';

/**
 * E6 (M20): app-lock gate. When the lock is on, it shows the PIN screen at boot
 * before any protected route renders. Recovery/onboarding paths are NEVER locked
 * (ÂNCORA 12) — the boot guard (`/`) decides emergency restore there, and an
 * evicted DB has no settings, so the lock simply cannot engage on a fresh start.
 */
const UNLOCKED_PATHS = new Set(['/', '/welcome', '/onboarding', '/rescue', '/sync']);

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const settings = useLiveSettings();
  const { pathname } = useLocation();
  const [unlocked, setUnlocked] = useState(false);
  // A session that STARTS without a lock is implicitly unlocked, so turning the
  // lock on mid-session never locks the user out of the screen they are on.
  const initializedRef = useRef(false);

  useEffect(() => {
    if (settings === undefined || initializedRef.current) return;
    initializedRef.current = true;
    const lockConfigured = settings.appLockEnabled && settings.appLockPinHash !== null;
    if (!lockConfigured) setUnlocked(true);
  }, [settings]);

  const lockConfigured =
    !!settings?.appLockEnabled &&
    settings.appLockPinHash !== null &&
    settings.appLockPinSalt !== null;
  const mustLock = lockConfigured && !unlocked && !UNLOCKED_PATHS.has(pathname);

  if (mustLock) {
    return (
      <LockScreen
        saltHex={settings!.appLockPinSalt!}
        hashHex={settings!.appLockPinHash!}
        biometricEnabled={settings!.appLockBiometricEnabled}
        biometricCredentialId={settings!.appLockBiometricCredentialId}
        onUnlock={() => setUnlocked(true)}
      />
    );
  }

  return <>{children}</>;
}
