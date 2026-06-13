import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordCrash,
  readCrashLog,
  isCrashLooping,
  clearCrashLog,
  describeError,
} from '@/utils/crash-log';

beforeEach(() => {
  clearCrashLog();
});

describe('crash-log telemetry + loop detection (BUG-017)', () => {
  it('records crashes and rotates to the last 10 entries', () => {
    for (let i = 0; i < 14; i++) {
      recordCrash({ message: `crash ${i}` });
    }
    const log = readCrashLog();
    expect(log).toHaveLength(10);
    expect(log[log.length - 1]?.message).toBe('crash 13');
  });

  it('flags a loop only after MORE than 3 crashes within 60s', () => {
    expect(isCrashLooping()).toBe(false);
    recordCrash({ message: 'a' });
    recordCrash({ message: 'b' });
    recordCrash({ message: 'c' });
    // Exactly 3 in the window is NOT yet a loop.
    expect(isCrashLooping()).toBe(false);
    recordCrash({ message: 'd' });
    // The 4th crash trips loop detection.
    expect(isCrashLooping()).toBe(true);
  });

  it('does not count crashes older than the 60s window', () => {
    recordCrash({ message: 'old-1' });
    recordCrash({ message: 'old-2' });
    recordCrash({ message: 'old-3' });
    recordCrash({ message: 'old-4' });
    // Evaluate the loop as if 61s have passed — stale crashes drop out.
    const future = Date.now() + 61_000;
    expect(isCrashLooping(future)).toBe(false);
  });

  it('clearCrashLog resets the buffer (used after recovery)', () => {
    recordCrash({ message: 'x' });
    clearCrashLog();
    expect(readCrashLog()).toHaveLength(0);
  });

  it('describeError normalizes Error and non-Error throws', () => {
    expect(describeError(new Error('boom')).message).toBe('boom');
    expect(describeError('plain string').message).toBe('plain string');
  });
});
