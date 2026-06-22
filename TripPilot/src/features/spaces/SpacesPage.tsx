import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { tripRepository, appSettingsRepository } from '@/data/repositories';
import { groupSpaces, isOngoing, type SpaceGroupId } from '@/domain/spaces/spaces';
import { formatDate } from '@/domain/dates';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';
import type { Trip } from '@/domain/types/trip';

/**
 * DEC-249 — the multi-space switcher. Lists every non-deleted space (dated
 * trips grouped by status + continuous "Dia a dia" spaces), marks the active
 * one, and swaps `appSettings.activeTrip` on tap. Anti-error (Critic): the
 * switch always asks for confirmation and never happens automatically; after
 * it lands we reload the shared app data and drop the user on the home of the
 * space they chose.
 */

const GROUP_META: Record<SpaceGroupId, { labelKey: string; icon: string }> = {
  ongoing: { labelKey: 'spaces.group_ongoing', icon: 'sync' },
  active: { labelKey: 'spaces.group_active', icon: 'flight_takeoff' },
  planning: { labelKey: 'spaces.group_planning', icon: 'event_upcoming' },
  completed: { labelKey: 'spaces.group_completed', icon: 'check_circle' },
};

export function SpacesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings, reload } = useAppData();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    tripRepository.getAll().then(setTrips);
  }, []);

  const activeTripId = settings?.activeTrip ?? null;

  const handleSwitch = async (space: Trip) => {
    if (space.id === activeTripId) {
      navigate('/dashboard');
      return;
    }
    if (!window.confirm(t('spaces.switch_confirm', { name: space.name }))) return;
    setSwitchingId(space.id);
    try {
      await appSettingsRepository.update({ activeTrip: space.id });
      await reload();
      showToast(t('spaces.switched', { name: space.name }), 'success');
      navigate('/dashboard');
    } catch {
      showToast(t('spaces.switch_error'), 'danger');
      setSwitchingId(null);
    }
  };

  const groups = trips ? groupSpaces(trips) : [];

  return (
    <div className="flex flex-col gap-4 py-6">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('spaces.title')}</h1>
      </div>

      <p className="text-xs text-on-surface-faint">{t('spaces.hint')}</p>

      <button
        onClick={() => navigate('/spaces/new')}
        className="w-full rounded-xl px-4 py-3 flex items-center gap-2 bg-surface-container ring-1 ring-primary/40 text-primary font-semibold text-sm btn-press"
      >
        <Icon name="add" size={20} className="text-primary" />
        {t('spaces.new_cta')}
      </button>

      {trips && groups.length === 0 ? (
        <p className="text-sm text-on-surface-dim py-10 text-center">{t('spaces.empty')}</p>
      ) : null}

      {groups.map((group) => (
        <section key={group.id} className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 px-1">
            <Icon name={GROUP_META[group.id].icon} size={14} className="text-on-surface-faint" />
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-on-surface-faint">
              {t(GROUP_META[group.id].labelKey as never)}
            </h2>
          </div>
          {group.spaces.map((space) => {
            const active = space.id === activeTripId;
            const subtitle = isOngoing(space)
              ? `${t('spaces.subtitle_ongoing')} · ${space.baseCurrency}`
              : `${formatDate(space.startDate)} – ${formatDate(space.endDate)}`;
            return (
              <button
                key={space.id}
                onClick={() => handleSwitch(space)}
                disabled={switchingId !== null}
                className={`w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 btn-press disabled:opacity-60 ${
                  active ? 'bg-surface-container ring-1 ring-primary' : 'bg-surface-container'
                }`}
              >
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-semibold text-on-surface truncate">{space.name}</span>
                  <span className="text-[11px] text-on-surface-dim truncate">{subtitle}</span>
                </div>
                {active ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-primary shrink-0">
                    <Icon name="check_circle" size={14} filled />
                    {t('spaces.current')}
                  </span>
                ) : switchingId === space.id ? (
                  <span className="text-[11px] text-on-surface-dim shrink-0">{t('spaces.switching')}</span>
                ) : (
                  <Icon name="chevron_right" size={18} className="text-on-surface-faint shrink-0" />
                )}
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
