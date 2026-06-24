import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { generateDemoData } from '@/domain/demo';
import { db } from '@/data/db/database';
import { appSettingsRepository } from '@/data/repositories';
import { Icon } from '@/components/Icon';

export function WelcomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip, reload } = useAppData();

  const handleDemo = async () => {
    const deviceId = crypto.randomUUID();
    const demo = generateDemoData(deviceId);

    await db.trips.add(demo.trip);
    await db.phases.bulkAdd(demo.phases);
    await db.budgetPools.bulkAdd(demo.pools);
    await db.budgetPoolPhaseLinks.bulkAdd(demo.links);
    await db.envelopes.bulkAdd(demo.envelopes);
    await db.participants.bulkAdd(demo.participants);
    await db.wallets.bulkAdd(demo.wallets);
    await db.transactions.bulkAdd(demo.transactions);
    await db.activityProfiles.bulkAdd(demo.profiles);
    await db.participantShares.bulkAdd(demo.shares);
    await db.sessions.bulkAdd(demo.sessions);
    await db.sessionItems.bulkAdd(demo.sessionItems);
    await db.settlements.bulkAdd(demo.settlements);

    await appSettingsRepository.update({
      activeTrip: demo.trip.id,
      onboardingCompleted: true,
      isDemo: true,
    });

    await reload();
    navigate('/dashboard');
  };

  // BUG-001: reaching /welcome with an active trip (cold start, manual nav)
  // must never expose the destructive onboarding menu — go to the dashboard.
  if (trip) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-10 gap-8">
      <div className="text-center">
        <Icon name="flight_takeoff" size={48} className="text-primary mb-4" />
        <h1 className="text-display font-bold text-on-surface">{t('onboarding.welcome_title')}</h1>
        <p className="text-sm text-on-surface-dim mt-2">{t('onboarding.welcome_subtitle')}</p>
        {/* M23: one concrete value line under the title. */}
        <p className="text-sm text-on-surface mt-3 max-w-xs mx-auto leading-snug">
          {t('onboarding.welcome_value')}
        </p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-3">
        {/* DEC-290: two primary choices — a dated trip OR a continuous day-to-day
            space. The trip×daily fork (NewSpacePage) now greets the first run. */}
        <PrimaryChoice
          icon="luggage"
          title={t('onboarding.create_trip')}
          desc={t('onboarding.create_trip_desc')}
          onClick={() => navigate('/onboarding')}
        />
        <PrimaryChoice
          icon="event_repeat"
          title={t('onboarding.start_daily')}
          desc={t('onboarding.start_daily_desc')}
          onClick={() => navigate('/onboarding?kind=ongoing')}
        />

        {/* DEC-290 / Â9: nothing is removed — import, receive and demo stay, just
            demoted to a clearly lighter "I already have data" tier. */}
        <div className="mt-2 pt-4 border-t border-surface-high flex flex-col gap-1">
          <p className="text-xs font-medium text-on-surface-faint px-1 mb-1">
            {t('onboarding.have_data_label')}
          </p>
          <SecondaryChoice
            icon="cloud_upload"
            label={t('onboarding.import_backup')}
            onClick={() => navigate('/settings/backup')}
          />
          <SecondaryChoice
            icon="sync_alt"
            label={t('onboarding.receive_from_device')}
            onClick={() => navigate('/sync')}
          />
        </div>

        {/* M20: the demo entry must read as tappable, not disabled. */}
        <button
          onClick={handleDemo}
          className="mt-1 self-center inline-flex items-center gap-1.5 text-sm font-semibold text-primary btn-press py-2 px-3"
        >
          <Icon name="play_circle" size={18} className="text-primary" />
          {t('onboarding.load_demo')}
        </button>
      </div>
    </div>
  );
}

function PrimaryChoice({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: string;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-surface-container rounded-2xl p-4 flex items-center gap-3 text-left btn-press ring-1 ring-transparent hover:ring-primary"
    >
      <span
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'var(--primary-subtle)' }}
      >
        <Icon name={icon} size={24} className="text-primary" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-on-surface">{title}</span>
        <span className="block text-xs text-on-surface-dim mt-0.5">{desc}</span>
      </span>
      <Icon name="chevron_right" size={20} className="text-on-surface-faint shrink-0" />
    </button>
  );
}

function SecondaryChoice({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 py-2.5 px-3 rounded-xl text-on-surface-dim btn-press"
    >
      <Icon name={icon} size={18} className="text-on-surface-faint shrink-0" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
