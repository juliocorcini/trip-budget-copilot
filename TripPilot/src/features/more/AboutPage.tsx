import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/Icon';
import { APP_VERSION } from '@/utils/app-version';

// DEC-059 (GAP-023, decision D-D): dedicated About entry — no Reports in D1/D2.
export function AboutPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4 pb-4 pt-2">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('about.title')}</h1>
      </div>

      <div className="bg-surface-container rounded-2xl p-6 text-center">
        <div
          className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3"
          style={{ background: '#C75B3918' }}
        >
          <Icon name="flight_takeoff" size={28} className="text-primary" />
        </div>
        <p className="text-lg font-extrabold text-on-surface">TripPilot</p>
        <p className="text-xs text-on-surface-dim mt-1">{t('about.version', { version: APP_VERSION })}</p>
        <p className="text-xs text-on-surface-faint mt-3">{t('about.description')}</p>
      </div>

      <button
        onClick={() => navigate('/settings/backup')}
        className="bg-surface-container rounded-xl px-4 py-3 flex items-center gap-3 btn-press text-left"
      >
        <Icon name="cloud_upload" size={20} className="text-on-surface-dim" />
        <span className="text-sm text-on-surface flex-1">{t('about.backup_link')}</span>
        <Icon name="chevron_right" size={18} className="text-on-surface-faint" />
      </button>

      <p className="text-[10px] text-on-surface-faint text-center px-6">{t('about.local_first')}</p>
    </div>
  );
}
