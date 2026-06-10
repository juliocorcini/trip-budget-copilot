import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeDisplayProps {
  value: string;
  /** Rendered pixel width (CSS px). */
  size?: number;
}

/**
 * Renders a QR on a white card regardless of theme — scanners need dark
 * modules over a light background, so these two colors are functional,
 * not themable (quiet zone preserved via margin).
 */
export function QrCodeDisplay({ value, size = 260 }: QrCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: size * 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        className="rounded-2xl bg-surface-high animate-pulse mx-auto"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div className="rounded-2xl p-3 mx-auto" style={{ background: '#FFFFFF', width: size + 24 }}>
      <img src={dataUrl} alt="QR code" width={size} height={size} className="block" />
    </div>
  );
}
