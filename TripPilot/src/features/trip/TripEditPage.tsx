import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { v4 as uuidv4 } from 'uuid';
import { useAppData } from '@/hooks/useAppData';
import { sortPhasesByOrder } from '@/domain/dates';
import { createPhase, getNextPhaseOrder } from '@/domain/phases';
import { createBudgetPoolPhaseLink } from '@/domain/budget';
import { createPlannedOccurrence } from '@/domain/planning';
import { toCents, formatMoney } from '@/domain/money';
import {
  tripRepository,
  phaseRepository,
  budgetPoolPhaseLinkRepository,
  transactionRepository,
  activityProfileRepository,
  phaseProfileSettingRepository,
  plannedOccurrenceRepository,
} from '@/data/repositories';
import { sessionRepository } from '@/data/repositories/session-repository';
import {
  deletePhase,
  swapPhaseOrder,
  createProfileEnabledInPhase,
  setProfileEnabledInPhase,
} from '@/domain/orchestrators';
import {
  ACTIVITY_PROFILE_PRESETS,
  findProfileForPreset,
  createProfileFromPreset,
  createCustomActivityProfile,
  isProfileEnabledInPhase,
} from '@/domain/profiles';
import { getCategoryIcon } from '@/utils/category-icons';
import { Icon } from '@/components/Icon';
import { DataErrorScreen } from '@/components/DataErrorScreen';
import { BottomSheet } from '@/components/BottomSheet';
import { showToast } from '@/components/Toast';
import { HelpButton } from '@/components/HelpMode';
import { ProfileForm, type ProfileFormData } from '@/components/ProfileForm';
import type { Phase, PhaseRhythmPreset } from '@/domain/types/phase';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { PhaseProfileSetting } from '@/domain/types/phase-profile-setting';
import type { PlannedOccurrence, OccurrenceKind } from '@/domain/types/planned-occurrence';

/** Display order Mon..Sun mapped to JS getDay() indices. */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const RHYTHM_PRESETS: PhaseRhythmPreset[] = ['intense', 'moderate', 'relaxed'];

interface NewPhaseDraft {
  tempId: string;
  name: string;
  startDate: string;
  endDate: string;
  poolId: string | null;
}

