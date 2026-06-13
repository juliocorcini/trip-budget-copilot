import { v4 as uuidv4 } from 'uuid';
import { parseISO, addDays, format, differenceInCalendarDays } from 'date-fns';
import type { Trip } from '@/domain/types/trip';
import type { Phase } from '@/domain/types/phase';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type {
  TripTemplate,
  TemplatePhase,
  TemplateProfile,
} from '@/domain/types/trip-template';

/**
 * E7 (M21/M22/M23) — trip templates: turn what a trip learned into priors for
 * the next one. Everything here is PURE and side-effect free; persistence lives
 * in the template orchestrators. Applying a template mints brand-new ids/dates
 * so it can never collide with the source trip (ÂNCORA 12 — explicit reuse).
 */

/** New trips re-learn from their own spending, so applied profiles start cold. */
const APPLIED_PROFILE_CONFIDENCE = 'low' as const;

function templateProfileFromActivity(profile: ActivityProfile): TemplateProfile {
  return {
    name: profile.name,
    category: profile.category,
    iconName: profile.iconName,
    color: profile.color,
    typicalValueCents: profile.typicalValueCents,
    safeValueCents: profile.safeValueCents,
    expectedFrequencyPerPhase: profile.expectedFrequencyPerPhase,
    isCustom: profile.isCustom,
    defaultTargetCents: profile.defaultTargetCents,
    defaultCeilingCents: profile.defaultCeilingCents,
    defaultMaxCents: profile.defaultMaxCents,
    defaultAvgDrinkPriceCents: profile.defaultAvgDrinkPriceCents,
    quickAddValuesCents: profile.quickAddValuesCents,
  };
}

function templatePhaseFromPhase(phase: Phase): TemplatePhase {
  return {
    name: phase.name,
    order: phase.order,
    durationDays: Math.max(
      1,
      differenceInCalendarDays(parseISO(phase.endDate), parseISO(phase.startDate)) + 1,
    ),
    rhythmPreset: phase.rhythmPreset,
    peakDays: phase.peakDays,
  };
}

export interface BuildTripTemplateInput {
  id: string;
  name: string;
  createdAt: string;
  baseCurrency: string;
  phases: Phase[];
  profiles: ActivityProfile[];
}

/**
 * M22: serialize a live trip into a reusable mold — its phase structure (names,
 * order, relative length, rhythm) and its learned profiles (typicals/safe/cost
 * shape). Soft-deleted records are dropped; phases come out ordered.
 */
export function buildTripTemplate(input: BuildTripTemplateInput): TripTemplate {
  const phases = input.phases
    .filter((p) => p.deletedAt === null)
    .sort((a, b) => a.order - b.order)
    .map(templatePhaseFromPhase);
  const profiles = input.profiles
    .filter((p) => p.deletedAt === null)
    .map(templateProfileFromActivity);
  return {
    id: input.id,
    name: input.name,
    createdAt: input.createdAt,
    baseCurrency: input.baseCurrency,
    phases,
    profiles,
  };
}

export interface TemplateSummary {
  phaseCount: number;
  profileCount: number;
}

/** Small read model for the picker/list — counts only, no money math. */
export function summarizeTemplate(template: TripTemplate): TemplateSummary {
  return {
    phaseCount: template.phases.length,
    profileCount: template.profiles.length,
  };
}

export interface InstantiateTemplateInput {
  template: TripTemplate;
  tripId: string;
  budgetPoolId: string;
  startDate: string;
  endDate: string;
  deviceId: string;
  now: string;
}

export interface InstantiateTemplateResult {
  phases: Phase[];
  links: BudgetPoolPhaseLink[];
  profiles: ActivityProfile[];
}

/**
 * M23: build the new-trip entities from a template. Phases are laid contiguously
 * across the new [startDate, endDate] range proportionally to their stored
 * duration (first starts on startDate, last ends on endDate), each linked to the
 * trip's operational pool. Profiles are recreated cold (confidence low, zero
 * data points) so the new trip re-learns from its own spending.
 */
