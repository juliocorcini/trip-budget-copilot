import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// DEC-416 (G11): the marker-cluster plugin (and its CSS) is imported ONLY here —
// this page is `React.lazy`-loaded (see router), so the new dependency ships in
// the `/mapa` chunk and never weighs on the core bundle (Red Team lock).
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useAppData } from '@/hooks/useAppData';
import { buildExpenseMapPoints, type ExpenseMapPoint } from '@/domain/map';
import { createTileLayer, DEFAULT_MAP_LAYER, type MapLayerKind } from '@/features/location/tile-layers';
import { formatMoney } from '@/domain/money';
import { formatShortDate } from '@/domain/dates';
import { isOnline } from '@/utils/places';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/EmptyState';
import { BottomSheet } from '@/components/BottomSheet';
import type { Transaction } from '@/domain/types/transaction';

/** How many spends a place's sheet reveals before "show more" (Critic: paginate). */
const PAGE_SIZE = 8;

/** The same dot the expense-detail map uses, so a spend looks identical everywhere. */
function makePin(): L.DivIcon {
  return L.divIcon({
    className: 'expense-map-pin',
    html: '<span class="expense-map-pin__dot"></span>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

/**
 * DEC-416 (G11) — "spends on the map". A full-screen, satellite-first map of
 * every spend that has a real location: places are grouped by the pure
 * `buildExpenseMapPoints`, then clustered by zoom (leaflet.markercluster). Tap a
 * pin/cluster to see that place's spends (total + a paginated list) and open any
 * one. The map is the traveler's own and is never shared. Offline shows a hint
 * (tiles may not load) but the points still render — nothing here blocks.
 */
export function ExpenseMapPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip, transactions, loading } = useAppData();
  const baseCurrency = trip?.baseCurrency ?? 'EUR';

  const points = useMemo(() => buildExpenseMapPoints(transactions), [transactions]);
  const txById = useMemo(() => {
    const map = new Map<string, Transaction>();
    for (const tx of transactions) map.set(tx.id, tx);
    return map;
  }, [transactions]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const layerRef = useRef<MapLayerKind>(DEFAULT_MAP_LAYER);
  const [layer, setLayer] = useState<MapLayerKind>(DEFAULT_MAP_LAYER);
  const [selected, setSelected] = useState<ExpenseMapPoint | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const hasPoints = points.length > 0;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !hasPoints) return;

    const first = points[0]!;
    const map = L.map(el, {
      center: [first.lat, first.lng],
      zoom: 15,
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;
    // Start on the currently selected surface (satellite by default, DEC-422).
    tileRef.current = createTileLayer(layerRef.current).addTo(map);

    const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 48 });
    for (const point of points) {
      const marker = L.marker([point.lat, point.lng], { icon: makePin(), keyboard: false });
      marker.on('click', () => {
        setVisibleCount(PAGE_SIZE);
        setSelected(point);
      });
      cluster.addLayer(marker);
    }
    map.addLayer(cluster);

    // Frame every point when there is more than one (a single point keeps its
    // street-level zoom instead of snapping to the max).
    if (points.length > 1) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
    }

    // Re-measure once the container has its real size (and on any later resize),
    // mirroring the expense-detail map — the map mounts inside a flex column.
    const raf = requestAnimationFrame(() => map.invalidateSize());
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => map.invalidateSize())
        : null;
    ro?.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
    };
  }, [points, hasPoints]);

  // Swap the tile source in place on toggle — no teardown, so the view stays put.
  useEffect(() => {
    layerRef.current = layer;
    const map = mapRef.current;
    if (!map) return;
    tileRef.current?.remove();
    tileRef.current = createTileLayer(layer).addTo(map);
  }, [layer]);

  const selectedTxs = selected
    ? selected.txIds
        .map((id) => txById.get(id))
        .filter((tx): tx is Transaction => tx !== undefined)
    : [];
  const visibleTxs = selectedTxs.slice(0, visibleCount);

  return (
    <div
      className="max-w-[430px] mx-auto h-[100dvh] flex flex-col bg-surface text-on-surface"
      style={{ paddingTop: 'var(--safe-top, 0px)' }}
    >
      <div className="flex items-center gap-3 px-[var(--page-padding-x)] py-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('map.title')}</h1>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-on-surface-dim text-sm">
          {t('map.loading')}
        </div>
      ) : hasPoints ? (
        <div className="relative flex-1 min-h-0">
          <div
            ref={containerRef}
            role="application"
            aria-label={t('map.title')}
            className="absolute inset-0"
          />
          <div className="absolute top-2 right-2 z-[1000] flex rounded-full bg-surface/90 p-0.5 shadow-sm">
            {(['satellite', 'street'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setLayer(kind)}
                aria-pressed={layer === kind}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold btn-press transition-colors ${
                  layer === kind ? 'bg-primary text-on-surface' : 'text-on-surface-dim'
                }`}
              >
                {t(kind === 'satellite' ? 'expenses.map_satellite' : 'expenses.map_street')}
              </button>
            ))}
          </div>
          {!isOnline() && (
            <div className="absolute bottom-2 left-2 right-2 z-[1000] rounded-lg bg-surface/95 px-3 py-2 text-[11px] text-on-surface-dim shadow-sm">
              {t('map.offline_hint')}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-[var(--page-padding-x)] py-6">
          <EmptyState
            icon="location_on"
            title={t('map.empty_title')}
            body={t('map.empty_body')}
            cta={{ label: t('map.empty_cta'), icon: 'receipt_long', onClick: () => navigate('/expenses') }}
          />
        </div>
      )}

      <BottomSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.label ?? t('map.sheet_title_fallback')}
      >
        {selected && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-on-surface-dim">
              {t('map.spends_count', { count: selected.count })} ·{' '}
              <span className="font-semibold text-on-surface">
                {formatMoney(selected.totalCents, baseCurrency)}
              </span>
            </p>
            <ul className="flex flex-col gap-1.5">
              {visibleTxs.map((tx) => (
                <li key={tx.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/expenses/${tx.id}`)}
                    className="btn-press w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left"
                    style={{ background: 'var(--surface-high)' }}
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-on-surface truncate">
                        {tx.description || t('map.sheet_title_fallback')}
                      </span>
                      <span className="block text-[11px] text-on-surface-faint">
                        {formatShortDate(tx.date)}
                      </span>
                    </span>
                    <span className="text-[13px] font-semibold text-on-surface tabular shrink-0">
                      {formatMoney(tx.amountCents, tx.currency)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {selectedTxs.length > visibleCount && (
              <button
                type="button"
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                className="btn-press mx-auto text-[13px] font-semibold text-primary py-1"
              >
                {t('map.show_more')}
              </button>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
