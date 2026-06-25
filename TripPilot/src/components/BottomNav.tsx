import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { Icon } from './Icon';
import { FABMenu } from './FAB';
import { SplitResumeSheet } from '@/features/split/SplitResumeSheet';
import { DivideChooserSheet } from '@/features/split/DivideChooserSheet';
import { useActiveSplit } from '@/features/split/useActiveSplit';
import { useAppData } from '@/hooks/useAppData';
import { visibleInMode, type ModeAware } from '@/domain/app-mode';
import { tabsForMode } from '@/app/nav-tabs';
import { setPendingTabDirection, tabSwitchDirection } from '@/app/nav-direction';
import { hapticSelection, hapticImpact } from '@/utils/haptics';
import { registerOverlayDismiss } from '@/utils/overlay-dismiss';

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
// (inteligência) + a engrenagem de Ajustes no header.
//
// C06/DEC-298: the bar is symmetric 2+2 in BOTH modes. Complete mode shows
// Viagem + Copiloto (advanced) on the right and Settings lives on the header
// gear. Simple mode hides the advanced Copilot, so Settings (`simpleOnly`)
// takes that slot → Início, Gastos · + · Viagem, Ajustes. `visibleInMode` keeps
// this data-driven: each side resolves to exactly two items per mode.
const RIGHT_NAV: NavItem[] = [
  { path: '/viagem', icon: 'explore', labelKey: 'nav.trip' },
  { path: '/copiloto', icon: 'insights', labelKey: 'nav.copilot', advanced: true },
  { path: '/settings', icon: 'settings', labelKey: 'nav.settings', simpleOnly: true },
];

export function BottomNav() {
  const [isFabOpen, setIsFabOpen] = useState(false);
  // D03 · DEC-309: the "Dividir" chooser (bill vs group) + the live-split
  // resume-or-new chooser. Both owned here so they outlive the FAB overlay
  // closing (the FAB is unmounted on close).
  const [divideOpen, setDivideOpen] = useState(false);
  const [splitChoiceOpen, setSplitChoiceOpen] = useState(false);
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { settings } = useAppData();
  // A live division turns "Dividir uma conta" into a resume-or-new decision.
  const activeSplit = useActiveSplit();
  // M19: planner (advanced) is hidden in simple mode; its route still exists.
  const appMode = settings?.appMode ?? 'complete';
  const rightNav = visibleInMode(RIGHT_NAV, appMode);
  // D-BUG-10: swipe order so a bar tap animates the same direction as a swipe.
  const tabPaths = tabsForMode(appMode).map((tab) => tab.path);

  // FB-07: the FAB menu is an overlay, so a hardware/gesture "back" must close it
  // before navigating — same contract as BottomSheet (DEC-193). Register its
  // dismiss while open so initBackButton (native) / the popstate guard (web/PWA)
  // pop it via dismissTopOverlay. The exit animation is untouched (onClose just
  // flips isOpen and useAnimatedPresence plays the close).
  useEffect(() => {
    if (!isFabOpen) return;
    return registerOverlayDismiss(() => setIsFabOpen(false));
  }, [isFabOpen]);

  // D09 · DEC-318: an open FAB must never survive a context switch. The nav sits
  // ABOVE the FAB scrim (z-[60]) while open, so tapping a tab used to navigate
  // and leave the menu mounted over the new screen (read as a bug). Closing on
  // every pathname change covers a tab tap, a card that navigates, or any
  // programmatic navigation; the scrim's own onClick still handles an outside tap.
  useEffect(() => {
    setIsFabOpen(false);
  }, [location.pathname]);

  const renderNavItem = (item: NavItem) => {
    const isActive = location.pathname.startsWith(item.path);
    return (
      <button
        key={item.path}
        onClick={() => {
          // D09 · DEC-318: close the FAB on a tab tap too. The pathname effect
          // already covers a real navigation, but tapping the tab you are
          // ALREADY on does not change the route — so close here explicitly so
          // an open FAB never survives any tab tap (no exception).
          setIsFabOpen(false);
          if (!isActive) hapticSelection();
          const direction = tabSwitchDirection(location.pathname, item.path, tabPaths);
          if (direction) setPendingTabDirection(direction);
          navigate(item.path);
        }}
        // M11/A-3: announce the active tab to screen readers (WCAG 4.1.2). The
        // active state is also non-color-coded (bold label + filled icon +
        // .nav-ind bar), so it does not rely on terracotta alone (WCAG 1.4.1).
        aria-current={isActive ? 'page' : undefined}
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
      <FABMenu
        isOpen={isFabOpen}
        onClose={() => setIsFabOpen(false)}
        onDivide={() => setDivideOpen(true)}
      />
      <DivideChooserSheet
        open={divideOpen}
        onClose={() => setDivideOpen(false)}
        onChooseBill={() => {
          setDivideOpen(false);
          // A live division still asks resume-or-new; otherwise go straight in.
          if (activeSplit) setSplitChoiceOpen(true);
          else navigate('/split/scan');
        }}
        onChooseGroup={() => {
          setDivideOpen(false);
          navigate('/groups?new=1');
        }}
      />
      <SplitResumeSheet open={splitChoiceOpen} onClose={() => setSplitChoiceOpen(false)} />

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
