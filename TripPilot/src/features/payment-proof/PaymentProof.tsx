import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';
import { useImageSourceChooser } from '@/components/ImageSourceChooser';
import { ImageLightbox } from '@/features/group-split/GroupImage';
import { compressImageFile } from '@/utils/image/compress';
import { uploadImage, imageUrl } from '@/data/sync/media-link';
import { checkImageBytes, type ImageRef } from '@/domain/media';

/**
 * DEC-363 (Item D) — the ONE reusable payment-proof surface, shared by the group
 * mark-paid flow and the P2P "paguei/recebi" flow (Critic's "componente único").
 *
 * A proof = an OPTIONAL receipt image the payer attaches. It reuses the DEC-348
 * image carve-out: the full image is uploaded to R2 as access-controlled plaintext
 * (only the {@link ImageRef} travels the E2E payload), and a tiny inline thumbnail
 * (data URL) gives instant render + is the durable evidence in the timeline/backup.
 */
export interface AttachedProof {
  proof: ImageRef;
  thumb: string;
}

/** The controlled attach field: pick → compress → upload → `onChange({proof,thumb})`. */
export function ProofAttachField({
  value,
  onChange,
}: {
  value: AttachedProof | null;
  onChange: (next: AttachedProof | null) => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const handlePick = async (file: File) => {
    setBusy(true);
    try {
      const compressed = await compressImageFile(file);
      const cap = checkImageBytes(compressed.byteSize);
      if (!cap.ok) {
        showToast(t('payment_proof.too_large'), 'danger');
        return;
      }
      const result = await uploadImage(compressed.blob, {
        width: compressed.width,
        height: compressed.height,
        mimeType: compressed.mimeType,
      });
      if (!result.ok) {
        showToast(
          t(result.reason === 'too_large' ? 'payment_proof.too_large' : 'payment_proof.upload_failed'),
          'danger',
        );
        return;
      }
      onChange({ proof: result.ref, thumb: compressed.thumbnailDataUrl });
    } catch {
      showToast(t('payment_proof.upload_failed'), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const chooser = useImageSourceChooser((file) => void handlePick(file), {
    title: t('payment_proof.attach'),
  });

  return (
    <div className="flex flex-col gap-1.5">
      {value ? (
        <div
          className="flex items-center gap-3 p-2 rounded-2xl"
          style={{ background: 'var(--surface-high)' }}
        >
          <img
            src={value.thumb}
            alt={t('payment_proof.attached')}
            className="w-12 h-12 rounded-xl object-cover shrink-0"
          />
          <span className="flex-1 text-[13px] font-semibold text-on-surface">
            {t('payment_proof.attached')}
          </span>
          <button
            onClick={() => onChange(null)}
            className="px-2.5 py-1.5 rounded-lg text-[12px] font-bold text-on-surface-dim btn-press"
          >
            {t('payment_proof.remove')}
          </button>
        </div>
      ) : (
        <button
          onClick={chooser.open}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl btn-press disabled:opacity-50"
          style={{ background: 'var(--surface-high)' }}
        >
          <Icon name="photo_camera" size={18} className="text-primary" />
          <span className="text-[13px] font-bold text-on-surface">
            {busy ? t('payment_proof.uploading') : t('payment_proof.attach_optional')}
          </span>
        </button>
      )}
      <p className="text-[10px] text-on-surface-faint leading-snug px-1">{t('payment_proof.privacy')}</p>
      {chooser.element}
    </div>
  );
}

/**
 * The read-side thumbnail: shows the inline proof thumb (instant) and, on tap,
 * opens the full image (the R2 ref when present, else the thumb itself). Renders
 * nothing when there is no proof. Reused on the timeline + the confirm prompt.
 */
export function ProofThumb({
  proof,
  thumb,
  size = 44,
}: {
  proof?: ImageRef;
  thumb?: string;
  size?: number;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!thumb && !proof) return null;
  const fullUrl = proof ? imageUrl(proof) : (thumb as string);
  const preview = thumb ?? (proof ? imageUrl(proof) : '');

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-press relative shrink-0 rounded-lg overflow-hidden"
        style={{ width: size, height: size, border: '1px solid var(--surface-high)' }}
        aria-label={t('payment_proof.view')}
      >
        <img src={preview} alt={t('payment_proof.view')} className="w-full h-full object-cover" />
        <span
          className="absolute bottom-0 inset-x-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)' }}
        >
          <Icon name="zoom_in" size={12} className="text-white" />
        </span>
      </button>
      {open && <ImageLightbox url={fullUrl} onClose={() => setOpen(false)} />}
    </>
  );
}
