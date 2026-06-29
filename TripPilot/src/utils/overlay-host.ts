/**
 * DEC-195 / DEC-406: the portal target for full-screen overlays. The host lives
 * inside `#root` (so the `cap-native` zoom still applies) but OUTSIDE the routed
 * page, with a `<body>` fallback for tests / a very early render before the host
 * is mounted. Centralized so every overlay (the BottomSheet, the expanded expense
 * map, …) escapes any transformed ancestor — a non-`none` transform makes the
 * element the containing block for its `position: fixed` descendants, which would
 * otherwise pin the overlay to the scrolling page instead of the viewport — and
 * shares one stacking context above the page.
 */
export function overlayHost(): HTMLElement {
  return document.getElementById('app-overlay-root') ?? document.body;
}
