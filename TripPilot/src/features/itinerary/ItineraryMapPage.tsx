import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db/database';
import { useAppData } from '@/hooks/useAppData';
import { localDateString } from '@/domain/dates';
import { createTileLayer, DEFAULT_MAP_LAYER } from '@/features/location/tile-layers';
import { geocodeCity, type GeoPoint } from './geocode-cache';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/EmptyState';
import type { ItineraryLeg, DayType } from '@/domain/types/itinerary-leg';

const DAY_TYPE_COLOR: Record<DayType, string> = {
  full: '#22c55e',
  transit: '#3b82f6',
  festival: '#a855f7',
  rest: '#9ca3af',
  day_trip: '#f59e0b',
};

function makeCityIcon(dayType: DayType, isPast: boolean): L.DivIcon {
  const color = DAY_TYPE_COLOR[dayType] ?? '#22c55e';
  const opacity = isPast ? '0.5' : '1';
  return L.divIcon({
    className: 'itinerary-city-pin',
    html: `<span style="display:block;width:14px;height:14px;border-radius:50%;background:${color};opacity:${opacity};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.3)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

interface LegPoint extends GeoPoint {
  leg: ItineraryLeg;
  isPast: boolean;
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

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
          result.push({
            ...geo,
            leg,
            isPast: leg.departureDate < today,
          });
        }
      }

      if (!cancelled) {
        setPoints(result);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [sortedLegs, today]);

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
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;
    createTileLayer(DEFAULT_MAP_LAYER).addTo(map);

    // Draw polyline segments (solid for past, dashed for future)
    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i]!;
      const to = points[i + 1]!;
      const isPast = from.isPast && to.isPast;

      L.polyline(
        [[from.lat, from.lng], [to.lat, to.lng]],
        {
          color: isPast ? '#6b7280' : '#3b82f6',
          weight: 3,
          opacity: isPast ? 0.5 : 0.8,
          dashArray: isPast ? undefined : '8 6',
        },
      ).addTo(map);
    }

    // Add city markers
    for (const point of points) {
      const marker = L.marker(
        [point.lat, point.lng],
        { icon: makeCityIcon(point.leg.dayType, point.isPast) },
      );
      marker.bindTooltip(point.leg.cityName, {
        permanent: points.length <= 10,
        direction: 'top',
        offset: [0, -10],
        className: 'itinerary-tooltip',
      });
      marker.addTo(map);
    }

    // Fit bounds
    if (points.length > 1) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
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
  }, [points]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-base">
      <div className="flex items-center gap-3 px-4 pt-3 pb-2 bg-surface-base/90 backdrop-blur-sm z-10">
        <button onClick={() => navigate(-1)} className="btn-press p-1">
          <Icon name="arrow_back" size={20} className="text-on-surface" />
        </button>
        <h1 className="text-sm font-bold text-on-surface flex-1">{t('itinerary.map_title')}</h1>
        {loading && (
          <span className="text-xs text-on-surface-faint animate-pulse">
            {t('itinerary.map_loading')}
          </span>
        )}
      </div>

      {!loading && points.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-6">
          <EmptyState
            icon="map"
            title={t('itinerary.map_empty_title')}
            body={t('itinerary.map_empty_body')}
          />
        </div>
      ) : (
        <div ref={containerRef} className="flex-1" />
      )}

      {points.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-surface-base/90 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-3 shadow-lg">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-[10px] text-on-surface-faint">
              <span className="inline-block w-4 h-0.5 bg-gray-400" /> {t('itinerary.map_legend_past')}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-on-surface-faint">
              <span className="inline-block w-4 h-0.5 bg-blue-500 border-dashed" style={{ borderTopWidth: 2, borderStyle: 'dashed' }} /> {t('itinerary.map_legend_future')}
            </span>
          </div>
          <span className="text-[10px] text-on-surface-dim ml-auto">
            {points.length} {t('itinerary.cities')}
          </span>
        </div>
      )}
    </div>
  );
}
