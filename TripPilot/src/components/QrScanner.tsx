import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import jsQR from 'jsqr';
import { Icon } from '@/components/Icon';

interface QrScannerProps {
  onScan: (text: string) => void;
}

const SCAN_INTERVAL_MS = 100;
export const ZOOM_PRESETS = [1, 2, 3];

type Facing = 'environment' | 'user';

/** lib.dom omits the zoom capability/constraint — narrow casts in one place. */
interface ZoomCapabilities {
  zoom?: { min: number; max: number; step?: number };
}
interface ZoomConstraint {
  zoom: number;
}

export interface ZoomState {
  min: number;
  max: number;
  current: number;
}

/**
 * Pure: which preset zoom buttons (1×/2×/3×) to show for a camera's reported
 * zoom range. Extracted so the gating is unit-testable without a real camera.
 */
export function computeZoomLevels(zoom: ZoomState | null): number[] {
  if (!zoom) return [];
  return ZOOM_PRESETS.filter((level) => level >= zoom.min && level <= zoom.max);
}

/**
 * F15 — pure: derive the usable zoom range a track reports. Android frequently
 * returns an EMPTY or DEGENERATE ({min === max}) capability set right after
 * `getUserMedia` and only fills a real range once the track has settled
 * (`loadedmetadata`) — so this is re-run on settle + a couple of retries and the
 * first usable range wins. Returns null when there is genuinely no zoom.
 */
export function deriveZoomState(
  capabilities: ZoomCapabilities,
  currentZoom?: number,
): ZoomState | null {
  const z = capabilities.zoom;
  if (z && typeof z.min === 'number' && typeof z.max === 'number' && z.max > z.min) {
    const current = typeof currentZoom === 'number' && currentZoom >= z.min && currentZoom <= z.max
      ? currentZoom
      : z.min;
    return { min: z.min, max: z.max, current };
  }
  return null;
}

/** DEC-382 — labels that mark a rear/back lens (multilingual, best-effort). */
const REAR_LENS_HINT = /(back|rear|environment|traseira|tras[ei])/i;
/** DEC-382 — labels of SECONDARY rear lenses we want to avoid for QR scanning. */
const SECONDARY_LENS_HINT = /(wide|ultra|tele|zoom|depth|macro|mono|infrared|\bir\b)/i;

type CameraInfo = Pick<MediaDeviceInfo, 'kind' | 'label' | 'deviceId'>;

