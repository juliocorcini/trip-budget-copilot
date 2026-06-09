import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { Icon } from './Icon';

interface NavItem {
  path: string;
  icon: string;
  labelKey: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', icon: 'home', labelKey: 'nav.dashboard' },
  { path: '/expenses', icon: 'receipt_long', labelKey: 'nav.expenses' },
  { path: '/planner', icon: 'event_note', labelKey: 'nav.plan' },
  { path: '/more', icon: 'more_horiz', labelKey: 'nav.more' },
];

export function BottomNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-on-surface-mute"
      style={{ background: 'rgba(15,20,25,0.85)' }}>
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center gap-0.5 py-1 px-3 btn-press"
            >
              <Icon
                name={item.icon}
                size={24}
                filled={isActive}
                className={isActive ? 'text-primary' : 'text-on-surface-dim'}
              />
              <span
                className={`text-[10px] font-medium ${isActive ? 'text-primary' : 'text-on-surface-faint'}`}
              >
                {t(item.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
