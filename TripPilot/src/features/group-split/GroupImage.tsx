import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { fetchDecryptedImageUrl } from '@/data/sync/media-link';
import type { ImageRef } from '@/domain/media';

/**
 * DEC-342/343 (G5) — a decrypt-on-mount image, reused by the owner detail gallery
 * and the `/g/` guest board. It fetches the R2 ciphertext, decrypts it with the
 * per-image key carried in the {@link ImageRef}, renders the blob URL, and revokes
 * it on unmount. It never throws into render: while loading it shows a spinner,
 * and a gone/expired/bad-key blob shows a neutral "broken" placeholder.
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
  /** Called with the already-decrypted blob URL so a lightbox needn't re-fetch. */
  onOpen?: (url: string) => void;
}) {
  const url = useDecryptedImage(imageRef);

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
      <img src={url} alt={alt} className="w-full h-full object-cover" />
    </button>
  );
}

/** Resolve an {@link ImageRef} to a decrypted blob URL ('failed' = gone/bad). */
export function useDecryptedImage(imageRef: ImageRef): string | 'failed' | null {
  const [state, setState] = useState<string | 'failed' | null>(null);
  useEffect(() => {
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
  }, [imageRef.r2Id, imageRef.key]);
  return state;
}

/**
 * Full-screen viewer for one already-resolved image URL (decrypted blob URL or a
 * local object URL). Offers a download (the cloud image is private — the only way
 * to save it is through the holder's own decrypted copy) and dismiss-on-backdrop.
 */
export function ImageLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
        <a
          href={url}
          download="receipt.jpg"
          className="px-4 py-2.5 rounded-xl bg-primary text-on-surface font-semibold btn-press flex items-center gap-1.5"
        >
          <Icon name="download" size={18} className="text-on-surface" />
          {t('group_split.image_download')}
        </a>
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
