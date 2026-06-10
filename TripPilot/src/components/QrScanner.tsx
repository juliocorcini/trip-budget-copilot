import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import jsQR from 'jsqr';
import { Icon } from '@/components/Icon';

interface QrScannerProps {
  onScan: (text: string) => void;
}

const SCAN_INTERVAL_MS = 100;

/**
 * Camera QR scanner: getUserMedia (environment) → canvas sampling → jsQR.
 * Stops the stream on unmount; surfaces a clear message when the camera
 * permission is denied.
 */
export function QrScanner({ onScan }: QrScannerProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [error, setError] = useState<'denied' | 'unavailable' | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
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

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = mediaStream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = mediaStream;
          void video.play().catch(() => {});
        }
        timer = setInterval(scanFrame, SCAN_INTERVAL_MS);
      })
      .catch((err: unknown) => {
        const name = err instanceof DOMException ? err.name : '';
        setError(name === 'NotAllowedError' ? 'denied' : 'unavailable');
      });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
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
    </div>
  );
}
