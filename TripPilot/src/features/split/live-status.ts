/**
 * L2 (live-table resilience) — derive a TRUTHFUL connection state from real
 * signals instead of a static "synced" badge (which once lied: the UI showed
 * connected while propagation had silently stopped). The freshness of the last
 * SUCCESSFUL pull is the primary signal — it proves data is actually flowing —
 * and the signal socket being open is a secondary hint. Pure and framework-free
 * so it is unit-tested with concrete timings and reused by both the owner card
 * and the guest page.
 */
export type LiveConnState = 'live' | 'syncing' | 'offline';

/** A pull older than this (≈1.5 poll cycles of 6s) means data stopped flowing. */
export const LIVE_FRESH_MS = 9000;
/** With no successful contact for this long, report honest offline (not syncing). */
export const LIVE_OFFLINE_MS = 20000;

export function liveConnState(args: {
  socketOpen: boolean;
  lastSyncAt: number | null;
  now: number;
}): LiveConnState {
  const { socketOpen, lastSyncAt, now } = args;
  const sinceSync = lastSyncAt === null ? Infinity : now - lastSyncAt;
  // Fresh data within ~1.5 poll cycles → genuinely live.
  if (sinceSync <= LIVE_FRESH_MS) return 'live';
  // Stale but still trying: the socket is up, or contact lapsed only recently.
  if (socketOpen || sinceSync <= LIVE_OFFLINE_MS) return 'syncing';
  return 'offline';
}
