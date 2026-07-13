import { describe, it, expect } from 'vitest';
import { getSchedulableTransports } from '@/domain/itinerary/itinerary-domain';
import type { ItineraryLeg } from '@/domain/types/itinerary-leg';

const baseMeta = {
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test-device',
  personalNotes: null,
};

const transport = {
  type: 'flight' as const,
  company: 'Iberia',
  route: 'MAD → VCE',
  bookingStatus: 'purchased' as const,
  costCents: 37971,
  costCurrency: 'BRL',
  isPrepaid: true,
  reference: null,
  notes: null,
};

const baseLeg: ItineraryLeg = {
  ...baseMeta,
  id: 'leg-1',
  tripId: 'trip-1',
  order: 1,
  cityName: 'Venice',
  countryCode: 'IT',
  arrivalDate: '2026-07-15',
  arrivalTime: '10:00',
  departureDate: '2026-07-17',
  departureTime: '08:30',
  arrivalTransport: transport,
  accommodation: null,
  dailyBudgetCents: null,
  dailyBudgetCurrency: null,
  budgetPremise: null,
  companions: [],
  dayType: 'full',
  highlights: [],
  linkedPhaseId: null,
};

function makeLeg(overrides: Partial<ItineraryLeg>): ItineraryLeg {
  return { ...baseLeg, ...overrides };
}

describe('getSchedulableTransports', () => {
  it('returns future transports sorted by order', () => {
    const legs: ItineraryLeg[] = [
      makeLeg({
        id: 'leg-1',
        order: 1,
        cityName: 'Venice',
        arrivalDate: '2026-07-15',
        arrivalTime: '10:00',
        departureDate: '2026-07-17',
        departureTime: '08:30',
      }),
      makeLeg({
        id: 'leg-2',
        order: 2,
        cityName: 'Ljubljana',
        arrivalDate: '2026-07-17',
        arrivalTime: '12:00',
        departureDate: '2026-07-19',
        departureTime: '09:00',
        arrivalTransport: { ...transport, type: 'train' },
      }),
    ];

    const result = getSchedulableTransports(legs, '2026-07-14T00:00');
    expect(result).toHaveLength(2);
    expect(result[0]!.legId).toBe('leg-1');
    expect(result[0]!.destination).toBe('Venice');
    expect(result[0]!.departureIso).toBe('2026-07-15T10:00');
    expect(result[1]!.legId).toBe('leg-2');
    expect(result[1]!.destination).toBe('Ljubljana');
    expect(result[1]!.transportType).toBe('train');
    expect(result[1]!.departureIso).toBe('2026-07-17T08:30');
    expect(result[1]!.departingFrom).toBe('Venice');
  });

  it('excludes transports already departed', () => {
    const legs: ItineraryLeg[] = [
      makeLeg({
        id: 'leg-1',
        order: 1,
        cityName: 'Venice',
        arrivalDate: '2026-07-15',
        arrivalTime: '10:00',
        departureDate: '2026-07-17',
        departureTime: '08:30',
      }),
      makeLeg({
        id: 'leg-2',
        order: 2,
        cityName: 'Ljubljana',
        arrivalDate: '2026-07-17',
        arrivalTime: '12:00',
        departureDate: '2026-07-19',
        departureTime: '09:00',
        arrivalTransport: { ...transport, type: 'train' },
      }),
    ];

    const result = getSchedulableTransports(legs, '2026-07-18T10:00');
    expect(result).toHaveLength(0);
  });

  it('excludes legs without arrivalTransport', () => {
    const legs: ItineraryLeg[] = [
      makeLeg({
        id: 'leg-1',
        order: 1,
        arrivalTransport: null,
      }),
    ];

    const result = getSchedulableTransports(legs, '2026-07-14T00:00');
    expect(result).toHaveLength(0);
  });

  it('excludes legs where no departure time can be resolved', () => {
    const legs: ItineraryLeg[] = [
      makeLeg({
        id: 'leg-1',
        order: 1,
        arrivalTime: null,
        departureTime: null,
      }),
    ];

    const result = getSchedulableTransports(legs, '2026-07-14T00:00');
    expect(result).toHaveLength(0);
  });

  it('uses previous leg departureTime as the transport departure', () => {
    const legs: ItineraryLeg[] = [
      makeLeg({
        id: 'leg-1',
        order: 1,
        cityName: 'Venice',
        departureDate: '2026-07-17',
        departureTime: '06:45',
      }),
      makeLeg({
        id: 'leg-2',
        order: 2,
        cityName: 'Ljubljana',
        arrivalDate: '2026-07-17',
        arrivalTime: '12:00',
        departureDate: '2026-07-19',
        departureTime: '09:00',
        arrivalTransport: { ...transport, type: 'train' },
      }),
    ];

    const result = getSchedulableTransports(legs, '2026-07-14T00:00');
    const lj = result.find((t) => t.destination === 'Ljubljana')!;
    expect(lj.departureIso).toBe('2026-07-17T06:45');
    expect(lj.departingFrom).toBe('Venice');
  });

  it('returns empty for no future transports', () => {
    const legs: ItineraryLeg[] = [
      makeLeg({
        id: 'leg-1',
        order: 1,
        arrivalDate: '2026-07-10',
        arrivalTime: '10:00',
        departureDate: '2026-07-12',
        departureTime: '08:30',
      }),
    ];

    const result = getSchedulableTransports(legs, '2026-07-14T00:00');
    expect(result).toHaveLength(0);
  });

  it('returns empty for empty legs', () => {
    expect(getSchedulableTransports([], '2026-07-14T00:00')).toHaveLength(0);
  });
});
