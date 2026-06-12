import { useEffect, useState } from 'react';
import {
  isInstallPromptAvailable,
  subscribeInstallPromptAvailability,
  promptAppInstall,
} from '@/utils/pwa';
import { isStandaloneDisplayMode } from '@/utils/platform';

/**
 * DEC-135: surfaces the captured `beforeinstallprompt` to the UI. `available`
 * is true only when the app is NOT already installed and the browser offered
 * the prompt (Chrome/Edge on Android — iOS never fires it).
 */
export function useInstallPrompt(): {
  available: boolean;
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
} {
  const [available, setAvailable] = useState(
    () => isInstallPromptAvailable() && !isStandaloneDisplayMode(),
  );

  useEffect(() => {
    const sync = () => setAvailable(isInstallPromptAvailable() && !isStandaloneDisplayMode());
    sync();
    return subscribeInstallPromptAvailability(sync);
  }, []);

  return { available, install: promptAppInstall };
}
