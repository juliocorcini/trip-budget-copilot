import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from './app/router';
import { ToastHost } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerServiceWorker, requestPersistentStorage } from './utils/pwa';
import { registerOutingNotificationBridge } from './utils/outing-notification';
import { appSettingsRepository } from './data/repositories';
import i18n from './i18n';
import './styles/globals.css';

registerServiceWorker();

// DEC-120 (R-11): notification action clicks delegated by the SW when a
// window is open are handled through the full domain flow.
registerOutingNotificationBridge();

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
