import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { Icon } from './Icon';
import { FABMenu } from './FAB';
import { useAppData } from '@/hooks/useAppData';
import { visibleInMode, type ModeAware } from '@/domain/app-mode';
import { tabsForMode } from '@/app/nav-tabs';
import { setPendingTabDirection, tabSwitchDirection } from '@/app/nav-direction';
import { hapticSelection, hapticImpact } from '@/utils/haptics';

interface NavItem extends ModeAware {
  path: string;
  icon: string;
  labelKey: string;
}

const LEFT_NAV: NavItem[] = [
  { path: '/dashboard', icon: 'dashboard', labelKey: 'nav.dashboard' },
  { path: '/expenses', icon: 'receipt_long', labelKey: 'nav.expenses' },
];

// Redesign (G1): "Mais" e "Planejar" deixam a barra. Planejar mora em Viagem;
// as funções do "Mais" viram a aba Viagem (estrutura/plano) + Copiloto
// (inteligência) + a engrenagem de Ajustes no header. Copiloto é avançado:
// no modo simples a barra fica enxuta (Início · Gastos · + · Viagem).
const RIGHT_NAV: NavItem[] = [
  { path: '/viagem', icon: 'explore', labelKey: 'nav.trip' },
  { path: '/copiloto', icon: 'insights', labelKey: 'nav.copilot', advanced: true },
];

export function BottomNav() {
  const [isFabOpen, setIsFabOpen] = useState(false);
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { settings } = useAppData();
  // M19: planner (advanced) is hidden in simple mode; its route still exists.
  const appMode = settings?.appMode ?? 'complete';
  const rightNav = visibleInMode(RIGHT_NAV, appMode);
  // D-BUG-10: swipe order so a bar tap animates the same direction as a swipe.
  const tabPaths = tabsForMode(appMode).map((tab) => tab.path);

  const renderNavItem = (item: NavItem) => {
    const isActive = location.pathname.startsWith(item.path);
    return (
      <button
        key={item.path}
        onClick={() => {
          if (!isActive) hapticSelection();
          const direction = tabSwitchDirection(location.pathname, item.path, tabPaths);
          if (direction) setPendingTabDirection(direction);
          navigate(item.path);
        }}
        className="relative flex flex-col items-center gap-0.5 py-1 px-2 btn-press"
      >
        {/* DEC-194: active-tab indicator — grows in on the selected tab. */}
        <span className={`nav-ind ${isActive ? 'is-active' : ''}`} aria-hidden />
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
        style={{
          background: 'var(--nav-bar)',
          borderColor: 'var(--border-hairline)',
          // DEC-192: lift the buttons above the gesture bar (and keep a small
          // breathing gap on devices without one) so the nav never sits flush
          // against the bottom edge.
          paddingBottom: 'max(var(--safe-bottom), 10px)',
        }}
      >
        <div className="max-w-[430px] mx-auto flex justify-around items-center px-3 py-1.5">
          {LEFT_NAV.map(renderNavItem)}

          <div className="flex flex-col items-center px-2 -mt-3">
            <button
              onClick={() => {
                hapticImpact();
                setIsFabOpen((prev) => !prev);
              }}
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
                  // DEC-194: spin the glyph as it toggles add ↔ close.
                  transform: isFabOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform var(--motion-base) var(--ease-out)',
                }}
              >
                {isFabOpen ? 'close' : 'add'}
              </span>
            </button>
          </div>

          {rightNav.map(renderNavItem)}
        </div>
      </nav>
    </>
  );
}
