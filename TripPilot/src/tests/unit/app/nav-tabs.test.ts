import { describe, it, expect } from 'vitest';
import { tabsForMode } from '@/app/nav-tabs';

// FIELD-02: the swipe order must match the visual bottom bar. These lock it so a
// future reorder can't silently desync the global swipe pager from the nav.
describe('tabsForMode (swipe/nav order)', () => {
  it('orders the tabs as Início · Gastos · Viagem · Copiloto in complete mode', () => {
    expect(tabsForMode('complete').map((tab) => tab.path)).toEqual([
      '/dashboard',
      '/expenses',
      '/viagem',
      '/copiloto',
    ]);
  });

  it('hides the advanced Copiloto tab in simple mode (ÂNCORA 9 — hidden, not removed)', () => {
    expect(tabsForMode('simple').map((tab) => tab.path)).toEqual([
      '/dashboard',
      '/expenses',
      '/viagem',
    ]);
  });
});
