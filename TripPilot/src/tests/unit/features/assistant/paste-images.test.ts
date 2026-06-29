import { describe, it, expect } from 'vitest';
import { imageFilesFromTransfer } from '@/features/assistant/paste-images';

/**
 * DEC-408 (G7): pasting a receipt image into the assistant must capture the
 * image File(s) and ignore plain text — across both `DataTransfer` shapes
 * (`items` vs `files`) — without ever double-counting a single image.
 */

function imageFile(name = 'shot.png'): File {
  return new File(['x'], name, { type: 'image/png' });
}

function fileItem(file: File) {
  return { kind: 'file' as const, type: file.type, getAsFile: () => file };
}

function stringItem(type = 'text/plain') {
  return { kind: 'string' as const, type, getAsFile: () => null };
}

function transfer(parts: { items?: unknown[]; files?: File[] }): DataTransfer {
  return { items: parts.items ?? [], files: parts.files ?? [] } as unknown as DataTransfer;
}

describe('imageFilesFromTransfer (DEC-408 · G7)', () => {
  it('returns [] for a null transfer', () => {
    expect(imageFilesFromTransfer(null)).toEqual([]);
  });

  it('picks image file items and skips text items', () => {
    const img = imageFile();
    const result = imageFilesFromTransfer(transfer({ items: [stringItem(), fileItem(img)] }));
    expect(result).toEqual([img]);
  });

  it('skips non-image file items (e.g. a pasted PDF)', () => {
    const pdf = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    expect(imageFilesFromTransfer(transfer({ items: [fileItem(pdf)] }))).toEqual([]);
  });

  it('falls back to dt.files when items exposes no image', () => {
    const img = imageFile();
    expect(imageFilesFromTransfer(transfer({ items: [], files: [img] }))).toEqual([img]);
  });

  it('prefers items over files so a single image is not added twice', () => {
    const a = imageFile('a.png');
    const b = imageFile('b.png');
    // `a` appears in both lists; the items path wins and `files` is ignored.
    expect(imageFilesFromTransfer(transfer({ items: [fileItem(a)], files: [a, b] }))).toEqual([a]);
  });
});
