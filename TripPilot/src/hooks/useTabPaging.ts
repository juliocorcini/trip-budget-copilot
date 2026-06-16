import { useLocation, useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { tabsForMode } from '@/app/nav-tabs';
import { hapticSelection } from '@/utils/haptics';

/**
 * FIELD-02: paging between the primary tabs. Used by the global swipe pager
 * (AppShell) and by the in-page handoff on Expenses/Viagem when an internal
 * swipe runs past its first/last sub-tab. Tab order comes from `nav-tabs` so it
 * always matches the bottom bar. Paging is a no-op unless the current path is
 * exactly a tab root (sub-pages keep their own back/forward behaviour).
 */
export interface TabPaging {
  goPrevTab: () => boolean;
  goNextTab: () => boolean;
  canPrev: boolean;
  canNext: boolean;
}

export function useTabPaging(): TabPaging {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useAppData();
  const tabs = tabsForMode(settings?.appMode ?? 'complete');
  const currentIndex = tabs.findIndex((tab) => tab.path === location.pathname);

  const goToIndex = (index: number): boolean => {
    if (currentIndex < 0 || index === currentIndex) return false;
    const target = tabs[index];
    if (!target) return false;
    hapticSelection();
    navigate(target.path);
    return true;
  };

  return {
    goPrevTab: () => goToIndex(currentIndex - 1),
    goNextTab: () => goToIndex(currentIndex + 1),
    canPrev: currentIndex > 0,
    canNext: currentIndex >= 0 && currentIndex < tabs.length - 1,
  };
}
