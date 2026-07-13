import { describe, it, expect } from 'vitest';
import {
  parseBuildResponse,
  parseRefineResponse,
} from '@/domain/itinerary/itinerary-copilot-parser';

const TRIP_ID = 'test-trip';

describe('parseBuildResponse', () => {
  it('parses a valid AI response with 2 legs', () => {
    const raw = {
      legs: [
        {
          cityName: 'Venice',
          countryCode: 'IT',
          arrivalDate: '2026-07-15',
          departureDate: '2026-07-17',
          arrivalTransport: { type: 'flight', company: 'Iberia', route: 'MAD → VCE', bookingStatus: 'purchased', costCents: 37971, costCurrency: 'BRL', isPrepaid: true, reference: null, notes: null },
          accommodation: { name: 'Anda Venice Hostel', type: 'hostel', bookingStatus: 'booked', costCents: 28000, costCurrency: 'BRL', isPrepaid: true, nights: 2 },
          dailyBudgetCents: 15000,
          dailyBudgetCurrency: 'BRL',
          companions: ['Jessika'],
          dayType: 'transit',
          highlights: ['Canal Grande'],
        },
        {
          cityName: 'Ljubljana',
          countryCode: 'SI',
          arrivalDate: '2026-07-17',
          arrivalTime: '18:30',
          departureDate: '2026-07-19',
          arrivalTransport: { type: 'car', company: 'GoOpti', route: 'Mestre → Ljubljana', bookingStatus: 'purchased', costCents: 3440, costCurrency: 'EUR', isPrepaid: true },
          dayType: 'full',
          companions: [],
          highlights: [],
        },
      ],
      suggestedPhases: [
        { name: 'Italy + Slovenia', startDate: '2026-07-15', endDate: '2026-07-19' },
      ],
      summary: 'A trip through Venice and Ljubljana.',
    };

    const result = parseBuildResponse(raw, TRIP_ID);
    expect(result.legs).toHaveLength(2);
    expect(result.legs[0]!.cityName).toBe('Venice');
    expect(result.legs[0]!.tripId).toBe(TRIP_ID);
    expect(result.legs[0]!.order).toBe(1);
    expect(result.legs[1]!.order).toBe(2);
    expect(result.legs[0]!.id).not.toBe(result.legs[1]!.id);
    expect(result.suggestedPhases).toHaveLength(1);
    expect(result.summary).toBe('A trip through Venice and Ljubljana.');
  });

  it('generates unique client-side IDs for each leg', () => {
    const raw = {
      legs: [
        { cityName: 'Paris', arrivalDate: '2026-08-01', departureDate: '2026-08-03' },
        { cityName: 'London', arrivalDate: '2026-08-03', departureDate: '2026-08-05' },
      ],
    };
    const result = parseBuildResponse(raw, TRIP_ID);
    const ids = result.legs.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => typeof id === 'string' && id.length > 10)).toBe(true);
  });

  it('drops legs with missing cityName', () => {
    const raw = {
      legs: [
        { arrivalDate: '2026-07-15', departureDate: '2026-07-17' },
        { cityName: 'Venice', arrivalDate: '2026-07-15', departureDate: '2026-07-17' },
      ],
    };
    const result = parseBuildResponse(raw, TRIP_ID);
    expect(result.legs).toHaveLength(1);
    expect(result.legs[0]!.cityName).toBe('Venice');
  });

  it('drops legs with invalid dates', () => {
    const raw = {
      legs: [
        { cityName: 'Venice', arrivalDate: 'not-a-date', departureDate: '2026-07-17' },
        { cityName: 'Paris', arrivalDate: '2026-07-20', departureDate: '2026-07-22' },
      ],
    };
    const result = parseBuildResponse(raw, TRIP_ID);
    expect(result.legs).toHaveLength(1);
    expect(result.legs[0]!.cityName).toBe('Paris');
  });

  it('defaults departureDate to arrivalDate when missing', () => {
    const raw = {
      legs: [{ cityName: 'Zurich', arrivalDate: '2026-08-04' }],
    };
    const result = parseBuildResponse(raw, TRIP_ID);
    expect(result.legs).toHaveLength(1);
    expect(result.legs[0]!.departureDate).toBe('2026-08-04');
  });

  it('coerces invalid transport type to "other"', () => {
    const raw = {
      legs: [{
        cityName: 'Venice',
        arrivalDate: '2026-07-15',
        departureDate: '2026-07-17',
        arrivalTransport: { type: 'spaceship', company: 'SpaceX' },
      }],
    };
    const result = parseBuildResponse(raw, TRIP_ID);
    expect(result.legs[0]!.arrivalTransport!.type).toBe('other');
  });

  it('coerces invalid booking status to "estimated"', () => {
    const raw = {
      legs: [{
        cityName: 'Venice',
        arrivalDate: '2026-07-15',
        departureDate: '2026-07-17',
        arrivalTransport: { type: 'train', bookingStatus: 'maybe' },
      }],
    };
    const result = parseBuildResponse(raw, TRIP_ID);
    expect(result.legs[0]!.arrivalTransport!.bookingStatus).toBe('estimated');
  });

  it('handles null/missing transport and accommodation gracefully', () => {
    const raw = {
      legs: [{
        cityName: 'Venice',
        arrivalDate: '2026-07-15',
        departureDate: '2026-07-17',
        arrivalTransport: null,
        accommodation: null,
      }],
    };
    const result = parseBuildResponse(raw, TRIP_ID);
    expect(result.legs[0]!.arrivalTransport).toBeNull();
    expect(result.legs[0]!.accommodation).toBeNull();
  });

  it('handles completely empty response', () => {
    const result = parseBuildResponse({}, TRIP_ID);
    expect(result.legs).toHaveLength(0);
    expect(result.suggestedPhases).toHaveLength(0);
    expect(result.summary).toBe('');
  });

  it('handles non-object response (null)', () => {
    const result = parseBuildResponse(null, TRIP_ID);
    expect(result.legs).toHaveLength(0);
  });

  it('handles non-object response (string)', () => {
    const result = parseBuildResponse('invalid', TRIP_ID);
    expect(result.legs).toHaveLength(0);
  });

  it('coerces cost string numbers to integer cents', () => {
    const raw = {
      legs: [{
        cityName: 'Venice',
        arrivalDate: '2026-07-15',
        departureDate: '2026-07-17',
        arrivalTransport: { type: 'train', costCents: '3440', costCurrency: 'EUR', isPrepaid: 'true' },
      }],
    };
    const result = parseBuildResponse(raw, TRIP_ID);
    expect(result.legs[0]!.arrivalTransport!.costCents).toBe(3440);
    expect(result.legs[0]!.arrivalTransport!.isPrepaid).toBe(true);
  });

  it('normalizes time formats', () => {
    const raw = {
      legs: [{
        cityName: 'Venice',
        arrivalDate: '2026-07-15',
        departureDate: '2026-07-17',
        arrivalTime: '9:30',
        departureTime: '18:05',
      }],
    };
    const result = parseBuildResponse(raw, TRIP_ID);
    expect(result.legs[0]!.arrivalTime).toBe('09:30');
    expect(result.legs[0]!.departureTime).toBe('18:05');
  });

  it('sets linkedPhaseId to null (never trusts AI)', () => {
    const raw = {
      legs: [{
        cityName: 'Venice',
        arrivalDate: '2026-07-15',
        departureDate: '2026-07-17',
        linkedPhaseId: 'some-ai-generated-id',
      }],
    };
    const result = parseBuildResponse(raw, TRIP_ID);
    expect(result.legs[0]!.linkedPhaseId).toBeNull();
  });

  it('parses accommodation without name as null', () => {
    const raw = {
      legs: [{
        cityName: 'Venice',
        arrivalDate: '2026-07-15',
        departureDate: '2026-07-17',
        accommodation: { type: 'hotel', nights: 2 },
      }],
    };
    const result = parseBuildResponse(raw, TRIP_ID);
    expect(result.legs[0]!.accommodation).toBeNull();
  });

  it('includes SyncMetadata fields on each leg', () => {
    const raw = {
      legs: [{ cityName: 'Paris', arrivalDate: '2026-08-01', departureDate: '2026-08-03' }],
    };
    const result = parseBuildResponse(raw, TRIP_ID);
    const leg = result.legs[0]!;
    expect(leg.createdAt).toBeDefined();
    expect(leg.updatedAt).toBeDefined();
    expect(leg.deletedAt).toBeNull();
    expect(leg.revision).toBe(1);
  });
});

