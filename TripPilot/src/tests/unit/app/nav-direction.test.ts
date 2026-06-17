import { describe, it, expect } from 'vitest';
import {
  resolveTabIndex,
  tabSwitchDirection,
  setPendingTabDirection,
  consumePendingTabDirection,
} from '@/app/nav-direction';

// Swipe order (left → right), mirrors nav-tabs.ts in complete mode.
const TABS = ['/dashboard', '/expenses', '/viagem', '/copiloto'];

describe('resolveTabIndex (D-BUG-10)', () => {
  it('matches a tab root exactly', () => {
    expect(resolveTabIndex('/dashboard', TABS)).toBe(0);
    expect(resolveTabIndex('/viagem', TABS)).toBe(2);
  });

  it('matches a sub-page under a tab', () => {
    expect(resolveTabIndex('/expenses/abc-123', TABS)).toBe(1);
    expect(resolveTabIndex('/viagem/funds', TABS)).toBe(2);
  });

  it('is -1 for a path outside the tab set', () => {
    expect(resolveTabIndex('/settings/backup', TABS)).toBe(-1);
    // A prefix that is not a path boundary must NOT match (/expensesX ≠ /expenses).
    expect(resolveTabIndex('/expensesX', TABS)).toBe(-1);
  });
});

describe('tabSwitchDirection (D-BUG-10)', () => {
  it('is "forward" toward a higher tab index', () => {
    expect(tabSwitchDirection('/dashboard', '/expenses', TABS)).toBe('forward');
    expect(tabSwitchDirection('/dashboard', '/copiloto', TABS)).toBe('forward');
  });

  it('is "back" toward a lower tab index (the bug: this used to read forward)', () => {
    expect(tabSwitchDirection('/viagem', '/dashboard', TABS)).toBe('back');
    expect(tabSwitchDirection('/copiloto', '/expenses', TABS)).toBe('back');
  });

  it('resolves from a sub-page of the current tab', () => {
    expect(tabSwitchDirection('/expenses/abc', '/dashboard', TABS)).toBe('back');
    expect(tabSwitchDirection('/dashboard', '/viagem', TABS)).toBe('forward');
  });

  it('is null when it is not a tab→tab move (same tab or outside the set)', () => {
    expect(tabSwitchDirection('/expenses', '/expenses', TABS)).toBeNull();
    expect(tabSwitchDirection('/expenses/abc', '/expenses', TABS)).toBeNull(); // same tab
    expect(tabSwitchDirection('/settings/backup', '/dashboard', TABS)).toBeNull();
    expect(tabSwitchDirection('/dashboard', '/settings', TABS)).toBeNull();
  });
});

describe('pending tab direction (D-BUG-10 — one-shot override)', () => {
  it('returns the set value once, then clears', () => {
    setPendingTabDirection('back');
    expect(consumePendingTabDirection()).toBe('back');
    expect(consumePendingTabDirection()).toBeNull();
  });

  it('the latest set wins before a consume', () => {
    setPendingTabDirection('back');
    setPendingTabDirection('forward');
    expect(consumePendingTabDirection()).toBe('forward');
    expect(consumePendingTabDirection()).toBeNull();
  });
});
