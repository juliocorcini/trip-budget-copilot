import { describe, expect, it } from 'vitest';
import {
  liveConnState,
  LIVE_FRESH_MS,
  LIVE_OFFLINE_MS,
} from '@/features/split/live-status';

const NOW = 1_000_000;

describe('liveConnState (L2 — truthful status)', () => {
  it('is live when a pull succeeded within the freshness window', () => {
    expect(liveConnState({ socketOpen: true, lastSyncAt: NOW - 1000, now: NOW })).toBe('live');
    expect(liveConnState({ socketOpen: false, lastSyncAt: NOW - (LIVE_FRESH_MS - 1), now: NOW })).toBe('live');
  });

  it('downgrades to syncing once data goes stale but contact is recent or socket is up', () => {
    // Stale data, but the socket is still open → actively trying.
    expect(liveConnState({ socketOpen: true, lastSyncAt: NOW - (LIVE_FRESH_MS + 1000), now: NOW })).toBe('syncing');
    // Socket down, but the last sync is within the offline grace → still syncing.
    expect(liveConnState({ socketOpen: false, lastSyncAt: NOW - (LIVE_OFFLINE_MS - 1000), now: NOW })).toBe('syncing');
  });

  it('reports honest offline when nothing has flowed for too long and the socket is down', () => {
    expect(liveConnState({ socketOpen: false, lastSyncAt: NOW - (LIVE_OFFLINE_MS + 1000), now: NOW })).toBe('offline');
  });

  it('never claims live before the first successful sync', () => {
    expect(liveConnState({ socketOpen: false, lastSyncAt: null, now: NOW })).toBe('offline');
    // Socket connected but no data yet → syncing, NOT a false "live".
    expect(liveConnState({ socketOpen: true, lastSyncAt: null, now: NOW })).toBe('syncing');
  });
});
