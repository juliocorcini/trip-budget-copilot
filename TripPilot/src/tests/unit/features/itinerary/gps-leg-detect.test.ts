import { describe, it, expect } from 'vitest';
import {
  haversineKm,
  findClosestLeg,
  GPS_THRESHOLD_KM,
  type CityPoint,
} from '@/features/itinerary/useGpsLegDetect';
import { JULIO_EUROTRIP_LEGS } from '@/tests/fixtures/julio-eurotrip-legs';

describe('haversineKm', () => {
  it('returns ~0 km for the same point', () => {
    const dist = haversineKm(45.4408, 12.3155, 45.4408, 12.3155);
    expect(dist).toBeCloseTo(0, 1);
  });

  it('computes Venice → Ljubljana correctly (~183 km)', () => {
    const dist = haversineKm(45.4408, 12.3155, 46.0569, 14.5058);
    expect(dist).toBeGreaterThan(170);
    expect(dist).toBeLessThan(200);
  });

  it('computes Venice → Mestre correctly (~8 km)', () => {
    const dist = haversineKm(45.4408, 12.3155, 45.4904, 12.2388);
    expect(dist).toBeLessThan(15);
  });

  it('computes long distance Madrid → Venice correctly (~1500 km)', () => {
    const dist = haversineKm(40.4168, -3.7038, 45.4408, 12.3155);
    expect(dist).toBeGreaterThan(1400);
    expect(dist).toBeLessThan(1600);
  });
});

describe('findClosestLeg', () => {
  const veniceLeg = JULIO_EUROTRIP_LEGS[0]!;
  const ljubljanaLeg = JULIO_EUROTRIP_LEGS[1]!;

  const cityPoints: CityPoint[] = [
    { cityName: 'Veneza/Mestre', lat: 45.4408, lng: 12.3155, leg: veniceLeg },
    { cityName: 'Ljubljana', lat: 46.0569, lng: 14.5058, leg: ljubljanaLeg },
  ];

  it('returns the closest leg when within threshold', () => {
    // User at Venice Mestre station (very close to Venice)
    const result = findClosestLeg(45.49, 12.24, cityPoints);
    expect(result).not.toBeNull();
    expect(result!.cityName).toBe('Veneza/Mestre');
  });

  it('returns Ljubljana when user is in Ljubljana', () => {
    const result = findClosestLeg(46.05, 14.51, cityPoints);
    expect(result).not.toBeNull();
    expect(result!.cityName).toBe('Ljubljana');
  });

  it('returns null when user is far from all cities', () => {
    // User in Madrid — far from all eurotrip legs
    const result = findClosestLeg(40.4168, -3.7038, cityPoints);
    expect(result).toBeNull();
  });

  it('returns null for empty cityPoints', () => {
    const result = findClosestLeg(45.49, 12.24, []);
    expect(result).toBeNull();
  });

  it('respects custom threshold', () => {
    // User ~230 km from Ljubljana, default threshold 50 km won't match
    const resultDefault = findClosestLeg(45.4408, 12.3155, cityPoints);
    expect(resultDefault!.cityName).toBe('Veneza/Mestre');

    // With a very large threshold, Ljubljana could also match but Venice is closer
    const resultLarge = findClosestLeg(45.4408, 12.3155, cityPoints, 300);
    expect(resultLarge!.cityName).toBe('Veneza/Mestre');
  });

  it('default threshold is 50 km', () => {
    expect(GPS_THRESHOLD_KM).toBe(50);
  });
});
