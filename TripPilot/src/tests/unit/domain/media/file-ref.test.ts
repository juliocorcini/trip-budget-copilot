import { describe, it, expect } from 'vitest';
import {
  checkFileBytes,
  fileRefSchema,
  formatFileSize,
  FILE_MAX_BYTES,
  type FileRef,
} from '@/domain/media';

describe('checkFileBytes (10 MB cap)', () => {
  it('accepts a typical PDF (1.5 MB)', () => {
    expect(checkFileBytes(1_500_000)).toEqual({ ok: true });
  });

  it('accepts a file exactly at the cap (10 MB)', () => {
    expect(checkFileBytes(FILE_MAX_BYTES)).toEqual({ ok: true });
  });

  it('accepts a tiny 1-byte file', () => {
    expect(checkFileBytes(1)).toEqual({ ok: true });
  });

  it('rejects zero bytes as "empty"', () => {
    expect(checkFileBytes(0)).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects negative bytes as "empty"', () => {
    expect(checkFileBytes(-100)).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects NaN as "empty"', () => {
    expect(checkFileBytes(Number.NaN)).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects Infinity as "empty"', () => {
    expect(checkFileBytes(Infinity)).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects a file 1 byte over the cap as "too_large"', () => {
    expect(checkFileBytes(FILE_MAX_BYTES + 1)).toEqual({ ok: false, reason: 'too_large' });
  });

  it('rejects a 50 MB file as "too_large"', () => {
    expect(checkFileBytes(50_000_000)).toEqual({ ok: false, reason: 'too_large' });
  });
});

describe('formatFileSize', () => {
  it('formats bytes under 1 KB', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  it('formats KB range (1 KB to 1 MB)', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('2 KB');
    expect(formatFileSize(500_000)).toBe('488 KB');
    expect(formatFileSize(1024 * 1024 - 1)).toBe('1024 KB');
  });

  it('formats MB range', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(1_500_000)).toBe('1.4 MB');
    expect(formatFileSize(FILE_MAX_BYTES)).toBe('9.5 MB');
    expect(formatFileSize(3_700_000)).toBe('3.5 MB');
  });
});

describe('fileRefSchema (Zod validation)', () => {
  const validRef: FileRef = {
    r2Id: 'abc123-uuid-here',
    mime: 'application/pdf',
    name: 'hotel-reservation.pdf',
    description: 'Reserva Hotel Marriott Lisboa',
    byteSize: 2_400_000,
  };

  it('parses a complete FileRef with description', () => {
    expect(fileRefSchema.parse(validRef)).toEqual(validRef);
  });

  it('parses a FileRef without description (optional field)', () => {
    const { description: _, ...noDesc } = validRef;
    expect(fileRefSchema.parse(noDesc)).toEqual(noDesc);
  });

  it('rejects missing r2Id', () => {
    const { r2Id: _, ...bad } = validRef;
    expect(fileRefSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects missing mime', () => {
    const { mime: _, ...bad } = validRef;
    expect(fileRefSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects missing name', () => {
    const { name: _, ...bad } = validRef;
    expect(fileRefSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects missing byteSize', () => {
    const { byteSize: _, ...bad } = validRef;
    expect(fileRefSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects non-integer byteSize', () => {
    expect(fileRefSchema.safeParse({ ...validRef, byteSize: 1.5 }).success).toBe(false);
  });

  it('rejects negative byteSize', () => {
    expect(fileRefSchema.safeParse({ ...validRef, byteSize: -100 }).success).toBe(false);
  });

  it('accepts zero byteSize (nonnegative integer)', () => {
    expect(fileRefSchema.safeParse({ ...validRef, byteSize: 0 }).success).toBe(true);
  });

  it('rejects non-string r2Id', () => {
    expect(fileRefSchema.safeParse({ ...validRef, r2Id: 123 }).success).toBe(false);
  });
});
