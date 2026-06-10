import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { createCustomActivityProfile } from '@/domain/profiles';
import { formatMoney } from '@/domain/money';
import { activityProfileRepository } from '@/data/repositories';
import { getCategoryIcon } from '@/utils/category-icons';
import { Icon } from '@/components/Icon';
import { ProfileForm, type ProfileFormData } from '@/components/ProfileForm';
import type { ActivityProfile } from '@/domain/types/activity-profile';

export function ProfilesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip, loading } = useAppData();

  const [profiles, setProfiles] = useState<ActivityProfile[]>([]);
  const [showForm, setShowForm] = useState(false);

  const loadProfiles = useCallback(async () => {
    if (!trip) return;
    const profs = await activityProfileRepository.getByTripId(trip.id);
    setProfiles(profs);
  }, [trip]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  if (loading || !trip) {
    return <p className="text-on-surface-dim py-8 text-center">{t('common.loading')}</p>;
  }

  const handleCreate = async (data: ProfileFormData) => {
    const profile = createCustomActivityProfile({
      tripId: trip.id,
      name: data.name,
      iconName: data.iconName,
      typicalValueCents: data.typicalValueCents,
    });
    await activityProfileRepository.create(profile);
    await loadProfiles();
    setShowForm(false);
  };

  return (
    <div className="flex flex-col gap-4 pb-4 pt-2">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('profiles.title')}</h1>
      </div>

      {profiles.length === 0 && (
        <div className="bg-surface-container rounded-xl p-6 text-center">
          <Icon name="tune" size={32} className="text-on-surface-mute mx-auto mb-2" />
          <p className="text-sm text-on-surface-dim">{t('profiles.empty')}</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {profiles.map((profile) => (
          <div key={profile.id} className="bg-surface-container rounded-xl px-4 py-3 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${profile.color ?? '#C75B39'}18` }}
            >
              <Icon
                name={profile.iconName ?? getCategoryIcon(profile.category)}
                size={20}
                className="text-on-surface-dim"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-on-surface truncate">{profile.name}</p>
                {profile.isCustom && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-primary/15 text-primary shrink-0">
                    {t('profiles.custom_tag')}
                  </span>
                )}
              </div>
              {profile.expectedFrequencyPerPhase !== null && (
                <p className="text-xs text-on-surface-faint mt-0.5">
                  {t('profiles.per_phase', { count: profile.expectedFrequencyPerPhase })}
                </p>
              )}
            </div>
            <p className="text-sm font-bold tabular text-on-surface-dim">
              {formatMoney(profile.typicalValueCents, trip.baseCurrency)}
            </p>
          </div>
        ))}
      </div>

      {showForm ? (
        <ProfileForm
          currency={trip.baseCurrency}
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-xl flex items-center justify-center gap-2 btn-press font-semibold text-sm"
          style={{ background: '#C75B3918', color: 'var(--primary)', border: '1px dashed #C75B3940' }}
        >
          <Icon name="add" size={18} className="text-primary" />
          {t('profiles.add')}
        </button>
      )}
    </div>
  );
}
