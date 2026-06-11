import { useState, useCallback } from 'react';
import { useLongPress, type LongPressBinding } from '@/hooks/useLongPress';

export interface MultiSelect {
  /** Selection mode is active (entered via long-press). */
  active: boolean;
  selectedIds: string[];
  isSelected: (id: string) => boolean;
  /** Long-press enters selection mode selecting the item (R-09 / DEC-118). */
  getLongPressHandlers: (id: string) => LongPressBinding;
  /** Tap: in selection mode toggles the item; otherwise runs the normal action. */
  handleTap: (id: string, normalAction: () => void) => void;
  clear: () => void;
}

/**
 * DEC-118 (R-09): reusable list selection-mode — hold to select, tap to add
 * or remove, action bar operates on the selection, X cancels.
 */
export function useMultiSelect(): MultiSelect {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [active, setActive] = useState(false);

  const enterSelection = useCallback((id: string) => {
    setActive(true);
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const getLongPressHandlers = useLongPress(enterSelection);

  const handleTap = useCallback(
    (id: string, normalAction: () => void) => {
      if (!active) {
        normalAction();
        return;
      }
      setSelectedIds((prev) => {
        const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
        if (next.length === 0) setActive(false);
        return next;
      });
    },
    [active],
  );

  const clear = useCallback(() => {
    setSelectedIds([]);
    setActive(false);
  }, []);

  return {
    active,
    selectedIds,
    isSelected: (id) => selectedIds.includes(id),
    getLongPressHandlers,
    handleTap,
    clear,
  };
}
