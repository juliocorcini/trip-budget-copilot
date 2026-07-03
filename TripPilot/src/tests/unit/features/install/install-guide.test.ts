import { describe, it, expect } from 'vitest';
import {
  manualInstallStepKeys,
  manualInstallTitleKey,
  resolveInstallGuideFamily,
  type InstallGuideFamily,
} from '@/features/install/install-guide';
import ptBR from '@/i18n/locales/pt-BR.json';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';

/**
 * DEC-444 (PWA-1/2) — the manual-install fallback guide. When the browser
 * refuses `beforeinstallprompt`, the button expands per-browser steps; picking
 * the wrong family (or pointing at a missing i18n key) turns the fallback into
 * a dead-end again, which is exactly the bug this wave fixes.
 */
describe('resolveInstallGuideFamily', () => {
  it('maps each Android browser family to its own guide', () => {
    expect(resolveInstallGuideFamily({ browser: 'Chrome', isAndroid: true })).toBe('chrome-android');
    expect(resolveInstallGuideFamily({ browser: 'Edge', isAndroid: true })).toBe('edge-android');
    expect(resolveInstallGuideFamily({ browser: 'Samsung Internet', isAndroid: true })).toBe('samsung-android');
    expect(resolveInstallGuideFamily({ browser: 'Firefox', isAndroid: true })).toBe('firefox-android');
  });

  it('falls back to the generic guide for unknown Android browsers', () => {
    expect(resolveInstallGuideFamily({ browser: 'Opera', isAndroid: true })).toBe('generic');
    expect(resolveInstallGuideFamily({ browser: null, isAndroid: true })).toBe('generic');
  });

  it('maps desktop Chromium browsers to the address-bar guide', () => {
    expect(resolveInstallGuideFamily({ browser: 'Chrome', isAndroid: false })).toBe('desktop');
    expect(resolveInstallGuideFamily({ browser: 'Edge', isAndroid: false })).toBe('desktop');
    expect(resolveInstallGuideFamily({ browser: 'Opera', isAndroid: false })).toBe('desktop');
  });

  it('maps non-Chromium desktop browsers to the generic guide', () => {
    expect(resolveInstallGuideFamily({ browser: 'Firefox', isAndroid: false })).toBe('generic');
    expect(resolveInstallGuideFamily({ browser: 'Safari', isAndroid: false })).toBe('generic');
    expect(resolveInstallGuideFamily({ browser: null, isAndroid: false })).toBe('generic');
  });
});

describe('manualInstallStepKeys / manualInstallTitleKey', () => {
  const FAMILIES: InstallGuideFamily[] = [
    'chrome-android',
    'edge-android',
    'samsung-android',
    'firefox-android',
    'desktop',
    'generic',
  ];

  function lookup(locale: Record<string, unknown>, dottedKey: string): unknown {
    return dottedKey.split('.').reduce<unknown>((node, part) => {
      if (node && typeof node === 'object') return (node as Record<string, unknown>)[part];
      return undefined;
    }, locale);
  }

  it('returns ordered step keys under install.guide for every family', () => {
    expect(manualInstallStepKeys('chrome-android')).toEqual([
      'install.guide.chrome_android.step1',
      'install.guide.chrome_android.step2',
      'install.guide.chrome_android.step3',
    ]);
    expect(manualInstallStepKeys('desktop')).toEqual([
      'install.guide.desktop.step1',
      'install.guide.desktop.step2',
    ]);
  });

  it.each([
    ['pt-BR', ptBR],
    ['en', en],
    ['es', es],
  ])('every generated key resolves to a non-empty string in %s', (_name, locale) => {
    for (const family of FAMILIES) {
      const keys = [manualInstallTitleKey(family), ...manualInstallStepKeys(family)];
      for (const key of keys) {
        const value = lookup(locale as Record<string, unknown>, key);
        expect(typeof value, `${key} missing`).toBe('string');
        expect((value as string).length, `${key} empty`).toBeGreaterThan(0);
      }
    }
  });
});
