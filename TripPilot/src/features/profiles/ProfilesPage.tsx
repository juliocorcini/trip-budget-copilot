import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { createCustomActivityProfile, createPhaseProfileSetting } from '@/domain/profiles';
import { formatMoney } from '@/domain/money';
import {
  activityProfileRepository,
  phaseProfileSettingRepository,
} from '@/data/repositories';
import { getCategoryIcon } from '@/utils/category-icons';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';
import { ProfileForm, type ProfileFormData } from '@/components/ProfileForm';
import type { ActivityProfile } from '@/domain/types/activity-profile';

export function ProfilesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip, phases, transactions, loading } = useAppData();

  const [profiles, setProfiles] = useState<ActivityProfile[]>([]);
  const [showForm, setShowForm] = useState(false);
  // DEC-099 (R-24): tap on a profile opens the edit form.
  const [editProfile, setEditProfile] = useState<ActivityProfile | null>(null);

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

  // DEC-099 (R-24): edit ANY profile — custom or automatic.
  const handleEdit = async (data: ProfileFormData) => {
    if (!editProfile) return;
    await activityProfileRepository.update({
      ...editProfile,
      name: data.name,
      iconName: data.iconName,
      typicalValueCents: data.typicalValueCents,
      safeValueCents: data.safeValueCents,
    });
    await loadProfiles();
    setEditProfile(null);
    showToast(t('profiles.updated'), 'success');
  };

  // DEC-099 (R-24): soft delete with safety rule — a profile with recorded
  // expenses is disabled in all phases instead of deleted.
  const handleRemove = async () => {
    if (!editProfile) return;
    const inUse = transactions.some(
      (tx) => tx.activityProfileId === editProfile.id && tx.deletedAt === null,
    );
    if (inUse) {
      await Promise.all(
        phases.map(async (phase) => {
          const existing = await phaseProfileSettingRepository.getByPhaseAndProfile(
            phase.id,
            editProfile.id,
          );
          if (existing) {
            await phaseProfileSettingRepository.update({ ...existing, isEnabled: false });
          } else {
            await phaseProfileSettingRepository.create(
              createPhaseProfileSetting(phase.id, editProfile.id, false),
            );
          }
        }),
      );
      showToast(t('profiles.in_use_disabled', { name: editProfile.name }), 'warning');
    } else {
      await activityProfileRepository.delete(editProfile.id);
      showToast(t('profiles.removed', { name: editProfile.name }), 'success');
    }
    await loadProfiles();
    setEditProfile(null);
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
        {profiles.map((profile) =>
          editProfile?.id === profile.id ? (
            <div key={profile.id} className="flex flex-col gap-2">
              <ProfileForm
                currency={trip.baseCurrency}
                onSave={handleEdit}
                onCancel={() => setEditProfile(null)}
                initial={{
                  name: profile.name,
                  iconName: profile.iconName,
                  typicalValueCents: profile.typicalValueCents,
                  safeValueCents: profile.safeValueCents,
                }}
              />
              <button
                onClick={handleRemove}
                className="w-full py-2.5 rounded-xl flex items-center justify-center gap-1.5 btn-press text-xs font-bold"
                style={{ background: '#D9404012', color: 'var(--error)' }}
              >
                <Icon name="delete" size={14} className="text-error" />
                {t('profiles.remove')}
              </button>
            </div>
          ) : (
            <button
              key={profile.id}
              onClick={() => {
                setShowForm(false);
                setEditProfile(profile);
              }}
              className="bg-surface-container rounded-xl px-4 py-3 flex items-center gap-3 btn-press text-left w-full"
            >
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
              <Icon name="chevron_right" size={16} className="text-on-surface-faint shrink-0" />
            </button>
          ),
        )}
      </div>

      {showForm ? (
        <ProfileForm
          currency={trip.baseCurrency}
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <button
          onClick={() => {
            setEditProfile(null);
            setShowForm(true);
          }}
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
