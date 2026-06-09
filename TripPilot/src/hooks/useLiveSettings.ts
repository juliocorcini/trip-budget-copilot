import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db/database';
import type { AppSettings } from '@/domain/types/app-settings';

const SETTINGS_ID = 'app-settings';

/**
 * Live settings via Dexie liveQuery (GAP-013, decision D-F): any screen that
 * writes settings is immediately reflected wherever this hook is mounted
 * (theme, language, alert tone) without a page refresh.
 */
export function useLiveSettings(): AppSettings | undefined {
  return useLiveQuery(() => db.appSettings.get(SETTINGS_ID), []);
}
