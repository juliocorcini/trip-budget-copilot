import { describe, it, expect } from 'vitest';
import {
  webPlatformTag,
  deviceBrowserFamily,
  deviceOsLabel,
  suggestDeviceName,
} from '@/utils/platform';

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

describe('webPlatformTag (DEC-253)', () => {
  it('classifies an iPhone (Safari or installed PWA) as ios-web, not web', () => {
    expect(webPlatformTag(IPHONE_UA, 'iPhone', 5)).toBe('ios-web');
  });

  it('classifies iPadOS 13+ (reports as MacIntel + touch) as ios-web', () => {
    expect(webPlatformTag('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5)).toBe('ios-web');
  });

  it('does NOT misread a real Mac (MacIntel, no touch) as iOS', () => {
    expect(webPlatformTag('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0)).toBe('web');
  });

  it('classifies an Android device as android-web', () => {
    expect(webPlatformTag(ANDROID_UA, 'Linux armv8l', 5)).toBe('android-web');
  });

  it('classifies a desktop browser as web', () => {
    expect(webPlatformTag(DESKTOP_UA, 'Win32', 0)).toBe('web');
  });

  // FB-20 (DEC-271): an installed PWA (standalone display mode) is distinguished
  // from a browser tab, so the admin "Plataformas" separates web vs PWA.
  it('classifies an installed iOS PWA (standalone) as ios-pwa', () => {
    expect(webPlatformTag(IPHONE_UA, 'iPhone', 5, true)).toBe('ios-pwa');
  });

  it('classifies an installed Android PWA (standalone) as android-pwa', () => {
    expect(webPlatformTag(ANDROID_UA, 'Linux armv8l', 5, true)).toBe('android-pwa');
  });

  it('keeps a browser tab as -web even when standalone is false', () => {
    expect(webPlatformTag(IPHONE_UA, 'iPhone', 5, false)).toBe('ios-web');
    expect(webPlatformTag(ANDROID_UA, 'Linux armv8l', 5, false)).toBe('android-web');
  });

  it('classifies a desktop browser as web regardless of standalone', () => {
    expect(webPlatformTag(DESKTOP_UA, 'Win32', 0, true)).toBe('web');
  });
});

const EDGE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0';
const FIREFOX_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0';
const SAMSUNG_UA =
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36';

describe('deviceBrowserFamily (FB-05)', () => {
  it('reads Chrome on Android', () => {
    expect(deviceBrowserFamily(ANDROID_UA)).toBe('Chrome');
  });

  it('reads Safari on iPhone (Version/ + Safari/ token)', () => {
    expect(deviceBrowserFamily(IPHONE_UA)).toBe('Safari');
  });

  it('reads Edge before the Chrome token it also carries', () => {
    expect(deviceBrowserFamily(EDGE_UA)).toBe('Edge');
  });

  it('reads Samsung Internet before its Chrome token', () => {
    expect(deviceBrowserFamily(SAMSUNG_UA)).toBe('Samsung Internet');
  });

  it('reads Firefox', () => {
    expect(deviceBrowserFamily(FIREFOX_UA)).toBe('Firefox');
  });

  it('returns null for an unrecognized UA', () => {
    expect(deviceBrowserFamily('some-unknown-agent')).toBeNull();
  });
});

describe('deviceOsLabel (FB-05)', () => {
  it('reads Android / iPhone / Windows', () => {
    expect(deviceOsLabel(ANDROID_UA, 'Linux armv8l', 5)).toBe('Android');
    expect(deviceOsLabel(IPHONE_UA, 'iPhone', 5)).toBe('iPhone');
    expect(deviceOsLabel(DESKTOP_UA, 'Win32', 0)).toBe('Windows');
  });

  it('reads iPad from the MacIntel + touch heuristic', () => {
    expect(deviceOsLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5)).toBe('iPad');
  });
});

describe('suggestDeviceName (FB-05 / DEC-266)', () => {
  it('combines OS and browser family', () => {
    expect(suggestDeviceName(ANDROID_UA, 'Linux armv8l', 5)).toBe('Android · Chrome');
    expect(suggestDeviceName(IPHONE_UA, 'iPhone', 5)).toBe('iPhone · Safari');
  });

  it('falls back to a generic label when nothing is recognizable', () => {
    expect(suggestDeviceName('some-unknown-agent', 'unknown', 0)).toBe('Meu dispositivo');
  });
});
