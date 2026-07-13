import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db/database';
import { getCurrentLeg } from '@/domain/itinerary/itinerary-domain';
import { localDateString } from '@/domain/dates';
import type { ItineraryLeg } from '@/domain/types/itinerary-leg';

export interface ItineraryDayContext {
  currentLeg: ItineraryLeg | null;
  budgetPremise: string | null;
  dailyBudgetCents: number | null;
  dailyBudgetCurrency: string | null;
  companions: string[];
}

export function useItineraryDayContext(tripId: string | undefined): ItineraryDayContext {
  const today = localDateString();

  const legs = useLiveQuery(
    async () => {
      if (!tripId) return [];
      return db.itineraryLegs
        .where('tripId')
        .equals(tripId)
        .filter((l) => l.deletedAt === null)
        .sortBy('order');
    },
    [tripId],
    [] as ItineraryLeg[],
  );

  return useMemo(() => {
    if (legs.length === 0) {
      return { currentLeg: null, budgetPremise: null, dailyBudgetCents: null, dailyBudgetCurrency: null, companions: [] };
    }

    const leg = getCurrentLeg(legs, today);
    if (!leg) {
      return { currentLeg: null, budgetPremise: null, dailyBudgetCents: null, dailyBudgetCurrency: null, companions: [] };
    }

    return {
      currentLeg: leg,
      budgetPremise: leg.budgetPremise,
      dailyBudgetCents: leg.dailyBudgetCents,
      dailyBudgetCurrency: leg.dailyBudgetCurrency,
      companions: leg.companions,
    };
  }, [legs, today]);
}
