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

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
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

      const capabilities = (track.getCapabilities?.() ?? {}) as ZoomCapabilities;
      if (capabilities.zoom && capabilities.zoom.max > capabilities.zoom.min) {
        setZoom({
          min: capabilities.zoom.min,
          max: capabilities.zoom.max,
          current: capabilities.zoom.min,
        });
      } else {
        setZoom(null);
      }

      // Only to decide whether to offer the front/back toggle at all.
      void navigator.mediaDevices.enumerateDevices().then((devices) => {
        if (cancelled) return;
        setHasMultipleCameras(devices.filter((d) => d.kind === 'videoinput').length > 1);
      });
    };

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        attachStream(stream);
      } catch (err: unknown) {
        const name = err instanceof DOMException ? err.name : '';
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
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
    // Restart the stream whenever the chosen side changes.
  }, [facing]);

  const switchCamera = useCallback(() => {
    setZoom(null);
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
      {zoomLevels.length > 1 && (
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
    </div>
  );
}