export function TripEditPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { trip, phases, pools, links, occurrences, loading, error, retry, reload } = useAppData();

  const [tripName, setTripName] = useState('');
  const [tripStart, setTripStart] = useState('');
  const [tripEnd, setTripEnd] = useState('');
  const [phaseEdits, setPhaseEdits] = useState<
    Record<string, { name: string; startDate: string; endDate: string; rhythmPreset: PhaseRhythmPreset | null; peakDays: number[] | null }>
  >({});

  // DEC-074 (FIELD-01): per-phase activities — profiles + settings + presets.
  const [profiles, setProfiles] = useState<ActivityProfile[]>([]);
  const [phaseSettings, setPhaseSettings] = useState<PhaseProfileSetting[]>([]);
  const [customProfilePhaseId, setCustomProfilePhaseId] = useState<string | null>(null);
  const [newPhases, setNewPhases] = useState<NewPhaseDraft[]>([]);
  const [saving, setSaving] = useState(false);

  // DEC-080 (FIELD-11): delete phase with safety rules + reorder.
  const [phaseDeleteTarget, setPhaseDeleteTarget] = useState<{
    phase: Phase;
    txCount: number;
    sessionCount: number;
  } | null>(null);
  const [deletingPhase, setDeletingPhase] = useState(false);

  // DEC-072 (FIELD-05): planned events of a phase — create/edit sheet.
  const [eventSheet, setEventSheet] = useState<{
    phaseId: string;
    occurrence: PlannedOccurrence | null;
  } | null>(null);
  const [eventForm, setEventForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    estimated: '',
    reserved: '',
    kind: 'event' as OccurrenceKind,
  });

  useEffect(() => {
    if (!trip) return;
    setTripName(trip.name);
    setTripStart(trip.startDate);
    setTripEnd(trip.endDate);
    const edits: typeof phaseEdits = {};
    for (const phase of phases) {
      edits[phase.id] = {
        name: phase.name,
        startDate: phase.startDate,
        endDate: phase.endDate,
        rhythmPreset: phase.rhythmPreset,
        peakDays: phase.peakDays,
      };
    }
    setPhaseEdits(edits);
  }, [trip, phases]);

  // DEC-074: load trip profiles + phase settings for the activity chips.
  const reloadActivities = async () => {
    if (!trip) return;
    const [profs, settingsByPhase] = await Promise.all([
      activityProfileRepository.getByTripId(trip.id),
      Promise.all(phases.map((p) => phaseProfileSettingRepository.getByPhaseId(p.id))),
    ]);
    setProfiles(profs);
    setPhaseSettings(settingsByPhase.flat());
  };

  useEffect(() => {
    reloadActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip, phases]);

  const updatePhase = (phaseId: string, field: 'name' | 'startDate' | 'endDate', value: string) => {
    setPhaseEdits((prev) => ({
      ...prev,
      [phaseId]: { ...prev[phaseId]!, [field]: value },
    }));
  };

  // DEC-075 (FIELD-02): rhythm preset + peak days, saved with the phase.
  const updateRhythm = (phaseId: string, preset: PhaseRhythmPreset | null) => {
    setPhaseEdits((prev) => ({
      ...prev,
      [phaseId]: {
        ...prev[phaseId]!,
        rhythmPreset: prev[phaseId]!.rhythmPreset === preset ? null : preset,
      },
    }));
  };

  const togglePeakDay = (phaseId: string, day: number) => {
    setPhaseEdits((prev) => {
      const current = prev[phaseId]!.peakDays ?? [];
      const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
      return {
        ...prev,
        [phaseId]: { ...prev[phaseId]!, peakDays: next.length > 0 ? next.sort() : null },
      };
    });
  };

  // DEC-074: tap on an activity chip — toggle existing profile or create from preset.
  const handleToggleProfile = async (phaseId: string, profile: ActivityProfile) => {
    const enabled = isProfileEnabledInPhase(phaseSettings, phaseId, profile.id);
    await setProfileEnabledInPhase(phaseId, profile.id, !enabled);
    await reloadActivities();
  };

  const handleEnablePreset = async (
    phaseId: string,
    preset: (typeof ACTIVITY_PROFILE_PRESETS)[number],
  ) => {
    if (!trip) return;
    const profile = createProfileFromPreset(
      trip.id,
      preset,
      t(`profile_presets.${preset.id}` as never),
    );
    await createProfileEnabledInPhase({ profile, phaseId });
    await reloadActivities();
  };

  const handleCreateCustomProfile = async (data: ProfileFormData) => {
    if (!trip || !customProfilePhaseId) return;
    const profile = createCustomActivityProfile({
      tripId: trip.id,
      name: data.name,
      iconName: data.iconName,
      typicalValueCents: data.typicalValueCents,
    });
    await createProfileEnabledInPhase({ profile, phaseId: customProfilePhaseId });
    setCustomProfilePhaseId(null);
    await reloadActivities();
  };

  const addNewPhase = () => {
    const sorted = sortPhasesByOrder(phases);
    const lastEnd = sorted[sorted.length - 1]?.endDate ?? tripEnd;
    setNewPhases((prev) => [
      ...prev,
      {
        tempId: uuidv4(),
        name: '',
        startDate: lastEnd,
        endDate: tripEnd || lastEnd,
        poolId: null,
      },
    ]);
  };

  const updateNewPhase = (tempId: string, field: keyof Omit<NewPhaseDraft, 'tempId'>, value: string | null) => {
    setNewPhases((prev) =>
      prev.map((p) => (p.tempId === tempId ? { ...p, [field]: value } : p)),
    );
  };

  const removeNewPhase = (tempId: string) => {
    setNewPhases((prev) => prev.filter((p) => p.tempId !== tempId));
  };

  const openDeletePhaseSheet = async (phase: Phase) => {
    if (!trip) return;
    const [txs, sessions] = await Promise.all([
      transactionRepository.getByPhaseId(phase.id),
      sessionRepository.getByTripId(trip.id),
    ]);
    setPhaseDeleteTarget({
      phase,
      txCount: txs.length,
      sessionCount: sessions.filter((s) => s.phaseId === phase.id).length,
    });
  };

  const handleConfirmDeletePhase = async () => {
    if (!phaseDeleteTarget) return;
    setDeletingPhase(true);
    try {
      const result = await deletePhase(phaseDeleteTarget.phase.id);
      if (result.ok) {
        setPhaseDeleteTarget(null);
        await reload();
        showToast(t('trip.phase_deleted'), 'success');
      }
    } finally {
      setDeletingPhase(false);
    }
  };

  // DEC-091/DEC-101 (R-09/R-23): deep link ?occurrence=<id> opens that
  // event's editor directly — used by the insight tap and the Planner.
  const occurrenceParamHandled = useRef(false);
  useEffect(() => {
    if (occurrenceParamHandled.current || loading) return;
    const occurrenceId = searchParams.get('occurrence');
    if (!occurrenceId) return;
    const occurrence = occurrences.find((o) => o.id === occurrenceId && o.deletedAt === null);
    if (!occurrence) return;
    occurrenceParamHandled.current = true;
    openEventSheet(occurrence.phaseId, occurrence);
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, occurrences, searchParams]);

  // DEC-072: planned events CRUD (soft delete via repository).
  const openEventSheet = (phaseId: string, occurrence: PlannedOccurrence | null) => {
    setEventForm(
      occurrence
        ? {
            name: occurrence.name,
            startDate: occurrence.plannedDate?.slice(0, 10) ?? '',
            endDate: occurrence.endDate?.slice(0, 10) ?? '',
            estimated:
              occurrence.estimatedCostCents > 0 ? String(occurrence.estimatedCostCents / 100) : '',
            reserved: occurrence.reservedCents !== null ? String(occurrence.reservedCents / 100) : '',
            kind: occurrence.kind,
          }
        : { name: '', startDate: '', endDate: '', estimated: '', reserved: '', kind: 'event' },
    );
    setEventSheet({ phaseId, occurrence });
  };

  const handleSaveEvent = async () => {
    if (!trip || !eventSheet || !eventForm.name.trim() || !eventForm.startDate) return;
    const phasePool =
      pools.find((p) =>
        links.some(
          (l) => l.budgetPoolId === p.id && l.phaseId === eventSheet.phaseId && l.deletedAt === null,
        ),
      ) ?? pools[0];
    if (!phasePool) return;

    const estimatedCostCents = toCents(parseFloat(eventForm.estimated.replace(',', '.')) || 0);
    const reservedValue = parseFloat(eventForm.reserved.replace(',', '.'));
    const reservedCents =
      Number.isNaN(reservedValue) || reservedValue <= 0 ? null : toCents(reservedValue);
    const endDate = eventForm.endDate && eventForm.endDate > eventForm.startDate ? eventForm.endDate : null;

    if (eventSheet.occurrence) {
      await plannedOccurrenceRepository.update({
        ...eventSheet.occurrence,
        name: eventForm.name.trim(),
        plannedDate: eventForm.startDate,
        endDate,
        estimatedCostCents,
        reservedCents,
        kind: eventForm.kind,
      });
    } else {
      await plannedOccurrenceRepository.create(
        createPlannedOccurrence({
          tripId: trip.id,
          phaseId: eventSheet.phaseId,
          budgetPoolId: phasePool.id,
          name: eventForm.name.trim(),
          plannedDate: eventForm.startDate,
          endDate,
          kind: eventForm.kind,
          estimatedCostCents,
          reservedCents,
          activityProfileId: null,
        }),
      );
    }
    setEventSheet(null);
    await reload();
  };

  const handleDeleteEvent = async (occurrenceId: string) => {
    await plannedOccurrenceRepository.delete(occurrenceId);
    await reload();
  };

  const handleMovePhase = async (phase: Phase, direction: -1 | 1) => {
    const sorted = sortPhasesByOrder(phases);
    const index = sorted.findIndex((p) => p.id === phase.id);
    const neighbor = sorted[index + direction];
    if (!neighbor) return;
    await swapPhaseOrder(phase.id, neighbor.id);
    await reload();
  };

  const handleSave = async () => {
    if (!trip) return;
    setSaving(true);
    try {
      await tripRepository.update({
        ...trip,
        name: tripName.trim() || trip.name,
        startDate: tripStart,
        endDate: tripEnd,
      });

      const sorted = sortPhasesByOrder(phases);
      await Promise.all(
        sorted.map((phase) => {
          const edit = phaseEdits[phase.id];
          if (!edit) return Promise.resolve();
          return phaseRepository.update({
            ...phase,
            name: edit.name.trim() || phase.name,
            startDate: edit.startDate,
            endDate: edit.endDate,
            rhythmPreset: edit.rhythmPreset,
            peakDays: edit.peakDays,
          });
        }),
      );

      let nextOrder = getNextPhaseOrder(phases);
      const drafts = newPhases.filter((p) => p.name.trim() && p.startDate && p.endDate);
      for (const draft of drafts) {
        const phase = createPhase({
          tripId: trip.id,
          name: draft.name.trim(),
          startDate: draft.startDate,
          endDate: draft.endDate,
          order: nextOrder,
        });
        nextOrder += 1;
        await phaseRepository.create(phase);
        if (draft.poolId) {
          await budgetPoolPhaseLinkRepository.create(
            createBudgetPoolPhaseLink(draft.poolId, phase.id),
          );
        }
      }

      await reload();
      navigate('/trip', { replace: true });
    } finally {
      setSaving(false);
    }
  };

  // BUG-004/009/014: never treat a DB read error as "no trip" (that would
  // redirect to the destructive onboarding flow). Keep valid data on reload.
  if (!trip) {
    if (error) return <DataErrorScreen onRetry={retry} />;
    if (loading) return <p className="text-on-surface-dim py-8 text-center">{t('common.loading')}</p>;
    return <Navigate to="/welcome" replace />;
  }

  const linkablePools = pools.filter((p) => p.scope === 'linked_phases');

  return (
    <div className="flex flex-col gap-5 pb-4 pt-2">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('trip.edit_title')}</h1>
        <HelpButton screenId="phase_edit" />
      </div>

      <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-3">
        <label className="text-xs text-on-surface-faint">{t('onboarding.trip_name')}</label>
        <input
          type="text"
          value={tripName}
          onChange={(e) => setTripName(e.target.value)}
          className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
        />
        <label className="text-xs text-on-surface-faint">{t('onboarding.start_date')}</label>
        <input
          type="date"
          value={tripStart}
          onChange={(e) => setTripStart(e.target.value)}
          className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
        />
        <label className="text-xs text-on-surface-faint">{t('onboarding.end_date')}</label>
        <input
          type="date"
          value={tripEnd}
          onChange={(e) => setTripEnd(e.target.value)}
          className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
        />
      </div>

      <div data-help-anchor="phase-edit-list">
        <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
          {t('planner.phases')}
        </p>
        <div className="flex flex-col gap-3">
          {sortPhasesByOrder(phases).map((phase, index, sorted) => {
            const edit = phaseEdits[phase.id];
            if (!edit) return null;
            return (
              <div key={phase.id} className="bg-surface-container rounded-xl p-4 flex flex-col gap-2">
                {/* DEC-080: reorder + delete controls */}
                <div className="flex items-center justify-end gap-1 -mt-1 -mr-1">
                  <button
                    onClick={() => handleMovePhase(phase, -1)}
                    disabled={index === 0}
                    className="p-1.5 btn-press disabled:opacity-25"
                    aria-label={t('trip.move_phase_up')}
                  >
                    <Icon name="arrow_upward" size={16} className="text-on-surface-dim" />
                  </button>
                  <button
                    onClick={() => handleMovePhase(phase, 1)}
                    disabled={index === sorted.length - 1}
                    className="p-1.5 btn-press disabled:opacity-25"
                    aria-label={t('trip.move_phase_down')}
                  >
                    <Icon name="arrow_downward" size={16} className="text-on-surface-dim" />
                  </button>
                  <button
                    onClick={() => openDeletePhaseSheet(phase)}
                    className="p-1.5 btn-press"
                    aria-label={t('trip.delete_phase')}
                  >
                    <Icon name="delete" size={16} className="text-error" />
                  </button>
                </div>
                <label className="text-xs text-on-surface-faint">{t('onboarding.phase_name')}</label>
                <input
                  type="text"
                  value={edit.name}
                  onChange={(e) => updatePhase(phase.id, 'name', e.target.value)}
                  className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-on-surface-faint">{t('onboarding.start_date')}</label>
                    <input
                      type="date"
                      value={edit.startDate}
                      onChange={(e) => updatePhase(phase.id, 'startDate', e.target.value)}
                      className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-on-surface-faint">{t('onboarding.end_date')}</label>
                    <input
                      type="date"
                      value={edit.endDate}
                      onChange={(e) => updatePhase(phase.id, 'endDate', e.target.value)}
                      className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full mt-1"
                    />
                  </div>
                </div>

                {/* DEC-074 (FIELD-01): activities available in this phase */}
                <label className="text-xs text-on-surface-faint mt-2">
                  {t('trip.phase_activities_title')}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {profiles.map((profile) => {
                    const enabled = isProfileEnabledInPhase(phaseSettings, phase.id, profile.id);
                    return (
                      <button
                        key={profile.id}
                        onClick={() => handleToggleProfile(phase.id, profile)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press flex items-center gap-1.5 ${
                          enabled ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-faint'
                        }`}
                      >
                        <Icon
                          name={profile.iconName ?? getCategoryIcon(profile.category)}
                          size={14}
                          className={enabled ? 'text-on-surface' : 'text-on-surface-faint'}
                        />
                        {profile.name}
                      </button>
                    );
                  })}
                  {ACTIVITY_PROFILE_PRESETS.filter(
                    (preset) => !findProfileForPreset(profiles, preset),
                  ).map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleEnablePreset(phase.id, preset)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium btn-press flex items-center gap-1.5 bg-surface-high text-on-surface-dim"
                      style={{ border: '1px dashed var(--border-subtle)' }}
                    >
                      <Icon name={preset.iconName} size={14} className="text-on-surface-dim" />
                      {t(`profile_presets.${preset.id}` as never)}
                    </button>
                  ))}
                  <button
                    onClick={() => setCustomProfilePhaseId(phase.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold btn-press flex items-center gap-1 text-primary"
                    style={{ background: 'var(--primary-subtle)', border: '1px dashed var(--primary-dim)' }}
                  >
                    <Icon name="add" size={14} className="text-primary" />
                    {t('trip.add_custom_activity')}
                  </button>
                </div>

                {/* DEC-075 (FIELD-02): phase rhythm + peak days */}
                <label className="text-xs text-on-surface-faint mt-2">
                  {t('trip.phase_rhythm_title')}
                </label>
                {/* G14 (audit §4.11): soften the editor jargon with one plain line. */}
                <p className="text-[11px] text-on-surface-faint leading-snug -mt-1">{t('trip.phase_rhythm_hint')}</p>
                <div className="flex gap-2">
                  {RHYTHM_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => updateRhythm(phase.id, preset)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${
                        edit.rhythmPreset === preset
                          ? 'bg-primary text-on-surface'
                          : 'bg-surface-high text-on-surface-dim'
                      }`}
                    >
                      {t(`trip.rhythm_${preset}` as never)}
                    </button>
                  ))}
                </div>
                <label className="text-xs text-on-surface-faint mt-1">
                  {t('trip.peak_days_label')}
                </label>
                <p className="text-[11px] text-on-surface-faint leading-snug -mt-1">{t('trip.peak_days_hint')}</p>
                <div className="flex gap-1.5">
                  {WEEKDAY_ORDER.map((day) => {
                    const selected = (edit.peakDays ?? []).includes(day);
                    return (
                      <button
                        key={day}
                        onClick={() => togglePeakDay(phase.id, day)}
                        className={`w-9 h-9 rounded-lg text-xs font-bold btn-press ${
                          selected ? 'bg-warning/20 text-warning ring-1 ring-warning' : 'bg-surface-high text-on-surface-dim'
                        }`}
                        aria-pressed={selected}
                      >
                        {t(`trip.weekday_${day}` as never)}
                      </button>
                    );
                  })}
                </div>

                {/* DEC-072 (FIELD-05): planned events of this phase */}
                <label className="text-xs text-on-surface-faint mt-2">
                  {t('trip.phase_events_title')}
                </label>
                <div className="flex flex-col gap-2">
                  {occurrences
                    .filter((o) => o.phaseId === phase.id)
                    .map((occ) => (
                      <div
                        key={occ.id}
                        className="flex items-center gap-2 bg-surface-high rounded-lg px-3 py-2"
                      >
                        <Icon
                          name={occ.kind === 'sub_destination' ? 'location_on' : 'celebration'}
                          size={16}
                          className="text-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-on-surface truncate">{occ.name}</p>
                          <p className="text-[10px] text-on-surface-faint">
                            {occ.plannedDate?.slice(0, 10)}
                            {occ.endDate ? ` → ${occ.endDate.slice(0, 10)}` : ''}
                            {' · '}
                            {formatMoney(occ.estimatedCostCents, trip.baseCurrency)}
                            {occ.reservedCents !== null
                              ? ` · ${t('trip.event_reserved_badge', {
                                  amount: formatMoney(occ.reservedCents, trip.baseCurrency),
                                })}`
                              : ''}
                          </p>
                        </div>
                        {occ.isConfirmed ? (
                          <Icon name="check_circle" size={16} className="text-success" />
                        ) : (
                          <>
                            <button
                              onClick={() => openEventSheet(phase.id, occ)}
                              className="p-1 btn-press"
                              aria-label={t('trip.edit_event')}
                            >
                              <Icon name="edit" size={14} className="text-on-surface-dim" />
                            </button>
                            <button
                              onClick={() => handleDeleteEvent(occ.id)}
                              className="p-1 btn-press"
                              aria-label={t('common.delete')}
                            >
                              <Icon name="delete" size={14} className="text-error" />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  <button
                    onClick={() => openEventSheet(phase.id, null)}
                    className="px-3 py-2 rounded-lg text-xs font-bold btn-press flex items-center justify-center gap-1 text-primary"
                    style={{ background: 'var(--primary-subtle)', border: '1px dashed var(--primary-dim)' }}
                  >
                    <Icon name="add" size={14} className="text-primary" />
                    {t('trip.add_event')}
                  </button>
                </div>
              </div>
            );
          })}

          {newPhases.map((draft) => (
            <div
              key={draft.tempId}
              className="bg-surface-container rounded-xl p-4 flex flex-col gap-2"
              style={{ border: '1px dashed var(--primary-dim)' }}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-primary uppercase tracking-wider">
                  {t('trip.new_phase')}
                </p>
                <button
                  onClick={() => removeNewPhase(draft.tempId)}
                  className="btn-press flex items-center gap-1 text-xs text-on-surface-faint"
                >
                  <Icon name="close" size={14} className="text-on-surface-faint" />
                  {t('trip.remove_phase')}
                </button>
              </div>
              <label className="text-xs text-on-surface-faint">{t('onboarding.phase_name')}</label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => updateNewPhase(draft.tempId, 'name', e.target.value)}
                className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-on-surface-faint">{t('onboarding.start_date')}</label>
                  <input
                    type="date"
                    value={draft.startDate}
                    onChange={(e) => updateNewPhase(draft.tempId, 'startDate', e.target.value)}
                    className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-on-surface-faint">{t('onboarding.end_date')}</label>
                  <input
                    type="date"
                    value={draft.endDate}
                    onChange={(e) => updateNewPhase(draft.tempId, 'endDate', e.target.value)}
                    className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full mt-1"
                  />
                </div>
              </div>
              {linkablePools.length > 0 && (
                <div>
                  <label className="text-xs text-on-surface-faint">{t('trip.phase_fund')}</label>
                  <div className="flex gap-2 flex-wrap mt-1">
                    <button
                      onClick={() => updateNewPhase(draft.tempId, 'poolId', null)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                        draft.poolId === null
                          ? 'bg-primary text-on-surface'
                          : 'bg-surface-high text-on-surface-dim'
                      }`}
                    >
                      {t('trip.phase_fund_none')}
                    </button>
                    {linkablePools.map((pool) => (
                      <button
                        key={pool.id}
                        onClick={() => updateNewPhase(draft.tempId, 'poolId', pool.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                          draft.poolId === pool.id
                            ? 'bg-primary text-on-surface'
                            : 'bg-surface-high text-on-surface-dim'
                        }`}
                      >
                        {pool.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          <button
            onClick={addNewPhase}
            className="w-full py-3 rounded-xl flex items-center justify-center gap-2 btn-press font-semibold text-sm"
            style={{ background: '#C75B3918', color: 'var(--primary)', border: '1px dashed #C75B3940' }}
          >
            <Icon name="add" size={18} className="text-primary" />
            {t('trip.add_phase')}
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex-1 py-3 rounded-xl bg-surface-high text-on-surface-dim font-medium btn-press"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-3 rounded-xl bg-primary text-on-surface font-medium btn-press disabled:opacity-40"
        >
          {saving ? t('common.loading') : t('common.save')}
        </button>
      </div>

      {/* DEC-074: "+ Other" — custom activity profile enabled in the phase */}
      <BottomSheet
        open={customProfilePhaseId !== null}
        onClose={() => setCustomProfilePhaseId(null)}
        title={t('trip.add_custom_activity')}
      >
        <ProfileForm
          currency={trip.baseCurrency}
          onSave={handleCreateCustomProfile}
          onCancel={() => setCustomProfilePhaseId(null)}
        />
      </BottomSheet>

      {/* DEC-072: create/edit planned event */}
      <BottomSheet
        open={eventSheet !== null}
        onClose={() => setEventSheet(null)}
        title={eventSheet?.occurrence ? t('trip.edit_event') : t('trip.add_event')}
      >
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            {(['event', 'sub_destination'] as OccurrenceKind[]).map((kind) => (
              <button
                key={kind}
                onClick={() => setEventForm((prev) => ({ ...prev, kind }))}
                className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${
                  eventForm.kind === kind
                    ? 'bg-primary text-on-surface'
                    : 'bg-surface-high text-on-surface-dim'
                }`}
              >
                {t(`trip.event_kind_${kind}` as never)}
              </button>
            ))}
          </div>
          {/* G14 (audit §4.11): name the event vs sub-destination distinction. */}
          <p className="text-[11px] text-on-surface-faint leading-snug">{t('trip.event_kind_hint')}</p>
          <div>
            <label className="text-xs text-on-surface-faint mb-1 block">
              {t('trip.event_name')}
            </label>
            <input
              type="text"
              value={eventForm.name}
              onChange={(e) => setEventForm((prev) => ({ ...prev, name: e.target.value }))}
              className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-on-surface-faint mb-1 block">
                {t('onboarding.start_date')}
              </label>
              <input
                type="date"
                value={eventForm.startDate}
                onChange={(e) => setEventForm((prev) => ({ ...prev, startDate: e.target.value }))}
                className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
              />
            </div>
            <div>
              <label className="text-xs text-on-surface-faint mb-1 block">
                {t('trip.event_end_date')}
              </label>
              <input
                type="date"
                value={eventForm.endDate}
                onChange={(e) => setEventForm((prev) => ({ ...prev, endDate: e.target.value }))}
                className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-on-surface-faint mb-1 block">
                {t('trip.event_estimated')}
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={eventForm.estimated}
                onChange={(e) => setEventForm((prev) => ({ ...prev, estimated: e.target.value }))}
                placeholder="0,00"
                className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full tabular"
              />
            </div>
            <div>
              <label className="text-xs text-on-surface-faint mb-1 block">
                {t('trip.event_reserved')}
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={eventForm.reserved}
                onChange={(e) => setEventForm((prev) => ({ ...prev, reserved: e.target.value }))}
                placeholder="0,00"
                className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full tabular"
              />
            </div>
          </div>
          <p className="text-[10px] text-on-surface-faint">{t('trip.event_reserved_hint')}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setEventSheet(null)}
              className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSaveEvent}
              disabled={!eventForm.name.trim() || !eventForm.startDate}
              className="flex-1 py-2.5 rounded-xl bg-primary text-on-surface font-medium text-sm btn-press disabled:opacity-40"
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* DEC-080: delete phase sheet — blocked with data or last phase */}
      <BottomSheet
        open={phaseDeleteTarget !== null}
        onClose={() => setPhaseDeleteTarget(null)}
        title={t('trip.delete_phase')}
      >
        {phaseDeleteTarget && (() => {
          const { phase, txCount, sessionCount } = phaseDeleteTarget;
          const isLastPhase = phases.length <= 1;
          const hasData = txCount > 0 || sessionCount > 0;

          if (isLastPhase || hasData) {
            return (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-on-surface-dim">
                  {isLastPhase
                    ? t('trip.delete_phase_last_blocked')
                    : t('trip.delete_phase_blocked', { count: txCount + sessionCount })}
                </p>
                <button
                  onClick={() => setPhaseDeleteTarget(null)}
                  className="w-full py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
                >
                  {t('common.close')}
                </button>
              </div>
            );
          }

          return (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-on-surface-dim">
                {t('trip.delete_phase_confirm', { name: phase.name })}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPhaseDeleteTarget(null)}
                  className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleConfirmDeletePhase}
                  disabled={deletingPhase}
                  className="flex-1 py-2.5 rounded-xl bg-error/15 text-error font-medium text-sm btn-press disabled:opacity-40"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          );
        })()}
      </BottomSheet>
    </div>
  );
}
