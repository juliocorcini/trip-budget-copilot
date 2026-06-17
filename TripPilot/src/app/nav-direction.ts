// D-BUG-10: page-transition direction. By default `useNavDirection` infers it
// from React Router's monotonic history `idx` — fine for push/pop of sub-pages,
// but a bottom-bar tab switch is ALWAYS a push, so going from Viagem back to
// Início used to animate "forward" (enter from the right) like every other tab.
//
// A tab switch must read by TAB ORDER instead: moving to a tab on the RIGHT is
// "forward", to the LEFT is "back". The tab navigators (BottomNav tap, the swipe
// pager via useTabPaging) record that intent here just before navigating; the
// next `useNavDirection` run consumes it and overrides the idx-based guess for
// that one navigation only (so normal sub-page nav is untouched).

export type NavDirection = 'forward' | 'back';

let pendingTabDirection: NavDirection | null = null;

/** A tab navigator records the swipe-order direction right before navigate(). */
export function setPendingTabDirection(direction: NavDirection): void {
  pendingTabDirection = direction;
}

/** `useNavDirection` reads (and clears) the override for the next transition. */
export function consumePendingTabDirection(): NavDirection | null {
  const direction = pendingTabDirection;
  pendingTabDirection = null;
  return direction;
}

/**
 * The index of the tab that owns `path` (its root, or any sub-page under it),
 * or -1 when `path` is not under any tab. Pure.
 */
export function resolveTabIndex(path: string, tabPaths: string[]): number {
  return tabPaths.findIndex((tabPath) => path === tabPath || path.startsWith(`${tabPath}/`));
}

/**
 * Direction of a tab switch by swipe order: `forward` toward a higher index,
 * `back` toward a lower one. Returns null when it is NOT a tab→tab move (same
 * tab, or either side is outside the tab set) so the caller leaves the default
 * idx-based behavior in place. Pure.
 */
export function tabSwitchDirection(
  fromPath: string,
  toPath: string,
  tabPaths: string[],
): NavDirection | null {
  const from = resolveTabIndex(fromPath, tabPaths);
  const to = resolveTabIndex(toPath, tabPaths);
  if (from < 0 || to < 0 || from === to) return null;
  return to > from ? 'forward' : 'back';
}
