import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { router } from './app/router';
import { ToastHost } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerServiceWorker } from './utils/pwa';
import { appSettingsRepository } from './data/repositories';
import i18n from './i18n';
import './styles/globals.css';

registerServiceWorker();

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
