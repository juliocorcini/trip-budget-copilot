import { db } from '@/data/db/database';
import type { ItineraryLeg } from '@/domain/types/itinerary-leg';
import { BaseRepository } from './base-repository';

class ItineraryLegRepository extends BaseRepository<ItineraryLeg> {
  constructor() {
    super(db.itineraryLegs);
  }

  async getByTripId(tripId: string): Promise<ItineraryLeg[]> {
    return this.table
      .where('tripId')
      .equals(tripId)
      .filter((leg) => leg.deletedAt === null)
      .sortBy('order');
  }

  async getByTripIdAndDate(tripId: string, date: string): Promise<ItineraryLeg[]> {
    const legs = await this.getByTripId(tripId);
    return legs.filter((leg) => leg.arrivalDate <= date && leg.departureDate >= date);
  }

  async saveBatch(legs: ItineraryLeg[]): Promise<void> {
    await this.table.bulkPut(legs);
  }

  async removeAllByTripId(tripId: string): Promise<void> {
    const legs = await this.getByTripId(tripId);
    await Promise.all(legs.map((leg) => this.delete(leg.id)));
  }
}

export const itineraryLegRepository = new ItineraryLegRepository();
