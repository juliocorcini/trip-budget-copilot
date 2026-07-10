import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { appSettingsRepository } from '@/data/repositories';
import {
  scenarioPlanRepository,
  scenarioAllocationItemRepository,
  activityProfileRepository,
} from '@/data/repositories';
import { createScenarioPlan, createAllocationItem } from '@/domain/planning';
import { getClusterForCity } from '@/domain/plan-copilot';
import { analyzeTrip, generatePlan } from '@/utils/ai-plan-copilot';
import { showToast } from '@/components/Toast';
import { buildAutoPlan } from '@/domain/planning';
import { PlanCopilotDisclosure } from './PlanCopilotDisclosure';
import { PlanCopilotQuestions } from './PlanCopilotQuestions';
import { PlanCopilotResult } from './PlanCopilotResult';
import { PlanCopilotLoading } from './PlanCopilotLoading';
import type { AnalyzeQuestion, GenerateResult, CurrentSpending } from '@/utils/ai-plan-copilot';
import type { EnrichedPlanActivity } from '@/domain/plan-copilot';
import type { ActivityProfile } from '@/domain/types/activity-profile';

export type CopilotFlowStage =
  | 'idle'
  | 'disclosure'
  | 'analyzing'
  | 'questions'
  | 'generating'
  | 'result';

interface TripContext {
  tripId: string;
  phaseId: string;
  poolId: string;
  destination: string;
  durationDays: number;
  budgetCents: number;
  reserveCents: number;
  currency: string;
  selectedActivities?: string[];
  profiles: ActivityProfile[];
  currentSpending?: CurrentSpending[];
  spendingStyle?: string;
}

interface Props {
  tripContext: TripContext;
  hasSeenDisclosure: boolean;
  onPlanCreated: () => void;
}

