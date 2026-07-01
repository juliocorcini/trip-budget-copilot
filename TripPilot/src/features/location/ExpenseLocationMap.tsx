import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Icon } from '@/components/Icon';
import { registerOverlayDismiss } from '@/utils/overlay-dismiss';
import { overlayHost } from '@/utils/overlay-host';
import { createTileLayer, DEFAULT_MAP_LAYER, type MapLayerKind } from './tile-layers';

/**
 * DEC-368 (G8) — interactive map for an expense's saved point. Default export so
 * the whole module (Leaflet + its CSS) is code-split behind `React.lazy`: it only
 * downloads when a detail screen with coordinates is opened (L-MAP = Leaflet,
 * not a static image). Uses the imperative Leaflet API directly (no react-leaflet
 * dependency) and a CSS `divIcon` so no marker image assets are needed.
 */
interface ExpenseLocationMapProps {
  lat: number;
  lng: number;
  /** Accessible name for the point (place name, or a generic location label). */
  label: string;
  /**
   * DEC-398 (G7): an inline map is a NON-INTERACTIVE preview (default) — every
   * gesture is disabled and the surface is `pointer-events-none`, so a one-finger
   * pan over it never captures the touch and traps the page scroll. The expanded
   * overlay passes `interactive` to turn drag/zoom back on. Same component, one flag.
   */
  interactive?: boolean;
}

export default function ExpenseLocationMap({
  lat,
  lng,
  label,
  interactive = false,
}: ExpenseLocationMapProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  // DEC-426: satellite is a LayerGroup (imagery + label overlays), street a tile
  // layer — both are `L.Layer`, so the ref holds the common base type.
  const tileRef = useRef<L.Layer | null>(null);
  // DEC-422 (G9): satellite (Esri) is the default surface; the toggle (interactive
  // only) swaps to the street map. A ref mirrors the state so the map-mount effect
  // can add the right layer without depending on `layer` (which would re-create
  // the whole map on every toggle).
  const [layer, setLayer] = useState<MapLayerKind>(DEFAULT_MAP_LAYER);
  const layerRef = useRef<MapLayerKind>(DEFAULT_MAP_LAYER);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const map = L.map(el, {
      center: [lat, lng],
      zoom: 16,
      attributionControl: true,
      // DEC-398 (G7): a preview disables EVERY gesture (and the zoom control) so it
      // can never grab the finger and trap the page scroll; the expanded overlay
      // turns them all back on. Mirror `interactive` across every handler.
      dragging: interactive,
      touchZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      scrollWheelZoom: interactive,
      tapHold: interactive,
      zoomControl: interactive,
    });
    mapRef.current = map;

    // DEC-422 (G9): start on whatever surface is currently selected (satellite by
    // default) so re-mounts — e.g. expanding into the overlay — keep the choice.
    const tile = createTileLayer(layerRef.current).addTo(map);
    tileRef.current = tile;

    const pin = L.divIcon({
      className: 'expense-map-pin',
      html: '<span class="expense-map-pin__dot"></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    // DEC-426: tapping the pin surfaces the place name (the `label` is the
    // geocoded name). `title` stays for the desktop hover tooltip.
    L.marker([lat, lng], { icon: pin, title: label, keyboard: false })
      .addTo(map)
      .bindPopup(label);

    // DEC-368/398: re-measure once the card animates in AND whenever the container
    // resizes — expanding the preview into the overlay grows the map after mount,
    // so a one-shot rAF is not enough (the sheet/overlay sizes it later).
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
  }, [lat, lng, label, interactive]);

  // DEC-422 (G9): swap the tile source in place when the surface changes — no map
  // teardown, so the center/zoom and the pin stay put across a toggle.
  useEffect(() => {
    layerRef.current = layer;
    const map = mapRef.current;
    if (!map) return;
    tileRef.current?.remove();
    tileRef.current = createTileLayer(layer).addTo(map);
  }, [layer]);

  return (
    <div
      className={`relative w-full h-full rounded-xl overflow-hidden bg-surface-high${
        interactive ? '' : ' pointer-events-none'
      }`}
    >
      <div ref={containerRef} role="img" aria-label={label} className="w-full h-full" />
      {/* DEC-422 (G9): map/satellite toggle, interactive surfaces only (the inline
          preview is pointer-events-none). Sibling of the Leaflet container, so its
          taps never reach the map. Placed top-right to clear the top-left zoom. */}
      {interactive && (
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
      )}
    </div>
  );
}

/**
 * DEC-398 (G7): the inline location field — a non-interactive preview that never
 * traps the page scroll, with a "tap to expand" affordance that opens a full-screen
 * interactive map (drag/zoom). Both views reuse the same `ExpenseLocationMap` (one
 * Leaflet chunk); the overlay mirrors the `AttachmentViewer` full-screen pattern and
 * is dismissable by the close button, the hardware back button, and Escape.
 */
export function ExpenseLocationMapField({ lat, lng, label }: ExpenseLocationMapProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    // DEC-193 parity: the native back button closes the expanded map first.
    const unregisterBack = registerOverlayDismiss(() => setExpanded(false));
    return () => {
      window.removeEventListener('keydown', onKey);
      unregisterBack();
    };
  }, [expanded]);

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label={t('expenses.map_expand')}
        className="relative block w-full h-44 rounded-xl overflow-hidden btn-press"
      >
        <ExpenseLocationMap lat={lat} lng={lng} label={label} />
        <span className="absolute top-2 right-2 z-[1000] flex items-center gap-1 rounded-full bg-surface/90 px-2 py-1 text-[11px] font-semibold text-on-surface shadow-sm">
          <Icon name="open_in_full" size={13} className="text-on-surface" />
          {t('expenses.map_expand_hint')}
        </span>
      </button>

      {/* DEC-406: portal the expanded map to the overlay host so it escapes the
          scrolling page's transformed ancestor (`fixed` becomes viewport-fixed
          again, not page-relative) and the inline preview maps' Leaflet panes can
          no longer pierce it. Mirrors the BottomSheet / AttachmentViewer pattern. */}
      {expanded &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            style={{ background: 'var(--scrim)' }}
          >
            <div
              className="flex items-center justify-between gap-3 p-4"
              style={{ paddingTop: 'var(--safe-top, 16px)' }}
            >
              <p className="text-sm font-semibold text-on-surface truncate">{label}</p>
              <button
                onClick={() => setExpanded(false)}
                className="btn-press p-1 shrink-0"
                aria-label={t('common.close')}
              >
                <Icon name="close" size={26} className="text-on-surface" />
              </button>
            </div>
            <div
              className="flex-1 min-h-0 px-3 pb-3"
              style={{ paddingBottom: 'var(--safe-bottom, 12px)' }}
            >
              <ExpenseLocationMap lat={lat} lng={lng} label={label} interactive />
            </div>
          </div>,
          overlayHost(),
        )}
    </>
  );
}
