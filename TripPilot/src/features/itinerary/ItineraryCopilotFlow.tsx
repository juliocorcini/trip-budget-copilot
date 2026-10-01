import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db/database';
import { useAppData } from '@/hooks/useAppData';
import { buildItinerary, refineItinerary } from '@/utils/ai-itinerary-copilot';
import { parseBuildResponse, parseRefineResponse } from '@/domain/itinerary/itinerary-copilot-parser';
import { suggestPhasesFromLegs } from '@/domain/itinerary/itinerary-domain';
import { itineraryLegRepository } from '@/data/repositories';
import { showToast } from '@/components/Toast';
import { Icon } from '@/components/Icon';
import { ItineraryPreview } from './ItineraryPreview';
import type { ItineraryLeg } from '@/domain/types/itinerary-leg';
import type { SuggestedPhase } from '@/domain/itinerary/itinerary-domain';

type FlowStage = 'intent' | 'choice' | 'input' | 'guided' | 'loading' | 'preview' | 'refining';

const GUIDED_STEPS = [
  { key: 'cities', icon: 'public' },
  { key: 'duration', icon: 'calendar_month' },
  { key: 'transport', icon: 'train' },
  { key: 'accommodation', icon: 'bed' },
  { key: 'events', icon: 'celebration' },
  { key: 'budget', icon: 'account_balance_wallet' },
] as const;

const LOADING_STEPS = [
  { icon: 'route', labelKey: 'itinerary.loading_step_routes' },
  { icon: 'hotel', labelKey: 'itinerary.loading_step_accommodation' },
  { icon: 'tune', labelKey: 'itinerary.loading_step_optimizing' },
] as const;

function compileGuidedAnswers(
  answers: Record<number, string>,
  t: (key: string) => string,
): string {
  return GUIDED_STEPS.map((step, i) => {
    const label = t(`itinerary.guided_q_${step.key}` as never);
    return `${label}: ${answers[i] ?? ''}`;
  })
    .filter((line) => !line.endsWith(': '))
    .join('\n');
}