describe('parseRefineResponse', () => {
  it('parses a valid refine response with changes', () => {
    const raw = {
      legs: [
        { cityName: 'Venice', arrivalDate: '2026-07-15', departureDate: '2026-07-17' },
        { cityName: 'Ljubljana', arrivalDate: '2026-07-17', departureDate: '2026-07-20' },
      ],
      changes: ['Extended Ljubljana stay by 1 day', 'Updated departure date'],
    };
    const result = parseRefineResponse(raw, TRIP_ID);
    expect(result.legs).toHaveLength(2);
    expect(result.changes).toHaveLength(2);
    expect(result.changes[0]).toContain('Ljubljana');
  });

  it('handles empty changes array', () => {
    const raw = {
      legs: [{ cityName: 'Venice', arrivalDate: '2026-07-15', departureDate: '2026-07-17' }],
      changes: [],
    };
    const result = parseRefineResponse(raw, TRIP_ID);
    expect(result.legs).toHaveLength(1);
    expect(result.changes).toHaveLength(0);
  });

  it('handles missing changes field', () => {
    const raw = {
      legs: [{ cityName: 'Venice', arrivalDate: '2026-07-15', departureDate: '2026-07-17' }],
    };
    const result = parseRefineResponse(raw, TRIP_ID);
    expect(result.changes).toHaveLength(0);
  });

  it('returns empty for null input', () => {
    const result = parseRefineResponse(null, TRIP_ID);
    expect(result.legs).toHaveLength(0);
    expect(result.changes).toHaveLength(0);
  });
});
