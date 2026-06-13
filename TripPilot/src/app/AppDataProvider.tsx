import type { ReactNode } from 'react';
import { AppDataContext, useAppDataState } from '@/hooks/useAppData';

// BUG-007: runs the app-data loader exactly once and shares the snapshot with
// every consumer through context. Mounted in RootLayout, above all routes, so
// the Dashboard route no longer triggers two full IndexedDB loads (page +
// useNotifications) and a single reload propagates one re-render cascade.
export function AppDataProvider({ children }: { children: ReactNode }) {
  const value = useAppDataState();
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
