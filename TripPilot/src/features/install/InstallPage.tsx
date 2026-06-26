import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/Icon';
import { InstallOptions } from './InstallOptions';
import { InstallComparison } from './InstallComparison';
import { installAudience } from './install-content';

/**
 * Item A (DEC-362) — the dedicated, shareable install landing. Lives OUTSIDE the
 * app shell (like /s/:id) so a cold visitor with no trip is never bounced to
 * onboarding. Composes the platform-aware CTAs + the App×PWA×Web comparison.
 */
export function InstallPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const audience = installAudience();

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/dashboard');
  };

  return (
    <div className="min-h-[100dvh] bg-surface text-on-surface">
      <div
        className="mx-auto max-w-[430px] px-[var(--page-padding-x)] pb-[calc(32px+var(--safe-bottom))]"
        style={{ paddingTop: 'calc(16px + var(--safe-top))' }}
      >
        <header className="flex items-center gap-1 -ml-2 mb-4">
          <button
            onClick={goBack}
            aria-label={t('common.back')}
            className="w-10 h-10 flex items-center justify-center rounded-full btn-press text-on-surface"
          >
            <Icon name="arrow_back" size={24} />
          </button>
          <h1 className="text-base font-bold">{t('install.page_title')}</h1>
        </header>

        <div
          className="flex flex-col items-center text-center gap-2 py-4 mb-5 rounded-3xl"
          style={{ background: 'var(--surface-container)' }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--primary)' }}
          >
            <Icon name="install_mobile" size={30} className="text-on-surface" />
          </div>
          <h2 className="text-lg font-extrabold px-6">{t('install.hero_title')}</h2>
          <p className="text-[13px] text-on-surface-dim leading-relaxed px-6">
            {t('install.hero_subtitle')}
          </p>
        </div>

        <InstallOptions audience={audience} />

        <h3 className="text-sm font-bold text-on-surface mt-7 mb-2.5">{t('install.compare_title')}</h3>
        <InstallComparison audience={audience} />

        <p className="text-[11px] text-on-surface-faint leading-relaxed mt-4">
          {t('install.footer_note')}
        </p>
      </div>
    </div>
  );
}
