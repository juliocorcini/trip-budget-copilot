import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@/i18n';

// D-IMP-06: the lock screen auto-verifies as the user types. We mock the crypto
// boundary so a "correct PIN" is a pure string compare, and keep the real
// `isValidPin` rule (4–8 digits) so the auto-submit gate is exercised for real.
vi.mock('@/utils/app-lock', async () => {
  const actual = await vi.importActual<typeof import('@/utils/app-lock')>('@/utils/app-lock');
  return {
    ...actual,
    verifyPin: vi.fn(async (pin: string) => pin === CORRECT_PIN),
  };
});

// Biometrics off: never auto-prompt, never offer the shortcut in these tests.
vi.mock('@/utils/biometric-unlock', () => ({
  isBiometricSupported: vi.fn(async () => false),
  isBiometricUnlockReady: vi.fn(() => false),
  verifyBiometricCredential: vi.fn(async () => false),
}));

import { LockScreen } from '@/features/security/LockScreen';

const CORRECT_PIN = '135790';

function renderLock(onUnlock = vi.fn()) {
  render(<LockScreen saltHex="salt" hashHex="hash" onUnlock={onUnlock} />);
  const input = screen.getByLabelText(/pin/i) as HTMLInputElement;
  return { onUnlock, input };
}

function type(input: HTMLInputElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

describe('LockScreen auto-submit (D-IMP-06)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('unlocks the instant the full correct PIN is typed — no button tap', async () => {
    const { onUnlock, input } = renderLock();
    // Type digit-by-digit; only the full 6-digit value matches.
    type(input, '1');
    type(input, '13');
    type(input, '135');
    type(input, '1357'); // valid length (4) but wrong → silent
    type(input, '13579'); // valid length (5) but wrong → silent
    type(input, '135790'); // correct → unlock
    await waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1));
  });

  it('stays silent on a wrong PIN of valid length — no unlock, no error, field kept', async () => {
    const { onUnlock, input } = renderLock();
    type(input, '999999');
    // Give any pending async verify a tick to settle.
    await new Promise((r) => setTimeout(r, 0));
    expect(onUnlock).not.toHaveBeenCalled();
    expect(input.value).toBe('999999'); // not wiped mid-typing
    expect(screen.queryByText(/incorret|wrong|errad/i)).not.toBeInTheDocument();
  });

  it('does not attempt to unlock before the minimum length (4 digits)', async () => {
    const { onUnlock, input } = renderLock();
    const { verifyPin } = await import('@/utils/app-lock');
    type(input, '13'); // below the 4-digit policy floor
    await new Promise((r) => setTimeout(r, 0));
    expect(verifyPin).not.toHaveBeenCalled();
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it('the explicit button is the loud fallback: wrong PIN shows the error and clears', async () => {
    const { onUnlock, input } = renderLock();
    type(input, '999999');
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(input.value).toBe('')); // loud path clears
    expect(onUnlock).not.toHaveBeenCalled();
  });
});
