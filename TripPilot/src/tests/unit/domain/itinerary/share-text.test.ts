import { describe, it, expect } from 'vitest';
import { formatItineraryShareText } from '@/domain/itinerary/itinerary-domain';
import type { ItineraryLeg } from '@/domain/types/itinerary-leg';

const baseMeta = {
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test-device',
  personalNotes: null,
};

function makeLeg(overrides: Partial<ItineraryLeg>): ItineraryLeg {
  return {
    ...baseMeta,
    id: 'leg-1',
    tripId: 'trip-1',
    order: 1,
    cityName: 'Venice',
    countryCode: 'IT',
    arrivalDate: '2026-07-15',
    arrivalTime: null,
    departureDate: '2026-07-17',
    departureTime: null,
    arrivalTransport: null,
    accommodation: null,
    dailyBudgetCents: null,
    dailyBudgetCurrency: null,
    budgetPremise: null,
    companions: [],
    dayType: 'full',
    highlights: [],
    linkedPhaseId: null,
    ...overrides,
  };
}

describe('formatItineraryShareText', () => {
  it('returns empty string for no legs', () => {
    expect(formatItineraryShareText('Eurotrip', [])).toBe('');
  });

  it('formats a single leg with transport and accommodation', () => {
    const legs = [
      makeLeg({
        id: 'leg-1',
        order: 1,
        cityName: 'Venice',
        arrivalDate: '2026-07-15',
        departureDate: '2026-07-17',
        arrivalTransport: {
          type: 'flight',
          company: 'Iberia',
          route: 'MAD → VCE',
          bookingStatus: 'purchased',
          costCents: 37971,
          costCurrency: 'BRL',
          isPrepaid: true,
          reference: null,
          notes: null,
        },
        accommodation: {
          name: 'Anda Venice Hostel',
          type: 'hostel',
          bookingStatus: 'booked',
          costCents: 28000,
          costCurrency: 'BRL',
          isPrepaid: true,
          nights: 2,
          reference: null,
          notes: null,
        },
      }),
    ];

    const text = formatItineraryShareText('Eurotrip Julio', legs);
    expect(text).toContain('🗺️ Eurotrip Julio');
    expect(text).toContain('📍 Venice');
    expect(text).toContain('✈️ Iberia MAD → VCE');
    expect(text).toContain('🏠 Anda Venice Hostel');
    expect(text).toContain('Gerado por TripPilot');
  });

  it('formats multiple legs sorted by order', () => {
    const legs = [
      makeLeg({
        id: 'leg-2',
        order: 2,
        cityName: 'Ljubljana',
        arrivalDate: '2026-07-17',
        departureDate: '2026-07-19',
        arrivalTransport: {
          type: 'train',
          company: 'Trenitalia',
          route: null,
          bookingStatus: 'purchased',
          costCents: 5000,
          costCurrency: 'EUR',
          isPrepaid: true,
          reference: null,
          notes: null,
        },
        accommodation: {
          name: 'Hostel Tresor',
          type: 'hostel',
          bookingStatus: 'booked',
          costCents: 8000,
          costCurrency: 'EUR',
          isPrepaid: true,
          nights: 2,
          reference: null,
          notes: null,
        },
      }),
      makeLeg({
        id: 'leg-1',
        order: 1,
        cityName: 'Venice',
        arrivalDate: '2026-07-15',
        departureDate: '2026-07-17',
      }),
    ];

    const text = formatItineraryShareText('Euro Trip', legs);
    const lines = text.split('\n');
    const veniceIdx = lines.findIndex((l) => l.includes('Venice'));
    const ljIdx = lines.findIndex((l) => l.includes('Ljubljana'));
    expect(veniceIdx).toBeLessThan(ljIdx);
  });

  it('omits transport when not set', () => {
    const legs = [
      makeLeg({
        cityName: 'Rome',
        arrivalTransport: null,
      }),
    ];

    const text = formatItineraryShareText('Trip', legs);
    expect(text).toContain('📍 Rome');
    expect(text).not.toContain('✈️');
    expect(text).not.toContain('🚂');
  });

  it('omits accommodation when not set', () => {
    const legs = [
      makeLeg({
        cityName: 'Rome',
        accommodation: null,
      }),
    ];

    const text = formatItineraryShareText('Trip', legs);
    expect(text).toContain('📍 Rome');
    expect(text).not.toContain('🏨');
    expect(text).not.toContain('🏠');
  });
});
