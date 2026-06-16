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
  iconBg: string;
  iconColorClass: string;
}

const FAB_ACTIONS: FabAction[] = [
  {
    icon: 'add_card',
    labelKey: 'fab.register_expense',
    descKey: 'fab.register_expense_desc',
    path: '/quick-add',
    iconBg: '#C75B3925',
    iconColorClass: 'text-primary',
  },
  {
    icon: 'local_bar',
    labelKey: 'fab.start_outing',
    descKey: 'fab.start_outing_desc',
    path: '/outings/new',
    iconBg: '#C75B3918',
    iconColorClass: 'text-primary',
    advanced: true,
  },
  {
    icon: 'calculate',
    labelKey: 'fab.simulate_purchase',
    descKey: 'fab.simulate_purchase_desc',
    path: '/simulator',
    iconBg: '#6B8F7118',
    iconColorClass: 'text-success',
    advanced: true,
  },
  {
    icon: 'shopping_cart',
    labelKey: 'fab.register_market',
    descKey: 'fab.register_market_desc',
    path: '/quick-add?cat=market',
    iconBg: '#6B8F7118',
    iconColorClass: 'text-success',
  },
  {
    icon: 'shopping_bag',
    labelKey: 'fab.plan_purchase',
    descKey: 'fab.plan_purchase_desc',
    path: '/planned?new=1',
    iconBg: '#6B8F7118',
    iconColorClass: 'text-success',
  },
  {
    icon: 'swap_horiz',
    labelKey: 'fab.register_transfer',
    descKey: 'fab.register_transfer_desc',
    path: '/quick-add?type=transfer',
    iconBg: '#D4A84318',
    iconColorClass: 'text-warning',
  },
  {
    icon: 'local_atm',
    labelKey: 'fab.register_withdrawal',
    descKey: 'fab.register_withdrawal_desc',
    path: '/quick-add?type=withdrawal',
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

  // DEC-201 (N7): the first action ("Registrar gasto") is the hero — full width,
  // accented; the rest read as a clean tonal grid below it.
  const [primary, ...secondary] = actions;

  return (
    <div className="fixed inset-0 z-50" data-no-tab-swipe onClick={onClose}>
      <div
        className="absolute inset-0"
        style={{
          background: 'var(--scrim)',
          animation: closing
            ? 'fab-scrim-out 160ms var(--ease-accelerate) both'
            : 'fab-scrim-in 200ms var(--ease-out) both',
        }}
      />

      {/* Anchor the sheet to the bottom, clearing the (taller, safe-area-aware)
          bottom nav + protruding center button so the panel floats above them. */}
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col justify-end"
        style={{
          paddingTop: 'calc(var(--safe-top) + 12px)',
          paddingBottom: 'calc(104px + var(--safe-bottom))',
          maxHeight: '100dvh',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="mx-3 rounded-[28px] flex flex-col overflow-hidden"
          style={{
            background: 'var(--surface-container)',
            border: '1px solid var(--surface-high)',
            boxShadow: '0 18px 48px -12px rgba(0,0,0,0.55)',
            maxHeight: '100%',
            animation: closing
              ? 'sheet-down 180ms var(--ease-accelerate) both'
              : 'sheet-up 240ms var(--ease-spring) both',
          }}
        >
          {/* Grabber + title — the "this is a sheet you can dismiss" affordance. */}
          <div className="pt-3 pb-1 flex justify-center shrink-0">
            <div className="w-9 h-1 rounded-full" style={{ background: 'var(--surface-high)' }} />
          </div>
          <div className="px-5 pt-1 pb-3 shrink-0">
            <p className="text-[11px] tracking-[0.14em] uppercase font-bold text-on-surface-faint">
              {t('fab.quick_actions')}
            </p>
          </div>

          {/* Actions — a 2-col grid where the hero spans both columns. `.stagger`
              cascades each cell; the grid scrolls internally if it ever overflows. */}
          <div className="px-3 pb-3 overflow-y-auto no-scrollbar">
            <div className="grid grid-cols-2 gap-2.5 stagger">
              {primary && (
                <button
                  key={primary.path}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction(primary.path);
                  }}
                  className="btn-press col-span-2 p-4 rounded-2xl flex items-center gap-3.5 text-left"
                  style={{ background: '#C75B3922', border: '1px solid #C75B3940' }}
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: '#C75B3933' }}
                  >
                    <Icon name={primary.icon} size={24} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-extrabold text-on-surface">{t(primary.labelKey)}</p>
                    <p className="text-[11px] font-semibold text-on-surface-dim">
                      {t(primary.descKey)}
                    </p>
                  </div>
                  <Icon name="arrow_forward" size={18} className="text-primary shrink-0" />
                </button>
              )}

              {/* DEC-206: our first AI feature — featured full-width, with a distinct
                  indigo "smart" accent + sparkle so it stands apart from the orange
                  hero and feels inviting rather than hidden. */}
              <button
                key="/receipt/scan"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction('/receipt/scan');
                }}
                className="btn-press col-span-2 p-4 rounded-2xl flex items-center gap-3.5 text-left"
                style={{ background: '#6366F11A', border: '1px solid #6366F140' }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative"
                  style={{ background: '#6366F126' }}
                >
                  <Icon name="document_scanner" size={24} className="text-[#818CF8]" />
                  <span
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: '#6366F1' }}
                  >
                    <Icon name="auto_awesome" size={9} className="text-[#ffffff]" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-extrabold text-on-surface">{t('fab.scan_receipt')}</p>
                  <p className="text-[11px] font-semibold text-on-surface-dim">
                    {t('fab.scan_receipt_desc')}
                  </p>
                </div>
                <Icon name="auto_awesome" size={18} className="text-[#818CF8] shrink-0" />
              </button>

              {secondary.map((action) => (
                <button
                  key={action.path}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction(action.path);
                  }}
                  className="btn-press p-3.5 rounded-2xl flex flex-col gap-2 text-left h-full"
                  style={{ background: 'var(--surface-high)' }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: action.iconBg }}
                  >
                    <Icon name={action.icon} size={20} className={action.iconColorClass} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-on-surface leading-tight">
                      {t(action.labelKey)}
                    </p>
                    <p className="text-[10px] font-semibold text-on-surface-dim leading-snug line-clamp-1 mt-0.5">
                      {t(action.descKey)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
