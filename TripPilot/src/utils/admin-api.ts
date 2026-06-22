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
  locale: string | null;
  country: string | null;
  activeDays: number;
  counters: Record<string, number>;
  flags: Record<string, boolean>;
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

export async function deleteInstall(token: string, installId: string): Promise<void> {
  const res = await fetch(
    `${getSyncWorkerUrl()}/admin/install?id=${encodeURIComponent(installId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 401) throw new AdminAuthError();
  if (!res.ok) throw new Error(`admin_${res.status}`);
}
