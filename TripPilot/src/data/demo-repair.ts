import { findActivePhase, sortPhasesByOrder } from '@/domain/dates';
import type { AppSettings } from '@/domain/types/app-settings';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import { createSyncMetadata } from '@/utils/entity-factory';
import {
  tripRepository,
  phaseRepository,
  activityProfileRepository,
} from '@/data/repositories';

function dayOffset(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function createDefaultProfiles(tripId: string): ActivityProfile[] {
  const base = createSyncMetadata();
  return [
    {
      ...base,
      tripId,
      name: 'Bar',
      category: 'bar',
      iconName: 'local_bar',
      color: '#C75B39',
      typicalValueCents: 1500,
      safeValueCents: 2000,
      confidence: 'medium',
      dataPointCount: 3,
      expectedFrequencyPerPhase: 5,
      isCustom: false,
      defaultTargetCents: 1500,
      defaultCeilingCents: 2500,
      defaultMaxCents: 3500,
      defaultAvgDrinkPriceCents: 350,
      quickAddValuesCents: null,
      notes: null,
    },
    {
      ...base,
      id: crypto.randomUUID(),
      tripId,
      name: 'Restaurante',
      category: 'restaurant',
      iconName: 'restaurant',
      color: '#D4A843',
      typicalValueCents: 1200,
      safeValueCents: 1800,
      confidence: 'medium',
      dataPointCount: 2,
      expectedFrequencyPerPhase: 4,
      isCustom: false,
      defaultTargetCents: null,
      defaultCeilingCents: null,
      defaultMaxCents: null,
      defaultAvgDrinkPriceCents: null,
      quickAddValuesCents: null,
      notes: null,
    },
    {
      ...base,
      id: crypto.randomUUID(),
      tripId,
      name: 'Mercado',
      category: 'market',
      iconName: 'shopping_cart',
      color: '#6B8F71',
      typicalValueCents: 2500,
      safeValueCents: 3500,
      confidence: 'low',
      dataPointCount: 1,
      expectedFrequencyPerPhase: 3,
      isCustom: false,
      defaultTargetCents: null,
      defaultCeilingCents: null,
      defaultMaxCents: null,
      defaultAvgDrinkPriceCents: null,
      quickAddValuesCents: null,
      notes: null,
    },
  ];
}

export async function repairDemoTripIfNeeded(settings: AppSettings): Promise<void> {
  if (!settings.activeTrip) return;

  const tripId = settings.activeTrip;
  const [trip, phases, profiles] = await Promise.all([
    tripRepository.getById(tripId),
    phaseRepository.getByTripId(tripId),
    activityProfileRepository.getByTripId(tripId),
  ]);

  if (!trip || phases.length === 0) return;

  // DEC-111: rewriting dates is ONLY valid for the demo trip. A real trip
  // outside its date range (future or finished) is user truth — never touch.
  if (settings.isDemo && !findActivePhase(phases)) {
    const now = new Date();
    const tripStart = dayOffset(now, -13);
    const phase1End = dayOffset(now, 10);
    const phase2Start = dayOffset(now, 11);
    const tripEnd = dayOffset(now, 33);

    await tripRepository.update({
      ...trip,
      startDate: tripStart,
      endDate: tripEnd,
    });

    const sorted = sortPhasesByOrder(phases);
    if (sorted[0]) {
      await phaseRepository.update({
        ...sorted[0],
        startDate: tripStart,
        endDate: sorted.length > 1 ? phase1End : tripEnd,
      });
    }
    if (sorted[1]) {
      await phaseRepository.update({
        ...sorted[1],
        startDate: phase2Start,
        endDate: tripEnd,
      });
    }
  }

  // BUG-015: only the DEMO trip gets its default profiles rebuilt. A real trip
  // with zero active profiles is user truth (they deleted them, or it was
  // imported/synced without profiles) — never resurrect them, or every boot
  // re-creates rows and soft-deleted profiles pile up as duplicates.
  if (settings.isDemo && profiles.length === 0) {
    await activityProfileRepository.bulkCreate(createDefaultProfiles(tripId));
  }
}
