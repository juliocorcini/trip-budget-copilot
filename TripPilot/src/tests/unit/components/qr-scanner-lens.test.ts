import { describe, expect, it } from 'vitest';
import { pickRearCameraDeviceId } from '@/components/QrScanner';

/**
 * DEC-382 — choosing the MAIN rear lens. On Android `facingMode:'environment'`
 * often binds to the ultra-wide, which reads QR codes poorly. `pickRearCameraDeviceId`
 * disambiguates from the device list; it must stay conservative (null = keep the
 * browser default) everywhere except a genuine multi-lens rear Android device, so
 * iOS and desktop never regress.
 */
type Cam = { kind: 'videoinput' | 'audioinput' | 'audiooutput'; label: string; deviceId: string };
const cam = (deviceId: string, label: string, kind: Cam['kind'] = 'videoinput'): Cam => ({
  kind,
  label,
  deviceId,
});

describe('QrScanner: pickRearCameraDeviceId (DEC-382)', () => {
  it('returns null with a single camera (nothing to disambiguate)', () => {
    expect(pickRearCameraDeviceId([cam('a', 'camera2 0, facing back')])).toBeNull();
  });

  it('returns null before permission is granted (labels still empty)', () => {
    expect(
      pickRearCameraDeviceId([cam('a', ''), cam('b', ''), cam('c', '')]),
    ).toBeNull();
  });

  it('returns null on a typical iOS device (one back + one front)', () => {
    expect(
      pickRearCameraDeviceId([cam('back', 'Back Camera'), cam('front', 'Front Camera')]),
    ).toBeNull();
  });

  it('returns null on desktop with two non-rear webcams', () => {
    expect(
      pickRearCameraDeviceId([cam('a', 'FaceTime HD Camera'), cam('b', 'Logitech BRIO')]),
    ).toBeNull();
  });

  it('ignores non-video inputs entirely', () => {
    expect(
      pickRearCameraDeviceId([
        cam('mic', 'Default - Microphone', 'audioinput'),
        cam('back0', 'camera2 0, facing back'),
        cam('back2', 'camera2 2, facing back'),
      ]),
    ).toBe('back0');
  });

  it('prefers the lowest camera2 ordinal among unlabelled-but-back Android lenses', () => {
    // Samsung-style: several "facing back" lenses with no wide/tele words — the
    // main sensor is camera2 0, the ultra-wide/tele are higher ordinals.
    const devices = [
      cam('ultra', 'camera2 2, facing back'),
      cam('main', 'camera2 0, facing back'),
      cam('tele', 'camera2 3, facing back'),
      cam('front', 'camera2 1, facing front'),
    ];
    expect(pickRearCameraDeviceId(devices)).toBe('main');
  });

  it('drops a labelled ultra-wide / telephoto and keeps the plain back camera', () => {
    const devices = [
      cam('uw', 'Back Ultra Wide Camera'),
      cam('main', 'Back Camera'),
      cam('tele', 'Back Telephoto Camera'),
    ];
    expect(pickRearCameraDeviceId(devices)).toBe('main');
  });

  it('falls back to the ordinal when every rear lens carries a secondary qualifier', () => {
    // Degenerate: no "plain" rear lens — still pick the lowest ordinal rather than null.
    const devices = [
      cam('uw', 'camera2 2, facing back ultra wide'),
      cam('w', 'camera2 0, facing back wide'),
    ];
    expect(pickRearCameraDeviceId(devices)).toBe('w');
  });
});
