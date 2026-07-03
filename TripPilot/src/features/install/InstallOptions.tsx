import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { deviceBrowserFamily } from '@/utils/platform';
import { APK_URL, type InstallAudience } from './install-content';
import {
  manualInstallStepKeys,
  manualInstallTitleKey,
  resolveInstallGuideFamily,
} from './install-guide';

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

/** DEC-444 (PWA-2) — per-browser numbered steps shown when the native prompt is unavailable. */
function ManualInstallGuide() {
  const { t } = useTranslation();
  const family = resolveInstallGuideFamily({
    browser: deviceBrowserFamily(),
    isAndroid: /Android/i.test(navigator.userAgent),
  });

  return (
    <div className="p-4 rounded-2xl flex flex-col gap-2.5" style={{ background: 'var(--surface-high)' }}>
      <p className="text-xs font-extrabold uppercase tracking-wide text-on-surface-dim">
        {t(manualInstallTitleKey(family))}
      </p>
      <ol className="flex flex-col gap-2">
        {manualInstallStepKeys(family).map((stepKey, index) => (
          <li key={stepKey} className="flex items-start gap-2.5">
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 mt-0.5"
              style={{ background: 'var(--primary-subtle)', color: 'var(--primary)' }}
            >
              {index + 1}
            </span>
            <span className="text-[13px] font-semibold text-on-surface leading-snug">{t(stepKey)}</span>
          </li>
        ))}
      </ol>
    </div>
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
  const [showGuide, setShowGuide] = useState(false);

  const runPwaInstall = async () => {
    const outcome = await install();
    if (outcome === 'unavailable') showToast(t('install.pwa_unavailable'), 'info');
    else if (outcome === 'dismissed') showToast(t('install.pwa_dismissed'), 'info');
  };

  // PWA-2 (DEC-444): the fallback CTA is ACTIVE — it still tries the native
  // prompt first (it may have arrived after mount), and only then opens the
  // per-browser step-by-step. Never a dead static hint again.
  const runShortcutInstall = async () => {
    const outcome = await install();
    if (outcome === 'unavailable') setShowGuide((current) => !current);
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
        /* DEC-364 (A5) + DEC-444 (PWA-2): when the browser didn't fire the
           auto-prompt, the CTA stays a real BUTTON — it retries the native
           prompt and, if the platform truly won't offer it, expands an honest
           per-browser step-by-step (Julio: "se o app não deu certo, instale o
           atalho — o que importa é ter o app instalado"). */
        <>
          <button
            onClick={runShortcutInstall}
            className="w-full p-4 rounded-2xl flex items-center gap-3 btn-press text-left"
            style={apkPrimary ? { background: 'var(--surface-high)' } : { background: 'var(--primary)' }}
          >
            <Icon
              name="install_mobile"
              size={22}
              className={`shrink-0 ${apkPrimary ? 'text-primary' : 'text-on-surface'}`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[15px] font-extrabold text-on-surface">{t('install.shortcut_cta')}</span>
                {!apkPrimary && <RecommendedBadge label={t('install.recommended')} />}
              </div>
              <p className="text-[11px] font-semibold text-on-surface-dim leading-snug mt-0.5">
                {t('install.shortcut_note')}
              </p>
            </div>
            <Icon
              name={showGuide ? 'expand_less' : 'expand_more'}
              size={20}
              className={`shrink-0 ${apkPrimary ? 'text-on-surface-dim' : 'text-on-surface'}`}
            />
          </button>
          {showGuide && <ManualInstallGuide />}
        </>
      )}

      {apkPrimary && (
        <p className="text-[11px] text-on-surface-faint leading-relaxed">{t('install.apk_fallback')}</p>
      )}
    </div>
  );
}
