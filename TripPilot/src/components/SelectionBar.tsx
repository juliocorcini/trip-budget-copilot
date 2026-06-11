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

/** DEC-118 (R-09): bottom action bar for list selection mode. */
export function SelectionBar({ count, actions, onCancel }: SelectionBarProps) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3"
      style={{ background: 'var(--surface-deep)', borderTop: '1px solid var(--border-faint)' }}
    >
      <div className="max-w-[430px] mx-auto flex items-center gap-2">
        <button
          onClick={onCancel}
          className="btn-press w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'var(--surface-container)' }}
          aria-label={t('common.cancel')}
        >
          <Icon name="close" size={18} className="text-on-surface-dim" />
        </button>
        <span className="text-xs font-bold text-on-surface shrink-0">
          {t('selection.count', { count })}
        </span>
        <div className="flex-1 flex justify-end gap-2 overflow-x-auto no-scrollbar">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={action.onAction}
              className="btn-press shrink-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
              style={
                action.tone === 'danger'
                  ? { background: '#D9404015', color: 'var(--error)' }
                  : { background: 'var(--surface-container)', color: 'var(--on-surface-dim)' }
              }
            >
              <Icon name={action.icon} size={14} />
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
