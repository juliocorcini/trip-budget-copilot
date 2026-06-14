import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { canHardReload, escalateToReload } from '@/data/db/db-recovery';

/**
 * DEC-170: resilient `React.lazy`. A code-split chunk can fail to load when a
 * fresh index.html (served network-first right after a deploy) references a
 * hashed chunk that the cache does not have yet and the network is flaky — a
 * plain `lazy()` then throws to the ErrorBoundary on every navigation. We retry
 * the dynamic import a couple of times, and on a persistent failure trigger ONE
 * bounded reload so the service worker pulls a consistent index.html + chunks.
 * The reload budget is shared with the DB recovery ladder, so nothing can ever
 * loop; once it is spent the error rethrows and the ErrorBoundary shows its
 * own recovery (clear cache / emergency export).
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
  delayMs = 350,
): LazyExoticComponent<T> {
  return lazy(async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await factory();
      } catch (err) {
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
          continue;
        }
        if (canHardReload()) {
          escalateToReload();
          // Let the reload navigate away; if it somehow does not, fall through.
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        throw err;
      }
    }
  });
}
