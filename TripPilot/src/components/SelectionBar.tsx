import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';

export interface SelectionAction {
  id: string;
  icon: string;
  label: string;
  tone?: 'default' | 'danger';
  onAction: () => void;
}

interface SelectionBarProps {
  count: number;
  actions: SelectionAction[];
  onCancel: () => void;
}

/**
 * DEC-118 (R-09): bottom action bar for list selection mode.
 * Rendered through a portal so no page/header stacking context can trap it,
 * and z-[45] so it covers the bottom nav (z-40) while staying below sheets (z-50).
 *
 * D-BUG-23: the old single-row layout put the actions in a `justify-end
 * overflow-x-auto` strip, so when they didn't fit (e.g. Categoria · Mover fundo ·
 * Excluir on a narrow phone) the leftmost actions were pushed off-screen BEHIND
 * the "N selecionados" label with the scrollbar hidden — invisible options. Now
 * the count sits on its own top row and the actions get a dedicated row of
 * equal-width (`flex-1`) buttons that always fit and are always fully visible,
 * regardless of how many actions a list contributes.
 */
export function SelectionBar({ count, actions, onCancel }: SelectionBarProps) {
  const { t } = useTranslation();
  return createPortal(
    <div
      data-selection-bar
      className="fixed bottom-0 left-0 right-0 z-[45] px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3"
      style={{ background: 'var(--surface-deep)', borderTop: '1px solid var(--border-faint)' }}
    >
      <div className="max-w-[430px] mx-auto flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="btn-press w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--surface-container)' }}
            aria-label={t('common.cancel')}
          >
            <Icon name="close" size={18} className="text-on-surface-dim" />
          </button>
          <span className="text-sm font-bold text-on-surface">
            {t('selection.count', { count })}
          </span>
        </div>
        <div className="flex items-stretch gap-2">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={action.onAction}
              className="btn-press flex-1 min-w-0 px-1.5 py-2 rounded-xl text-[11px] leading-tight font-bold flex flex-col items-center justify-center gap-1 text-center"
              style={
                action.tone === 'danger'
                  ? { background: '#D9404015', color: 'var(--error)' }
                  : { background: 'var(--surface-container)', color: 'var(--on-surface-dim)' }
              }
            >
              <Icon name={action.icon} size={18} className="shrink-0" />
              <span className="w-full truncate">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
