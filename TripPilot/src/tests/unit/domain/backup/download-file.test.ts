import { describe, it, expect, vi, afterEach } from 'vitest';
import { downloadFile } from '@/domain/backup';

/* eslint-disable @typescript-eslint/no-explicit-any */

// M17: the backup "send" relies on downloadFile, which prefers the OS share
// sheet (Web Share API with a File) and falls back to a plain file download
// where Web Share is unavailable. Both paths must work and never throw.
describe('downloadFile — share-first with download fallback (M17)', () => {
  const origShare = (navigator as any).share;
  const origCanShare = (navigator as any).canShare;
  const origCreate = (URL as any).createObjectURL;
  const origRevoke = (URL as any).revokeObjectURL;

  afterEach(() => {
    (navigator as any).share = origShare;
    (navigator as any).canShare = origCanShare;
    (URL as any).createObjectURL = origCreate;
    (URL as any).revokeObjectURL = origRevoke;
    vi.restoreAllMocks();
  });

  it('uses the OS share sheet when files can be shared', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    (navigator as any).share = share;
    (navigator as any).canShare = canShare;
    const createSpy = vi.spyOn(document, 'createElement');

    await downloadFile('{"a":1}', 'backup.json', 'application/json');

    expect(share).toHaveBeenCalledTimes(1);
    const arg = share.mock.calls[0]![0] as { files: File[] };
    expect(arg.files[0]).toBeInstanceOf(File);
    expect(arg.files[0]!.name).toBe('backup.json');
    // On a successful share we never build an anchor to download.
    expect(createSpy).not.toHaveBeenCalledWith('a');
  });

  it('falls back to a file download when Web Share is unavailable', async () => {
    delete (navigator as any).share;
    delete (navigator as any).canShare;
    const createObjectURL = vi.fn().mockReturnValue('blob:fake');
    (URL as any).createObjectURL = createObjectURL;
    (URL as any).revokeObjectURL = vi.fn();
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    await downloadFile('hello', 'note.txt', 'text/plain');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to download when the user cancels nothing but share rejects', async () => {
    (navigator as any).share = vi.fn().mockRejectedValue(new Error('boom'));
    (navigator as any).canShare = vi.fn().mockReturnValue(true);
    const createObjectURL = vi.fn().mockReturnValue('blob:fake');
    (URL as any).createObjectURL = createObjectURL;
    (URL as any).revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await downloadFile('hello', 'note.txt', 'text/plain');

    // A non-abort share failure still gets the file to the user.
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });
});
