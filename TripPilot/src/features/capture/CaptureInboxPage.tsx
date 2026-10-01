import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Navigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db/database';
import { useAppData } from '@/hooks/useAppData';
import { processCapture, deleteCapture, parseCaptureOcrResult } from '@/domain/capture/capture-stack';
import { setReceiptReviewHandoff } from '@/features/receipt/receipt-review-handoff';
import { useImageSourceChooser } from '@/components/ImageSourceChooser';
import { saveCapture } from '@/domain/capture/capture-stack';
import { showToast } from '@/components/Toast';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/EmptyState';
import { BottomSheet } from '@/components/BottomSheet';
import type { CaptureItem, CaptureStatus } from '@/domain/types/capture-item';

const STATUS_CONFIG: Record<CaptureStatus, { icon: string; color: string; labelKey: string }> = {
  pending: { icon: 'hourglass_empty', color: 'var(--warning)', labelKey: 'capture.status_pending' },
  processing: { icon: 'sync', color: 'var(--primary)', labelKey: 'capture.status_processing' },
  done: { icon: 'check_circle', color: 'var(--success)', labelKey: 'capture.status_done' },
  error: { icon: 'error', color: 'var(--danger)', labelKey: 'capture.status_error' },
};

export function CaptureInboxPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip, loading } = useAppData();
  const tripId = trip?.id ?? '';

  const captures = useLiveQuery(
    async (): Promise<CaptureItem[]> =>
      tripId
        ? db.captureInbox.where('tripId').equals(tripId).reverse().sortBy('createdAt')
        : [],
    [tripId],
  );

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const chooser = useImageSourceChooser(
    useCallback(
      (file: File) => {
        if (!tripId) return;
        void saveCapture(tripId, file).then(() => {
          showToast(t('capture.saved_toast'), 'success');
        });
      },
      [tripId, t],
    ),
    { title: t('capture.add_title') },
  );

  const pendingCount = useMemo(
    () => (captures ?? []).filter((c) => c.status === 'pending').length,
    [captures],
  );

  const handleProcess = async (item: CaptureItem) => {
    if (item.status === 'done') {
      const plan = parseCaptureOcrResult(item);
      if (plan) {
        setReceiptReviewHandoff({
          plan,
          image: {
            blob: item.blob,
            thumbnailDataUrl: item.thumbnailDataUrl,
            width: item.width,
            height: item.height,
            mimeType: 'image/jpeg',
            byteSize: item.byteSize,
          },
          name: plan.merchant,
        });
        navigate('/receipt/scan');
        return;
      }
    }

    if (item.status === 'processing') return;

    setProcessingId(item.id);
    const plan = await processCapture(item.id);
    setProcessingId(null);

    if (plan) {
      showToast(t('capture.ocr_success'), 'success');
      setReceiptReviewHandoff({
        plan,
        image: {
          blob: item.blob,
          thumbnailDataUrl: item.thumbnailDataUrl,
          width: item.width,
          height: item.height,
          mimeType: 'image/jpeg',
          byteSize: item.byteSize,
        },
        name: plan.merchant,
      });
      navigate('/receipt/scan');
    } else {
      showToast(t('capture.ocr_failed'), 'warning');
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    await deleteCapture(confirmDeleteId);
    setConfirmDeleteId(null);
    showToast(t('capture.deleted_toast'), 'info');
  };

  if (!trip) {
    if (loading) return <p className="text-on-surface-dim py-8 text-center">{t('common.loading')}</p>;
    return <Navigate to="/welcome" replace />;
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return t('capture.time_now');
    if (diffMin < 60) return t('capture.time_min', { count: diffMin });
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return t('capture.time_hr', { count: diffHr });
    return d.toLocaleDateString();
  };

  return (
    <div className="max-w-[430px] mx-auto flex flex-col gap-4 px-5 pt-2 pb-28">
      {chooser.element}

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <div className="flex-1">
          <h1 className="text-heading font-bold text-on-surface leading-tight">
            {t('capture.inbox_title')}
          </h1>
          <p className="text-[11px] text-on-surface-faint">
            {pendingCount > 0
              ? t('capture.inbox_subtitle_pending', { count: pendingCount })
              : t('capture.inbox_subtitle')}
          </p>
        </div>
        <button
          onClick={() => chooser.open()}
          className="btn-press w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--primary)' }}
          aria-label={t('capture.add_capture')}
        >
          <Icon name="add_a_photo" size={20} style={{ color: 'var(--surface)' }} />
        </button>
      </div>

      {/* Empty state */}
      {captures && captures.length === 0 && (
        <EmptyState
          icon="photo_camera"
          title={t('capture.empty_title')}
          body={t('capture.empty_body')}
          cta={{ label: t('capture.empty_cta'), icon: 'add_a_photo', onClick: () => chooser.open() }}
        />
      )}

      {/* Capture grid */}
      {captures && captures.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {captures.map((item) => {
            const cfg = STATUS_CONFIG[item.status];
            const isProcessing = processingId === item.id || item.status === 'processing';

            return (
              <div
                key={item.id}
                className="relative rounded-2xl overflow-hidden group"
                style={{ background: 'var(--surface-container)' }}
              >
                {/* Thumbnail */}
                <button
                  onClick={() => void handleProcess(item)}
                  disabled={isProcessing}
                  className="btn-press w-full aspect-[4/3] relative"
                >
                  <img
                    src={item.thumbnailDataUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    style={{ opacity: isProcessing ? 0.5 : 1 }}
                  />

                  {/* Processing spinner overlay */}
                  {isProcessing && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    </div>
                  )}

                  {/* Status badge */}
                  <div
                    className="absolute top-2 left-2 px-2 py-1 rounded-lg flex items-center gap-1"
                    style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
                  >
                    <Icon name={cfg.icon} size={12} style={{ color: cfg.color }} />
                    <span className="text-[10px] font-semibold text-white">{t(cfg.labelKey)}</span>
                  </div>

                  {/* Tap-to-process hint for pending items */}
                  {item.status === 'pending' && !isProcessing && (
                    <div
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(0,0,0,0.35)' }}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Icon name="auto_awesome" size={24} className="text-white" />
                        <span className="text-[11px] font-bold text-white">{t('capture.tap_to_scan')}</span>
                      </div>
                    </div>
                  )}
                </button>

                {/* Footer: time + delete */}
                <div className="px-2.5 py-2 flex items-center justify-between">
                  <span className="text-[11px] text-on-surface-faint">{formatTime(item.createdAt)}</span>
                  <button
                    onClick={() => setConfirmDeleteId(item.id)}
                    className="btn-press p-1 -mr-1"
                    aria-label={t('common.delete')}
                  >
                    <Icon name="delete_outline" size={16} className="text-on-surface-faint" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <BottomSheet
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        title={t('capture.delete_title')}
      >
        <div className="flex flex-col gap-3 mt-4">
          <p className="text-sm text-on-surface-dim">{t('capture.delete_body')}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDeleteId(null)}
              className="flex-1 py-3 rounded-2xl bg-surface-high text-on-surface font-semibold btn-press"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={() => void handleDelete()}
              className="flex-1 py-3 rounded-2xl font-bold btn-press"
              style={{ background: 'var(--danger)', color: '#fff' }}
            >
              {t('common.delete')}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
