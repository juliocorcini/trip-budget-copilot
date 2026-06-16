import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Icon } from './Icon';
import { useAppData } from '@/hooks/useAppData';
import { visibleInMode, type ModeAware } from '@/domain/app-mode';
import { hapticSelection } from '@/utils/haptics';
import { useAnimatedPresence } from '@/hooks/useAnimatedPresence';

interface FabAction extends ModeAware {
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
    advanced: true,
  },
  {
    icon: 'calculate',
    labelKey: 'fab.simulate_purchase',
    descKey: 'fab.simulate_purchase_desc',
    path: '/simulator',
    itemBg: 'var(--surface-container)',
    iconBg: '#6B8F7118',
    iconColorClass: 'text-success',
    advanced: true,
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
    icon: 'shopping_bag',
    labelKey: 'fab.plan_purchase',
    descKey: 'fab.plan_purchase_desc',
    path: '/planned?new=1',
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
  const { settings } = useAppData();
  // DEC-194: keep the menu mounted through its exit so it visibly closes.
  const { mounted, state } = useAnimatedPresence(isOpen, 180);

  if (!mounted) return null;
  const closing = state === 'closing';

  // M19: simple mode keeps only the capture actions; advanced ones stay
  // reachable via their full pages (ÂNCORA 9 — hide, never delete).
  const actions = visibleInMode(FAB_ACTIONS, settings?.appMode ?? 'complete');

  const handleAction = (path: string) => {
    hapticSelection();
    onClose();
    navigate(path);
  };

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute inset-0"
        style={{
          background: 'var(--scrim)',
          animation: closing
            ? 'fab-scrim-out 160ms var(--ease-accelerate) both'
            : 'fab-scrim-in 200ms var(--ease-out) both',
        }}
      />

      <div className="relative flex flex-col justify-end min-h-[100dvh]">
        {/* DEC-194 fix: the actions clear the (taller, safe-area-aware) bottom nav
            AND the protruding center button, and the list scrolls internally when
            every action is shown — so the lowest item never lands on the bar. */}
        <div
          className={`px-5 space-y-2 overflow-y-auto no-scrollbar ${closing ? 'fab-panel-out' : 'stagger'}`}
          style={{
            paddingTop: 'calc(var(--safe-top) + 12px)',
            paddingBottom: 'calc(112px + var(--safe-bottom))',
            maxHeight: '100dvh',
          }}
        >
          <p className="text-[10px] tracking-[0.15em] uppercase font-bold mb-2 text-on-surface-faint">
            {t('fab.quick_actions')}
          </p>

          {actions.map((action) => (
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
