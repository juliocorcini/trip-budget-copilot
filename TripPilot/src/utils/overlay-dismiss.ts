/**
 * LIFO registry of "dismiss" callbacks for open overlays (bottom sheets, modals).
 * The native hardware back button (DEC-193) pops the topmost one so a back press
 * closes what's open before navigating. Plain module — no native imports — so UI
 * components can register without coupling to Capacitor.
 */
const dismissers: Array<() => void> = [];

export function registerOverlayDismiss(onDismiss: () => void): () => void {
  dismissers.push(onDismiss);
  return () => {
    const index = dismissers.lastIndexOf(onDismiss);
    if (index !== -1) dismissers.splice(index, 1);
  };
}

/** Runs the most recently registered dismisser, if any. Returns true if one ran. */
export function dismissTopOverlay(): boolean {
  const onDismiss = dismissers[dismissers.length - 1];
  if (!onDismiss) return false;
  onDismiss();
  return true;
}
