import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import {
  buildTripDiary,
  renderTripDiaryHtml,
  type TripDiary,
  type DiaryDay,
  type DiaryEntry,
} from '@/domain/diary';
import { formatMoney } from '@/domain/money';
import { attachmentRepository } from '@/data/repositories/attachment-repository';
import type { Attachment } from '@/domain/types/attachment';
import { downloadFile } from '@/domain/backup';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/EmptyState';
import { showToast } from '@/components/Toast';
import { logger } from '@/utils/logger';

/**
 * DEC-460 — Trip Diary V1: the trip retold day by day (spends + places +
 * photos), with a one-tap export to a self-contained HTML document (inline
 * photos, opens offline anywhere). Read-only over existing data — registering
 * expenses stays untouched.
 */

/** Data-URL photo budget for the export; beyond it photos are skipped (never fails the export). */
const EXPORT_PHOTO_BUDGET_BYTES = 25 * 1024 * 1024;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function DiaryPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { trip, transactions, loading } = useAppData();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [exporting, setExporting] = useState(false);

  // One bulk query for every photo of the trip's expenses (thumbnails render
  // from the tiny inline data URLs — no object-URL churn).
  const expenseIds = useMemo(
    () =>
      transactions
        .filter((tx) => tx.deletedAt === null && tx.type === 'expense')
        .map((tx) => tx.id),
    [transactions],
  );
  useEffect(() => {
    let cancelled = false;
    void attachmentRepository.getByTransactionIds(expenseIds).then((list) => {
      if (!cancelled) setAttachments(list);
    });
    return () => {
      cancelled = true;
    };
  }, [expenseIds]);

  const photosByEntry = useMemo(() => {
    const map = new Map<string, Attachment[]>();
    for (const att of attachments) {
      if (!att.transactionId) continue;
      const list = map.get(att.transactionId);
      if (list) list.push(att);
      else map.set(att.transactionId, [att]);
    }
    return map;
  }, [attachments]);

  const diary: TripDiary | null = useMemo(() => {
    if (!trip) return null;
    const photoCounts = new Map<string, number>();
    for (const [txId, list] of photosByEntry) photoCounts.set(txId, list.length);
    return buildTripDiary({ trip, transactions, photoCountByTransactionId: photoCounts });
  }, [trip, transactions, photosByEntry]);

  const dayHeading = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(i18n.language, {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
    });
    return (date: string) => fmt.format(new Date(`${date}T12:00:00`));
  }, [i18n.language]);

  const handleExport = async () => {
    if (!diary || exporting) return;
    setExporting(true);
    try {
      // Embed full-size (already downscaled at capture) photos while the byte
      // budget lasts; past it, entries fall back to photo-less (never fails).
      const photoDataUrls: Record<string, string[]> = {};
      let budget = EXPORT_PHOTO_BUDGET_BYTES;
      for (const day of diary.days) {
        for (const entry of day.entries) {
          const photos = photosByEntry.get(entry.id) ?? [];
          for (const att of photos) {
            if (budget - att.byteSize < 0) continue;
            try {
              const dataUrl = await blobToDataUrl(att.blob);
              (photoDataUrls[entry.id] ??= []).push(dataUrl);
              budget -= att.byteSize;
            } catch {
              // Skip an unreadable blob; the rest of the export proceeds.
            }
          }
        }
      }
      const html = renderTripDiaryHtml(diary, {
        labels: {
          documentTitle: t('diary.title'),
          days: t('diary.stat_days'),
          expenses: t('diary.stat_expenses'),
          totalSpent: t('diary.stat_total'),
          places: t('diary.stat_places'),
          dayTotal: t('diary.day_total'),
          noEntries: t('diary.empty_body'),
          madeWith: t('diary.made_with'),
        },
        dayHeading,
        categoryName: (category) => t(`categories.${category}` as never) as string,
        photosByEntry: photoDataUrls,
      });
      await downloadFile(
        html,
        `trippilot-diary-${new Date().toISOString().slice(0, 10)}.html`,
        'text/html;charset=utf-8',
      );
    } catch (err) {
      logger.error('diary_export_failed', { module: 'diary' }, err);
      showToast(t('diary.export_failed'), 'danger');
    } finally {
      setExporting(false);
    }
  };

  if (loading || !trip) {
    return <p className="text-on-surface-dim py-8 text-center">{t('common.loading')}</p>;
  }

  return (
    <div className="flex flex-col gap-4 pb-4 pt-2">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-heading font-bold text-on-surface">{t('diary.title')}</h1>
          <p className="text-sm text-on-surface-dim mt-0.5">{t('diary.subtitle')}</p>
        </div>
        {diary && diary.days.length > 0 && (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-press w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-50 shrink-0"
            style={{ background: 'var(--highlight-subtle)' }}
            aria-label={t('diary.export')}
          >
            <Icon name={exporting ? 'hourglass_top' : 'ios_share'} size={18} className="text-primary" />
          </button>
        )}
      </div>

      {diary && diary.days.length > 0 && (
        <div className="flex gap-2">
          <StatChip label={t('diary.stat_days')} value={String(diary.days.length)} />
          <StatChip label={t('diary.stat_expenses')} value={String(diary.expenseCount)} />
          <StatChip
            label={t('diary.stat_total')}
            value={formatMoney(diary.totalSpentCents, trip.baseCurrency)}
          />
          {diary.placeCount > 0 && (
            <StatChip label={t('diary.stat_places')} value={String(diary.placeCount)} />
          )}
        </div>
      )}

      {!diary || diary.days.length === 0 ? (
        <EmptyState icon="auto_stories" title={t('diary.empty_title')} body={t('diary.empty_body')} />
      ) : (
        <div className="flex flex-col gap-5">
          {diary.days.map((day) => (
            <DiaryDaySection
              key={day.date}
              day={day}
              currency={trip.baseCurrency}
              heading={dayHeading(day.date)}
              photosByEntry={photosByEntry}
              onOpenEntry={(id) => navigate(`/expenses/${id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-container rounded-xl px-3 py-2 flex-1 min-w-0">
      <p className="text-[10px] text-on-surface-faint font-semibold uppercase tracking-wider truncate">
        {label}
      </p>
      <p className="text-sm font-bold text-on-surface tabular truncate">{value}</p>
    </div>
  );
}

function DiaryDaySection({
  day,
  currency,
  heading,
  photosByEntry,
  onOpenEntry,
}: {
  day: DiaryDay;
  currency: string;
  heading: string;
  photosByEntry: Map<string, Attachment[]>;
  onOpenEntry: (id: string) => void;
}) {
  return (
    <section className="relative pl-4 border-l-2 border-outline/40">
      <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-primary" />
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold text-on-surface capitalize">{heading}</h2>
        <span className="text-xs font-bold text-primary tabular whitespace-nowrap">
          {formatMoney(day.totalCents, currency)}
        </span>
      </div>
      {day.places.length > 0 && (
        <p className="text-[11px] text-on-surface-dim mt-0.5 flex items-center gap-1">
          <Icon name="location_on" size={12} className="shrink-0" />
          <span className="truncate">{day.places.join(' · ')}</span>
        </p>
      )}
      <div className="flex flex-col gap-2 mt-2">
        {day.entries.map((entry) => (
          <DiaryEntryCard
            key={entry.id}
            entry={entry}
            currency={currency}
            photos={photosByEntry.get(entry.id) ?? []}
            onOpen={() => onOpenEntry(entry.id)}
          />
        ))}
      </div>
    </section>
  );
}

function DiaryEntryCard({
  entry,
  currency,
  photos,
  onOpen,
}: {
  entry: DiaryEntry;
  currency: string;
  photos: Attachment[];
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onOpen}
      className="bg-surface-container rounded-xl p-3 btn-press text-left w-full"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-on-surface truncate">{entry.description}</p>
          <div className="flex items-center gap-2 mt-0.5 min-w-0">
            {entry.category && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-high text-on-surface-dim shrink-0">
                {t(`categories.${entry.category}` as never)}
              </span>
            )}
            {entry.placeLabel && (
              <span className="text-[10px] text-on-surface-dim truncate">{entry.placeLabel}</span>
            )}
          </div>
          {entry.notes && (
            <p className="text-[11px] text-on-surface-dim italic mt-1 line-clamp-2">{entry.notes}</p>
          )}
        </div>
        <p className="text-sm font-bold text-on-surface tabular whitespace-nowrap">
          {formatMoney(entry.amountCents, currency)}
        </p>
      </div>
      {photos.length > 0 && (
        <div className="flex gap-1.5 mt-2 overflow-x-auto">
          {photos.map((att) => (
            <img
              key={att.id}
              src={att.thumbnailDataUrl}
              alt=""
              className="h-16 w-16 object-cover rounded-lg shrink-0"
            />
          ))}
        </div>
      )}
    </button>
  );
}
