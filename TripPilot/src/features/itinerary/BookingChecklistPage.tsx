import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db/database';
import { useAppData } from '@/hooks/useAppData';
import { formatMoney } from '@/domain/money';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/EmptyState';
import { showToast } from '@/components/Toast';
import type { ItineraryLeg, BookingStatus } from '@/domain/types/itinerary-leg';

const TRANSPORT_ICON: Record<string, string> = {
  flight: 'flight', train: 'train', bus: 'directions_bus',
  car: 'directions_car', ferry: 'directions_boat', walk: 'directions_walk', other: 'commute',
};

interface ChecklistItem {
  legId: string;
  type: 'transport' | 'accommodation';
  label: string;
  ref: string;
  iconName: string;
  costCents: number | null;
  costCurrency: string | null;
  bookingStatus: BookingStatus;
  date: string;
}

const STATUS_ORDER: BookingStatus[] = ['booked', 'priced', 'estimated', 'none'];

interface StatusStyle {
  dotColor: string;
  dotGlow: string;
  labelKey: string;
  descKey: string;
  cardBg: string;
  cardBorder: string;
  actionBg: string;
  actionText: string;
  actionIcon: string;
  actionLabelKey: string;
  cardOpacity?: string;
}

const STATUS_STYLES: Record<BookingStatus, StatusStyle> = {
  booked: {
    dotColor: 'var(--warning)',
    dotGlow: 'color-mix(in srgb, var(--warning) 40%, transparent)',
    labelKey: 'itinerary.checklist_booked',
    descKey: 'itinerary.checklist_booked_desc',
    cardBg: 'var(--surface-container)',
    cardBorder: '1px solid var(--border-subtle)',
    actionBg: 'var(--surface-container-highest)',
    actionText: 'var(--on-surface)',
    actionIcon: 'check_circle',
    actionLabelKey: 'itinerary.checklist_mark_purchased',
  },
  priced: {
    dotColor: 'var(--success)',
    dotGlow: 'color-mix(in srgb, var(--success) 40%, transparent)',
    labelKey: 'itinerary.checklist_priced',
    descKey: 'itinerary.checklist_priced_desc',
    cardBg: 'var(--surface-container)',
    cardBorder: '1px solid var(--border-subtle)',
    actionBg: 'var(--primary)',
    actionText: '#fff',
    actionIcon: 'shopping_cart',
    actionLabelKey: 'itinerary.checklist_record_purchase',
  },
  estimated: {
    dotColor: 'var(--ai)',
    dotGlow: 'color-mix(in srgb, var(--ai) 40%, transparent)',
    labelKey: 'itinerary.checklist_estimated',
    descKey: 'itinerary.checklist_estimated_desc',
    cardBg: 'var(--surface-container-low)',
    cardBorder: '1px dashed var(--on-surface-faint)',
    actionBg: 'var(--surface-container)',
    actionText: 'var(--on-surface)',
    actionIcon: 'edit',
    actionLabelKey: 'itinerary.checklist_finalize',
  },
  none: {
    dotColor: 'var(--on-surface-faint)',
    dotGlow: 'transparent',
    labelKey: 'itinerary.checklist_none',
    descKey: 'itinerary.checklist_none_desc',
    cardBg: 'var(--surface-container-lowest)',
    cardBorder: '1px solid var(--surface-container-high)',
    actionBg: 'var(--surface-container)',
    actionText: 'var(--on-surface)',
    actionIcon: 'add',
    actionLabelKey: 'itinerary.checklist_update_details',
    cardOpacity: '0.85',
  },
  purchased: {
    dotColor: 'var(--primary)',
    dotGlow: 'transparent',
    labelKey: 'itinerary.checklist_purchased',
    descKey: '',
    cardBg: 'var(--surface-container)',
    cardBorder: '1px solid var(--border-subtle)',
    actionBg: 'var(--primary)',
    actionText: '#fff',
    actionIcon: 'check_circle',
    actionLabelKey: 'itinerary.checklist_mark_purchased',
  },
};

function buildChecklist(legs: ItineraryLeg[]): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const sorted = [...legs].sort((a, b) => a.order - b.order);

  for (const leg of sorted) {
    if (leg.arrivalTransport && leg.arrivalTransport.bookingStatus !== 'purchased') {
      const prevLeg = sorted.find((l) => l.order === leg.order - 1);
      const iconName = TRANSPORT_ICON[leg.arrivalTransport.type] ?? 'commute';
      items.push({
        legId: leg.id,
        type: 'transport',
        label: `${prevLeg?.cityName ?? '?'} → ${leg.cityName}`,
        ref: leg.arrivalTransport.company ?? leg.arrivalTransport.route ?? '',
        iconName,
        costCents: leg.arrivalTransport.costCents,
        costCurrency: leg.arrivalTransport.costCurrency,
        bookingStatus: leg.arrivalTransport.bookingStatus,
        date: leg.arrivalDate,
      });
    }

    if (leg.accommodation && leg.accommodation.bookingStatus !== 'purchased') {
      items.push({
        legId: leg.id,
        type: 'accommodation',
        label: leg.accommodation.name,
        ref: leg.cityName,
        iconName: 'bed',
        costCents: leg.accommodation.costCents,
        costCurrency: leg.accommodation.costCurrency,
        bookingStatus: leg.accommodation.bookingStatus,
        date: leg.arrivalDate,
      });
    }
  }

  return items;
}

function formatChecklistDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function BookingChecklistPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip } = useAppData();

  const legs = useLiveQuery(
    async () => {
      if (!trip) return [];
      return db.itineraryLegs
        .where('tripId')
        .equals(trip.id)
        .filter((l) => l.deletedAt === null)
        .sortBy('order');
    },
    [trip?.id],
    [] as ItineraryLeg[],
  );

  const checklist = useMemo(() => buildChecklist(legs), [legs]);

  const grouped = useMemo(() => {
    const groups: Record<BookingStatus, ChecklistItem[]> = {
      priced: [], estimated: [], booked: [], none: [], purchased: [],
    };
    for (const item of checklist) {
      groups[item.bookingStatus].push(item);
    }
    for (const status of STATUS_ORDER) {
      groups[status].sort((a, b) => a.date.localeCompare(b.date));
    }
    return groups;
  }, [checklist]);

  const markAsPurchased = async (item: ChecklistItem) => {
    const leg = legs.find((l) => l.id === item.legId);
    if (!leg) return;

    if (item.type === 'transport' && leg.arrivalTransport) {
      await db.itineraryLegs.update(leg.id, {
        arrivalTransport: { ...leg.arrivalTransport, bookingStatus: 'purchased' },
        updatedAt: new Date().toISOString(),
      });
    } else if (item.type === 'accommodation' && leg.accommodation) {
      await db.itineraryLegs.update(leg.id, {
        accommodation: { ...leg.accommodation, bookingStatus: 'purchased' },
        updatedAt: new Date().toISOString(),
      });
    }
    showToast(t('itinerary.checklist_marked'), 'success');
  };

  if (!trip) return null;

  return (
    <div className="flex flex-col pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2 mb-6">
        <button onClick={() => navigate(-1)} className="btn-press p-1">
          <Icon name="arrow_back" size={20} style={{ color: 'var(--on-surface)' }} />
        </button>
      </div>

      {/* Large title + subtitle */}
      <div className="mb-8">
        <h1
          className="text-3xl font-extrabold tracking-tight mb-2"
          style={{ color: 'var(--on-surface)' }}
        >
          {t('itinerary.checklist_title')}
        </h1>
        <p
          className="text-base leading-relaxed"
          style={{ color: 'var(--on-surface-dim)' }}
        >
          {t('itinerary.checklist_subtitle')}
        </p>
      </div>

      {checklist.length === 0 ? (
        <EmptyState
          icon="check_circle"
          title={t('itinerary.checklist_empty_title')}
          body={t('itinerary.checklist_empty_body')}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {STATUS_ORDER.filter((status) => grouped[status].length > 0).map((status) => {
            const style = STATUS_STYLES[status];
            return (
              <section key={status}>
                {/* Section header with dot + name + description */}
                <header className="flex items-center gap-3 mb-4">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{
                      background: style.dotColor,
                      boxShadow: `0 0 10px ${style.dotGlow}`,
                    }}
                  />
                  <h3 className="text-lg font-semibold flex-1" style={{ color: 'var(--on-surface)' }}>
                    {t(style.labelKey as never)}
                    <span
                      className="text-sm font-normal ml-2"
                      style={{ color: 'var(--on-surface-dim)' }}
                    >
                      {t(style.descKey as never)}
                    </span>
                  </h3>
                </header>

                {/* Cards */}
                <div className="flex flex-col gap-3">
                  {grouped[status].map((item, idx) => (
                    <article
                      key={`${item.legId}-${item.type}-${idx}`}
                      className="rounded-xl p-4 flex flex-col gap-3"
                      style={{
                        background: style.cardBg,
                        border: style.cardBorder,
                        opacity: style.cardOpacity ?? '1',
                      }}
                    >
                      {/* Top row: icon + name/ref + price */}
                      <div className="flex justify-between items-start">
                        <div className="flex gap-3 items-center min-w-0">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                            style={{
                              background: 'var(--surface-container-high)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            <Icon
                              name={item.iconName}
                              size={20}
                              style={{ color: 'var(--on-surface-dim)' }}
                            />
                          </div>
                          <div className="min-w-0">
                            <h4
                              className="text-base font-bold truncate"
                              style={{ color: 'var(--on-surface)' }}
                            >
                              {item.label}
                            </h4>
                            {item.ref && (
                              <p
                                className="font-mono text-[10px] uppercase tracking-[0.1em] truncate"
                                style={{ color: 'var(--on-surface-dim)' }}
                              >
                                {item.ref}
                              </p>
                            )}
                          </div>
                        </div>
                        {item.costCents !== null && item.costCurrency && (
                          <span
                            className="text-lg font-semibold tabular shrink-0 ml-2"
                            style={{
                              color: status === 'estimated'
                                ? 'var(--on-surface-dim)'
                                : 'var(--on-surface)',
                            }}
                          >
                            {status === 'estimated' ? '~' : ''}
                            {formatMoney(item.costCents, item.costCurrency)}
                          </span>
                        )}
                        {(item.costCents === null || !item.costCurrency) && (
                          <span
                            className="text-lg font-semibold tabular shrink-0 ml-2"
                            style={{ color: 'var(--on-surface-dim)' }}
                          >
                            --
                          </span>
                        )}
                      </div>

                      {/* Date row */}
                      <div className="flex items-center gap-2">
                        <Icon name="calendar_month" size={14} style={{ color: 'var(--on-surface-dim)' }} />
                        <span
                          className="text-sm"
                          style={{ color: 'var(--on-surface-dim)' }}
                        >
                          {formatChecklistDate(item.date)}
                        </span>
                      </div>

                      {/* Action button */}
                      <button
                        onClick={() => markAsPurchased(item)}
                        className="btn-press w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-[background-color] duration-200"
                        style={{
                          background: style.actionBg,
                          color: style.actionText,
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <Icon name={style.actionIcon} size={18} style={{ color: style.actionText }} />
                        {t(style.actionLabelKey as never)}
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
