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
import { appSettingsRepository } from './data/repositories';
import { recordCrash, describeError } from './utils/crash-log';
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

registerServiceWorker();

// DEC-135: beforeinstallprompt fires once and early — capture it at boot so
// the in-app "add to home screen" button can replay it later.
captureInstallPrompt();

// DEC-120 + DEC-124 (R-11 v2): SW broadcasts (notification actions wrote to
// the DB) refresh open pages; on boot an active outing re-shows its
// notification no matter which screen the user lands on.
registerOutingNotificationBridge();
syncActiveOutingNotification();

// DEC-111 (R5-03): ask for durable storage as early as possible — without it
// the OS may evict IndexedDB and the user genuinely loses everything.
requestPersistentStorage();

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
      <ToastHost />
    </ErrorBoundary>
  </StrictMode>,
);
