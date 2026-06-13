// BUG-011: a new Service Worker reload must never tear down a live outing.
// The flag below is flipped by OutingPage while a session is active. When a
// controllerchange fires (the user accepted an update), the SW reload handler
// asks shouldReloadOnUpdate(): if an outing is active it defers, and the reload
// is applied the moment the outing ends (takePendingReload). State is kept in
// module memory on purpose — both the reload handler and OutingPage share the
// same window/module instance, so no fragile sessionStorage is needed.

let activeOuting = false;
let pendingReload = false;

/** OutingPage marks whether a session is currently active. */
export function setActiveOuting(active: boolean): void {
  activeOuting = active;
}

export function isActiveOuting(): boolean {
  return activeOuting;
}

/**
 * Called from the controllerchange handler. Returns true when the caller should
 * reload now; false when an outing is active, in which case the reload is
 * remembered and applied later via takePendingReload().
 */
export function shouldReloadOnUpdate(): boolean {
  if (activeOuting) {
    pendingReload = true;
    return false;
  }
  return true;
}

export function isReloadPending(): boolean {
  return pendingReload;
}

/**
 * Called when an outing ends. Returns true once if an update arrived during the
 * outing and a reload is now due; clears the pending flag so it fires only once.
 */
export function takePendingReload(): boolean {
  if (pendingReload) {
    pendingReload = false;
    return true;
  }
  return false;
}

/** Test helper — resets the module state between cases. */
export function resetSwReloadState(): void {
  activeOuting = false;
  pendingReload = false;
}
