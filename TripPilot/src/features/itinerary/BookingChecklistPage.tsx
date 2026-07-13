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

const TRANSPORT_EMOJI: Record<string, string> = {
  flight: '✈️', train: '🚂', bus: '🚌', car: '🚗', ferry: '⛴️', walk: '🚶', other: '🚐',
};

interface ChecklistItem {
  legId: string;
  type: 'transport' | 'accommodation';
  label: string;
  detail: string;
  costCents: number | null;
  costCurrency: string | null;
  bookingStatus: BookingStatus;
  date: string;
}

const STATUS_ORDER: BookingStatus[] = ['priced', 'estimated', 'booked', 'none'];
const STATUS_CONFIG: Record<BookingStatus, { color: string; icon: string; labelKey: string }> = {
  priced: { color: 'text-amber-600 dark:text-amber-400', icon: 'sell', labelKey: 'itinerary.checklist_priced' },
  estimated: { color: 'text-orange-600 dark:text-orange-400', icon: 'help_outline', labelKey: 'itinerary.checklist_estimated' },
  booked: { color: 'text-green-600 dark:text-green-400', icon: 'bookmark', labelKey: 'itinerary.checklist_booked' },
  none: { color: 'text-on-surface-faint', icon: 'radio_button_unchecked', labelKey: 'itinerary.checklist_none' },
  purchased: { color: 'text-primary', icon: 'check_circle', labelKey: 'itinerary.checklist_purchased' },
};

function buildChecklist(legs: ItineraryLeg[]): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const sorted = [...legs].sort((a, b) => a.order - b.order);

  for (const leg of sorted) {
    if (leg.arrivalTransport && leg.arrivalTransport.bookingStatus !== 'purchased') {
      const emoji = TRANSPORT_EMOJI[leg.arrivalTransport.type] ?? '🚐';
      const prevLeg = sorted.find((l) => l.order === leg.order - 1);
      items.push({
        legId: leg.id,
        type: 'transport',
        label: `${emoji} ${prevLeg?.cityName ?? '?'} → ${leg.cityName}`,
        detail: leg.arrivalTransport.company ?? leg.arrivalTransport.route ?? '',
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
        label: `🏠 ${leg.accommodation.name} (${leg.cityName})`,
        detail: `${leg.accommodation.nights} ${leg.accommodation.nights === 1 ? 'night' : 'nights'}`,
        costCents: leg.accommodation.costCents,
        costCurrency: leg.accommodation.costCurrency,
        bookingStatus: leg.accommodation.bookingStatus,
        date: leg.arrivalDate,
      });
    }
  }

  return items;
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
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex items-center gap-3 pt-2">
        <button onClick={() => navigate(-1)} className="btn-press p-1">
          <Icon name="arrow_back" size={20} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('itinerary.checklist_title')}</h1>
      </div>

      {checklist.length === 0 ? (
        <EmptyState
          icon="check_circle"
          title={t('itinerary.checklist_empty_title')}
          body={t('itinerary.checklist_empty_body')}
        />
      ) : (
        STATUS_ORDER.filter((status) => grouped[status].length > 0).map((status) => (
          <div key={status} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 px-1 pb-1">
              <Icon name={STATUS_CONFIG[status].icon} size={16} className={STATUS_CONFIG[status].color} />
              <span className={`text-xs font-bold uppercase tracking-wider ${STATUS_CONFIG[status].color}`}>
                {t(STATUS_CONFIG[status].labelKey as never)} ({grouped[status].length})
              </span>
            </div>
            {grouped[status].map((item, idx) => (
              <div
                key={`${item.legId}-${item.type}-${idx}`}
                className="bg-surface-container rounded-xl px-4 py-3 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-on-surface truncate">{item.label}</p>
                  {item.detail && (
                    <p className="text-xs text-on-surface-faint mt-0.5 truncate">{item.detail}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  {item.costCents !== null && item.costCurrency && (
                    <span className="text-xs font-semibold tabular text-on-surface-dim">
                      {formatMoney(item.costCents, item.costCurrency)}
                    </span>
                  )}
                  <button
                    onClick={() => markAsPurchased(item)}
                    className="p-1.5 rounded-lg bg-primary/10 btn-press"
                    title={t('itinerary.checklist_mark_purchased')}
                  >
                    <Icon name="check" size={16} className="text-primary" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