export function ItineraryCopilotFlow() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appData = useAppData();
  const trip = appData.trip;

  const isAddMode = searchParams.get('mode') === 'add';

  const existingLegs = useLiveQuery(
    async () => {
      if (!trip) return [];
      return db.itineraryLegs
        .where('tripId')
        .equals(trip.id)
        .filter((l) => l.deletedAt === null)
        .sortBy('order');
    },
    [trip?.id],
    [] as ItineraryLeg[],
  );

  const nextOrder = useMemo(() => {
    if (existingLegs.length === 0) return 1;
    return Math.max(...existingLegs.map((l) => l.order)) + 1;
  }, [existingLegs]);

  const hasExistingLegs = existingLegs.length > 0;
  const [addToExisting, setAddToExisting] = useState(isAddMode);

  const [stage, setStage] = useState<FlowStage>(hasExistingLegs ? 'intent' : 'choice');
  const [userInput, setUserInput] = useState('');
  const [legs, setLegs] = useState<ItineraryLeg[]>([]);
  const [phases, setPhases] = useState<SuggestedPhase[]>([]);
  const [summary, setSummary] = useState('');
  const [refinement, setRefinement] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [guidedStep, setGuidedStep] = useState(0);
  const [guidedAnswers, setGuidedAnswers] = useState<Record<number, string>>({});
  const [guidedInput, setGuidedInput] = useState('');

  const handleBuild = useCallback(async () => {
    if (!trip || userInput.trim().length < 5) return;
    setStage('loading');
    setError(null);

    const contextPrefix = addToExisting && existingLegs.length > 0
      ? `EXISTING ITINERARY (keep these, add new ones):\n${existingLegs.map((l) =>
          `- ${l.cityName}: ${l.arrivalDate} to ${l.departureDate}`
        ).join('\n')}\n\nNEW LEGS TO ADD:\n`
      : '';

    const result = await buildItinerary({
      tripName: trip.name,
      startDate: trip.startDate ?? undefined,
      endDate: trip.endDate ?? undefined,
      baseCurrency: trip.baseCurrency,
      language: i18n.language,
      userInput: contextPrefix + userInput.trim(),
    });

    if (!result.ok) {
      setError(t(`itinerary.error_${result.error}` as never));
      setStage('input');
      return;
    }

    const parsed = parseBuildResponse(result.data, trip.id);
    if (parsed.legs.length === 0) {
      setError(t('itinerary.error_no_legs'));
      setStage('input');
      return;
    }

    if (addToExisting) {
      const reorderedLegs = parsed.legs.map((leg, idx) => ({
        ...leg,
        order: nextOrder + idx,
      }));
      setLegs(reorderedLegs);
    } else {
      setLegs(parsed.legs);
    }

    setSummary(parsed.summary);
    const allLegs = addToExisting ? [...existingLegs, ...parsed.legs] : parsed.legs;
    const suggested = parsed.suggestedPhases.length > 0
      ? parsed.suggestedPhases.map((p) => ({
        ...p,
        legs: allLegs.filter((l) => l.arrivalDate >= p.startDate && l.arrivalDate <= p.endDate),
      }))
      : suggestPhasesFromLegs(allLegs);
    setPhases(suggested);
    setStage('preview');
  }, [trip, userInput, i18n.language, t, isAddMode, existingLegs, nextOrder]);

  const handleRefine = useCallback(async () => {
    if (!trip || refinement.trim().length < 3) return;
    setStage('loading');
    setError(null);

    const result = await refineItinerary({
      currentLegs: legs,
      refinement: refinement.trim(),
      language: i18n.language,
    });

    if (!result.ok) {
      setError(t(`itinerary.error_${result.error}` as never));
      setStage('preview');
      return;
    }

    const parsed = parseRefineResponse(result.data, trip.id);
    if (parsed.legs.length === 0) {
      setError(t('itinerary.error_no_legs'));
      setStage('preview');
      return;
    }

    setLegs(parsed.legs);
    setPhases(suggestPhasesFromLegs(parsed.legs));
    setRefinement('');
    setStage('preview');
    showToast(parsed.changes.join('. ') || t('itinerary.refined'), 'success');
  }, [trip, legs, refinement, i18n.language, t]);

  const handleSave = useCallback(async () => {
    if (!trip || legs.length === 0) return;
    try {
      await itineraryLegRepository.saveBatch(legs);
      showToast(t('itinerary.saved'), 'success');
      navigate('/itinerary');
    } catch {
      showToast(t('itinerary.save_error'), 'danger');
    }
  }, [trip, legs, navigate, t]);

  if (appData.loading || !trip) return null;

  if (stage === 'intent' && hasExistingLegs) {
    return (
      <div className="flex flex-col pt-6 pb-4">
        {/* Header bar */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate(-1)} className="btn-press w-10 h-10 flex items-center justify-center -ml-2 rounded-full">
            <Icon name="arrow_back" size={24} style={{ color: 'var(--on-surface-dim)' }} />
          </button>
          <span
            className="font-mono text-[11px] uppercase tracking-[0.2em]"
            style={{ color: 'var(--on-surface-dim)' }}
          >
            Copilot
          </span>
          <div className="w-10 h-10" />
        </div>

        <div className="text-center mb-8 flex flex-col items-center gap-3">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-2"
            style={{ background: 'var(--surface-container)', border: '1px solid var(--border-subtle)' }}
          >
            <Icon name="flight_takeoff" size={28} filled style={{ color: 'var(--primary)' }} />
          </div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--on-surface)' }}
          >
            {t('itinerary.create_title')}
          </h1>
          <p
            className="text-base leading-relaxed max-w-[280px]"
            style={{ color: 'var(--on-surface-dim)' }}
          >
            {t('itinerary.intent_subtitle')}
          </p>
        </div>

        <p
          className="font-mono text-[10px] uppercase tracking-[0.15em] font-bold px-1 mb-3"
          style={{ color: 'var(--on-surface-dim)' }}
        >
          {t('itinerary.existing_legs_label', { count: existingLegs.length })}
        </p>

        <div className="flex flex-col gap-4">
          <button
            onClick={() => { setAddToExisting(false); setStage('choice'); }}
            className="btn-press flex items-start text-left p-5 rounded-xl"
            style={{ background: 'var(--surface-container)', border: '1px solid var(--border-subtle)' }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mr-4 shrink-0"
              style={{ background: 'var(--surface-container-highest)', border: '1px solid var(--border-subtle)' }}
            >
              <Icon name="restart_alt" size={28} style={{ color: 'var(--primary)' }} />
            </div>
            <div className="flex flex-col gap-1 pt-1">
              <span className="text-lg font-semibold" style={{ color: 'var(--on-surface)' }}>
                {t('itinerary.choice_new_from_scratch')}
              </span>
              <span className="text-sm leading-snug" style={{ color: 'var(--on-surface-dim)' }}>
                {t('itinerary.intent_new_desc')}
              </span>
            </div>
          </button>

          <button
            onClick={() => { setAddToExisting(true); setStage('choice'); }}
            className="btn-press flex items-start text-left p-5 rounded-xl"
            style={{ background: 'var(--surface-container)', border: '1px solid var(--border-subtle)' }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mr-4 shrink-0"
              style={{ background: 'var(--surface-container-highest)', border: '1px solid var(--border-subtle)' }}
            >
              <Icon name="add_circle" size={28} style={{ color: 'var(--primary)' }} />
            </div>
            <div className="flex flex-col gap-1 pt-1">
              <span className="text-lg font-semibold" style={{ color: 'var(--on-surface)' }}>
                {t('itinerary.choice_add_to_existing')}
              </span>
              <span className="text-sm leading-snug" style={{ color: 'var(--on-surface-dim)' }}>
                {t('itinerary.intent_add_desc')}
              </span>
            </div>
          </button>
        </div>

        {/* Show existing legs as pills */}
        <div className="flex flex-wrap gap-1.5 mt-4 px-1">
          {existingLegs.map((leg) => (
            <span
              key={leg.id}
              className="px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{
                background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
                color: 'var(--primary)',
              }}
            >
              {leg.cityName}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (stage === 'choice') {
    return (
      <div className="flex flex-col pt-6 pb-4">
        {/* Header bar */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => hasExistingLegs ? setStage('intent') : navigate(-1)} className="btn-press w-10 h-10 flex items-center justify-center -ml-2 rounded-full">
            <Icon name="arrow_back" size={24} style={{ color: 'var(--on-surface-dim)' }} />
          </button>
          <span
            className="font-mono text-[11px] uppercase tracking-[0.2em]"
            style={{ color: 'var(--on-surface-dim)' }}
          >
            Copilot
          </span>
          <div className="w-10 h-10" />
        </div>

        {/* Centered header */}
        <div className="text-center mb-8 flex flex-col items-center gap-3">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-2"
            style={{ background: 'var(--surface-container)', border: '1px solid var(--border-subtle)' }}
          >
            <Icon name="flight_takeoff" size={28} filled style={{ color: 'var(--primary)' }} />
          </div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--on-surface)' }}
          >
            {t('itinerary.create_title')}
          </h1>
          <p
            className="text-base leading-relaxed max-w-[280px]"
            style={{ color: 'var(--on-surface-dim)' }}
          >
            {t('itinerary.create_subtitle')}
          </p>
        </div>

        {/* Option cards */}
        <div className="flex flex-col gap-4">
          <button
            onClick={() => { setGuidedStep(0); setGuidedAnswers({}); setGuidedInput(''); setStage('guided'); }}
            className="btn-press flex items-start text-left p-5 rounded-xl relative overflow-hidden"
            style={{ background: 'var(--surface-container)', border: '1px solid var(--border-subtle)' }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mr-4 shrink-0"
              style={{ background: 'var(--surface-container-highest)', border: '1px solid var(--border-subtle)' }}
            >
              <Icon name="explore" size={28} style={{ color: 'var(--primary)' }} />
            </div>
            <div className="flex flex-col gap-1 pt-1">
              <span className="text-lg font-semibold" style={{ color: 'var(--on-surface)' }}>
                {t('itinerary.mode_describe')}
              </span>
              <span className="text-sm leading-snug" style={{ color: 'var(--on-surface-dim)' }}>
                {t('itinerary.mode_describe_desc')}
              </span>
            </div>
          </button>

          {/* AI free text card with glow */}
          <button
            onClick={() => setStage('input')}
            className="btn-press flex items-start text-left p-5 rounded-xl relative overflow-hidden"
            style={{
              background: 'var(--surface-container)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--ai) 20%, transparent), 0 4px 20px -2px color-mix(in srgb, var(--ai) 10%, transparent)',
            }}
          >
            <div
              className="absolute top-0 right-0 w-24 h-24 rounded-full pointer-events-none"
              style={{
                background: 'color-mix(in srgb, var(--ai) 15%, transparent)',
                filter: 'blur(24px)',
                transform: 'translate(50%, -50%)',
              }}
            />
            <div
              className="relative z-10 w-14 h-14 rounded-full flex items-center justify-center mr-4 shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--surface-container-highest), var(--surface-container-high))',
                border: '1px solid color-mix(in srgb, var(--ai) 30%, transparent)',
                boxShadow: '0 0 15px color-mix(in srgb, var(--ai) 15%, transparent)',
              }}
            >
              <Icon name="auto_awesome" size={28} filled style={{ color: 'var(--ai)' }} />
            </div>
            <div className="relative z-10 flex flex-col gap-1 pt-1">
              <span className="text-lg font-semibold" style={{ color: 'var(--on-surface)' }}>
                {t('itinerary.mode_paste')}
              </span>
              <span className="text-sm leading-snug" style={{ color: 'var(--on-surface-dim)' }}>
                {t('itinerary.mode_paste_desc')}
              </span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'guided') {
    const currentStepDef = GUIDED_STEPS[guidedStep];
    const isLast = guidedStep === GUIDED_STEPS.length - 1;
    const progressPct = Math.round(((guidedStep + 1) / GUIDED_STEPS.length) * 100);

    const handleGuidedNext = () => {
      if (guidedInput.trim().length === 0) return;
      const updated = { ...guidedAnswers, [guidedStep]: guidedInput.trim() };
      setGuidedAnswers(updated);
      setGuidedInput('');

      if (isLast) {
        const compiled = compileGuidedAnswers(updated, t);
        setUserInput(compiled);
        setStage('loading');
        setError(null);

        buildItinerary({
          tripName: trip!.name,
          startDate: trip!.startDate ?? undefined,
          endDate: trip!.endDate ?? undefined,
          baseCurrency: trip!.baseCurrency,
          language: i18n.language,
          userInput: compiled,
        }).then((result) => {
          if (!result.ok) {
            setError(t(`itinerary.error_${result.error}` as never));
            setStage('guided');
            return;
          }
          const parsed = parseBuildResponse(result.data, trip!.id);
          if (parsed.legs.length === 0) {
            setError(t('itinerary.error_no_legs'));
            setStage('guided');
            return;
          }
          setLegs(parsed.legs);
          setSummary(parsed.summary);
          const suggested = parsed.suggestedPhases.length > 0
            ? parsed.suggestedPhases.map((p) => ({
              ...p,
              legs: parsed.legs.filter((l) => l.arrivalDate >= p.startDate && l.arrivalDate <= p.endDate),
            }))
            : suggestPhasesFromLegs(parsed.legs);
          setPhases(suggested);
          setStage('preview');
        });
      } else {
        setGuidedStep(guidedStep + 1);
      }
    };

    const handleGuidedBack = () => {
      if (guidedStep === 0) {
        setStage('choice');
      } else {
        setGuidedInput(guidedAnswers[guidedStep - 1] ?? '');
        setGuidedStep(guidedStep - 1);
      }
    };

    return (
      <div className="flex flex-col min-h-[80vh] pt-6 pb-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={handleGuidedBack} className="btn-press w-10 h-10 flex items-center justify-center -ml-2 rounded-full">
            <Icon name="arrow_back" size={24} style={{ color: 'var(--on-surface-dim)' }} />
          </button>
          <span
            className="text-sm font-semibold"
            style={{ color: 'var(--on-surface)' }}
          >
            {t('itinerary.guided_mode_title')}
          </span>
          <div className="w-10 h-10" />
        </div>

        {/* Progress bar + step label */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p
              className="font-mono text-[10px] uppercase tracking-[0.15em] font-bold"
              style={{ color: 'var(--on-surface-dim)' }}
            >
              {t('itinerary.guided_step_label', { current: guidedStep + 1, total: GUIDED_STEPS.length })}
            </p>
            <span
              className="font-mono text-[10px]"
              style={{ color: 'var(--on-surface-faint)' }}
            >
              {progressPct}%
            </span>
          </div>
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ background: 'var(--surface-container-high)' }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${progressPct}%`,
                background: 'var(--primary)',
              }}
            />
          </div>
        </div>

        {error && (
          <div
            className="p-3 rounded-xl text-sm mb-3"
            style={{ background: 'color-mix(in srgb, var(--error) 10%, transparent)', color: 'var(--error)' }}
          >
            {error}
          </div>
        )}

        {/* Centered question content */}
        {currentStepDef && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            {/* Icon circle */}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-8"
              style={{
                background: 'var(--surface-container-high)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Icon name={currentStepDef.icon} size={28} style={{ color: 'var(--primary)' }} />
            </div>

            {/* Question text */}
            <h2
              className="text-2xl font-bold leading-tight tracking-tight mb-6"
              style={{ color: 'var(--on-surface)' }}
            >
              {t(`itinerary.guided_q_${currentStepDef.key}` as never)}
            </h2>

            {/* Input with icon */}
            <div
              className="w-full relative rounded-xl"
              style={{
                border: '1px solid var(--primary)',
              }}
            >
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Icon name={currentStepDef.icon} size={18} style={{ color: 'var(--on-surface-dim)' }} />
              </div>
              <input
                type="text"
                value={guidedInput}
                onChange={(e) => setGuidedInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleGuidedNext(); }}
                placeholder={t(`itinerary.guided_ph_${currentStepDef.key}` as never)}
                className="w-full pl-10 pr-4 py-3.5 rounded-xl text-sm outline-none bg-transparent"
                style={{
                  color: 'var(--on-surface)',
                }}
                autoFocus
              />
            </div>

            {/* Helper text */}
            <p
              className="text-xs mt-2 self-start"
              style={{ color: 'var(--on-surface-faint)' }}
            >
              {t(`itinerary.guided_hint_${currentStepDef.key}` as never)}
            </p>
          </div>
        )}

        {/* Bottom buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleGuidedBack}
            className="btn-press flex-shrink-0 px-6 py-3.5 rounded-xl text-sm font-medium"
            style={{
              background: 'transparent',
              color: 'var(--on-surface)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {t('itinerary.guided_back')}
          </button>
          <button
            onClick={handleGuidedNext}
            disabled={guidedInput.trim().length === 0}
            className="btn-press flex-1 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: 'var(--primary)', color: '#fff' }}
          >
            {isLast ? t('itinerary.build_button') : t('itinerary.guided_next')}
            <Icon name="arrow_forward" size={18} style={{ color: '#fff' }} />
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'input') {
    return (
      <div className="flex flex-col gap-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setStage('choice')} className="btn-press w-10 h-10 flex items-center justify-center -ml-2 rounded-full">
            <Icon name="arrow_back" size={24} style={{ color: 'var(--on-surface-dim)' }} />
          </button>
          <span
            className="font-mono text-[11px] uppercase tracking-[0.2em]"
            style={{ color: 'var(--on-surface-dim)' }}
          >
            Copilot
          </span>
          <div className="w-10 h-10" />
        </div>

        <h2
          className="text-xl font-bold tracking-tight"
          style={{ color: 'var(--on-surface)' }}
        >
          {t('itinerary.input_title')}
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--on-surface-dim)' }}>
          {t('itinerary.input_hint')}
        </p>

        {error && (
          <div
            className="p-3 rounded-xl text-sm"
            style={{ background: 'color-mix(in srgb, var(--error) 10%, transparent)', color: 'var(--error)' }}
          >
            {error}
          </div>
        )}

        <div className="relative">
          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value.slice(0, 500))}
            placeholder={t('itinerary.input_placeholder')}
            className="w-full h-48 p-4 rounded-2xl text-sm leading-relaxed resize-none outline-none"
            style={{
              background: 'var(--surface-container-high)',
              color: 'var(--on-surface)',
              border: '1px solid var(--on-surface-faint)',
            }}
            autoFocus
          />
          <span
            className="absolute bottom-3 right-3 font-mono text-[10px]"
            style={{ color: 'var(--on-surface-faint)' }}
          >
            {userInput.length}/500
          </span>
        </div>

        <button
          onClick={handleBuild}
          disabled={userInput.trim().length < 5}
          className="btn-press w-full py-3.5 rounded-xl font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: 'var(--primary)', color: '#fff' }}
        >
          <Icon name="auto_awesome" size={18} style={{ color: '#fff' }} />
          {t('itinerary.build_button')}
        </button>
      </div>
    );
  }

  if (stage === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-8 py-24">
        {/* Animated ring with icon */}
        <div className="relative w-20 h-20">
          <svg className="w-20 h-20 animate-spin" style={{ animationDuration: '2s' }} viewBox="0 0 80 80">
            <circle
              cx="40" cy="40" r="34"
              fill="none"
              strokeWidth="3"
              style={{ stroke: 'var(--surface-container-high)' }}
            />
            <circle
              cx="40" cy="40" r="34"
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="140 80"
              style={{ stroke: 'var(--primary)' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon name="flight_takeoff" size={24} filled style={{ color: 'var(--primary)' }} />
          </div>
        </div>

        <div className="text-center">
          <p
            className="text-lg font-bold mb-2"
            style={{ color: 'var(--on-surface)' }}
          >
            {addToExisting ? t('itinerary.ai_adding') : t('itinerary.loading')}
          </p>
          <p className="text-sm" style={{ color: 'var(--on-surface-dim)' }}>
            {t('itinerary.loading_subtitle')}
          </p>
        </div>

        {/* 3-step simulated checklist */}
        <div className="flex flex-col gap-4 w-full max-w-[280px]">
          {LOADING_STEPS.map((step, i) => (
            <div
              key={step.icon}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: i === 0
                  ? 'color-mix(in srgb, var(--primary) 5%, transparent)'
                  : 'transparent',
                borderLeft: i <= 1
                  ? '2px solid var(--primary)'
                  : '2px solid var(--surface-container-high)',
              }}
            >
              <Icon
                name={i === 0 ? 'check_circle' : i === 1 ? 'check_circle' : 'sync'}
                size={18}
                className={i === 2 ? 'animate-spin' : ''}
                style={{
                  color: i <= 1 ? 'var(--primary)' : 'var(--on-surface-faint)',
                  ...(i === 2 ? { animationDuration: '2s' } : {}),
                }}
              />
              <span
                className="text-sm"
                style={{
                  color: i <= 1 ? 'var(--on-surface)' : 'var(--on-surface-faint)',
                }}
              >
                {t(step.labelKey as never)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (stage === 'preview') {
    return (
      <div className="flex flex-col gap-4 pt-4 pb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setStage('input')} className="btn-press w-10 h-10 flex items-center justify-center -ml-1 rounded-full">
            <Icon name="arrow_back" size={24} style={{ color: 'var(--on-surface-dim)' }} />
          </button>
          <h2 className="text-lg font-bold flex-1" style={{ color: 'var(--on-surface)' }}>
            {t('itinerary.preview_title')}
          </h2>
          {/* AI Generated pill */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{
              background: 'color-mix(in srgb, var(--ai) 15%, transparent)',
              border: '1px solid color-mix(in srgb, var(--ai) 30%, transparent)',
            }}
          >
            <Icon name="auto_awesome" size={12} filled style={{ color: 'var(--ai)' }} />
            <span
              className="font-mono text-[9px] uppercase tracking-[0.1em] font-bold"
              style={{ color: 'var(--ai)' }}
            >
              AI
            </span>
          </div>
        </div>

        {summary && (
          <p className="text-sm leading-relaxed" style={{ color: 'var(--on-surface-dim)' }}>
            {summary}
          </p>
        )}

        {error && (
          <div
            className="p-3 rounded-xl text-sm"
            style={{ background: 'color-mix(in srgb, var(--error) 10%, transparent)', color: 'var(--error)' }}
          >
            {error}
          </div>
        )}

        <ItineraryPreview
          legs={legs}
          suggestedPhases={phases}
          tripId={trip.id}
          onSave={handleSave}
        />

        {/* Inline refinement input */}
        <div
          className="flex gap-2 items-end p-3 rounded-xl mt-2"
          style={{ background: 'var(--surface-container)', border: '1px solid var(--border-subtle)' }}
        >
          <textarea
            value={refinement}
            onChange={(e) => setRefinement(e.target.value)}
            placeholder={t('itinerary.refine_placeholder')}
            className="flex-1 text-sm resize-none outline-none bg-transparent min-h-[40px]"
            style={{ color: 'var(--on-surface)' }}
            rows={2}
          />
          <button
            onClick={handleRefine}
            disabled={refinement.trim().length < 3}
            className="btn-press shrink-0 w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40"
            style={{ background: 'var(--ai)' }}
          >
            <Icon name="auto_awesome" size={18} style={{ color: '#fff' }} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
