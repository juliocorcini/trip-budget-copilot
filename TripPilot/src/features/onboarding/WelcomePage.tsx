import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { generateDemoData } from '@/domain/demo';
import { db } from '@/data/db/database';
import { appSettingsRepository } from '@/data/repositories';
import { Icon } from '@/components/Icon';

export function WelcomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { reload } = useAppData();

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

    await appSettingsRepository.update({
      activeTrip: demo.trip.id,
      onboardingCompleted: true,
      isDemo: true,
    });

    await reload();
    navigate('/dashboard');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-8">
      <div className="text-center">
        <Icon name="flight_takeoff" size={48} className="text-primary mb-4" />
        <h1 className="text-display font-bold text-on-surface">{t('onboarding.welcome_title')}</h1>
        <p className="text-sm text-on-surface-dim mt-2">{t('onboarding.welcome_subtitle')}</p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-3">
        <button
          onClick={() => navigate('/onboarding')}
          className="w-full py-4 rounded-2xl bg-primary text-on-surface font-semibold text-sm btn-press"
        >
          {t('onboarding.create_trip')}
        </button>

        <label className="w-full py-4 rounded-2xl bg-surface-container text-on-surface font-medium text-sm text-center btn-press cursor-pointer block">
          {t('onboarding.import_backup')}
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              navigate('/settings/backup');
            }}
          />
        </label>

        <button
          onClick={handleDemo}
          className="w-full py-4 rounded-2xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
        >
          {t('onboarding.load_demo')}
        </button>
      </div>
    </div>
  );
}
