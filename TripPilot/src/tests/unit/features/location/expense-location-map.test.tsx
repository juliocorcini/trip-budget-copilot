import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

/**
 * DEC-398 (G7) — the expense map renders as a non-interactive PREVIEW inline
 * (so a one-finger pan over it never traps the page scroll) and an INTERACTIVE
 * map only inside the expanded overlay. Leaflet needs real layout, so in jsdom we
 * mock it and assert the gesture options the component passes — that is the
 * testable seam for "preview is frozen" vs "expanded can drag/zoom".
 */
const mapOptionsLog: Array<Record<string, unknown>> = [];

vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('leaflet', () => {
  // Mirror Leaflet's chainable layer API (addTo/bindPopup return `this`) so the
  // component's `L.marker(...).addTo(map).bindPopup(label)` (DEC-426) works, and
  // expose `layerGroup` — the satellite surface is now imagery + label overlays
  // wrapped in a LayerGroup (DEC-426), so `createTileLayer('satellite')` needs it.
  const addable = () => {
    const layer = {
      addTo: () => layer,
      remove: () => undefined,
      bindPopup: () => layer,
    };
    return layer;
  };
  return {
    map: (_el: unknown, options: Record<string, unknown>) => {
      mapOptionsLog.push(options);
      return { invalidateSize: () => undefined, remove: () => undefined };
    },
    tileLayer: () => addable(),
    layerGroup: () => addable(),
    marker: () => addable(),
    divIcon: () => ({}),
  };
});

import ExpenseLocationMap from '@/features/location/ExpenseLocationMap';

const GESTURES = [
  'dragging',
  'touchZoom',
  'doubleClickZoom',
  'boxZoom',
  'keyboard',
  'scrollWheelZoom',
  'tapHold',
  'zoomControl',
] as const;

describe('ExpenseLocationMap — DEC-398 (G7) interactive flag', () => {
  beforeEach(() => {
    mapOptionsLog.length = 0;
    cleanup();
  });

  it('preview (default) disables every gesture so it never traps the page scroll', () => {
    render(<ExpenseLocationMap lat={48.8606} lng={2.3376} label="Louvre" />);
    const opts = mapOptionsLog[0]!;
    for (const key of GESTURES) {
      expect(opts[key], `${key} must be OFF in the inline preview`).toBe(false);
    }
  });

  it('interactive enables every gesture for the expanded overlay', () => {
    render(<ExpenseLocationMap lat={48.8606} lng={2.3376} label="Louvre" interactive />);
    const opts = mapOptionsLog[0]!;
    for (const key of GESTURES) {
      expect(opts[key], `${key} must be ON when interactive`).toBe(true);
    }
  });
});
