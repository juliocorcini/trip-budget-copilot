import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { Icon } from './Icon';
import { FABMenu } from './FAB';

interface NavItem {
  path: string;
  icon: string;
  labelKey: string;
}

const LEFT_NAV: NavItem[] = [
  { path: '/dashboard', icon: 'dashboard', labelKey: 'nav.dashboard' },
  { path: '/expenses', icon: 'receipt_long', labelKey: 'nav.expenses' },
];

const RIGHT_NAV: NavItem[] = [
  { path: '/planner', icon: 'tune', labelKey: 'nav.plan' },
  { path: '/more', icon: 'more_horiz', labelKey: 'nav.more' },
];

export function BottomNav() {
  const [isFabOpen, setIsFabOpen] = useState(false);
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const renderNavItem = (item: NavItem) => {
    const isActive = location.pathname.startsWith(item.path);
    return (
      <button
        key={item.path}
        onClick={() => navigate(item.path)}
        className="flex flex-col items-center gap-0.5 py-1 px-2 btn-press"
      >
        <Icon
          name={item.icon}
          size={22}
          filled={isActive}
          className={isActive ? 'text-primary' : 'text-on-surface-faint'}
        />
        <span
          className={`text-[10px] ${
            isActive ? 'font-bold text-primary' : 'font-semibold text-on-surface-faint'
          }`}
        >
          {t(item.labelKey)}
        </span>
      </button>
    );
  };

  return (
    <>
      <FABMenu isOpen={isFabOpen} onClose={() => setIsFabOpen(false)} />

      <nav
        className={`fixed bottom-0 left-0 right-0 ${isFabOpen ? 'z-[60]' : 'z-40'} glass border-t`}
        style={{ background: 'var(--nav-bar)', borderColor: 'var(--border-hairline)' }}
      >
        <div className="max-w-[430px] mx-auto flex justify-around items-center px-3 py-1.5">
          {LEFT_NAV.map(renderNavItem)}

          <div className="flex flex-col items-center px-2 -mt-3">
            <button
              onClick={() => setIsFabOpen((prev) => !prev)}
              className="btn-press w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: 'var(--primary)',
                boxShadow: '0 4px 20px #C75B3940',
              }}
              aria-label={t('fab.quick_actions')}
            >
              <span
                className="material-symbols-outlined text-2xl"
                style={{
                  color: 'var(--surface)',
                  fontVariationSettings: "'wght' 600",
                }}
              >
                {isFabOpen ? 'close' : 'add'}
              </span>
            </button>
          </div>

          {RIGHT_NAV.map(renderNavItem)}
        </div>
      </nav>
    </>
  );
}
