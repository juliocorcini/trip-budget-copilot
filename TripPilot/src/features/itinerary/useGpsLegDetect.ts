import { useCallback, useEffect, useState } from 'react';
import type { ItineraryLeg } from '@/domain/types/itinerary-leg';
import { geocodeCity, type GeoPoint } from './geocode-cache';

const LS_GPS_ENABLED = 'itinerary_gps_enabled';

export const GPS_THRESHOLD_KM = 50;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface CityPoint {
  cityName: string;
  lat: number;
  lng: number;
  leg: ItineraryLeg;
}

export function findClosestLeg(
  userLat: number,
  userLng: number,
  cityPoints: CityPoint[],
  thresholdKm: number = GPS_THRESHOLD_KM,
): ItineraryLeg | null {
  let closest: { leg: ItineraryLeg; dist: number } | null = null;
  for (const point of cityPoints) {
    const dist = haversineKm(userLat, userLng, point.lat, point.lng);
    if (dist <= thresholdKm && (!closest || dist < closest.dist)) {
      closest = { leg: point.leg, dist };
    }
  }
  return closest?.leg ?? null;
}

function isGpsEnabled(): boolean {
  try { return localStorage.getItem(LS_GPS_ENABLED) === '1'; } catch { return false; }
}
function setGpsEnabled(v: boolean) {
  try { localStorage.setItem(LS_GPS_ENABLED, v ? '1' : '0'); } catch { /* noop */ }
}

export interface GpsDetectResult {
  enabled: boolean;
  detecting: boolean;
  detectedLeg: ItineraryLeg | null;
  error: string | null;
  enable: () => void;
  disable: () => void;
}

/**
 * Opt-in GPS detection that matches current position to the nearest itinerary leg city.
 * Only activates when user explicitly enables it.
 */
export function useGpsLegDetect(legs: ItineraryLeg[]): GpsDetectResult {
  const [enabled, setEnabled] = useState(isGpsEnabled);
  const [detecting, setDetecting] = useState(false);
  const [detectedLeg, setDetectedLeg] = useState<ItineraryLeg | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enable = useCallback(async () => {
    if (!('geolocation' in navigator)) {
      setError('GPS not available');
      return;
    }
    try {
      const perm = await navigator.permissions?.query({ name: 'geolocation' });
      if (perm?.state === 'denied') {
        setError('Permission denied');
        return;
      }
    } catch { /* permissions API not available, try anyway */ }

    setGpsEnabled(true);
    setEnabled(true);
  }, []);

  const disable = useCallback(() => {
    setGpsEnabled(false);
    setEnabled(false);
    setDetectedLeg(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!enabled || legs.length === 0) return;

    let cancelled = false;
    setDetecting(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (cancelled) return;
        const { latitude, longitude } = position.coords;

        const cityPoints: (GeoPoint & { leg: ItineraryLeg })[] = [];
        const seen = new Set<string>();

        for (const leg of legs) {
          const key = leg.cityName.toLowerCase().trim();
          if (seen.has(key)) {
            const existing = cityPoints.find((p) => p.cityName.toLowerCase().trim() === key);
            if (existing) cityPoints.push({ ...existing, leg });
            continue;
          }
          seen.add(key);
          const geo = await geocodeCity(leg.cityName);
          if (geo) cityPoints.push({ ...geo, leg });
        }

        if (cancelled) return;

        setDetectedLeg(findClosestLeg(latitude, longitude, cityPoints));
        setDetecting(false);
      },
      (err) => {
        if (cancelled) return;
        setError(err.message);
        setDetecting(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );

    return () => { cancelled = true; };
  }, [enabled, legs]);

  return { enabled, detecting, detectedLeg, error, enable, disable };
}
