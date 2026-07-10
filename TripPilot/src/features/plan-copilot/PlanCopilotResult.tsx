import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { fromCents } from '@/domain/money';
import { enrichActivity, getEnrichmentData } from '@/domain/plan-copilot';
import type { DestinationCluster, SpendingLevel, ActivityType, EnrichedPlanActivity } from '@/domain/plan-copilot';
import type { GenerateResult } from '@/utils/ai-plan-copilot';

interface Props {
  open: boolean;
  result: GenerateResult;
  cluster: DestinationCluster;
  currency: string;
  onUsePlan: (enriched: EnrichedPlanActivity[]) => void;
  onAdjust: (enriched: EnrichedPlanActivity[]) => void;
  onRedo: () => void;
  onClose: () => void;
}

const ACTIVITY_ICONS: Record<string, string> = {
  bar: 'local_bar',
  market: 'shopping_cart',
  restaurant: 'restaurant',
  outing: 'museum',
  transport: 'directions_bus',
};

const SPENDING_ICONS: Record<string, string> = {
  budget: '💰',
  balanced: '⚖️',
  comfortable: '🍽️',
  flexible: '✨',
};

function fmtEuro(cents: number, currency: string): string {
  const sym: Record<string, string> = { EUR: '€', USD: '$', BRL: 'R$', GBP: '£' };
  return `${sym[currency] ?? currency}${Math.round(fromCents(cents))}`;
}

