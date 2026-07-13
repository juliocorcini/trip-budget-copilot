import type { SyncMetadata } from './common';

export type TransportType = 'flight' | 'train' | 'bus' | 'car' | 'ferry' | 'walk' | 'other';
export type BookingStatus = 'purchased' | 'booked' | 'priced' | 'estimated' | 'none';
export type DayType = 'full' | 'transit' | 'festival' | 'rest' | 'day_trip';

export type AccommodationType =
  | 'hotel'
  | 'hostel'
  | 'apartment'
  | 'friend'
  | 'airbnb'
  | 'camping'
  | 'other';

export interface ArrivalTransport {
  type: TransportType;
  company: string | null;
  route: string | null;
  bookingStatus: BookingStatus;
  costCents: number | null;
  costCurrency: string | null;
  isPrepaid: boolean;
  reference: string | null;
  notes: string | null;
}

export interface LegAccommodation {
  name: string;
  type: AccommodationType;
  bookingStatus: BookingStatus;
  costCents: number | null;
  costCurrency: string | null;
  isPrepaid: boolean;
  nights: number;
  reference: string | null;
  notes: string | null;
}

export interface ItineraryLeg extends SyncMetadata {
  tripId: string;
  order: number;

  cityName: string;
  countryCode: string | null;

  arrivalDate: string;
  arrivalTime: string | null;
  departureDate: string;
  departureTime: string | null;

  arrivalTransport: ArrivalTransport | null;
  accommodation: LegAccommodation | null;

  dailyBudgetCents: number | null;
  dailyBudgetCurrency: string | null;
  budgetPremise: string | null;

  companions: string[];
  dayType: DayType;
  highlights: string[];

  linkedPhaseId: string | null;
  personalNotes: string | null;
}
