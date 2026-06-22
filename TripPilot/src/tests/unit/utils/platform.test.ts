import { describe, it, expect } from 'vitest';
import { webPlatformTag } from '@/utils/platform';

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
});
