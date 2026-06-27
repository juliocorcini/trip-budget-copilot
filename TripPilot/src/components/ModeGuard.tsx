import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Icon } from './Icon';
import { useAppData } from '@/hooks/useAppData';
import { isAdvancedRouteBlocked } from '@/domain/app-mode';

/**
 * M20: wraps advanced routes so simple mode shows an interstitial instead of
 * the page. The route still exists (ÂNCORA 9) — "open anyway" is a per-visit
 * escape hatch that never changes the saved preference (ÂNCORA 11).
 */
export function ModeGuard({ children }: { children: ReactNode }) {
  const { settings } = useAppData();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [override, setOverride] = useState(false);

  const appMode = settings?.appMode ?? 'complete';
  if (!isAdvancedRouteBlocked(appMode, override)) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center mb-5">
        <Icon name="auto_awesome" size={28} className="text-primary" />
      </div>
      <h1 className="text-xl font-bold text-on-surface">{t('mode_guard.title')}</h1>
      <p className="mt-2 text-sm text-on-surface-dim max-w-xs">{t('mode_guard.body')}</p>

      <div className="mt-7 w-full max-w-xs flex flex-col gap-3">
        <button
          onClick={() => setOverride(true)}
          className="w-full py-3.5 rounded-2xl bg-primary text-on-surface font-bold btn-press"
        >
          {t('mode_guard.open_anyway')}
        </button>
        <button
          onClick={() => navigate('/settings/c/preferences?section=mode')}
          className="w-full py-3 rounded-xl bg-surface-container text-on-surface-dim font-semibold text-sm btn-press"
        >
          {t('mode_guard.go_settings')}
        </button>
        <button
          onClick={() => navigate(-1)}
          className="w-full py-2 text-on-surface-faint font-semibold text-sm btn-press"
        >
          {t('common.back')}
        </button>
      </div>
    </div>
  );
}
