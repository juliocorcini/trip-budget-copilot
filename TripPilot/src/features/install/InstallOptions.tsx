import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { deviceBrowserFamily } from '@/utils/platform';
import { APK_URL, type InstallAudience } from './install-content';

function RecommendedBadge({ label }: { label: string }) {
  return (
    <span
      className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide shrink-0"
      style={{ background: 'rgba(22,163,74,0.16)', color: '#16a34a' }}
    >
      {label}
    </span>
  );
}

/**
 * Item A (DEC-362) — the platform-aware install CTAs. Android leads with the APK
 * (Julio's "sempre o mais recomendado") + a one-tap PWA fallback; iOS shows the
 * Safari A2HS infographic (+ a "use Safari" nudge off-Safari); desktop installs
 * the PWA. Reuses `useInstallPrompt` (no event re-capture) + the live APK URL.
 */
export function InstallOptions({ audience }: { audience: InstallAudience }) {
  const { t } = useTranslation();
  const { available, install } = useInstallPrompt();

  const runPwaInstall = async () => {
    const outcome = await install();
    if (outcome === 'unavailable') showToast(t('install.pwa_unavailable'), 'info');
    else if (outcome === 'dismissed') showToast(t('install.pwa_dismissed'), 'info');
  };

  if (audience === 'installed') {
    return (
      <div
        className="flex items-center gap-3 p-4 rounded-2xl"
        style={{ background: 'rgba(22,163,74,0.12)' }}
      >
        <Icon name="check_circle" size={22} style={{ color: '#16a34a' }} />
        <p className="text-sm font-semibold text-on-surface">{t('install.already_installed')}</p>
      </div>
    );
  }

  if (audience === 'ios') {
    const notSafari = deviceBrowserFamily() !== 'Safari';
    return (
      <div className="flex flex-col gap-3">
        {notSafari && (
          <div
            className="flex items-start gap-2 p-3 rounded-xl"
            style={{ background: 'rgba(217,119,6,0.14)' }}
          >
            <Icon name="warning" size={18} style={{ color: '#d97706' }} className="shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-on-surface">{t('install.ios_use_safari')}</p>
          </div>
        )}
        <p className="text-sm text-on-surface-dim leading-relaxed">{t('install.ios_intro')}</p>
        <img
          src="/guides/ios-install.png"
          alt={t('install.ios_alt')}
          loading="lazy"
          className="w-full rounded-2xl"
          style={{ border: '1px solid var(--surface-high)' }}
        />
      </div>
    );
  }

  const apkPrimary = audience === 'android';

  return (
    <div className="flex flex-col gap-3">
      {apkPrimary && (
        <a
          href={APK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full p-4 rounded-2xl flex items-center gap-3 btn-press bg-primary"
        >
          <Icon name="download" size={22} className="text-on-surface shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-extrabold text-on-surface">{t('install.apk_cta')}</span>
              <RecommendedBadge label={t('install.recommended')} />
            </div>
            <p className="text-[11px] font-semibold text-on-surface/80 leading-snug mt-0.5">
              {t('install.apk_note')}
            </p>
          </div>
        </a>
      )}

      {available ? (
        <button
          onClick={runPwaInstall}
          className="w-full p-4 rounded-2xl flex items-center gap-3 btn-press text-left"
          style={
            apkPrimary
              ? { background: 'var(--surface-high)' }
              : { background: 'var(--primary)' }
          }
        >
          <Icon
            name="install_mobile"
            size={22}
            className={`shrink-0 ${apkPrimary ? 'text-primary' : 'text-on-surface'}`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-extrabold text-on-surface">{t('install.pwa_cta')}</span>
              {!apkPrimary && <RecommendedBadge label={t('install.recommended')} />}
            </div>
            <p className="text-[11px] font-semibold text-on-surface-dim leading-snug mt-0.5">
              {t('install.pwa_note')}
            </p>
          </div>
        </button>
      ) : (
        !apkPrimary && (
          <p className="text-xs text-on-surface-dim leading-relaxed">{t('install.pwa_browser_hint')}</p>
        )
      )}

      {apkPrimary && (
        <p className="text-[11px] text-on-surface-faint leading-relaxed">{t('install.apk_fallback')}</p>
      )}
    </div>
  );
}
