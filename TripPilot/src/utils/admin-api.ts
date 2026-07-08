import { getSyncWorkerUrl } from '@/data/sync/config';

/**
 * DEC-248 — read-only client for the admin telemetry endpoints. The bearer
 * token is the Worker `ADMIN_TOKEN` secret; it is held only in the admin screen
 * (localStorage) and sent per request. Every call is gated server-side, so this
 * boundary just shapes responses and distinguishes a bad token (401) from other
 * failures.
 */

export interface AdminDistribution {
  key: string;
  count: number;
}

export interface AdminOverview {
  total: number;
  dau: number;
  wau: number;
  mau: number;
  new7d: number;
  counters: Record<string, number>;
  flags: Record<string, number>;
  platforms: AdminDistribution[];
  versions: AdminDistribution[];
  countries: AdminDistribution[];
  generatedAt: number;
}

export interface AdminInstall {
  installId: string;
  displayName: string | null;
  firstSeen: number;
  lastSeen: number;
  appVersion: string | null;
  platform: string | null;
  // FB-21 (DEC-274) — coarse browser family (e.g. "Chrome"); null on old rows.
  browser: string | null;
  locale: string | null;
  country: string | null;
  activeDays: number;
  counters: Record<string, number>;
  flags: Record<string, boolean>;
  // DEC-251 (Onda B) — server-authoritative AI spend for this install.
  aiTokens: number;
  aiCalls: number;
}

export interface AdminInstallsResult {
  installs: AdminInstall[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminTimeseriesPoint {
  day: string;
  dau: number;
}

export interface AdminTimeseriesResult {
  series: AdminTimeseriesPoint[];
}

// DEC-251 (Onda B) — server-authoritative AI token accounting.
export interface AdminAiUsageByFn {
  fn: string;
  tokens: number;
  runs: number;
}

export interface AdminAiUsageDay {
  day: string;
  tokens: number;
  runs: number;
}

export interface AdminAiUsageUser {
  installId: string;
  displayName: string | null;
  tokens: number;
  runs: number;
  // FB-19 (DEC-272) — true for the all-zeros sentinel (probe/scanner), so the UI
  // names it and keeps it out of the real user ranking.
  isSystem?: boolean;
}

export interface AdminAiUsageResult {
  totals: { tokens: number; runs: number };
  byFn: AdminAiUsageByFn[];
  series: AdminAiUsageDay[];
  topUsers: AdminAiUsageUser[];
}

// FB-17 (DEC-272) — per-function token/run breakdown for ONE install.
export interface AdminInstallDetail {
  installId: string;
  byFn: AdminAiUsageByFn[];
  isSystem: boolean;
}

// FB-21 (DEC-274) — the distinct errors a single install has hit.
export interface AdminInstallError {
  hash: string;
  message: string;
  count: number;
  lastSeen: number;
  appVersion: string | null;
  platform: string | null;
}

export interface AdminInstallErrorsResult {
  installId: string;
  errors: AdminInstallError[];
}

// FB-18 (DEC-273) — Groq governance rollups + real free-tier limits.
export interface AdminGroqLimit {
  rpd: number;
  tpm: number;
  label: string;
}

export interface AdminGovernance {
  today: string;
  month: string;
  todayTokens: number;
  todayRuns: number;
  monthTokens: number;
  monthRuns: number;
  activeToday: number;
  byFnToday: AdminAiUsageByFn[];
  limits: Record<string, AdminGroqLimit>;
}

// DEC-251 (Onda B) — anonymous error capture (deduped by message hash).
export interface AdminError {
  hash: string;
  message: string;
  count: number;
  users: number;
  firstSeen: number;
  lastSeen: number;
  appVersion: string | null;
  platform: string | null;
}

export interface AdminErrorsResult {
  errors: AdminError[];
  total: number;
}

/** Thrown on a 401 so the UI can clear a stale/wrong token and re-prompt. */
export class AdminAuthError extends Error {
  constructor() {
    super('admin_unauthorized');
    this.name = 'AdminAuthError';
  }
}

async function adminGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${getSyncWorkerUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new AdminAuthError();
  if (!res.ok) throw new Error(`admin_${res.status}`);
  return (await res.json()) as T;
}

export function fetchOverview(token: string): Promise<AdminOverview> {
  return adminGet<AdminOverview>(token, '/admin/overview');
}

export function fetchInstalls(token: string, limit = 200): Promise<AdminInstallsResult> {
  return adminGet<AdminInstallsResult>(token, `/admin/installs?limit=${limit}`);
}

export function fetchTimeseries(token: string, days = 30): Promise<AdminTimeseriesResult> {
  return adminGet<AdminTimeseriesResult>(token, `/admin/timeseries?days=${days}`);
}

export function fetchAiUsage(token: string, days = 30): Promise<AdminAiUsageResult> {
  return adminGet<AdminAiUsageResult>(token, `/admin/ai-usage?days=${days}`);
}

export function fetchErrors(token: string, limit = 100): Promise<AdminErrorsResult> {
  return adminGet<AdminErrorsResult>(token, `/admin/errors?limit=${limit}`);
}

export function fetchInstallDetail(token: string, installId: string): Promise<AdminInstallDetail> {
  return adminGet<AdminInstallDetail>(token, `/admin/install-detail?id=${encodeURIComponent(installId)}`);
}

export function fetchInstallErrors(token: string, installId: string): Promise<AdminInstallErrorsResult> {
  return adminGet<AdminInstallErrorsResult>(token, `/admin/install-errors?id=${encodeURIComponent(installId)}`);
}

export function fetchGovernance(token: string): Promise<AdminGovernance> {
  return adminGet<AdminGovernance>(token, '/admin/ai-governance');
}

export interface AdminGhostSignal {
  installId: string;
  sources: string[];
  aiTokens: number;
  aiCalls: number;
  aiFns: { fn: string; tokens: number; runs: number }[];
  errorCount: number;
  errorMessages: string[];
  heartbeatDays: string[];
  platforms: string[];
  versions: string[];
  firstSeen: number | null;
  lastSeen: number | null;
}

export interface AdminGhostSignalsResult {
  signals: AdminGhostSignal[];
  total: number;
}

export function fetchGhostSignals(token: string): Promise<AdminGhostSignalsResult> {
  return adminGet<AdminGhostSignalsResult>(token, '/admin/ghost-signals');
}

export async function deleteInstall(token: string, installId: string): Promise<void> {
  const res = await fetch(
    `${getSyncWorkerUrl()}/admin/install?id=${encodeURIComponent(installId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 401) throw new AdminAuthError();
  if (!res.ok) throw new Error(`admin_${res.status}`);
}
