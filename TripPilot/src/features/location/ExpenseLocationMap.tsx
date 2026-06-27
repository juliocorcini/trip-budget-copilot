import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
}

export default function ExpenseLocationMap({ lat, lng, label }: ExpenseLocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const map = L.map(el, {
      center: [lat, lng],
      zoom: 16,
      // Keep page scroll natural; the traveler pinch/drag-zooms intentionally.
      scrollWheelZoom: false,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    const pin = L.divIcon({
      className: 'expense-map-pin',
      html: '<span class="expense-map-pin__dot"></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    L.marker([lat, lng], { icon: pin, title: label, keyboard: false }).addTo(map);

    // The card animates in; re-measure once the container has its final size.
    const raf = requestAnimationFrame(() => map.invalidateSize());

    return () => {
      cancelAnimationFrame(raf);
      map.remove();
    };
  }, [lat, lng, label]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={label}
      className="w-full h-44 rounded-xl overflow-hidden bg-surface-high"
    />
  );
}
