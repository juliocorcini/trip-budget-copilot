import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import jsQR from 'jsqr';
import { Icon } from '@/components/Icon';
import { safeLocalStorage } from '@/utils/safe-storage';

interface QrScannerProps {
  onScan: (text: string) => void;
}

const SCAN_INTERVAL_MS = 100;
const PREFERRED_CAMERA_KEY = 'trippilot.qr-camera-id';
const ZOOM_PRESETS = [1, 2, 3];

/** lib.dom omits the zoom capability/constraint — narrow casts in one place. */
interface ZoomCapabilities {
  zoom?: { min: number; max: number; step?: number };
}
interface ZoomConstraint {
  zoom: number;
}

interface ZoomState {
  min: number;
  max: number;
  current: number;
}

function readPreferredCameraId(): string | null {
  return safeLocalStorage.get(PREFERRED_CAMERA_KEY);
}

function savePreferredCameraId(deviceId: string): void {
  // BUG-018: storage unavailable — safeLocalStorage keeps it in memory so
  // switching still works for this session.
  safeLocalStorage.set(PREFERRED_CAMERA_KEY, deviceId);
}

/**
 * Camera QR scanner: getUserMedia → canvas sampling → jsQR.
 * R6-08/R6-09 (P2P-06): multi-lens phones can pick a camera that will not
 * focus a dense/near QR — the scanner now supports cycling through cameras
 * (remembering the last choice) and optical zoom when the track supports it.
 */
export function QrScanner({ onScan }: QrScannerProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<'denied' | 'unavailable' | null>(null);
  const [cameraIds, setCameraIds] = useState<string[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(readPreferredCameraId);
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

      const settings = track.getSettings();
      if (settings.deviceId) setActiveDeviceId(settings.deviceId);

      const capabilities = (track.getCapabilities?.() ?? {}) as ZoomCapabilities;
      if (capabilities.zoom && capabilities.zoom.max > capabilities.zoom.min) {
        setZoom({ min: capabilities.zoom.min, max: capabilities.zoom.max, current: capabilities.zoom.min });
      } else {
        setZoom(null);
      }

      void navigator.mediaDevices.enumerateDevices().then((devices) => {
        if (cancelled) return;
        setCameraIds(devices.filter((d) => d.kind === 'videoinput').map((d) => d.deviceId));
      });
    };

    const constraintsFor = (deviceId: string | null): MediaStreamConstraints =>
      deviceId
        ? { video: { deviceId: { exact: deviceId } } }
        : { video: { facingMode: 'environment' } };

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraintsFor(activeDeviceId));
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        attachStream(stream);
      } catch (err: unknown) {
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'OverconstrainedError' && activeDeviceId) {
          // Stale remembered camera — fall back to the environment default.
          setActiveDeviceId(null);
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
    // Restart the stream whenever the chosen camera changes.
  }, [activeDeviceId]);

  const switchCamera = useCallback(() => {
    if (cameraIds.length < 2) return;
    const currentIndex = activeDeviceId ? cameraIds.indexOf(activeDeviceId) : -1;
    const nextId = cameraIds[(currentIndex + 1) % cameraIds.length]!;
    savePreferredCameraId(nextId);
    setZoom(null);
    setActiveDeviceId(nextId);
  }, [cameraIds, activeDeviceId]);

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

  const zoomLevels = zoom
    ? ZOOM_PRESETS.filter((level) => level >= zoom.min && level <= zoom.max)
    : [];

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
      {cameraIds.length > 1 && (
        <button
          onClick={switchCamera}
          aria-label={t('sync.switch_camera')}
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
