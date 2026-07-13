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
import { BottomSheet } from '@/components/BottomSheet';
import { ItineraryPreview } from './ItineraryPreview';
import type { ItineraryLeg } from '@/domain/types/itinerary-leg';
import type { SuggestedPhase } from '@/domain/itinerary/itinerary-domain';

type FlowStage = 'choice' | 'input' | 'guided' | 'loading' | 'preview' | 'refining';

const GUIDED_STEPS = [
  { key: 'cities', icon: '🌍' },
  { key: 'duration', icon: '📅' },
  { key: 'transport', icon: '🚂' },
  { key: 'accommodation', icon: '🏠' },
  { key: 'events', icon: '🎉' },
  { key: 'budget', icon: '💰' },
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
      if (!trip || !isAddMode) return [];
      return db.itineraryLegs
        .where('tripId')
        .equals(trip.id)
        .filter((l) => l.deletedAt === null)
        .sortBy('order');
    },
    [trip?.id, isAddMode],
    [] as ItineraryLeg[],
  );

  const nextOrder = useMemo(() => {
    if (existingLegs.length === 0) return 1;
    return Math.max(...existingLegs.map((l) => l.order)) + 1;
  }, [existingLegs]);

  const [stage, setStage] = useState<FlowStage>(isAddMode ? 'input' : 'choice');
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

    const contextPrefix = isAddMode && existingLegs.length > 0
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

    if (isAddMode) {
      const reorderedLegs = parsed.legs.map((leg, idx) => ({
        ...leg,
        order: nextOrder + idx,
      }));
      setLegs(reorderedLegs);
    } else {
      setLegs(parsed.legs);
    }

    setSummary(parsed.summary);
    const allLegs = isAddMode ? [...existingLegs, ...parsed.legs] : parsed.legs;
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

  // ─── Add mode: direct input screen ───
  if (isAddMode && (stage === 'input' || stage === 'choice')) {
    return (
      <div className="flex flex-col gap-4 pt-6 pb-4">
        <button onClick={() => navigate(-1)} className="self-start btn-press">
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Icon name="auto_awesome" size={22} className="text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface">{t('itinerary.ai_add_title')}</h2>
            <p className="text-xs text-on-surface-dim">{t('itinerary.ai_add_subtitle')}</p>
          </div>
        </div>

        {existingLegs.length > 0 && (
          <div className="p-3 rounded-xl bg-surface-high">
            <p className="text-xs font-semibold text-on-surface-dim mb-1.5">
              {t('itinerary.preview_legs', { count: existingLegs.length })}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {existingLegs.map((leg) => (
                <span key={leg.id} className="px-2 py-1 rounded-lg bg-primary/10 text-xs text-primary font-medium">
                  {leg.cityName}
                </span>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-error/10 text-error text-sm">{error}</div>
        )}

        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder={t('itinerary.ai_add_placeholder')}
          className="w-full h-40 p-4 rounded-2xl bg-surface-high text-on-surface text-sm leading-relaxed resize-none outline-none focus:ring-2 focus:ring-primary/40"
          autoFocus
        />

        <button
          onClick={handleBuild}
          disabled={userInput.trim().length < 5}
          className="btn-press w-full py-3.5 rounded-xl font-bold text-sm disabled:opacity-40"
          style={{ background: 'var(--primary)', color: 'var(--surface)' }}
        >
          <Icon name="auto_awesome" size={16} className="text-surface inline-block mr-1.5 align-text-bottom" />
          {t('itinerary.ai_add_button')}
        </button>
      </div>
    );
  }

  if (stage === 'choice') {
    return (
      <div className="flex flex-col gap-5 pt-6 pb-4">
        <button onClick={() => navigate(-1)} className="self-start btn-press">
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>

        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Icon name="route" size={32} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold text-on-surface">{t('itinerary.create_title')}</h1>
          <p className="text-sm text-on-surface-dim mt-2 leading-relaxed">
            {t('itinerary.create_subtitle')}
          </p>
        </div>

        <div className="flex flex-col gap-3 mt-4">
          <button
            onClick={() => setStage('input')}
            className="btn-press flex items-center gap-3 p-4 rounded-2xl bg-surface-high text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Icon name="content_paste" size={20} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold text-on-surface">{t('itinerary.mode_paste')}</p>
              <p className="text-xs text-on-surface-dim mt-0.5">{t('itinerary.mode_paste_desc')}</p>
            </div>
          </button>

          <button
            onClick={() => { setGuidedStep(0); setGuidedAnswers({}); setGuidedInput(''); setStage('guided'); }}
            className="btn-press flex items-center gap-3 p-4 rounded-2xl bg-surface-high text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Icon name="chat" size={20} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold text-on-surface">{t('itinerary.mode_describe')}</p>
              <p className="text-xs text-on-surface-dim mt-0.5">{t('itinerary.mode_describe_desc')}</p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'guided') {
    const currentStepDef = GUIDED_STEPS[guidedStep];
    const isLast = guidedStep === GUIDED_STEPS.length - 1;

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

    return (
      <div className="flex flex-col h-full pt-6 pb-4">
        <button onClick={() => setStage('choice')} className="self-start btn-press mb-4">
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>

        <h2 className="text-lg font-bold text-on-surface mb-1">{t('itinerary.guided_title')}</h2>
        <p className="text-xs text-on-surface-faint mb-4">
          {guidedStep + 1}/{GUIDED_STEPS.length}
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-error/10 text-error text-sm mb-3">{error}</div>
        )}

        <div className="flex-1 overflow-y-auto flex flex-col gap-3 mb-4">
          {GUIDED_STEPS.slice(0, guidedStep + 1).map((step, i) => (
            <div key={step.key} className="flex flex-col gap-2">
              <div className="flex items-start gap-2 max-w-[85%]">
                <span className="text-lg shrink-0 mt-0.5">{step.icon}</span>
                <div className="p-3 rounded-2xl rounded-tl-sm bg-surface-high">
                  <p className="text-sm text-on-surface">
                    {t(`itinerary.guided_q_${step.key}` as never)}
                  </p>
                </div>
              </div>
              {guidedAnswers[i] !== undefined && (
                <div className="self-end max-w-[85%]">
                  <div className="p-3 rounded-2xl rounded-br-sm" style={{ background: 'var(--primary)', color: 'var(--surface)' }}>
                    <p className="text-sm">{guidedAnswers[i]}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {currentStepDef && (
          <div className="flex gap-2 items-end">
            <input
              type="text"
              value={guidedInput}
              onChange={(e) => setGuidedInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleGuidedNext(); }}
              placeholder={t(`itinerary.guided_ph_${currentStepDef.key}` as never)}
              className="flex-1 px-4 py-3 rounded-xl bg-surface-high text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/40"
              autoFocus
            />
            <button
              onClick={handleGuidedNext}
              disabled={guidedInput.trim().length === 0}
              className="btn-press shrink-0 w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40"
              style={{ background: 'var(--primary)' }}
            >
              <Icon name={isLast ? 'check' : 'arrow_forward'} size={18} className="text-surface" />
            </button>
          </div>
        )}
      </div>
    );
  }

  if (stage === 'input') {
    return (
      <div className="flex flex-col gap-4 pt-6 pb-4">
        <button onClick={() => setStage('choice')} className="self-start btn-press">
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>

        <h2 className="text-lg font-bold text-on-surface">{t('itinerary.input_title')}</h2>
        <p className="text-sm text-on-surface-dim leading-relaxed">{t('itinerary.input_hint')}</p>

        {error && (
          <div className="p-3 rounded-xl bg-error/10 text-error text-sm">{error}</div>
        )}

        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder={t('itinerary.input_placeholder')}
          className="w-full h-48 p-4 rounded-2xl bg-surface-high text-on-surface text-sm leading-relaxed resize-none outline-none focus:ring-2 focus:ring-primary/40"
          autoFocus
        />

        <button
          onClick={handleBuild}
          disabled={userInput.trim().length < 5}
          className="btn-press w-full py-3.5 rounded-xl font-bold text-sm disabled:opacity-40"
          style={{ background: 'var(--primary)', color: 'var(--surface)' }}
        >
          {t('itinerary.build_button')}
        </button>
      </div>
    );
  }

  if (stage === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-3 border-primary border-t-transparent animate-spin" />
        </div>
        <p className="text-sm font-bold text-on-surface">
          {isAddMode ? t('itinerary.ai_adding') : t('itinerary.loading')}
        </p>
        <p className="text-xs text-on-surface-faint text-center px-4 leading-relaxed">
          {isAddMode ? t('itinerary.ai_adding_hint') : t('itinerary.loading_hint')}
        </p>
      </div>
    );
  }

  if (stage === 'preview') {
    return (
      <div className="flex flex-col gap-4 pt-4 pb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setStage(isAddMode ? 'input' : 'input')} className="btn-press">
            <Icon name="arrow_back" size={24} className="text-on-surface" />
          </button>
          <h2 className="text-lg font-bold text-on-surface flex-1">{t('itinerary.preview_title')}</h2>
        </div>

        {summary && (
          <p className="text-sm text-on-surface-dim leading-relaxed">{summary}</p>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-error/10 text-error text-sm">{error}</div>
        )}

        <ItineraryPreview
          legs={legs}
          suggestedPhases={phases}
          tripId={trip.id}
          onSave={handleSave}
        />

        <div className="flex flex-col gap-2 mt-2">
          <button
            onClick={() => setStage('refining')}
            className="btn-press w-full py-3 rounded-xl text-sm font-semibold bg-surface-high text-on-surface"
          >
            <Icon name="edit" size={14} className="text-on-surface-dim inline-block mr-1 align-text-bottom" />
            {t('itinerary.adjust_with_ai')}
          </button>
        </div>

        <BottomSheet
          open={stage === 'refining' as never}
          onClose={() => setStage('preview')}
          title={t('itinerary.refine_title')}
        >
          <div className="flex flex-col gap-3 pb-2">
            <textarea
              value={refinement}
              onChange={(e) => setRefinement(e.target.value)}
              placeholder={t('itinerary.refine_placeholder')}
              className="w-full h-32 p-3 rounded-xl bg-surface-high text-on-surface text-sm resize-none outline-none"
              autoFocus
            />
            <button
              onClick={handleRefine}
              disabled={refinement.trim().length < 3}
              className="btn-press w-full py-3 rounded-xl font-bold text-sm disabled:opacity-40"
              style={{ background: 'var(--primary)', color: 'var(--surface)' }}
            >
              {t('itinerary.refine_button')}
            </button>
          </div>
        </BottomSheet>
      </div>
    );
  }

  return null;
}