export function PlanCopilotResult({
  open, result, cluster, currency, onUsePlan, onAdjust, onRedo, onClose,
}: Props) {
  const { t } = useTranslation();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const enriched = useMemo<EnrichedPlanActivity[]>(() =>
    result.plan.activities.map((a) => enrichActivity(a as Parameters<typeof enrichActivity>[0], cluster)),
    [result.plan.activities, cluster],
  );

  const handleUsePlan = useCallback(() => onUsePlan(enriched), [enriched, onUsePlan]);
  const handleAdjust = useCallback(() => onAdjust(enriched), [enriched, onAdjust]);

  const contextUsed = result.context_used as Record<string, string>;
  const spendingStyle = contextUsed?.spending_style ?? 'balanced';

  return (
    <BottomSheet open={open} onClose={onClose} title={t('copilot_result.title')}>
      <div className="flex flex-col gap-4 pb-4" data-no-sheet-drag>
        {/* Header: user choices summary */}
        <div className="p-3 rounded-xl bg-surface-high">
          <p className="text-xs font-bold text-on-surface mb-1">
            {t('copilot_result.your_style')}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base">{SPENDING_ICONS[spendingStyle] ?? '⚖️'}</span>
            <span className="text-sm font-bold text-on-surface capitalize">{t(`copilot_result.style_${spendingStyle}` as never)}</span>
          </div>
          <p className="text-xs text-on-surface-faint mt-1.5">
            📍 {contextUsed?.destination ?? ''} · {contextUsed?.duration ?? ''} · {fmtEuro(result.plan.free_budget_cents, currency)} {t('copilot_result.free_label')}
          </p>
        </div>

        {/* Activity cards */}
        {enriched.map((activity, idx) => {
          const icon = ACTIVITY_ICONS[activity.type] ?? 'category';
          const lineTotal = activity.suggested_quantity * activity.typical_cost_cents;
          const isExpanded = expandedIdx === idx;
          const enrichData = getEnrichmentData(
            cluster,
            activity.type as ActivityType,
            activity.spending_level as SpendingLevel,
          );

          return (
            <div key={idx}>
              <button
                type="button"
                onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                className="w-full text-left p-3.5 rounded-xl bg-surface-container btn-press"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name={icon} size={18} className="text-primary" />
                    <span className="text-sm font-bold text-on-surface">
                      {t(`copilot_result.type_${activity.type}` as never)}
                    </span>
                  </div>
                  <Icon
                    name="expand_more"
                    size={18}
                    className="text-on-surface-faint transition-transform"
                    style={isExpanded ? { transform: 'rotate(180deg)' } : undefined}
                  />
                </div>
                <p className="text-xs text-on-surface-dim mt-1 tabular">
                  {activity.suggested_quantity} × ~{fmtEuro(activity.typical_cost_cents, currency)} = {fmtEuro(lineTotal, currency)}
                </p>
                <p className="text-xs text-on-surface-faint mt-0.5 leading-relaxed">
                  {activity.assumption}
                </p>
                {enrichData && (
                  <p className="text-[11px] text-on-surface-faint mt-1 tabular">
                    {t('copilot_result.range')}: {fmtEuro(enrichData.expected_min_cost_cents, currency)}–{fmtEuro(enrichData.expected_max_cost_cents, currency)}
                  </p>
                )}
              </button>

              {/* Expanded detail */}
              {isExpanded && enrichData && (
                <div className="mx-1 mt-1 p-3 rounded-xl bg-surface-high flex flex-col gap-2.5">
                  <p className="text-xs font-bold text-on-surface">
                    {t('copilot_result.how_we_got_here')}
                  </p>
                  <p className="text-xs text-on-surface-faint leading-relaxed">
                    {activity.reasoning}
                  </p>

                  {enrichData.includes.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-success mb-1">
                        ✅ {t('copilot_result.includes')}
                      </p>
                      {enrichData.includes.map((item, i) => (
                        <p key={i} className="text-xs text-on-surface-dim">• {item}</p>
                      ))}
                    </div>
                  )}

                  {enrichData.usually_not_included.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-warning mb-1">
                        ⚠️ {t('copilot_result.not_included')}
                      </p>
                      {enrichData.usually_not_included.map((item, i) => (
                        <p key={i} className="text-xs text-on-surface-dim">• {item}</p>
                      ))}
                    </div>
                  )}

                  {/* Alternative spending levels */}
                  <div className="pt-2 border-t border-[var(--border-faint)]">
                    <p className="text-[11px] font-bold text-on-surface-faint mb-1.5">
                      {t('copilot_result.other_styles')}
                    </p>
                    {(['budget', 'balanced', 'comfortable', 'flexible'] as const).map((level) => {
                      const alt = getEnrichmentData(cluster, activity.type as ActivityType, level);
                      if (!alt) return null;
                      const isCurrent = level === activity.spending_level;
                      return (
                        <p
                          key={level}
                          className={`text-xs leading-relaxed ${isCurrent ? 'font-bold text-on-surface' : 'text-on-surface-dim'}`}
                        >
                          {SPENDING_ICONS[level]} {t(`copilot_result.style_${level}` as never)}: {fmtEuro(alt.expected_min_cost_cents, currency)}–{fmtEuro(alt.expected_max_cost_cents, currency)}
                          {isCurrent ? ` (${t('copilot_result.current')})` : ''}
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Summary */}
        <div className="p-3.5 rounded-xl bg-surface-container">
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-faint mb-2">
            📊 {t('copilot_result.summary')}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-[10px] text-on-surface-faint">{t('copilot_result.total_planned')}</p>
              <p className="text-sm font-extrabold tabular text-on-surface">{fmtEuro(result.total_planned_cents, currency)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-on-surface-faint">{t('copilot_result.free')}</p>
              <p className="text-sm font-extrabold tabular text-on-surface">{fmtEuro(result.plan.free_budget_cents, currency)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-on-surface-faint">{t('copilot_result.margin')}</p>
              <p className="text-sm font-extrabold tabular text-success">
                {fmtEuro(result.margin_cents, currency)} ({result.margin_percent}%)
              </p>
            </div>
          </div>
          <p className="text-xs text-on-surface-faint mt-2 leading-relaxed">
            {t('copilot_result.margin_note')}
          </p>
        </div>

        {/* Insights */}
        {result.insights.length > 0 && (
          <div className="p-3.5 rounded-xl bg-surface-container">
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-faint mb-2">
              💡 {t('copilot_result.tips')}
            </p>
            {result.insights.map((insight, i) => (
              <p key={i} className="text-xs text-on-surface-dim leading-relaxed mb-1">
                • {insight}
              </p>
            ))}
          </div>
        )}

        {/* Warning */}
        <p className="text-[11px] text-on-surface-faint leading-relaxed px-1">
          ⚠️ {t('copilot_result.style_warning')}
        </p>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 mt-1">
          <button
            onClick={handleUsePlan}
            className="btn-press w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5"
            style={{ background: 'var(--primary)', color: 'var(--surface)' }}
          >
            <Icon name="check" size={16} />
            {t('copilot_result.use_plan')}
          </button>
          <button
            onClick={handleAdjust}
            className="btn-press w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 bg-surface-container text-on-surface-dim"
          >
            <Icon name="edit" size={16} />
            {t('copilot_result.adjust_in_planner')}
          </button>
          <button
            onClick={onRedo}
            className="btn-press w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 bg-surface-high text-on-surface-faint"
          >
            <Icon name="refresh" size={16} />
            {t('copilot_result.redo')}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
