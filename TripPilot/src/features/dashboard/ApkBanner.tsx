import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { isNativeApp } from '@/utils/native/platform';
import { isStandaloneDisplayMode } from '@/utils/platform';
import { installAudience, APK_URL } from '@/features/install/install-content';

const STORAGE_KEY = 'tp.apk.banner';
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

interface BannerState {
  dismissedAt?: number;
  never?: boolean;
}

function readState(): BannerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const state: BannerState = {};
    if (typeof parsed.dismissedAt === 'number') state.dismissedAt = parsed.dismissedAt;
    if (parsed.never === true) state.never = true;
    return state;
  } catch {
    return {};
  }
}

function shouldShow(): boolean {
  if (isNativeApp() || isStandaloneDisplayMode()) return false;
  if (installAudience() !== 'android') return false;
  const state = readState();
  if (state.never) return false;
  if (state.dismissedAt && Date.now() - state.dismissedAt < SNOOZE_MS) return false;
  return true;
}

export function ApkBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(shouldShow);

  if (!visible) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ dismissedAt: Date.now() }));
    setVisible(false);
  };

  const handleNever = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ never: true }));
    setVisible(false);
  };

  return (
    <div
      className="mt-4 p-4 rounded-2xl flex flex-col gap-3"
      style={{ background: 'var(--surface-container)', border: '1px solid var(--border-faint)' }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: '#C75B3920' }}
        >
          <Icon name="download" size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-on-surface">{t('dashboard.apk_banner_title')}</p>
          <p className="text-xs text-on-surface-dim mt-0.5">{t('dashboard.apk_banner_body')}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <a
          href={APK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-2.5 rounded-xl bg-primary text-center text-sm font-bold text-on-surface btn-press"
        >
          {t('dashboard.apk_banner_cta')}
        </a>
        <button
          onClick={handleDismiss}
          className="py-2.5 px-3 rounded-xl text-xs font-semibold text-on-surface-dim btn-press"
          style={{ background: 'var(--surface-high)' }}
        >
          {t('dashboard.apk_banner_dismiss')}
        </button>
      </div>

      <button
        onClick={handleNever}
        className="text-[11px] text-on-surface-faint btn-press self-center"
      >
        {t('dashboard.apk_banner_never')}
      </button>
    </div>
  );
}
