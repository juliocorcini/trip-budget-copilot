import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';
import { useImageSourceChooser } from '@/components/ImageSourceChooser';
import { useAttachments } from './useAttachments';
import {
  clampOffset,
  clampScale,
  distance,
  nextDoubleTapScale,
  type Point,
  type Size,
} from './attachment-zoom';
import type { Attachment } from '@/domain/types/attachment';

interface AttachmentSectionProps {
  transactionId?: string | null;
  sessionId?: string | null;
}

/**
 * DEC-206 (G1): attach photos to an expense or outing. Julio device test
 * 2026-06-18: tapping "add" opens a SOURCE CHOOSER — "take a photo now" uses a
 * capture-hinted input so the camera opens directly, "from gallery" a plain
 * input. Both work on web/iOS Safari and inside the native WebView (CAMERA
 * permission declared in Wave F). Thumbnails render from the stored inline data
 * URL; tapping one opens a full-screen viewer backed by an object URL created on
 * demand and revoked on close.
 */
export function AttachmentSection({ transactionId, sessionId }: AttachmentSectionProps) {
  const { t } = useTranslation();
  const { attachments, busy, addFromFile, remove } = useAttachments({ transactionId, sessionId });
  const [viewer, setViewer] = useState<Attachment | null>(null);

  // CC-IMG (DEC-275): the shared "take photo / gallery" chooser (was inline here
  // — DEC-206 — now extracted so every image entry reuses the same pattern).
  const { open: openChooser, element: sourceChooser } = useImageSourceChooser(async (file) => {
    const ok = await addFromFile(file);
    showToast(
      ok ? t('attachments.added_toast') : t('attachments.add_failed'),
      ok ? 'success' : 'danger',
    );
  });

  const viewerEl = viewer && (
    <AttachmentViewer
      attachment={viewer}
      onClose={() => setViewer(null)}
      onDelete={async () => {
        await remove(viewer.id);
        setViewer(null);
        showToast(t('attachments.deleted_toast'), 'success');
      }}
    />
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider">
          {t('attachments.title')}
        </p>
        <button
          onClick={openChooser}
          disabled={busy}
          className="flex items-center gap-1 text-xs font-semibold text-primary btn-press disabled:opacity-40"
        >
          <Icon name="add_a_photo" size={16} className="text-primary" />
          {busy ? t('attachments.adding') : t('attachments.add')}
        </button>
      </div>

      {attachments.length === 0 ? (
        <button
          onClick={openChooser}
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

      {viewerEl}
      {sourceChooser}
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
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const pointers = useRef<Map<number, Point>>(new Map());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const panStart = useRef<{ pointer: Point; offset: Point } | null>(null);
  const lastTap = useRef(0);

  useEffect(() => {
    // New photo opened: reset the zoom transform, then mount its blob URL.
    setScale(1);
    setOffset({ x: 0, y: 0 });
    const objectUrl = URL.createObjectURL(attachment.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [attachment]);

  const measure = (): { container: Size; content: Size } => {
    const rect = containerRef.current?.getBoundingClientRect();
    const img = imgRef.current;
    return {
      container: { width: rect?.width ?? 0, height: rect?.height ?? 0 },
      content: { width: img?.offsetWidth ?? 0, height: img?.offsetHeight ?? 0 },
    };
  };

  const zoomTo = (nextScale: number, recenter = false) => {
    const clamped = clampScale(nextScale);
    setScale(clamped);
    setOffset((prev) => {
      if (clamped === 1) return { x: 0, y: 0 };
      const { container, content } = measure();
      return clampOffset(recenter ? { x: 0, y: 0 } : prev, clamped, container, content);
    });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { dist: distance(a!, b!), scale };
      panStart.current = null;
      return;
    }
    panStart.current = scale > 1 ? { pointer: { x: e.clientX, y: e.clientY }, offset } : null;
    const now = Date.now();
    if (now - lastTap.current < 300) {
      zoomTo(nextDoubleTapScale(scale), true);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const ratio = distance(a!, b!) / (pinchStart.current.dist || 1);
      zoomTo(pinchStart.current.scale * ratio);
      return;
    }
    if (pointers.current.size === 1 && panStart.current) {
      const dx = e.clientX - panStart.current.pointer.x;
      const dy = e.clientY - panStart.current.pointer.y;
      const { container, content } = measure();
      setOffset(
        clampOffset(
          { x: panStart.current.offset.x + dx, y: panStart.current.offset.y + dy },
          scale,
          container,
          content,
        ),
      );
    }
  };

  const handlePointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) panStart.current = null;
  };

  const interacting = pointers.current.size > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      role="dialog"
      aria-modal="true"
      style={{ background: 'var(--scrim)' }}
    >
      <div className="flex items-center justify-between p-4" style={{ paddingTop: 'var(--safe-top, 16px)' }}>
        <button onClick={onClose} className="btn-press p-1" aria-label={t('attachments.close')}>
          <Icon name="close" size={26} className="text-on-surface" />
        </button>
        <button
          onClick={() => setConfirmDelete(true)}
          className="btn-press p-1"
          aria-label={t('common.delete')}
        >
          <Icon name="delete" size={24} className="text-on-surface" />
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden p-2 touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {url && (
          <img
            ref={imgRef}
            src={url}
            alt=""
            draggable={false}
            className="max-w-full max-h-full object-contain select-none"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transition: interacting ? 'none' : 'transform 0.18s var(--ease-out, ease-out)',
              willChange: 'transform',
              touchAction: 'none',
            }}
          />
        )}
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
