import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shareOrCopyLink, buildShareLinkPayload } from '@/utils/native/link-share';

// D-IMP-04: share a statement link natively, fall back to copy. The cancel case
// must stay silent (no copy behind the user's back).
describe('buildShareLinkPayload (D-IMP-04)', () => {
  it('always carries the url and only adds text/title when present', () => {
    expect(buildShareLinkPayload({ url: 'https://t.pl/s#k' })).toEqual({ url: 'https://t.pl/s#k' });
    expect(buildShareLinkPayload({ url: 'u', text: 'hi', title: 'T' })).toEqual({
      url: 'u',
      text: 'hi',
      title: 'T',
    });
  });
});

describe('shareOrCopyLink (D-IMP-04)', () => {
  const originalShare = Object.getOwnPropertyDescriptor(navigator, 'share');
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

  const setShare = (fn: unknown) =>
    Object.defineProperty(navigator, 'share', { value: fn, configurable: true });
  const setClipboard = (fn: unknown) =>
    Object.defineProperty(navigator, 'clipboard', { value: fn, configurable: true });

  beforeEach(() => {
    setShare(undefined);
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
  });

  afterEach(() => {
    if (originalShare) Object.defineProperty(navigator, 'share', originalShare);
    else setShare(undefined);
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  });

  it('uses the OS share sheet when available and reports "shared"', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setShare(share);
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    const outcome = await shareOrCopyLink({ url: 'https://t.pl/s#k', text: 'msg' });

    expect(outcome).toBe('shared');
    expect(share).toHaveBeenCalledWith({ url: 'https://t.pl/s#k', text: 'msg' });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('stays silent on a user cancel — never copies behind their back', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('dismissed', 'AbortError'));
    setShare(share);
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    const outcome = await shareOrCopyLink({ url: 'https://t.pl/s#k', text: 'msg' });

    expect(outcome).toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls back to copy when sharing fails for a real reason', async () => {
    const share = vi.fn().mockRejectedValue(new Error('no target app'));
    setShare(share);
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    const outcome = await shareOrCopyLink({ url: 'https://t.pl/s#k', text: 'msg' });

    expect(outcome).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://t.pl/s#k');
  });

  it('copies straight away when the Web Share API is absent', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    const outcome = await shareOrCopyLink({ url: 'https://t.pl/s#k' });

    expect(outcome).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://t.pl/s#k');
  });

  it('reports copy_failed when even the clipboard rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('blocked'));
    setClipboard({ writeText });

    const outcome = await shareOrCopyLink({ url: 'https://t.pl/s#k' });

    expect(outcome).toBe('copy_failed');
  });
});
