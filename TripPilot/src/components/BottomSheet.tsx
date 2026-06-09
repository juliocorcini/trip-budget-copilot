import { useEffect } from 'react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * Design-system bottom sheet (replaces native dialogs — DEC-022 / GAP-025).
 * Renders over the current screen, constrained to the app's 430px column.
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" style={{ animation: 'sheet-fade 0.15s ease-out' }} />
      <div
        className="relative w-full max-w-[430px] bg-surface-container rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto"
        style={{ animation: 'sheet-up 0.2s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-surface-high mx-auto mb-4" />
        {title && <p className="text-sm font-bold text-on-surface mb-4">{title}</p>}
        {children}
      </div>
      <style>{`
        @keyframes sheet-up { from { transform: translateY(24px); opacity: 0.6; } to { transform: translateY(0); opacity: 1; } }
        @keyframes sheet-fade { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
