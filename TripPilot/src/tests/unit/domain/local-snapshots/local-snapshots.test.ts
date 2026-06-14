import { describe, it, expect } from 'vitest';
import {
  MAX_LOCAL_SNAPSHOTS,
  snapshotDayId,
  sortSnapshotsNewestFirst,
  hasSnapshotForDay,
  selectSnapshotsToPrune,
  parseSnapshotJson,
} from '@/domain/local-snapshots';
import { localDateString } from '@/domain/dates';
import type { LocalSnapshot } from '@/domain/types/local-snapshot';

function snap(day: string, createdAt: string): LocalSnapshot {
  return { id: day, createdAt, expenseCount: 0, json: '{}' };
}

describe('local snapshots — pure history helpers (E6 / M14)', () => {
  describe('snapshotDayId', () => {
    it('uses the local YYYY-MM-DD day key', () => {
      const date = new Date('2026-06-13T15:30:00');
      expect(snapshotDayId(date)).toBe(localDateString(date));
    });
  });

  describe('sortSnapshotsNewestFirst', () => {
    it('orders by createdAt descending without mutating the input', () => {
      const input = [
        snap('2026-06-11', '2026-06-11T08:00:00.000Z'),
        snap('2026-06-13', '2026-06-13T08:00:00.000Z'),
        snap('2026-06-12', '2026-06-12T08:00:00.000Z'),
      ];
      const sorted = sortSnapshotsNewestFirst(input);
      expect(sorted.map((s) => s.id)).toEqual(['2026-06-13', '2026-06-12', '2026-06-11']);
      // Original array is untouched (non-mutating).
      expect(input.map((s) => s.id)).toEqual(['2026-06-11', '2026-06-13', '2026-06-12']);
    });
  });

  describe('hasSnapshotForDay', () => {
    it('detects an existing day so the daily write happens once', () => {
      const list = [snap('2026-06-12', '2026-06-12T08:00:00.000Z')];
      expect(hasSnapshotForDay(list, '2026-06-12')).toBe(true);
      expect(hasSnapshotForDay(list, '2026-06-13')).toBe(false);
    });
  });

  describe('selectSnapshotsToPrune', () => {
    it('returns nothing while at or below the cap', () => {
      const list = Array.from({ length: MAX_LOCAL_SNAPSHOTS }, (_, i) =>
        snap(`2026-06-0${i + 1}`, `2026-06-0${i + 1}T08:00:00.000Z`),
      );
      expect(selectSnapshotsToPrune(list)).toEqual([]);
    });

    it('keeps the N newest and prunes the oldest beyond the cap', () => {
      // 9 days; default cap is 7 → the two oldest must be pruned.
      const list = Array.from({ length: 9 }, (_, i) => {
        const day = String(i + 1).padStart(2, '0');
        return snap(`2026-06-${day}`, `2026-06-${day}T08:00:00.000Z`);
      });
      const pruned = selectSnapshotsToPrune(list).map((s) => s.id).sort();
      expect(pruned).toEqual(['2026-06-01', '2026-06-02']);
    });

    it('respects a custom cap', () => {
      const list = [
        snap('2026-06-10', '2026-06-10T08:00:00.000Z'),
        snap('2026-06-11', '2026-06-11T08:00:00.000Z'),
        snap('2026-06-12', '2026-06-12T08:00:00.000Z'),
      ];
      const pruned = selectSnapshotsToPrune(list, 2);
      expect(pruned.map((s) => s.id)).toEqual(['2026-06-10']);
    });
  });

  describe('parseSnapshotJson', () => {
    it('returns null for a malformed payload instead of throwing', () => {
      expect(parseSnapshotJson('not-json')).toBeNull();
    });
  });
});
