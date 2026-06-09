import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Icon } from './Icon';

interface FabAction {
  icon: string;
  labelKey: string;
  descKey: string;
  path: string;
  itemBg: string;
  iconBg: string;
  iconColorClass: string;
}

const FAB_ACTIONS: FabAction[] = [
  {
    icon: 'add_card',
    labelKey: 'fab.register_expense',
    descKey: 'fab.register_expense_desc',
    path: '/quick-add',
    itemBg: '#C75B3918',
    iconBg: '#C75B3925',
    iconColorClass: 'text-primary',
  },
  {
    icon: 'local_bar',
    labelKey: 'fab.start_outing',
    descKey: 'fab.start_outing_desc',
    path: '/outings/new',
    itemBg: 'var(--surface-container)',
    iconBg: '#C75B3918',
    iconColorClass: 'text-primary',
  },
  {
    icon: 'calculate',
    labelKey: 'fab.simulate_purchase',
    descKey: 'fab.simulate_purchase_desc',
    path: '/simulator',
    itemBg: 'var(--surface-container)',
    iconBg: '#6B8F7118',
    iconColorClass: 'text-success',
  },
  {
    icon: 'shopping_cart',
    labelKey: 'fab.register_market',
    descKey: 'fab.register_market_desc',
    path: '/quick-add?cat=market',
    itemBg: 'var(--surface-container)',
    iconBg: '#6B8F7118',
    iconColorClass: 'text-success',
  },
  {
    icon: 'swap_horiz',
    labelKey: 'fab.register_transfer',
    descKey: 'fab.register_transfer_desc',
    path: '/quick-add?type=transfer',
    itemBg: 'var(--surface-container)',
    iconBg: '#D4A84318',
    iconColorClass: 'text-warning',
  },
  {
    icon: 'local_atm',
    labelKey: 'fab.register_withdrawal',
    descKey: 'fab.register_withdrawal_desc',
    path: '/quick-add?type=withdrawal',
    itemBg: 'var(--surface-container)',
    iconBg: '#D4A84318',
    iconColorClass: 'text-warning',
  },
];

interface FABMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FABMenu({ isOpen, onClose }: FABMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleAction = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: '#0A0F14f0' }} />

      <div className="relative flex flex-col justify-end min-h-screen pb-[88px]">
        <div className="px-5 pb-5 space-y-2">
          <p className="text-[10px] tracking-[0.15em] uppercase font-bold mb-2 text-on-surface-faint">
            {t('fab.quick_actions')}
          </p>

          {FAB_ACTIONS.map((action) => (
            <button
              key={action.path}
              onClick={(e) => {
                e.stopPropagation();
                handleAction(action.path);
              }}
              className="btn-press w-full p-4 rounded-xl flex items-center gap-3 text-left"
              style={{ background: action.itemBg }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: action.iconBg }}
              >
                <Icon name={action.icon} className={action.iconColorClass} />
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface">
                  {t(action.labelKey)}
                </p>
                <p className="text-[11px] font-semibold text-on-surface-dim">
                  {t(action.descKey)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
