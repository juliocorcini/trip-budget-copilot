/**
 * DEC-248 — pure telemetry assembly (Admin dashboard v1). NO IO lives here: this
 * module only builds the heartbeat payload and decides when to send it.
 *
 * Privacy contract: it may carry the owner's display NAME plus NON-MONETARY
 * usage counts/flags — and NEVER values, items, balances, place names, dates or
 * any transaction content. The Worker additionally allowlists keys at ingest, so
 * a money value can never be persisted even if a caller tried (defense in depth).
 */

/** Cumulative per-install usage counts (structural rows + a few event tallies).
 *  Keys MUST match the Worker's TELEMETRY_COUNTERS map exactly. */
export interface TelemetryCounts {
  trips: number;
  expenses: number;
  outings: number;
  splits: number;
  settlements: number;
  plannedPurchases: number;
  wallets: number;
  participants: number;
  connections: number;
  aiEntries: number;
  receiptScans: number;
  crashes: number;
}

/** Adoption flags. Keys MUST match the Worker's TELEMETRY_FLAGS map exactly. */
export interface TelemetryFlags {
  usesAI: boolean;
  usesReceiptOcr: boolean;
  usesSplit: boolean;
  usesWallets: boolean;
  usesLocation: boolean;
  usesAppLock: boolean;
  isNative: boolean;
}

export interface TelemetryInput {
  installId: string;
  nowMs: number;
  displayName: string | null;
  appVersion: string;
  platform: string;
  locale: string;
  counts: TelemetryCounts;
  flags: TelemetryFlags;
}

export interface TelemetryPayload {
  installId: string;
  day: string;
  displayName: string | null;
  appVersion: string;
  platform: string;
  locale: string;
  counters: Record<string, number>;
  flags: Record<string, number>;
}

const MAX_NAME = 60;
const MAX_COUNT = 100_000_000;

/** UTC calendar day (YYYY-MM-DD) — the heartbeat throttle + DAU bucket key. */
export function utcDayKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/** One successful heartbeat per UTC day. */
export function shouldSendHeartbeat(lastSentDay: string | null, today: string): boolean {
  return lastSentDay !== today;
}

function clampCount(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(Math.floor(v), MAX_COUNT);
}

function cleanName(name: string | null): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  return trimmed === '' ? null : trimmed.slice(0, MAX_NAME);
}

/** Derive the adoption flags from settings booleans + the structural counts.
 *  Pure so the "what counts as using X" policy is unit-testable in isolation. */
export function deriveTelemetryFlags(input: {
  aiQuickEntryEnabled: boolean;
  cloudReceiptOcrEnabled: boolean;
  locationCaptureEnabled: boolean;
  appLockEnabled: boolean;
  isNative: boolean;
  splits: number;
  wallets: number;
}): TelemetryFlags {
  return {
    usesAI: input.aiQuickEntryEnabled,
    usesReceiptOcr: input.cloudReceiptOcrEnabled,
    usesSplit: input.splits > 0,
    usesWallets: input.wallets > 1,
    usesLocation: input.locationCaptureEnabled,
    usesAppLock: input.appLockEnabled,
    isNative: input.isNative,
  };
}

/** Assemble the JSON-ready heartbeat payload: clamps counts to safe integers,
 *  trims/limits the name, computes the UTC day. Output keys match the Worker
 *  contract exactly. */
export function buildTelemetryPayload(input: TelemetryInput): TelemetryPayload {
  const counters: Record<string, number> = {};
  for (const [key, value] of Object.entries(input.counts)) {
    counters[key] = clampCount(value);
  }
  const flags: Record<string, number> = {};
  for (const [key, value] of Object.entries(input.flags)) {
    flags[key] = value ? 1 : 0;
  }
  return {
    installId: input.installId,
    day: utcDayKey(input.nowMs),
    displayName: cleanName(input.displayName),
    appVersion: input.appVersion,
    platform: input.platform,
    locale: input.locale,
    counters,
    flags,
  };
}
