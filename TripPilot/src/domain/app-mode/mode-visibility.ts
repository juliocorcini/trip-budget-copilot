import type { AppMode } from '@/domain/types/common';

/**
 * E1 (M19/M20): shared mode-visibility rules. Simple mode HIDES advanced
 * surfaces — it never removes data or routes (ÂNCORA 9). Items flagged
 * `advanced` disappear from nav/menus in simple mode; advanced routes are
 * gated (with an "open anyway" escape) rather than blocked.
 */
export interface ModeAware {
  advanced?: boolean;
  /**
   * C06/DEC-298: shown ONLY in simple mode. The bottom nav uses this so Settings
   * can take the slot the (advanced) Copilot vacates in simple mode, keeping the
   * bar symmetric (2+2: Início, Gastos · + · Viagem, Ajustes). In complete mode
   * the header gear already owns Settings, so it stays out of the bar.
   */
  simpleOnly?: boolean;
}

export function visibleInMode<T extends ModeAware>(items: T[], appMode: AppMode): T[] {
  if (appMode === 'simple') return items.filter((item) => !item.advanced);
  return items.filter((item) => !item.simpleOnly);
}

/** True when an advanced route should show the guard instead of its page. */
export function isAdvancedRouteBlocked(appMode: AppMode, override: boolean): boolean {
  return appMode === 'simple' && !override;
}
