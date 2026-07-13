import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db/database';
import type { ItineraryLeg } from '@/domain/types/itinerary-leg';

/**
 * Returns a function that maps a date string to the city name of the
 * itinerary leg active on that date, or null if no leg covers it.
 * The legs are queried once and cached; lookup is O(N) per call but
 * N is small (typically 5-25 legs).
 */
export function useExpenseLegCity(
  tripId: string | undefined,
): (date: string) => string | null {
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

  return useMemo(
    () => (date: string) => {
      for (const leg of legs) {
        if (date >= leg.arrivalDate && date <= leg.departureDate) {
          return leg.cityName;
        }
      }
      return null;
    },
    [legs],
  );
}
