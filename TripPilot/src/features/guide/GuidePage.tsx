import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/Icon';
import { GUIDE_SECTIONS } from '@/domain/guide';

/**
 * G7 — "Everything you can do". Renders the feature catalog (domain) as
 * grouped, tappable rows so every capability is discoverable in one place and
 * one tap away. Pure presentation — the catalog is the single source of truth.
 */
export function GuidePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4 pb-6 pt-2">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('guide.title')}</h1>
      </div>

      <p className="text-sm text-on-surface-dim leading-relaxed px-1">{t('guide.intro')}</p>

      {GUIDE_SECTIONS.map((section) => (
        <div key={section.id}>
          <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider px-1 mb-2">
            {t(section.titleKey as never)}
          </p>
          <div className="bg-surface-container rounded-2xl overflow-hidden">
            {section.entries.map((entry, index) => (
              <button
                key={entry.id}
                onClick={() => navigate(entry.route)}
                className="w-full flex items-center gap-3 px-4 py-3 btn-press text-left"
                style={
                  index > 0 ? { borderTop: '1px solid var(--border-faint)' } : undefined
                }
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: '#C75B3914' }}
                >
                  <Icon name={entry.icon} size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-on-surface">{t(entry.titleKey as never)}</p>
                  <p className="text-xs text-on-surface-dim leading-snug mt-0.5">
                    {t(entry.descKey as never)}
                  </p>
                </div>
                <Icon name="chevron_right" size={18} className="text-on-surface-faint shrink-0" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
