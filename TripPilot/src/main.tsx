import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from './app/router';
import { ToastHost } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerServiceWorker, requestPersistentStorage, captureInstallPrompt } from './utils/pwa';
import {
  registerOutingNotificationBridge,
  syncActiveOutingNotification,
} from './utils/outing-notification';
import {
  registerCheckInNotificationBridge,
  maybeShowCheckInPrompt,
} from './utils/check-in-notification';
import { registerSplitNotificationBridge } from './utils/split-notification';
import { appSettingsRepository } from './data/repositories';
import { recordCrash, describeError } from './utils/crash-log';
import { initNativeShell } from './utils/native';
import { registerMailboxSync } from './utils/mailbox-boot';
import { registerLiveUpdate } from './utils/live-update-boot';
import i18n from './i18n';
import './styles/globals.css';

// BUG-017: capture errors that never reach the React ErrorBoundary (async
// rejections, event handlers, non-React code) into the same crash buffer so
// the boundary's loop detection sees the full picture.
window.addEventListener('error', (event) => {
  recordCrash(describeError(event.error ?? event.message));
});
window.addEventListener('unhandledrejection', (event) => {
  recordCrash(describeError(event.reason));
});

// DEC-191/192/193: one-time native shell setup (status bar overlay + hardware
// back button). No-op on the web build.
initNativeShell();

registerServiceWorker();

// DEC-135: beforeinstallprompt fires once and early — capture it at boot so
// the in-app "add to home screen" button can replay it later.
captureInstallPrompt();

// DEC-120 + DEC-124 (R-11 v2): SW broadcasts (notification actions wrote to
// the DB) refresh open pages; on boot an active outing re-shows its
// notification no matter which screen the user lands on.
registerOutingNotificationBridge();
syncActiveOutingNotification();

// M8 (E5): check-in action writes refresh open pages; a best-effort morning
// reminder fires at most once a day (true scheduling needs push — local-first).
registerCheckInNotificationBridge();
maybeShowCheckInPrompt();

// Live bill split: keep the persistent "a divisão está rolando" notification in
// step with the active table from any screen (shows on boot if one is live).
registerSplitNotificationBridge();

// DEC-111 (R5-03): ask for durable storage as early as possible — without it
// the OS may evict IndexedDB and the user genuinely loses everything.
requestPersistentStorage();

// FIELD item 8: drain the encrypted mailbox on open (default-on) + whenever we
// regain connectivity or focus, so split notifications and backups arrive
// without both phones being online at once.
registerMailboxSync();

// FIELD item 20 (G8b): on a native cold start, confirm the running OTA bundle is
// healthy and pull a newer web bundle from Pages when one is published (no-op on
// web/PWA — the service worker handles those).
registerLiveUpdate();

// GAP-014: restore the persisted language on boot (before most screens mount).
appSettingsRepository.get().then((settings) => {
  if (i18n.language !== settings.language) {
    i18n.changeLanguage(settings.language);
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
      {/* DEC-195: overlay host for portaled sheets — INSIDE #root so it keeps the
          cap-native zoom, but OUTSIDE the routed page so the page transition's
          transform can never trap a `position: fixed` sheet at the page bottom. */}
      <div id="app-overlay-root" />
      <ToastHost />
    </ErrorBoundary>
  </StrictMode>,
);
