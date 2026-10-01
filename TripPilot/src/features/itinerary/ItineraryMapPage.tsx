import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db/database';
import { useAppData } from '@/hooks/useAppData';
import { localDateString } from '@/domain/dates';
import { createTileLayer } from '@/features/location/tile-layers';
import { geocodeCity, type GeoPoint } from './geocode-cache';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/EmptyState';
import type { ItineraryLeg } from '@/domain/types/itinerary-leg';

interface LegPoint extends GeoPoint {
  leg: ItineraryLeg;
  isPast: boolean;
  isCurrent: boolean;
  dayRange: string;
}

function computeDayRange(
  leg: ItineraryLeg,
  allLegs: ItineraryLeg[],
): string {
  const startIdx = allLegs.findIndex((l) => l.id === leg.id);
  const nextLeg = allLegs[startIdx + 1];
  const start = new Date(leg.arrivalDate + 'T12:00:00');
  const first = new Date(allLegs[0]!.arrivalDate + 'T12:00:00');
  const dayStart = Math.floor((start.getTime() - first.getTime()) / 86400000) + 1;

  if (nextLeg) {
    const end = new Date(nextLeg.arrivalDate + 'T12:00:00');
    const dayEnd = Math.floor((end.getTime() - first.getTime()) / 86400000);
    return dayEnd > dayStart ? `${dayStart}-${dayEnd}` : `${dayStart}`;
  }
  const dep = new Date(leg.departureDate + 'T12:00:00');
  const dayEnd = Math.floor((dep.getTime() - first.getTime()) / 86400000) + 1;
  return dayEnd > dayStart ? `${dayStart}-${dayEnd}` : `${dayStart}`;
}

