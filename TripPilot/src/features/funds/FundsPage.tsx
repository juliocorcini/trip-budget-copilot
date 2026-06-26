import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import {
  createPoolSummary,
  createEnvelope,
  calculateRecommendedFloor,
  poolNature,
  poolNatureLabelKey,
} from '@/domain/budget';
import { filterTransactionsByPool } from '@/domain/transactions';
import { formatMoney } from '@/domain/money';
import { sortPhasesByOrder } from '@/domain/dates';
import type { Phase } from '@/domain/types/phase';
import { budgetPoolRepository, budgetPoolPhaseLinkRepository, envelopeRepository } from '@/data/repositories';
import { createBudgetPoolWithPhaseLinks, deleteBudgetPool } from '@/domain/orchestrators';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { EmptyState } from '@/components/EmptyState';
import { BreakdownRows } from '@/components/Breakdown';
import { HelpButton } from '@/components/HelpMode';
import { showToast } from '@/components/Toast';
import type { BudgetPoolScope } from '@/domain/types/common';

function parseEurosToCents(value: string): number | null {
  const parsed = parseFloat(value.replace(',', '.'));
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

export function FundsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip, phases, pools, links, envelopes, transactions, loading, reload } = useAppData();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [scope, setScope] = useState<BudgetPoolScope>('linked_phases');
  const [selectedPhaseIds, setSelectedPhaseIds] = useState<string[]>([]);
  const [phaseFloors, setPhaseFloors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Per-pool detail panel (future floors + envelopes — GAP-008/009)
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);
  const [floorDrafts, setFloorDrafts] = useState<Record<string, string>>({});
  const [envelopeDrafts, setEnvelopeDrafts] = useState<Record<string, string>>({});
  const [newEnvelopeName, setNewEnvelopeName] = useState('');
  const [newEnvelopeAmount, setNewEnvelopeAmount] = useState('');

  // DEC-080 (FIELD-11): edit name/value + delete with reassignment.
  const [editPoolName, setEditPoolName] = useState('');
  const [editPoolAmount, setEditPoolAmount] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (loading || !trip) {
    return <p className="text-on-surface-dim py-8 text-center">{t('common.loading')}</p>;
  }

  const sortedPhases = sortPhasesByOrder(phases);
  const phaseNameById = new Map(phases.map((p) => [p.id, p.name]));
  const phaseById = new Map(phases.map((p) => [p.id, p]));

  const togglePhase = (phaseId: string) => {
    setSelectedPhaseIds((prev) =>
      prev.includes(phaseId) ? prev.filter((id) => id !== phaseId) : [...prev, phaseId],
    );
  };

  const resetForm = () => {
    setShowForm(false);
    setName('');
    setAmount('');
    setScope('linked_phases');
    setSelectedPhaseIds([]);
    setPhaseFloors({});
  };

  const toggleExpanded = (poolId: string) => {
    setExpandedPoolId((prev) => (prev === poolId ? null : poolId));
    setNewEnvelopeName('');
    setNewEnvelopeAmount('');
    const pool = pools.find((p) => p.id === poolId);
    setEditPoolName(pool?.name ?? '');
    setEditPoolAmount(pool ? (pool.totalAmountCents / 100).toString() : '');
  };

  const handleSavePoolEdit = async (poolId: string) => {
    const pool = pools.find((p) => p.id === poolId);
    if (!pool) return;
    const cents = parseEurosToCents(editPoolAmount);
    await budgetPoolRepository.update({
      ...pool,
      name: editPoolName.trim() || pool.name,
      totalAmountCents: cents !== null && cents > 0 ? cents : pool.totalAmountCents,
    });
    await reload();
    showToast(t('funds.updated'), 'success');
  };

  const handleDeletePool = async (poolId: string, reassignToPoolId: string | null) => {
    setDeleting(true);
    try {
      const result = await deleteBudgetPool({ poolId, reassignToPoolId });
      if (result.ok) {
        setDeleteTargetId(null);
        setExpandedPoolId(null);
        await reload();
        showToast(t('funds.deleted'), 'success');
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveFloor = async (linkId: string) => {
    const link = links.find((l) => l.id === linkId);
    if (!link) return;
    const cents = parseEurosToCents(floorDrafts[linkId] ?? '');
    await budgetPoolPhaseLinkRepository.update({
      ...link,
      futureFloorCents: cents !== null && cents > 0 ? cents : null,
    });
    setFloorDrafts((prev) => {
      const next = { ...prev };
      delete next[linkId];
      return next;
    });
    await reload();
  };

  const handleSaveEnvelopeAmount = async (envelopeId: string) => {
    const envelope = envelopes.find((e) => e.id === envelopeId);
    if (!envelope) return;
    const cents = parseEurosToCents(envelopeDrafts[envelopeId] ?? '');
    if (cents === null) return;
    await envelopeRepository.update({ ...envelope, amountCents: cents });
    setEnvelopeDrafts((prev) => {
      const next = { ...prev };
      delete next[envelopeId];
      return next;
    });
    await reload();
  };

  const handleAddEnvelope = async (poolId: string) => {
    const cents = parseEurosToCents(newEnvelopeAmount);
    if (!newEnvelopeName.trim() || cents === null || cents <= 0) return;
    await envelopeRepository.create(
      createEnvelope({
        budgetPoolId: poolId,
        kind: 'allocation',
        name: newEnvelopeName.trim(),
        amountCents: cents,
      }),
    );
    setNewEnvelopeName('');
    setNewEnvelopeAmount('');
    await reload();
  };

  const handleDeleteEnvelope = async (envelopeId: string) => {
    await envelopeRepository.delete(envelopeId);
    await reload();
  };

  const parsedAmount = parseFloat(amount.replace(',', '.'));
  const isValid =
    name.trim().length > 0 &&
    !Number.isNaN(parsedAmount) &&
    parsedAmount > 0 &&
    (scope === 'global' || selectedPhaseIds.length > 0);

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      // DEC-067 (B13): pool + phase links persisted atomically by the orchestrator.
      await createBudgetPoolWithPhaseLinks({
        tripId: trip.id,
        name: name.trim(),
        scope,
        totalAmountCents: Math.round(parsedAmount * 100),
        currency: trip.baseCurrency,
        phaseLinks:
          scope === 'linked_phases'
            ? selectedPhaseIds.map((phaseId) => ({
                phaseId,
                floorCents: parseEurosToCents(phaseFloors[phaseId] ?? ''),
              }))
            : [],
      });
      await reload();
      resetForm();
      showToast(t('funds.created'), 'success');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-4 pt-2">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('funds.title')}</h1>
        <HelpButton screenId="funds" />
      </div>

      {pools.length === 0 && !showForm && (
        <EmptyState
          icon="savings"
          title={t('funds.empty_title')}
          body={t('funds.empty_body')}
          cta={{ label: t('funds.empty_cta'), icon: 'add', onClick: () => setShowForm(true) }}
        />
      )}

      <div className="flex flex-col gap-2" data-help-anchor="funds-pool-list">
        {pools.map((pool) => {
          const summary = createPoolSummary(pool, filterTransactionsByPool(transactions, pool.id));
          const poolLinks = links.filter((l) => l.budgetPoolId === pool.id && l.deletedAt === null);
          const linkedNames = poolLinks
            .map((l) => phaseNameById.get(l.phaseId))
            .filter((n): n is string => !!n);
          // B7: phases linked to this pool — the basis for the recommended floor.
          const poolLinkedPhases = poolLinks
            .map((l) => phaseById.get(l.phaseId))
            .filter((p): p is Phase => p !== undefined);
          const poolEnvelopes = envelopes.filter(
            (e) => e.budgetPoolId === pool.id && e.deletedAt === null,
          );
          const isExpanded = expandedPoolId === pool.id;
          const nature = poolNature(pool);

          return (
            <div key={pool.id} className="bg-surface-container rounded-xl p-4">
              <button onClick={() => toggleExpanded(pool.id)} className="w-full text-left btn-press">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-on-surface">{pool.name}</p>
                      <span
                        className={`shrink-0 rounded bg-surface-high px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                          nature === 'trecho'
                            ? 'text-primary'
                            : nature === 'pote'
                              ? 'text-warning'
                              : 'text-on-surface-faint'
                        }`}
                      >
                        {t(poolNatureLabelKey(nature))}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-faint mt-0.5">
                      {pool.scope === 'global'
                        ? t('funds.scope_global')
                        : linkedNames.length > 0
                          ? `${t('funds.linked_phases')}: ${linkedNames.join(', ')}`
                          : t('funds.no_linked_phases')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-extrabold tabular text-success">
                      {formatMoney(summary.remainingCents, pool.currency)}
                    </p>
                    <Icon
                      name={isExpanded ? 'expand_less' : 'expand_more'}
                      size={18}
                      className="text-on-surface-faint"
                    />
                  </div>
                </div>
                <div
                  className="w-full h-1.5 rounded-full overflow-hidden mt-3"
                  style={{ background: 'var(--surface-container-high)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, summary.percentUsed)}%`,
                      background: 'var(--primary)',
                    }}
                  />
                </div>
                <p className="text-xs text-on-surface-faint mt-1.5">
                  {formatMoney(summary.spentCents, pool.currency)} / {formatMoney(summary.totalCents, pool.currency)}
                </p>
              </button>

              {isExpanded && (
                <div className="mt-4 pt-4 flex flex-col gap-4" style={{ borderTop: '1px solid var(--surface-container-high)' }}>
                  {/* DEC-172: "where this balance comes from" — total − spent = available,
                      surfaced inline so the green figure above is never a mystery. */}
                  <div>
                    <p className="text-xs font-semibold text-on-surface-dim mb-2">
                      {t('funds.breakdown_heading')}
                    </p>
                    <BreakdownRows
                      items={[
                        { label: t('funds.bd_total'), cents: summary.totalCents, kind: 'base' },
                        { label: t('funds.bd_spent'), cents: summary.spentCents, kind: 'subtract' },
                      ]}
                      totalLabel={t('funds.bd_available')}
                      totalCents={summary.remainingCents}
                      currency={pool.currency}
                    />
                  </div>

                  {/* Edit name/value + delete (DEC-080 / FIELD-11) */}
                  <div>
                    <p className="text-xs font-semibold text-on-surface-dim mb-2">
                      {t('funds.edit_title')}
                    </p>
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        value={editPoolName}
                        onChange={(e) => setEditPoolName(e.target.value)}
                        placeholder={t('funds.name')}
                        className="bg-surface-high text-on-surface text-xs rounded-lg px-3 py-2 outline-none w-full"
                      />
                      <div className="flex items-center gap-2">
                        <div className="flex items-baseline gap-1 bg-surface-high rounded-lg px-3 py-2 flex-1">
                          <span className="text-on-surface-faint text-xs">{pool.currency}</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={editPoolAmount}
                            onChange={(e) => setEditPoolAmount(e.target.value)}
                            placeholder="0,00"
                            className="bg-transparent text-xs text-on-surface tabular outline-none w-full"
                          />
                        </div>
                        <button
                          onClick={() => handleSavePoolEdit(pool.id)}
                          className="px-3 py-2 rounded-lg text-xs font-semibold btn-press bg-primary text-on-surface"
                        >
                          {t('common.save')}
                        </button>
                        <button
                          onClick={() => setDeleteTargetId(pool.id)}
                          className="p-2 btn-press rounded-lg bg-error/10"
                          aria-label={t('funds.delete_fund')}
                        >
                          <Icon name="delete" size={16} className="text-error" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* C19: essential (balance + edit) reads first; the power-user
                      config — per-phase reserves and envelopes — sits under a
                      clearly secondary "Advanced" divider. Nothing is hidden,
                      only demoted (ÂNCORA 9). */}
                  <div className="pt-1">
                    <p className="text-[10px] font-bold text-on-surface-faint uppercase tracking-wider">
                      {t('funds.advanced_section')}
                    </p>
                    <p className="text-[11px] text-on-surface-faint leading-snug mt-0.5">
                      {t('funds.advanced_hint')}
                    </p>
                  </div>

                  {/* Future floors per phase (DEC-016 / GAP-008) */}
                  {poolLinks.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-on-surface-dim mb-2">
                        {t('funds.future_floors_title')}
                      </p>
                      <div className="flex flex-col gap-2">
                        {poolLinks.map((link) => {
                          const draft =
                            floorDrafts[link.id] ??
                            (link.futureFloorCents !== null ? (link.futureFloorCents / 100).toString() : '');
                          const isDirty = floorDrafts[link.id] !== undefined;
                          // B7 (DEC-016): rhythm-weighted suggestion, never imposed.
                          const futurePhase = phaseById.get(link.phaseId);
                          const recommended = futurePhase
                            ? calculateRecommendedFloor({
                                poolTotalCents: pool.totalAmountCents,
                                futurePhase,
                                linkedPhases: poolLinkedPhases,
                              })
                            : null;
                          const floorTiers =
                            recommended && recommended.recommendedCents > 0
                              ? ([
                                  ['essential', recommended.essentialCents],
                                  ['recommended', recommended.recommendedCents],
                                  ['comfortable', recommended.comfortableCents],
                                ] as const)
                              : [];
                          return (
                            <div key={link.id} className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-on-surface-dim flex-1 truncate">
                                  {phaseNameById.get(link.phaseId) ?? '—'}
                                </span>
                                <div className="flex items-baseline gap-1 bg-surface-high rounded-lg px-3 py-1.5 w-28">
                                  <span className="text-on-surface-faint text-xs">{pool.currency}</span>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    step="0.01"
                                    value={draft}
                                    onChange={(e) =>
                                      setFloorDrafts((prev) => ({ ...prev, [link.id]: e.target.value }))
                                    }
                                    placeholder="0,00"
                                    className="bg-transparent text-xs text-on-surface tabular outline-none w-full"
                                  />
                                </div>
                                <button
                                  onClick={() => handleSaveFloor(link.id)}
                                  disabled={!isDirty}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold btn-press bg-primary text-on-surface disabled:opacity-30"
                                >
                                  {t('common.save')}
                                </button>
                              </div>
                              {floorTiers.length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] text-on-surface-faint">
                                    {t('funds.floor_suggest_label')}
                                  </span>
                                  {floorTiers.map(([tierKey, tierCents]) => (
                                    <button
                                      key={tierKey}
                                      onClick={() =>
                                        setFloorDrafts((prev) => ({
                                          ...prev,
                                          [link.id]: (tierCents / 100).toString(),
                                        }))
                                      }
                                      className="px-2 py-1 rounded-md text-[10px] font-semibold btn-press bg-surface-high text-on-surface-dim"
                                    >
                                      {t(`funds.floor_tier_${tierKey}`)} · {formatMoney(tierCents, pool.currency)}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-on-surface-faint mt-1.5">{t('funds.future_floor_hint')}</p>
                    </div>
                  )}

                  {/* Envelopes (DEC-042 / GAP-009) */}
                  <div>
                    <p className="text-xs font-semibold text-on-surface-dim mb-2">
                      {t('funds.envelopes_title')}
                    </p>
                    {poolEnvelopes.length === 0 && (
                      <p className="text-xs text-on-surface-faint mb-2">{t('funds.no_envelopes')}</p>
                    )}
                    <div className="flex flex-col gap-2">
                      {poolEnvelopes.map((envelope) => {
                        const draft = envelopeDrafts[envelope.id] ?? (envelope.amountCents / 100).toString();
                        const isDirty = envelopeDrafts[envelope.id] !== undefined;
                        return (
                          <div key={envelope.id} className="flex items-center gap-2">
                            <span className="text-xs text-on-surface-dim flex-1 truncate flex items-center gap-1">
                              {envelope.kind === 'protected_reserve' && (
                                <Icon name="lock" size={12} className="text-on-surface-faint" />
                              )}
                              {envelope.name}
                            </span>
                            <div className="flex items-baseline gap-1 bg-surface-high rounded-lg px-3 py-1.5 w-28">
                              <span className="text-on-surface-faint text-xs">{pool.currency}</span>
                              <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                value={draft}
                                onChange={(e) =>
                                  setEnvelopeDrafts((prev) => ({ ...prev, [envelope.id]: e.target.value }))
                                }
                                placeholder="0,00"
                                className="bg-transparent text-xs text-on-surface tabular outline-none w-full"
                              />
                            </div>
                            <button
                              onClick={() => handleSaveEnvelopeAmount(envelope.id)}
                              disabled={!isDirty}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold btn-press bg-primary text-on-surface disabled:opacity-30"
                            >
                              {t('common.save')}
                            </button>
                            {envelope.kind === 'allocation' && (
                              <button
                                onClick={() => handleDeleteEnvelope(envelope.id)}
                                className="p-1.5 btn-press"
                                aria-label={t('common.delete')}
                              >
                                <Icon name="delete" size={16} className="text-error" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="text"
                        value={newEnvelopeName}
                        onChange={(e) => setNewEnvelopeName(e.target.value)}
                        placeholder={t('funds.new_envelope_name')}
                        className="bg-surface-high text-on-surface text-xs rounded-lg px-3 py-1.5 outline-none flex-1 min-w-0"
                      />
                      <div className="flex items-baseline gap-1 bg-surface-high rounded-lg px-3 py-1.5 w-24">
                        <span className="text-on-surface-faint text-xs">{pool.currency}</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          value={newEnvelopeAmount}
                          onChange={(e) => setNewEnvelopeAmount(e.target.value)}
                          placeholder="0,00"
                          className="bg-transparent text-xs text-on-surface tabular outline-none w-full"
                        />
                      </div>
                      <button
                        onClick={() => handleAddEnvelope(pool.id)}
                        disabled={
                          !newEnvelopeName.trim() ||
                          (parseEurosToCents(newEnvelopeAmount) ?? 0) <= 0
                        }
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold btn-press bg-primary text-on-surface disabled:opacity-30"
                      >
                        {t('common.add')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showForm ? (
        <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-3">
          <div>
            <label className="text-xs text-on-surface-faint mb-1 block">{t('funds.name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-on-surface-faint mb-1 block">{t('funds.amount')}</label>
            <div className="flex items-baseline gap-1 bg-surface-high rounded-lg px-3 py-2">
              <span className="text-on-surface-dim text-sm">{trip.baseCurrency}</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="bg-transparent text-sm text-on-surface tabular outline-none w-full"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-on-surface-faint mb-1 block">{t('funds.scope')}</label>
            <div className="flex gap-2">
              <button
                onClick={() => setScope('linked_phases')}
                className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${
                  scope === 'linked_phases' ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                }`}
              >
                {t('funds.scope_linked')}
              </button>
              <button
                onClick={() => setScope('global')}
                className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${
                  scope === 'global' ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                }`}
              >
                {t('funds.scope_global')}
              </button>
            </div>
          </div>
          {scope === 'linked_phases' && (
            <div>
              <label className="text-xs text-on-surface-faint mb-1 block">{t('funds.linked_phases')}</label>
              <div className="flex gap-2 flex-wrap">
                {sortedPhases.map((phase) => (
                  <button
                    key={phase.id}
                    onClick={() => togglePhase(phase.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                      selectedPhaseIds.includes(phase.id)
                        ? 'bg-primary text-on-surface'
                        : 'bg-surface-high text-on-surface-dim'
                    }`}
                  >
                    {phase.name}
                  </button>
                ))}
              </div>
              {selectedPhaseIds.length > 0 && (
                <div className="mt-3">
                  <label className="text-xs text-on-surface-faint mb-1 block">
                    {t('funds.reserve_for_phase')}
                  </label>
                  <div className="flex flex-col gap-2">
                    {sortedPhases
                      .filter((phase) => selectedPhaseIds.includes(phase.id))
                      .map((phase) => (
                        <div key={phase.id} className="flex items-center gap-2">
                          <span className="text-xs text-on-surface-dim flex-1 truncate">{phase.name}</span>
                          <div className="flex items-baseline gap-1 bg-surface-high rounded-lg px-3 py-1.5 w-28">
                            <span className="text-on-surface-faint text-xs">{trip.baseCurrency}</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              value={phaseFloors[phase.id] ?? ''}
                              onChange={(e) =>
                                setPhaseFloors((prev) => ({ ...prev, [phase.id]: e.target.value }))
                              }
                              placeholder="0,00"
                              className="bg-transparent text-xs text-on-surface tabular outline-none w-full"
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                  <p className="text-[10px] text-on-surface-faint mt-1.5">{t('funds.future_floor_hint')}</p>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={resetForm}
              className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={!isValid || saving}
              className="flex-1 py-2.5 rounded-xl bg-primary text-on-surface font-medium text-sm btn-press disabled:opacity-40"
            >
              {saving ? t('common.loading') : t('common.add')}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-xl flex items-center justify-center gap-2 btn-press font-semibold text-sm"
          style={{ background: '#C75B3918', color: 'var(--primary)', border: '1px dashed #C75B3940' }}
          data-help-anchor="funds-add"
        >
          <Icon name="add" size={18} className="text-primary" />
          {t('funds.add')}
        </button>
      )}

      {/* DEC-080: delete fund sheet — reassign transactions or confirm */}
      <BottomSheet
        open={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        title={t('funds.delete_confirm_title')}
      >
        {(() => {
          const target = pools.find((p) => p.id === deleteTargetId);
          if (!target) return null;
          const activeTxCount = filterTransactionsByPool(transactions, target.id).length;
          const otherPools = pools.filter((p) => p.id !== target.id);

          if (activeTxCount === 0) {
            return (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-on-surface-dim">
                  {t('funds.delete_confirm_body', { name: target.name })}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteTargetId(null)}
                    className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={() => handleDeletePool(target.id, null)}
                    disabled={deleting}
                    className="flex-1 py-2.5 rounded-xl bg-error/15 text-error font-medium text-sm btn-press disabled:opacity-40"
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-on-surface-dim">
                {t('funds.delete_has_transactions', { count: activeTxCount, name: target.name })}
              </p>
              {otherPools.length > 0 ? (
                <>
                  <p className="text-xs font-semibold text-on-surface-dim">{t('funds.reassign_to')}</p>
                  <div className="flex flex-col gap-2">
                    {otherPools.map((pool) => (
                      <button
                        key={pool.id}
                        onClick={() => handleDeletePool(target.id, pool.id)}
                        disabled={deleting}
                        className="w-full py-2.5 px-3 rounded-xl bg-surface-high text-on-surface text-sm font-medium btn-press text-left disabled:opacity-40"
                      >
                        {pool.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-on-surface-faint">{t('funds.delete_blocked_no_target')}</p>
              )}
              <button
                onClick={() => setDeleteTargetId(null)}
                className="w-full py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
              >
                {t('common.cancel')}
              </button>
            </div>
          );
        })()}
      </BottomSheet>
    </div>
  );
}
