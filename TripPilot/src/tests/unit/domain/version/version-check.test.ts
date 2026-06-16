import { describe, it, expect } from 'vitest';
import {
  compareSemver,
  isNewerVersion,
  evaluateVersionStatus,
  parseVersionManifest,
  type VersionManifest,
} from '@/domain/version';

describe('compareSemver', () => {
  it('orders equal, greater and lesser versions', () => {
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
    expect(compareSemver('1.3.0', '1.2.9')).toBe(1);
    expect(compareSemver('0.47.0', '0.48.0')).toBe(-1);
  });

  it('treats missing trailing segments as zero', () => {
    expect(compareSemver('1.2', '1.2.0')).toBe(0);
    expect(compareSemver('1.2.1', '1.2')).toBe(1);
  });

  it('compares major segments numerically (not lexicographically)', () => {
    // "10" > "9" numerically, even though "1" < "9" as a string.
    expect(compareSemver('0.10.0', '0.9.0')).toBe(1);
  });

  it('treats non-numeric junk as zero', () => {
    expect(compareSemver('1.x.3', '1.0.3')).toBe(0);
  });
});

describe('isNewerVersion', () => {
  it('is true only when strictly newer', () => {
    expect(isNewerVersion('0.48.0', '0.47.0')).toBe(true);
    expect(isNewerVersion('0.47.0', '0.47.0')).toBe(false);
    expect(isNewerVersion('0.46.0', '0.47.0')).toBe(false);
  });
});

describe('parseVersionManifest', () => {
  it('accepts a full manifest and trims strings', () => {
    const parsed = parseVersionManifest({
      version: ' 0.48.0 ',
      requiredNativeVersion: ' 0.40.0 ',
      apkUrl: ' https://x/app.apk ',
      notes: 'hi',
    });
    expect(parsed).toEqual({
      version: '0.48.0',
      requiredNativeVersion: '0.40.0',
      apkUrl: 'https://x/app.apk',
      notes: 'hi',
    });
  });

  it('accepts a minimal manifest (version only)', () => {
    expect(parseVersionManifest({ version: '0.48.0' })).toEqual({ version: '0.48.0' });
  });

  it('rejects payloads without a usable version', () => {
    expect(parseVersionManifest(null)).toBeNull();
    expect(parseVersionManifest('0.48.0')).toBeNull();
    expect(parseVersionManifest({})).toBeNull();
    expect(parseVersionManifest({ version: '' })).toBeNull();
    expect(parseVersionManifest({ version: 48 })).toBeNull();
  });
});

describe('evaluateVersionStatus', () => {
  const manifest: VersionManifest = {
    version: '0.48.0',
    requiredNativeVersion: '0.45.0',
    apkUrl: 'https://x/app.apk',
  };

  it('returns unknown when the manifest is missing', () => {
    const status = evaluateVersionStatus({ webVersion: '0.47.0', nativeVersion: null, manifest: null });
    expect(status.kind).toBe('unknown');
    expect(status.latestWeb).toBe('0.47.0');
  });

  it('is up to date when the running bundle is the latest (or newer)', () => {
    expect(
      evaluateVersionStatus({ webVersion: '0.48.0', nativeVersion: null, manifest }).kind,
    ).toBe('up_to_date');
    expect(
      evaluateVersionStatus({ webVersion: '0.49.0', nativeVersion: null, manifest }).kind,
    ).toBe('up_to_date');
  });

  it('reports a web update on the PWA (no native version to gate)', () => {
    const status = evaluateVersionStatus({ webVersion: '0.47.0', nativeVersion: null, manifest });
    expect(status.kind).toBe('web_update_available');
    expect(status.latestWeb).toBe('0.48.0');
  });

  it('allows the OTA update when the APK is recent enough', () => {
    const status = evaluateVersionStatus({ webVersion: '0.47.0', nativeVersion: '0.46.0', manifest });
    expect(status.kind).toBe('web_update_available');
  });

  it('flags the APK as outdated when it predates the required native version', () => {
    const status = evaluateVersionStatus({ webVersion: '0.47.0', nativeVersion: '0.40.0', manifest });
    expect(status.kind).toBe('apk_outdated');
    expect(status.requiredNative).toBe('0.45.0');
    expect(status.apkUrl).toBe('https://x/app.apk');
  });

  it('cannot gate on the APK when the manifest omits the required native version', () => {
    const noGate: VersionManifest = { version: '0.48.0' };
    const status = evaluateVersionStatus({ webVersion: '0.47.0', nativeVersion: '0.10.0', manifest: noGate });
    expect(status.kind).toBe('web_update_available');
  });
});