export function ItineraryMapPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip } = useAppData();
  const today = localDateString();

  const legs = useLiveQuery(
    async () => {
      if (!trip) return [];
      return db.itineraryLegs
        .where('tripId')
        .equals(trip.id)
        .filter((l) => l.deletedAt === null)
        .sortBy('order');
    },
    [trip?.id],
    [] as ItineraryLeg[],
  );

  const [points, setPoints] = useState<LegPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLegId, setActiveLegId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const sortedLegs = useMemo(() => [...legs].sort((a, b) => a.order - b.order), [legs]);

  useEffect(() => {
    if (sortedLegs.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const result: LegPoint[] = [];
      const seen = new Map<string, GeoPoint>();

      for (const leg of sortedLegs) {
        const key = leg.cityName.toLowerCase().trim();
        let geo = seen.get(key);
        if (!geo) {
          geo = await geocodeCity(leg.cityName) ?? undefined;
          if (geo) seen.set(key, geo);
          await new Promise((r) => setTimeout(r, 150));
        }
        if (cancelled) return;
        if (geo) {
          const isPast = leg.departureDate < today;
          const isCurrent = leg.arrivalDate <= today && leg.departureDate >= today;
          result.push({
            ...geo,
            leg,
            isPast,
            isCurrent,
            dayRange: computeDayRange(leg, sortedLegs),
          });
        }
      }

      if (!cancelled) {
        setPoints(result);
        setLoading(false);
        const current = result.find((p) => p.isCurrent);
        if (current) setActiveLegId(current.leg.id);
      }
    })();

    return () => { cancelled = true; };
  }, [sortedLegs, today]);

  const flyToLeg = useCallback((legId: string) => {
    const point = points.find((p) => p.leg.id === legId);
    if (!point || !mapRef.current) return;
    setActiveLegId(legId);
    mapRef.current.flyTo([point.lat, point.lng], 10, { duration: 0.8 });
  }, [points]);

  const scrollToCard = useCallback((legId: string) => {
    setActiveLegId(legId);
    const card = cardRefs.current.get(legId);
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || points.length === 0) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(el, {
      center: [points[0]!.lat, points[0]!.lng],
      zoom: 6,
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: false,
    });
    mapRef.current = map;
    createTileLayer('dark').addTo(map);

    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i]!;
      const to = points[i + 1]!;
      const isPastSegment = from.isPast && to.isPast;

      L.polyline(
        [[from.lat, from.lng], [to.lat, to.lng]],
        {
          color: isPastSegment ? 'var(--primary, #ffb59f)' : 'var(--ai, #7B5BE4)',
          weight: 4,
          opacity: 0.8,
          dashArray: isPastSegment ? undefined : '8 8',
        },
      ).addTo(map);
    }

    for (const point of points) {
      const size = point.isCurrent ? 16 : 10;
      const color = point.isPast
        ? 'var(--primary, #ffb59f)'
        : point.isCurrent
          ? 'var(--primary, #ffb59f)'
          : 'var(--ai, #7B5BE4)';
      const borderWidth = point.isCurrent ? 4 : 2;

      const icon = L.divIcon({
        className: 'itinerary-city-pin',
        html: `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
            <div style="width:${size * 2}px;height:${size * 2}px;border-radius:50%;background:var(--surface-container, #1b2025);border:${borderWidth}px solid ${color};display:flex;align-items:center;justify-content:center;">
              <div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};"></div>
            </div>
            <div style="margin-top:4px;padding:1px 6px;border-radius:4px;background:var(--surface-container, #1b2025);font-family:monospace;font-size:9px;color:var(--on-surface, #dee3ea);white-space:nowrap;text-align:center;letter-spacing:0.05em;">
              ${point.leg.cityName}
            </div>
          </div>
        `,
        iconSize: [size * 3, size * 3 + 20],
        iconAnchor: [size * 1.5, size],
      });

      const marker = L.marker([point.lat, point.lng], { icon });
      marker.on('click', () => scrollToCard(point.leg.id));
      marker.addTo(map);
    }

    if (points.length > 1) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 30], maxZoom: 10 });
    }

    const raf = requestAnimationFrame(() => map.invalidateSize());
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => map.invalidateSize()) : null;
    ro?.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [points, scrollToCard]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--surface)' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 h-14 shrink-0 z-40"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <button onClick={() => navigate(-1)} className="btn-press w-10 h-10 flex items-center justify-center rounded-full">
          <Icon name="arrow_back" size={20} style={{ color: 'var(--on-surface)' }} />
        </button>
        <h1 className="text-base font-semibold" style={{ color: 'var(--on-surface)' }}>
          {t('itinerary.map_title')}
        </h1>
        <div className="w-10 h-10" />
      </header>

      {!loading && points.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-6">
          <EmptyState
            icon="map"
            title={t('itinerary.map_empty_title')}
            body={t('itinerary.map_empty_body')}
          />
        </div>
      ) : (
        <>
          {/* Split view: map ~45vh, list below */}
          <div
            ref={containerRef}
            className="shrink-0"
            style={{ height: '45vh', touchAction: 'none' }}
          />

          {/* Scrollable leg list */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto px-4 pt-3 pb-6"
            style={{ background: 'var(--surface)' }}
          >
            <div className="flex flex-col gap-3">
              {points.map((point) => {
                const isActive = point.leg.id === activeLegId;
                const isFuture = !point.isPast && !point.isCurrent;

                return (
                  <div
                    key={point.leg.id}
                    ref={(el) => { if (el) cardRefs.current.set(point.leg.id, el); }}
                    onClick={() => flyToLeg(point.leg.id)}
                    className="btn-press rounded-2xl p-4 relative overflow-hidden cursor-pointer"
                    style={{
                      background: 'var(--surface-container)',
                      border: isActive
                        ? '1px solid color-mix(in srgb, var(--primary) 40%, transparent)'
                        : '1px solid var(--border-subtle)',
                    }}
                  >
                    {isActive && (
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1"
                        style={{ background: 'var(--primary)' }}
                      />
                    )}

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <span
                          className="font-mono text-[9px] uppercase tracking-[0.15em] block mb-1"
                          style={{
                            color: isActive
                              ? 'var(--primary)'
                              : isFuture
                                ? 'var(--ai)'
                                : 'var(--on-surface-dim)',
                          }}
                        >
                          <span
                            className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                            style={{
                              background: isActive
                                ? 'var(--primary)'
                                : point.isPast
                                  ? 'var(--on-surface-faint)'
                                  : 'var(--ai)',
                            }}
                          />
                          {t('itinerary.map_days_label', { range: point.dayRange })}
                          {point.isCurrent && ` · ${t('itinerary.map_current')}`}
                        </span>

                        <h3
                          className="text-lg font-bold truncate"
                          style={{
                            color: point.isPast && !isActive
                              ? 'var(--on-surface-dim)'
                              : 'var(--on-surface)',
                          }}
                        >
                          {point.leg.cityName}
                        </h3>

                        {point.leg.budgetPremise && (
                          <p
                            className="text-xs mt-1.5 line-clamp-2 leading-snug"
                            style={{ color: 'var(--on-surface-dim)' }}
                          >
                            {point.leg.budgetPremise}
                          </p>
                        )}
                      </div>

                      {point.leg.arrivalTransport && (
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: 'var(--surface-container-high)' }}
                        >
                          <Icon
                            name={
                              ({ flight: 'flight', train: 'train', bus: 'directions_bus', car: 'directions_car', ferry: 'directions_boat', walk: 'directions_walk', other: 'commute' } as Record<string, string>)[point.leg.arrivalTransport.type] ?? 'commute'
                            }
                            size={20}
                            style={{ color: 'var(--on-surface-dim)' }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
