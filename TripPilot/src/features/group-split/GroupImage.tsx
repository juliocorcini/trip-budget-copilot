import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { fetchDecryptedImageUrl, imageUrl } from '@/data/sync/media-link';
import type { ImageRef } from '@/domain/media';

/**
 * DEC-348 (G2, this wave) — a shared image, reused by the owner detail gallery,
 * the `/g/` guest board and the bill-split surfaces. A PLAINTEXT ref (no `key`)
 * renders straight from its direct R2 URL (`<img src>`), so a no-app web guest can
 * view + download it. A LEGACY E2E ref (carries `key`, minted by 1.2.4-rc) is
 * fetched + decrypted to a blob URL for back-compat. It never throws into render:
 * while a legacy image loads it shows a spinner, and a gone/expired/broken image
 * shows a neutral placeholder.
 */
export function GroupImage({
  imageRef,
  alt,
  className,
  onOpen,
}: {
  imageRef: ImageRef;
  alt: string;
  className?: string;
  /** Called with the resolved image URL so a lightbox needn't re-fetch. */
  onOpen?: (url: string) => void;
}) {
  const legacy = !!imageRef.key;
  const decrypted = useDecryptedImage(legacy ? imageRef : null);
  const [plainFailed, setPlainFailed] = useState(false);
  const url = legacy ? decrypted : plainFailed ? 'failed' : imageUrl(imageRef);

  if (url === 'failed') {
    return (
      <div className={`flex items-center justify-center bg-surface-high ${className ?? ''}`}>
        <Icon name="broken_image" size={20} className="text-on-surface-faint" />
      </div>
    );
  }
  if (url === null) {
    return (
      <div className={`flex items-center justify-center bg-surface-high ${className ?? ''}`}>
        <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  return (
    <button type="button" onClick={() => onOpen?.(url)} className={`btn-press block overflow-hidden ${className ?? ''}`}>
      <img
        src={url}
        alt={alt}
        className="w-full h-full object-cover"
        onError={legacy ? undefined : () => setPlainFailed(true)}
      />
    </button>
  );
}

/**
 * LEGACY back-compat — resolve an E2E {@link ImageRef} (carries `key`) to a
 * decrypted blob URL ('failed' = gone/bad). Passing `null` (a plaintext ref, or
 * none) is a no-op: plaintext images render straight from {@link imageUrl}.
 */
export function useDecryptedImage(imageRef: ImageRef | null): string | 'failed' | null {
  const [state, setState] = useState<string | 'failed' | null>(null);
  const r2Id = imageRef?.r2Id;
  const key = imageRef?.key;
  useEffect(() => {
    if (!imageRef || !key) {
      setState(null);
      return;
    }
    let active = true;
    let created: string | null = null;
    setState(null);
    void fetchDecryptedImageUrl(imageRef).then((u) => {
      if (!active) {
        if (u) URL.revokeObjectURL(u);
        return;
      }
      if (u) {
        created = u;
        setState(u);
      } else {
        setState('failed');
      }
    });
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r2Id, key]);
  return state;
}

/**
 * Full-screen viewer for one already-resolved image URL (a direct R2 URL or a
 * decrypted/local blob URL). Offers a download and dismiss-on-backdrop. The
 * download fetches the bytes into an object URL so it works even for a
 * cross-origin plaintext image (where a bare `download` attribute is ignored).
 */
export function ImageLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleDownload = async () => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = 'receipt.jpg';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Fall back to opening the image in a new tab so the user can still save it.
      window.open(url, '_blank', 'noopener');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <img
        src={url}
        alt=""
        className="max-w-full max-h-[80vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="flex gap-3 pt-4" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => void handleDownload()}
          className="px-4 py-2.5 rounded-xl bg-primary text-on-surface font-semibold btn-press flex items-center gap-1.5"
        >
          <Icon name="download" size={18} className="text-on-surface" />
          {t('group_split.image_download')}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl bg-surface-high text-on-surface font-semibold btn-press"
        >
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}