/** DEC-382 — the `camera2 N` ordinal Android assigns; the main sensor is N=0. */
function rearLensOrder(label: string): number {
  const match = label.match(/camera2\s+(\d+)/i);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

/**
 * DEC-382 — pure: pick the MAIN rear lens from a device list. Android exposes
 * several back cameras (ultra-wide / tele / depth) and `facingMode:'environment'`
 * frequently binds to the ULTRA-WIDE, which is poor for reading a QR. We prefer a
 * back-facing lens whose label has no secondary-lens qualifier, breaking ties by
 * the lowest `camera2 N` ordinal (the main sensor). Returns null whenever there
 * is nothing better than the browser default — fewer than two cameras, no granted
 * labels (pre-permission), or NO rear-labelled lens at all (desktop webcams) — so
 * the caller keeps the plain `facingMode` stream and nothing regresses.
 */
export function pickRearCameraDeviceId(devices: CameraInfo[]): string | null {
  const videoInputs = devices.filter((d) => d.kind === 'videoinput');
  if (videoInputs.length < 2) return null;
  const rear = videoInputs.filter((d) => d.label.trim().length > 0 && REAR_LENS_HINT.test(d.label));
  // Only act when a rear lens is actually identifiable (Android/iOS). On desktop
  // — multiple unlabelled or non-rear webcams — keep the browser default.
  if (rear.length < 2) return null;
  const mains = rear.filter((d) => !SECONDARY_LENS_HINT.test(d.label));
  const ranked = (mains.length > 0 ? mains : rear)
    .map((d, index) => ({ d, index }))
    .sort((a, b) => rearLensOrder(a.d.label) - rearLensOrder(b.d.label) || a.index - b.index);
  return ranked[0]?.d.deviceId ?? null;
}

export type ZoomMode = 'none' | 'presets' | 'slider';

/**
 * F15 — pure: how to render zoom for a range. `presets` when ≥2 of 1×/2×/3× fall
 * inside it; `slider` when the camera zooms but the presets don't qualify (e.g.
 * Android's default stream reports {min:1,max:1.6}); `none` when there is no zoom.
 * The fix: a degenerate preset set no longer HIDES zoom — it degrades to a
 * continuous slider so Android keeps a working zoom control.
 */
export function zoomMode(zoom: ZoomState | null): ZoomMode {
  if (!zoom) return 'none';
  return computeZoomLevels(zoom).length > 1 ? 'presets' : 'slider';
}

/**
 * Camera QR scanner: getUserMedia → canvas sampling → jsQR.
 *
 * D-BUG-03: the switch button is a plain front↔back toggle (`facingMode`), not a
 * round-robin over every physical lens, and the rear camera's optical/digital
 * zoom presets are re-derived from each stream (so they never vanish on switch).
 * This restores the simple "rear with 1×/2×/3× + a front toggle" behavior.
 */
export function QrScanner({ onScan }: QrScannerProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<'denied' | 'unavailable' | null>(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [facing, setFacing] = useState<Facing>('environment');
  const [zoom, setZoom] = useState<ZoomState | null>(null);
  // DEC-382: once labels are known we bind the rear stream to the MAIN lens
  // (Android's `facingMode:environment` often picks the ultra-wide). Null until
  // chosen, and only on the rear side — the front toggle and other platforms keep
  // the plain `facingMode` stream.
  const [preferredDeviceId, setPreferredDeviceId] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let zoomTimers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });

    const scanFrame = () => {
      const video = videoRef.current;
      if (!video || !context || video.readyState < video.HAVE_ENOUGH_DATA) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(image.data, image.width, image.height, {
        inversionAttempts: 'dontInvert',
      });
      if (result?.data) onScanRef.current(result.data);
    };

    const attachStream = (mediaStream: MediaStream) => {
      streamRef.current = mediaStream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = mediaStream;
        void video.play().catch(() => {});
      }
      timer = setInterval(scanFrame, SCAN_INTERVAL_MS);

      const track = mediaStream.getVideoTracks()[0];
      if (!track) return;

      // F15 — Android exposes zoom only AFTER the track settles. Derive now, again
      // on `loadedmetadata`, and on a couple of retries; keep the first usable
      // range so the 1×/2×/3× presets (or a slider fallback) reappear on Android.
      const deriveZoom = () => {
        if (cancelled) return;
        const live = streamRef.current?.getVideoTracks()[0];
        if (!live) return;
        const capabilities = (live.getCapabilities?.() ?? {}) as ZoomCapabilities;
        const trackSettings = (live.getSettings?.() ?? {}) as { zoom?: number };
        const next = deriveZoomState(capabilities, trackSettings.zoom);
        if (next) setZoom((prev) => prev ?? next);
      };

      deriveZoom();
      if (video) video.addEventListener('loadedmetadata', deriveZoom, { once: true });
      zoomTimers = [250, 700, 1500].map((ms) => setTimeout(deriveZoom, ms));

      // Decide whether to offer the front/back toggle, and — DEC-382 — once the
      // labels are granted, prefer the MAIN rear lens over Android's ultra-wide.
      void navigator.mediaDevices.enumerateDevices().then((devices) => {
        if (cancelled) return;
        setHasMultipleCameras(devices.filter((d) => d.kind === 'videoinput').length > 1);
        if (facing !== 'environment' || preferredDeviceId) return;
        const mainRear = pickRearCameraDeviceId(devices);
        const activeId = (track.getSettings?.() ?? {}).deviceId;
        if (mainRear && mainRear !== activeId) setPreferredDeviceId(mainRear);
      });
    };

    const start = async () => {
      // DEC-382: on the rear side, once a main lens is chosen, bind to it by
      // deviceId; otherwise (front side, or before the pick) use facingMode.
      const video: MediaTrackConstraints =
        facing === 'environment' && preferredDeviceId
          ? { deviceId: { exact: preferredDeviceId } }
          : { facingMode: facing };
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        attachStream(stream);
      } catch (err: unknown) {
        const name = err instanceof DOMException ? err.name : '';
        // DEC-382: the chosen lens vanished/was rejected — drop the override and
        // fall back to the plain rear stream instead of erroring out.
        if ((name === 'OverconstrainedError' || name === 'NotFoundError') && preferredDeviceId) {
          setPreferredDeviceId(null);
          return;
        }
        // No camera matching the requested side (e.g. no front camera) — fall
        // back to the rear default once instead of erroring out.
        if (name === 'OverconstrainedError' && facing === 'user') {
          setFacing('environment');
          return;
        }
        setError(name === 'NotAllowedError' ? 'denied' : 'unavailable');
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      zoomTimers.forEach(clearTimeout);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
    // Restart the stream whenever the chosen side OR the preferred lens changes.
  }, [facing, preferredDeviceId]);

  const switchCamera = useCallback(() => {
    setZoom(null);
    // DEC-382: re-pick the main lens next time we return to the rear side.
    setPreferredDeviceId(null);
    setFacing((prev) => (prev === 'environment' ? 'user' : 'environment'));
  }, []);

  const applyZoom = useCallback((level: number) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    void track
      .applyConstraints({ advanced: [{ zoom: level } as ZoomConstraint as MediaTrackConstraintSet] })
      .then(() => setZoom((prev) => (prev ? { ...prev, current: level } : prev)))
      .catch(() => {});
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl bg-surface-high p-6 flex flex-col items-center gap-3 text-center">
        <Icon name="videocam_off" size={32} className="text-on-surface-dim" />
        <p className="text-sm text-on-surface-dim">
          {error === 'denied' ? t('sync.camera_denied') : t('sync.camera_unavailable')}
        </p>
      </div>
    );
  }

  const zoomLevels = computeZoomLevels(zoom);
  const mode = zoomMode(zoom);

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
      <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
      {/* Aim overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-3/5 aspect-square rounded-2xl"
          style={{ border: '3px solid var(--primary)', boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)' }}
        />
      </div>
      {hasMultipleCameras && (
        <button
          onClick={switchCamera}
          aria-label={t('sync.switch_camera')}
          aria-pressed={facing === 'user'}
          className="absolute top-3 right-3 w-11 h-11 rounded-full flex items-center justify-center btn-press"
          style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
        >
          <Icon name="cameraswitch" size={22} />
        </button>
      )}
      {mode === 'presets' && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {zoomLevels.map((level) => (
            <button
              key={level}
              onClick={() => applyZoom(level)}
              className="px-3 py-1.5 rounded-full text-xs font-bold btn-press tabular"
              style={{
                background: zoom?.current === level ? 'var(--primary)' : 'rgba(0,0,0,0.55)',
                color: '#fff',
              }}
            >
              {level}×
            </button>
          ))}
        </div>
      )}
      {/* F15 — when presets don't fit the reported range (common on Android's
          default stream), keep a working zoom as a continuous slider. */}
      {mode === 'slider' && zoom && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{ background: 'rgba(0,0,0,0.55)' }}
        >
          <Icon name="zoom_in" size={16} className="text-white" />
          <input
            type="range"
            min={zoom.min}
            max={zoom.max}
            step={(zoom.max - zoom.min) / 20 || 0.1}
            value={zoom.current}
            onChange={(e) => applyZoom(Number(e.target.value))}
            aria-label={t('sync.zoom')}
            className="w-32"
            style={{ accentColor: 'var(--primary)' }}
          />
          <span className="text-xs font-bold text-white tabular">{zoom.current.toFixed(1)}×</span>
        </div>
      )}
    </div>
  );
}
