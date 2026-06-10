import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { v4 as uuidv4 } from 'uuid';
import { useAppData } from '@/hooks/useAppData';
import { sortPhasesByOrder } from '@/domain/dates';
import { createPhase, getNextPhaseOrder } from '@/domain/phases';
import { createBudgetPoolPhaseLink } from '@/domain/budget';
import {
  tripRepository,
  phaseRepository,
  budgetPoolPhaseLinkRepository,
  transactionRepository,
} from '@/data/repositories';
import { sessionRepository } from '@/data/repositories/session-repository';
import { deletePhase, swapPhaseOrder } from '@/domain/orchestrators';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { showToast } from '@/components/Toast';
import type { Phase } from '@/domain/types/phase';

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
  const { trip, phases, pools, loading, reload } = useAppData();

  const [tripName, setTripName] = useState('');
  const [tripStart, setTripStart] = useState('');
  const [tripEnd, setTripEnd] = useState('');
  const [phaseEdits, setPhaseEdits] = useState<Record<string, { name: string; startDate: string; endDate: string }>>({});
  const [newPhases, setNewPhases] = useState<NewPhaseDraft[]>([]);
  const [saving, setSaving] = useState(false);

  // DEC-080 (FIELD-11): delete phase with safety rules + reorder.
  const [phaseDeleteTarget, setPhaseDeleteTarget] = useState<{
    phase: Phase;
    txCount: number;
    sessionCount: number;
  } | null>(null);
  const [deletingPhase, setDeletingPhase] = useState(false);

  useEffect(() => {
    if (!trip) return;
    setTripName(trip.name);
    setTripStart(trip.startDate);
    setTripEnd(trip.endDate);
    const edits: Record<string, { name: string; startDate: string; endDate: string }> = {};
    for (const phase of phases) {
      edits[phase.id] = { name: phase.name, startDate: phase.startDate, endDate: phase.endDate };
    }
    setPhaseEdits(edits);
  }, [trip, phases]);

  const updatePhase = (phaseId: string, field: 'name' | 'startDate' | 'endDate', value: string) => {
    setPhaseEdits((prev) => ({
      ...prev,
      [phaseId]: { ...prev[phaseId]!, [field]: value },
    }));
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

  if (loading) {
    return <p className="text-on-surface-dim py-8 text-center">{t('common.loading')}</p>;
  }

  if (!trip) {
    navigate('/welcome');
    return null;
  }

  const linkablePools = pools.filter((p) => p.scope === 'linked_phases');

  return (
    <div className="flex flex-col gap-5 pb-4 pt-2">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1">
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('trip.edit_title')}</h1>
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

      <div>
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
              </div>
            );
          })}

          {newPhases.map((draft) => (
            <div
              key={draft.tempId}
              className="bg-surface-container rounded-xl p-4 flex flex-col gap-2"
              style={{ border: '1px dashed #C75B3940' }}
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
