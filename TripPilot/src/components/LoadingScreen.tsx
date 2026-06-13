/**
 * Shared full-height loading state. Used by the boot guard and route guards
 * (BUG-014) so every screen shows the same spinner instead of a blank frame.
 */
export function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}