export function PlanCopilotFlow({ tripContext, hasSeenDisclosure, onPlanCreated }: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [stage, setStage] = useState<CopilotFlowStage>('idle');
  const [questions, setQuestions] = useState<AnalyzeQuestion[]>([]);
  const [contextSummary, setContextSummary] = useState('');
  const [generateResult, setGenerateResult] = useState<GenerateResult | null>(null);
  const answersRef = useRef<Record<string, string>>({});

  const cluster = getClusterForCity(tripContext.destination);
  const startedRef = useRef(false);

  const fallbackToAutoPlan = useCallback(() => {
    const profileIds = tripContext.profiles.map((p) => p.id);
    if (profileIds.length === 0) return;
    const freeCents = Math.max(0, tripContext.budgetCents - tripContext.reserveCents);
    const result = buildAutoPlan({
      selectedProfileIds: profileIds,
      profiles: tripContext.profiles,
      freeToSpendCents: freeCents,
    });
    if (result.allocations.length > 0) {
      const plan = createScenarioPlan({
        tripId: tripContext.tripId,
        phaseId: tripContext.phaseId,
        budgetPoolId: tripContext.poolId,
        name: 'Auto',
        preset: 'equilibrado',
      });
      void (async () => {
        await scenarioPlanRepository.create(plan);
        for (const a of result.allocations) {
          await scenarioAllocationItemRepository.create(
            createAllocationItem({
              scenarioPlanId: plan.id,
              activityProfileId: a.activityProfileId,
              quantity: a.quantity,
              estimatedUnitCostCents: a.estimatedUnitCostCents,
              isLocked: false,
              priority: 'planned',
            }),
          );
        }
        onPlanCreated();
      })();
    }
    showToast(t('copilot_flow.fallback_toast'), 'info');
  }, [tripContext, t, onPlanCreated]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (hasSeenDisclosure) {
      setStage('analyzing');
      void runAnalyze();
    } else {
      setStage('disclosure');
    }
  }, []);

  const handleDisclosureAccept = useCallback(async () => {
    await appSettingsRepository.update({ hasSeenPlanCopilotDisclosure: true });
    setStage('analyzing');
    void runAnalyze();
  }, []);

  const handleDisclosureDecline = useCallback(() => {
    setStage('idle');
  }, []);

  async function runAnalyze() {
    const outcome = await analyzeTrip({
      destination: tripContext.destination,
      duration_days: tripContext.durationDays,
      budget_cents: tripContext.budgetCents,
      reserve_cents: tripContext.reserveCents,
      currency: tripContext.currency,
      language: i18n.language,
      selected_activities: tripContext.selectedActivities,
      current_spending: tripContext.currentSpending,
      spending_style: tripContext.spendingStyle,
    });

    if (!outcome.ok) {
      setStage('idle');
      fallbackToAutoPlan();
      return;
    }

    setQuestions(outcome.data.questions ?? []);
    setContextSummary(outcome.data.context_summary ?? '');
    setStage('questions');
  }

  const handleGenerate = useCallback(async (answers: Record<string, string>) => {
    answersRef.current = answers;
    setStage('generating');

    const outcome = await generatePlan({
      destination: tripContext.destination,
      duration_days: tripContext.durationDays,
      budget_cents: tripContext.budgetCents,
      reserve_cents: tripContext.reserveCents,
      currency: tripContext.currency,
      language: i18n.language,
      selected_activities: tripContext.selectedActivities,
      answers,
      current_spending: tripContext.currentSpending,
    });

    if (!outcome.ok) {
      setStage('idle');
      fallbackToAutoPlan();
      return;
    }

    setGenerateResult(outcome.data);
    setStage('result');
  }, [tripContext, i18n.language, fallbackToAutoPlan]);

  const handleManual = useCallback(() => {
    setStage('idle');
  }, []);

  const persistPlan = useCallback(async (activities: EnrichedPlanActivity[]) => {
    const plan = createScenarioPlan({
      tripId: tripContext.tripId,
      phaseId: tripContext.phaseId,
      budgetPoolId: tripContext.poolId,
      name: 'AI Copilot',
      preset: 'equilibrado',
    });
    await scenarioPlanRepository.create(plan);

    for (const activity of activities) {
      const profile = tripContext.profiles.find(
        (p) => p.category === activity.type,
      );
      if (!profile) continue;

      if (profile.typicalValueCents !== activity.typical_cost_cents) {
        await activityProfileRepository.update({
          ...profile,
          typicalValueCents: activity.typical_cost_cents,
        });
      }

      await scenarioAllocationItemRepository.create(
        createAllocationItem({
          scenarioPlanId: plan.id,
          activityProfileId: profile.id,
          quantity: activity.suggested_quantity,
          estimatedUnitCostCents: activity.typical_cost_cents,
          isLocked: false,
          priority: 'planned',
        }),
      );
    }
  }, [tripContext]);

  const handleUsePlan = useCallback(async (enriched: EnrichedPlanActivity[]) => {
    await persistPlan(enriched);
    setStage('idle');
    onPlanCreated();
    showToast(t('copilot_flow.plan_created'), 'success');
  }, [persistPlan, onPlanCreated, t]);

  const handleAdjust = useCallback(async (enriched: EnrichedPlanActivity[]) => {
    await persistPlan(enriched);
    setStage('idle');
    onPlanCreated();
    navigate('/planner');
  }, [persistPlan, onPlanCreated, navigate]);

  const handleRedo = useCallback(() => {
    setStage('questions');
  }, []);

  return (
    <>
      <PlanCopilotDisclosure
        open={stage === 'disclosure'}
        onAccept={handleDisclosureAccept}
        onDecline={handleDisclosureDecline}
      />

      <PlanCopilotLoading
        open={stage === 'analyzing' || stage === 'generating'}
        stage={stage === 'analyzing' ? 'analyze' : 'generate'}
      />

      <PlanCopilotQuestions
        open={stage === 'questions'}
        questions={questions}
        contextSummary={contextSummary}
        onGenerate={handleGenerate}
        onManual={handleManual}
        onClose={handleManual}
      />

      {generateResult && (
        <PlanCopilotResult
          open={stage === 'result'}
          result={generateResult}
          cluster={cluster}
          currency={tripContext.currency}
          currentSpending={tripContext.currentSpending}
          userAnswers={answersRef.current}
          onUsePlan={handleUsePlan}
          onAdjust={handleAdjust}
          onRedo={handleRedo}
          onClose={() => setStage('idle')}
        />
      )}
    </>
  );
}

export { type TripContext };
