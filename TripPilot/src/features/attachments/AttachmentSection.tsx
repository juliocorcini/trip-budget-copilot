import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';
import { useAttachments } from './useAttachments';
import type { Attachment } from '@/domain/types/attachment';

interface AttachmentSectionProps {
  transactionId?: string | null;
  sessionId?: string | null;
}

/**
 * DEC-206 (G1): attach photos (camera/gallery) to an expense or outing. Capture
 * uses a plain file input so it works on web/iOS Safari and inside the native
 * WebView (CAMERA permission was declared in Wave F). Thumbnails render from the
 * stored inline data URL; tapping one opens a full-screen viewer backed by an
 * object URL created on demand and revoked on close.
 */
export function AttachmentSection({ transactionId, sessionId }: AttachmentSectionProps) {
  const { t } = useTranslation();
  const { attachments, busy, addFromFile, remove } = useAttachments({ transactionId, sessionId });
  const inputRef = useRef<HTMLInputElement>(null);
  const [viewer, setViewer] = useState<Attachment | null>(null);

  const handlePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const ok = await addFromFile(file);
    showToast(
      ok ? t('attachments.added_toast') : t('attachments.add_failed'),
      ok ? 'success' : 'danger',
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider">
          {t('attachments.title')}
        </p>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1 text-xs font-semibold text-primary btn-press disabled:opacity-40"
        >
          <Icon name="add_a_photo" size={16} className="text-primary" />
          {busy ? t('attachments.adding') : t('attachments.add')}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePick}
      />

      {attachments.length === 0 ? (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full bg-surface-container rounded-xl py-6 flex flex-col items-center gap-2 btn-press disabled:opacity-40"
        >
          <Icon name="photo_camera" size={28} className="text-on-surface-faint" />
          <span className="text-xs text-on-surface-faint">{t('attachments.empty')}</span>
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {attachments.map((attachment) => (
            <button
              key={attachment.id}
              onClick={() => setViewer(attachment)}
              className="relative aspect-square rounded-xl overflow-hidden bg-surface-container btn-press"
            >
              <img
                src={attachment.thumbnailDataUrl}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {viewer && (
        <AttachmentViewer
          attachment={viewer}
          onClose={() => setViewer(null)}
          onDelete={async () => {
            await remove(viewer.id);
            setViewer(null);
            showToast(t('attachments.deleted_toast'), 'success');
          }}
        />
      )}
    </div>
  );
}

function AttachmentViewer({
  attachment,
  onClose,
  onDelete,
}: {
  attachment: Attachment;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(attachment.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [attachment]);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between p-4" style={{ paddingTop: 'var(--safe-top, 16px)' }}>
        <button onClick={onClose} className="btn-press p-1" aria-label={t('attachments.close')}>
          <Icon name="close" size={26} className="text-white" />
        </button>
        <button
          onClick={() => setConfirmDelete(true)}
          className="btn-press p-1"
          aria-label={t('common.delete')}
        >
          <Icon name="delete" size={24} className="text-white" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center overflow-hidden p-2">
        {url && <img src={url} alt="" className="max-w-full max-h-full object-contain" />}
      </div>

      {confirmDelete && (
        <div className="p-4 bg-surface-container m-4 rounded-2xl flex flex-col gap-3">
          <p className="text-sm text-on-surface text-center">{t('attachments.delete_confirm')}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={onDelete}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm btn-press"
              style={{ background: '#D9404015', color: 'var(--error)', border: '1px solid #D9404040' }}
            >
              {t('common.delete')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
