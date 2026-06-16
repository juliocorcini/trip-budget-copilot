import { visibleInMode, type ModeAware } from '@/domain/app-mode';
import type { AppMode } from '@/domain/types/common';

/**
 * FIELD-02: single source of truth for the primary bottom-nav tabs, in swipe
 * order (left → right). The BottomNav renders them split around the FAB; the
 * global swipe pager (AppShell) and the in-page handoff (Expenses/Viagem) all
 * read this same list so a left/right swipe always matches the visual order.
 *
 * Copiloto is advanced: in simple mode it drops out of both the bar and the
 * swipe chain (so the chain becomes Início · Gastos · Viagem). The route still
 * exists (ÂNCORA 9 — nothing is removed, only hidden).
 */
export interface AppTab extends ModeAware {
  path: string;
}

const APP_TABS: AppTab[] = [
  { path: '/dashboard' },
  { path: '/expenses' },
  { path: '/viagem' },
  { path: '/copiloto', advanced: true },
];

export function tabsForMode(appMode: AppMode): AppTab[] {
  return visibleInMode(APP_TABS, appMode);
}