export function instantiateTemplate(input: InstantiateTemplateInput): InstantiateTemplateResult {
  const meta = {
    createdAt: input.now,
    updatedAt: input.now,
    deletedAt: null as string | null,
    revision: 1,
    sourceDeviceId: input.deviceId,
  };

  const profiles: ActivityProfile[] = input.template.profiles.map((tp) => ({
    ...meta,
    id: uuidv4(),
    tripId: input.tripId,
    name: tp.name,
    category: tp.category,
    iconName: tp.iconName,
    color: tp.color,
    typicalValueCents: tp.typicalValueCents,
    safeValueCents: tp.safeValueCents,
    confidence: APPLIED_PROFILE_CONFIDENCE,
    dataPointCount: 0,
    expectedFrequencyPerPhase: tp.expectedFrequencyPerPhase,
    isCustom: tp.isCustom,
    defaultTargetCents: tp.defaultTargetCents,
    defaultCeilingCents: tp.defaultCeilingCents,
    defaultMaxCents: tp.defaultMaxCents,
    defaultAvgDrinkPriceCents: tp.defaultAvgDrinkPriceCents,
    quickAddValuesCents: tp.quickAddValuesCents,
    notes: null,
  }));

  const phases: Phase[] = [];
  const links: BudgetPoolPhaseLink[] = [];

  const orderedTemplatePhases = [...input.template.phases].sort((a, b) => a.order - b.order);
  if (orderedTemplatePhases.length > 0) {
    const totalDays = Math.max(
      1,
      differenceInCalendarDays(parseISO(input.endDate), parseISO(input.startDate)) + 1,
    );
    const totalDuration = orderedTemplatePhases.reduce(
      (sum, p) => sum + Math.max(1, p.durationDays),
      0,
    );
    const tripStart = parseISO(input.startDate);

    let cumulative = 0;
    orderedTemplatePhases.forEach((tp, index) => {
      const isLast = index === orderedTemplatePhases.length - 1;
      const startOffset = index === 0 ? 0 : Math.round((totalDays * cumulative) / totalDuration);
      cumulative += Math.max(1, tp.durationDays);
      const endOffset = isLast
        ? totalDays - 1
        : Math.round((totalDays * cumulative) / totalDuration) - 1;
      const safeStart = Math.min(Math.max(0, startOffset), totalDays - 1);
      const safeEnd = Math.min(Math.max(safeStart, endOffset), totalDays - 1);

      const phaseId = uuidv4();
      phases.push({
        ...meta,
        id: phaseId,
        tripId: input.tripId,
        name: tp.name,
        startDate: format(addDays(tripStart, safeStart), 'yyyy-MM-dd'),
        endDate: format(addDays(tripStart, safeEnd), 'yyyy-MM-dd'),
        order: index,
        rhythmPreset: tp.rhythmPreset,
        peakDays: tp.peakDays,
        notes: null,
      });
      links.push({
        ...meta,
        id: uuidv4(),
        budgetPoolId: input.budgetPoolId,
        phaseId,
        futureFloorCents: null,
      });
    });
  }

  return { phases, links, profiles };
}

export interface TripPriorsOffer {
  tripId: string;
  tripName: string;
  profileCount: number;
}

export interface DetectTripPriorsOfferInput {
  trip: Trip | null;
  todayIso: string;
  profiles: ActivityProfile[];
  /** settings.tripPriorsHandled — trips whose offer was already saved/dismissed. */
  handledTripIds: string[];
}

/**
 * M21: at the end of a trip (today is past its end date), offer to save what it
 * learned as priors for the next one — once. Returns null while the trip is
 * still running, when there is nothing learned to save, or when the traveler
 * already handled the offer for this trip (anti-nag, mirrors ÂNCORA 8).
 */
export function detectTripPriorsOffer(input: DetectTripPriorsOfferInput): TripPriorsOffer | null {
  const { trip } = input;
  if (!trip) return null;
  if (input.todayIso <= trip.endDate.slice(0, 10)) return null;
  if (input.handledTripIds.includes(trip.id)) return null;
  const liveProfiles = input.profiles.filter((p) => p.deletedAt === null);
  if (liveProfiles.length === 0) return null;
  return {
    tripId: trip.id,
    tripName: trip.name,
    profileCount: liveProfiles.length,
  };
}

/** Append a trip id to the handled list (idempotent). */
export function markTripPriorsHandled(handled: string[], tripId: string): string[] {
  return handled.includes(tripId) ? handled : [...handled, tripId];
}

/** Append/replace a template by id (newest kept), capped to avoid unbounded growth. */
const MAX_TEMPLATES = 20;
export function upsertTemplate(templates: TripTemplate[], template: TripTemplate): TripTemplate[] {
  const without = templates.filter((t) => t.id !== template.id);
  return [template, ...without].slice(0, MAX_TEMPLATES);
}

export function removeTemplate(templates: TripTemplate[], templateId: string): TripTemplate[] {
  return templates.filter((t) => t.id !== templateId);
}
