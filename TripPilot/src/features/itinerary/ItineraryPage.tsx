import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db/database';
import { useAppData } from '@/hooks/useAppData';
import { getDayAgenda, getCurrentLeg, getTripSummary, getLegSpend, formatItineraryShareText } from '@/domain/itinerary/itinerary-domain';
import { fromCents, formatMoney } from '@/domain/money';
import { localDateString } from '@/domain/dates';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { HeroBanner } from '@/components/HeroBanner';
import { BudgetStatusBadge } from '@/components/BudgetStatusBadge';
import { TimelineView } from '@/components/TimelineView';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { LegFormSheet } from './LegFormSheet';
import { useGpsLegDetect } from './useGpsLegDetect';
import { shareOrCopyText } from '@/utils/native/link-share';
import { showToast } from '@/components/Toast';
import type { ItineraryLeg } from '@/domain/types/itinerary-leg';
import type { DayAgendaItem } from '@/domain/itinerary/itinerary-domain';
import type { TimelineItem } from '@/components/TimelineView';

const DAY_DOT_COLOR: Record<string, string> = {
  full: 'var(--tertiary)',
  transit: 'var(--primary)',
  festival: 'var(--secondary)',
  rest: 'var(--on-surface-faint)',
  day_trip: 'var(--warning)',
};

const TRANSPORT_ICON: Record<string, string> = {
  flight: 'flight', train: 'train', bus: 'directions_bus',
  car: 'directions_car', ferry: 'directions_boat', walk: 'directions_walk', other: 'commute',
};

const BOOKING_STATUS_STYLE: Record<string, { icon: string; color: string; bg: string }> = {
  purchased: { icon: 'check_circle', color: 'var(--success)', bg: 'color-mix(in srgb, var(--success) 12%, transparent)' },
  booked: { icon: 'event_available', color: 'var(--primary)', bg: 'color-mix(in srgb, var(--primary) 12%, transparent)' },
  priced: { icon: 'sell', color: 'var(--warning)', bg: 'color-mix(in srgb, var(--warning) 12%, transparent)' },
  estimated: { icon: 'help_outline', color: 'var(--on-surface-dim)', bg: 'var(--surface-container-high)' },
  none: { icon: 'circle', color: 'var(--on-surface-faint)', bg: 'var(--surface-container-high)' },
};

function agendaToTimeline(
  item: DayAgendaItem,
  index: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
): TimelineItem {
  const now = new Date();
  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  let status: TimelineItem['status'] = 'future';
  if (item.time) {
    if (item.time < currentHHMM) status = 'past';
  }
  if (index === 0 && item.type === 'departure' && item.time && item.time < currentHHMM) {
    status = 'past';
  }

  const badge =
    item.type === 'departure'
      ? t('itinerary.departed')
      : item.type === 'arrival'
        ? index === 0
          ? t('itinerary.next_stop')
          : t('itinerary.destination_badge')
        : null;

  const isTransport = item.type === 'arrival' || item.type === 'departure';
  const isAccom = item.type === 'accommodation';
  const iconName = isTransport
    ? TRANSPORT_ICON[item.leg.arrivalTransport?.type ?? 'other'] ?? 'commute'
    : AGENDA_ICON[item.type];

  const company = isTransport ? item.leg.arrivalTransport?.company : undefined;
  const route = isTransport ? item.leg.arrivalTransport?.route : undefined;
  const bookingStatus = isTransport
    ? item.leg.arrivalTransport?.bookingStatus
    : isAccom ? item.leg.accommodation?.bookingStatus : undefined;
  const statusStyle = bookingStatus ? BOOKING_STATUS_STYLE[bookingStatus] : undefined;
  const costCents = isTransport
    ? item.leg.arrivalTransport?.costCents
    : isAccom ? item.leg.accommodation?.costCents : undefined;
  const costCurrency = isTransport
    ? item.leg.arrivalTransport?.costCurrency
    : isAccom ? item.leg.accommodation?.costCurrency : undefined;

  return {
    id: `${item.leg.id}-${item.type}-${index}`,
    status,
    time: item.time,
    badge,
    content: (
      <div className="flex flex-col gap-1">
        <h3
          className="text-lg font-extrabold leading-tight tracking-tight"
          style={{ color: 'var(--on-surface)' }}
        >
          {item.label}
        </h3>
        {(company || route) && (
          <div className="flex items-center gap-1.5">
            <Icon name={iconName} size={14} style={{ color: 'var(--on-surface-dim)' }} />
            <span className="text-xs" style={{ color: 'var(--on-surface-dim)' }}>
              {[company, route].filter(Boolean).join(' · ')}
            </span>
          </div>
        )}
        {item.detail && !route && (
          <div className="flex items-center gap-1.5">
            <Icon name={iconName} size={14} style={{ color: 'var(--on-surface-dim)' }} />
            <span className="text-xs" style={{ color: 'var(--on-surface-dim)' }}>
              {item.detail}
            </span>
          </div>
        )}
        {(statusStyle || costCents != null) && (
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {statusStyle && bookingStatus && bookingStatus !== 'none' && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: statusStyle.bg, color: statusStyle.color }}
              >
                <Icon name={statusStyle.icon} size={11} filled style={{ color: statusStyle.color }} />
                {t(`itinerary.checklist_${bookingStatus}` as never)}
              </span>
            )}
            {costCents != null && costCurrency && (
              <span
                className="text-[10px] font-medium tabular px-2 py-0.5 rounded-full"
                style={{ background: 'var(--surface-container-high)', color: 'var(--on-surface)' }}
              >
                {formatMoney(costCents, costCurrency)}
              </span>
            )}
          </div>
        )}
      </div>
    ),
  };
}

const AGENDA_ICON: Record<DayAgendaItem['type'], string> = {
  arrival: 'flight_land', departure: 'flight_takeoff',
  accommodation: 'hotel', highlight: 'star',
};

export function ItineraryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const appData = useAppData();
  const trip = appData.trip;

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

  const today = localDateString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [formOpen, setFormOpen] = useState(false);
  const [editingLeg, setEditingLeg] = useState<ItineraryLeg | null>(null);
  const [actionsMenuLeg, setActionsMenuLeg] = useState<ItineraryLeg | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const gps = useGpsLegDetect(legs);
  const [gpsOverrideActive, setGpsOverrideActive] = useState(false);
  const [notesEditing, setNotesEditing] = useState(false);

  const touchStartX = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const dateScrollRef = useRef<HTMLDivElement>(null);

  const allDates = useMemo(() => {
    if (legs.length === 0) return [];
    const dates: string[] = [];
    const sorted = [...legs].sort((a, b) => a.order - b.order);
    const start = new Date(sorted[0]!.arrivalDate);
    const end = new Date(sorted[sorted.length - 1]!.departureDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }, [legs]);

  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]!.clientX;
    setSwipeOffset(0);
  }, []);

  const handleSwipeMove = useCallback((e: React.TouchEvent) => {
    const delta = e.touches[0]!.clientX - touchStartX.current;
    setSwipeOffset(Math.max(-80, Math.min(80, delta)));
  }, []);

  const handleSwipeEnd = useCallback(() => {
    if (allDates.length <= 1) { setSwipeOffset(0); return; }
    const currentIdx = allDates.indexOf(selectedDate);
    if (swipeOffset < -40 && currentIdx < allDates.length - 1) {
      setSelectedDate(allDates[currentIdx + 1]!);
    } else if (swipeOffset > 40 && currentIdx > 0) {
      setSelectedDate(allDates[currentIdx - 1]!);
    }
    setSwipeOffset(0);
  }, [allDates, selectedDate, swipeOffset]);

  // GPS override: when GPS detects a leg different from the date-based one, jump to it
  useEffect(() => {
    if (!gps.detectedLeg || allDates.length === 0) return;
    const dateLeg = getCurrentLeg(legs, selectedDate);
    if (dateLeg?.id === gps.detectedLeg.id) {
      setGpsOverrideActive(false);
      return;
    }
    const targetDate = gps.detectedLeg.arrivalDate;
    if (allDates.includes(targetDate) && targetDate !== selectedDate) {
      setSelectedDate(targetDate);
      setGpsOverrideActive(true);
    } else if (gps.detectedLeg.arrivalDate <= selectedDate && gps.detectedLeg.departureDate >= selectedDate) {
      setGpsOverrideActive(false);
    } else {
      setGpsOverrideActive(true);
    }
  }, [gps.detectedLeg, legs, allDates]); // eslint-disable-line react-hooks/exhaustive-deps

  const agenda = useMemo(() => getDayAgenda(legs, selectedDate), [legs, selectedDate]);
  const dateBasedLeg = useMemo(() => getCurrentLeg(legs, selectedDate), [legs, selectedDate]);
  const currentLeg = gps.detectedLeg && gpsOverrideActive ? gps.detectedLeg : dateBasedLeg;
  const summary = useMemo(() => getTripSummary(legs), [legs]);

  const nextOrder = useMemo(() => {
    if (legs.length === 0) return 1;
    return Math.max(...legs.map((l) => l.order)) + 1;
  }, [legs]);

  const cityTimeline = useMemo(() => {
    const sorted = [...legs].sort((a, b) => a.order - b.order);
    return sorted.map((leg) => {
      const isPast = leg.departureDate < today;
      const isCurrent = leg.arrivalDate <= today && leg.departureDate >= today;
      const isSelected = currentLeg?.id === leg.id;
      return { leg, isPast, isCurrent, isSelected };
    });
  }, [legs, today, currentLeg?.id]);

  const handleSaveLeg = useCallback(async (leg: ItineraryLeg) => {
    await db.itineraryLegs.put(leg);
  }, []);

  const handleDeleteLeg = useCallback(async (leg: ItineraryLeg) => {
    await db.itineraryLegs.update(leg.id, {
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      revision: leg.revision + 1,
    });
    setActionsMenuLeg(null);
  }, []);

  const openCreate = useCallback(() => {
    setEditingLeg(null);
    setFormOpen(true);
    setAddMenuOpen(false);
  }, []);

  const openEdit = useCallback((leg: ItineraryLeg) => {
    setEditingLeg(leg);
    setFormOpen(true);
    setActionsMenuLeg(null);
  }, []);

  const handleShareItinerary = useCallback(async () => {
    const tripName = trip?.name ?? 'Trip';
    const text = formatItineraryShareText(tripName, legs);
    if (!text) return;
    const result = await shareOrCopyText(text, tripName);
    if (result === 'copied') showToast(t('itinerary.share_copied'), 'success');
    if (result === 'copy_failed') showToast(t('itinerary.share_failed'), 'danger');
  }, [trip?.name, legs, t]);

  // ─── Cost breakdown (MUST be before any early return to satisfy hook rules) ───
  const costBreakdown = useMemo(() => {
    const prepaid: Record<string, number> = {};
    const pending: Record<string, number> = {};
    let bookedCount = 0;
    let totalBookable = 0;

    for (const leg of legs) {
      if (leg.arrivalTransport) {
        totalBookable++;
        const c = leg.arrivalTransport.costCurrency ?? trip?.baseCurrency ?? 'EUR';
        const cents = leg.arrivalTransport.costCents ?? 0;
        if (leg.arrivalTransport.bookingStatus === 'purchased' || leg.arrivalTransport.isPrepaid) {
          prepaid[c] = (prepaid[c] ?? 0) + cents;
          bookedCount++;
        } else if (cents > 0) {
          pending[c] = (pending[c] ?? 0) + cents;
          if (leg.arrivalTransport.bookingStatus === 'booked') bookedCount++;
        }
      }
      if (leg.accommodation) {
        totalBookable++;
        const c = leg.accommodation.costCurrency ?? trip?.baseCurrency ?? 'EUR';
        const cents = leg.accommodation.costCents ?? 0;
        if (leg.accommodation.bookingStatus === 'purchased' || leg.accommodation.isPrepaid) {
          prepaid[c] = (prepaid[c] ?? 0) + cents;
          bookedCount++;
        } else if (cents > 0) {
          pending[c] = (pending[c] ?? 0) + cents;
          if (leg.accommodation.bookingStatus === 'booked') bookedCount++;
        }
      }
    }
    const hasCosts = Object.keys(prepaid).length > 0 || Object.keys(pending).length > 0;
    return { prepaid, pending, bookedCount, totalBookable, hasCosts };
  }, [legs, trip?.baseCurrency]);

  if (appData.loading || !trip) return null;

  // ─── Empty state ───
  if (legs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] py-12 px-6 text-center">
        {/* Composed illustration */}
        <div className="relative w-48 h-48 mb-8 flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-full blur-2xl"
            style={{ background: 'color-mix(in srgb, var(--primary) 10%, transparent)' }}
          />
          <div
            className="absolute w-32 h-32 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: 'var(--surface-container)', border: '1px solid var(--border-subtle)' }}
          >
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center"
              style={{ background: 'var(--surface-container-high)', border: '1px solid var(--border-subtle)' }}
            >
              <Icon name="route" size={48} filled style={{ color: 'var(--primary)' }} />
            </div>
          </div>
          <div
            className="absolute top-4 right-8 rounded-full p-1 shadow-lg animate-bounce"
            style={{
              background: 'var(--surface-container-high)',
              border: '1px solid var(--border-subtle)',
              animationDelay: '0.5s',
            }}
          >
            <Icon name="location_on" size={16} filled style={{ color: 'var(--ai)' }} />
          </div>
          <div
            className="absolute bottom-6 left-6 rounded-full p-1 shadow-lg animate-bounce"
            style={{
              background: 'var(--surface-container-high)',
              border: '1px solid var(--border-subtle)',
              animationDelay: '1.2s',
            }}
          >
            <Icon name="push_pin" size={16} filled style={{ color: 'var(--success)' }} />
          </div>
        </div>

        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--on-surface)' }}>
          {t('itinerary.empty_title')}
        </h2>
        <p
          className="text-sm leading-relaxed max-w-[280px] mb-8"
          style={{ color: 'var(--on-surface-dim)' }}
        >
          {t('itinerary.empty_desc')}
        </p>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => navigate('/itinerary/create')}
            className="btn-press flex items-center justify-center gap-2 w-full py-4 rounded-2xl text-sm font-bold text-white shadow-lg"
            style={{ background: 'var(--ai-gradient)' }}
          >
            <Icon name="auto_awesome" size={18} filled style={{ color: '#fff' }} />
            {t('itinerary.create_with_ai')}
          </button>
          <button
            onClick={openCreate}
            className="btn-press flex items-center justify-center gap-2 w-full py-4 rounded-2xl text-sm font-semibold"
            style={{
              background: 'transparent',
              color: 'var(--on-surface)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <Icon name="edit_calendar" size={18} style={{ color: 'var(--on-surface-dim)' }} />
            {t('itinerary.create_manual')}
          </button>
        </div>

        <LegFormSheet
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSave={handleSaveLeg}
          tripId={trip.id}
          nextOrder={1}
        />
      </div>
    );
  }

  // ─── Progress computation ───
  const firstDate = allDates[0]!;
  const lastDate = allDates[allDates.length - 1]!;
  const todayIdx = allDates.indexOf(today);
  const isBefore = today < firstDate;
  const isAfter = today > lastDate;
  const progressPercent = isBefore ? 0 : isAfter ? 100 : Math.round(((todayIdx + 1) / allDates.length) * 100);
  const dayNum = todayIdx >= 0 ? todayIdx + 1 : isBefore ? 0 : allDates.length;

  // ─── Spend computation ───
  const spendBar = (() => {
    if (!currentLeg) return null;
    const txs = (appData.transactions ?? []).map((tx) => ({
      date: tx.date, amountCents: tx.amountCents, currency: tx.currency,
    }));
    const spend = getLegSpend(currentLeg, txs, trip!.baseCurrency);
    if (spend.totalSpentCents <= 0 && spend.budgetCents === null) return null;
    return spend;
  })();

  const selectedDateFormatted = (() => {
    const d = new Date(selectedDate + 'T12:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  })();

  return (
    <div className="flex flex-col gap-0 pb-28">

      {/* ═══ HEADER ═══ */}
      <div className="flex items-center gap-2 pt-2 pb-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1">
          <Icon name="arrow_back" size={22} className="text-on-surface" />
        </button>
        <h1 className="text-base font-bold text-on-surface flex-1 truncate">{t('itinerary.title')}</h1>
        <span className="text-xs text-on-surface-faint tabular">
          {summary.totalCities} {t('itinerary.cities')} · {summary.totalDays}d
        </span>
        <button onClick={() => navigate('/itinerary/map')} className="btn-press p-2 rounded-xl bg-surface-high" title={t('itinerary.map_title')}>
          <Icon name="map" size={18} className="text-on-surface-dim" />
        </button>
        <button onClick={() => navigate('/itinerary/checklist')} className="btn-press p-2 rounded-xl bg-surface-high" title={t('itinerary.checklist_title')}>
          <Icon name="checklist" size={18} className="text-on-surface-dim" />
        </button>
        <button onClick={handleShareItinerary} className="btn-press p-2 rounded-xl bg-surface-high" title={t('itinerary.share_button')}>
          <Icon name="share" size={18} className="text-on-surface-dim" />
        </button>
      </div>

      {/* ═══ COST SUMMARY ═══ */}
      {costBreakdown.hasCosts && (
        <div
          className="rounded-xl p-3.5 mb-3 flex items-center gap-3"
          style={{ background: 'var(--surface-container)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex-1 flex gap-4">
            {Object.keys(costBreakdown.prepaid).length > 0 && (
              <div className="flex flex-col">
                <span
                  className="font-mono text-[9px] uppercase tracking-[0.12em]"
                  style={{ color: 'var(--success)' }}
                >
                  {t('itinerary.cost_prepaid')}
                </span>
                {Object.entries(costBreakdown.prepaid).map(([cur, cents]) => (
                  <span key={cur} className="text-sm font-bold tabular" style={{ color: 'var(--on-surface)' }}>
                    {formatMoney(cents, cur)}
                  </span>
                ))}
              </div>
            )}
            {Object.keys(costBreakdown.pending).length > 0 && (
              <div className="flex flex-col">
                <span
                  className="font-mono text-[9px] uppercase tracking-[0.12em]"
                  style={{ color: 'var(--warning)' }}
                >
                  {t('itinerary.cost_pending')}
                </span>
                {Object.entries(costBreakdown.pending).map(([cur, cents]) => (
                  <span key={cur} className="text-sm font-bold tabular" style={{ color: 'var(--on-surface)' }}>
                    {formatMoney(cents, cur)}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span
              className="font-mono text-[9px] uppercase tracking-[0.12em]"
              style={{ color: 'var(--on-surface-dim)' }}
            >
              {t('itinerary.cost_booked_ratio')}
            </span>
            <span className="text-sm font-bold tabular" style={{ color: 'var(--primary)' }}>
              {costBreakdown.bookedCount}/{costBreakdown.totalBookable}
            </span>
          </div>
        </div>
      )}

      {/* ═══ PROGRESS BAR ═══ */}
      {allDates.length > 0 && (
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex-1 h-1.5 rounded-full overflow-hidden"
            style={{ background: 'var(--surface-container-high)' }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${progressPercent}%`, background: 'var(--primary)' }}
            />
          </div>
          <span
            className="text-xs tabular shrink-0"
            style={{ color: 'var(--on-surface-dim)' }}
          >
            {isBefore
              ? t('itinerary.starts_in', { days: Math.round((new Date(firstDate).getTime() - new Date(today).getTime()) / 86400000) })
              : isAfter
                ? t('itinerary.trip_done')
                : t('itinerary.context_card_day', { current: dayNum, total: allDates.length })}
          </span>
        </div>
      )}

      {/* ═══ MULTI-CITY TIMELINE ═══ */}
      {cityTimeline.length > 1 && (
        <div className="mb-3 -mx-[var(--page-padding-x)] px-[var(--page-padding-x)]">
          <div className="flex items-center overflow-x-auto no-scrollbar py-1">
            {cityTimeline.map((city, idx) => (
              <div key={city.leg.id} className="flex items-center shrink-0">
                <button
                  onClick={() => setSelectedDate(city.leg.arrivalDate)}
                  className="btn-press flex flex-col items-center gap-1 relative"
                  style={{ minWidth: '64px' }}
                >
                  {/* Node */}
                  <div
                    className="rounded-full flex items-center justify-center transition-all duration-200"
                    style={{
                      width: city.isSelected ? '36px' : '28px',
                      height: city.isSelected ? '36px' : '28px',
                      background: city.isSelected
                        ? 'var(--primary)'
                        : city.isPast
                          ? 'var(--surface-container-high)'
                          : 'var(--surface-container)',
                      border: city.isSelected
                        ? '3px solid color-mix(in srgb, var(--primary) 30%, transparent)'
                        : city.isCurrent
                          ? '2px solid var(--primary)'
                          : city.isPast
                            ? '2px solid var(--on-surface-faint)'
                            : '2px solid var(--ai)',
                      boxShadow: city.isSelected ? '0 2px 8px color-mix(in srgb, var(--primary) 30%, transparent)' : 'none',
                    }}
                  >
                    <Icon
                      name={city.isSelected ? 'location_on' : city.isPast ? 'check' : 'circle'}
                      size={city.isSelected ? 18 : 12}
                      filled={city.isSelected}
                      style={{
                        color: city.isSelected
                          ? 'var(--on-primary)'
                          : city.isPast
                            ? 'var(--on-surface-faint)'
                            : 'var(--ai)',
                      }}
                    />
                  </div>
                  {/* City name */}
                  <span
                    className="text-[10px] font-medium leading-tight text-center max-w-[60px] truncate"
                    style={{
                      color: city.isSelected
                        ? 'var(--primary)'
                        : city.isPast
                          ? 'var(--on-surface-faint)'
                          : 'var(--on-surface-dim)',
                      fontWeight: city.isSelected ? 700 : 500,
                    }}
                  >
                    {city.leg.cityName}
                  </span>
                </button>
                {/* Connector line */}
                {idx < cityTimeline.length - 1 && (
                  <div
                    className="h-[2px] shrink-0"
                    style={{
                      width: '24px',
                      background: city.isPast
                        ? 'var(--on-surface-faint)'
                        : 'color-mix(in srgb, var(--ai) 40%, transparent)',
                      marginTop: '-14px',
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ GPS ═══ */}
      {!gps.enabled ? (
        <div
          className="rounded-2xl p-8 mb-3 flex flex-col items-center text-center"
          style={{ background: 'var(--surface-container)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="relative w-24 h-24 flex items-center justify-center mb-6">
            {/* Outer pulse ring */}
            <div
              className="absolute inset-0 rounded-full animate-ping"
              style={{
                border: '2px solid var(--primary)',
                opacity: 0.15,
                animationDuration: '2.5s',
              }}
            />
            {/* Outer ring */}
            <div
              className="absolute inset-0 rounded-full"
              style={{ border: '2px solid color-mix(in srgb, var(--primary) 30%, transparent)' }}
            />
            {/* Inner filled circle */}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--primary) 15%, transparent)' }}
            >
              <Icon name="my_location" size={36} filled style={{ color: 'var(--primary)' }} />
            </div>
          </div>
          <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--on-surface)' }}>
            {t('itinerary.gps_opt_in_title')}
          </h3>
          <p className="text-sm leading-relaxed mb-6 max-w-[280px]" style={{ color: 'var(--on-surface-dim)' }}>
            {t('itinerary.gps_opt_in_desc')}
          </p>
          <button
            onClick={gps.enable}
            className="btn-press w-full py-3.5 rounded-full text-sm font-bold text-white mb-3"
            style={{ background: 'var(--primary)' }}
          >
            <Icon name="explore" size={18} style={{ color: '#fff' }} className="mr-1.5 inline-block align-text-bottom" />
            {t('itinerary.gps_enable')}
          </button>
          <button
            onClick={() => {/* dismiss opt-in */}}
            className="btn-press py-2 text-sm"
            style={{ color: 'var(--on-surface-dim)' }}
          >
            {t('itinerary.gps_search_manual')}
          </button>
        </div>
      ) : gps.detecting ? (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl mb-3"
          style={{ background: 'var(--surface-container-high)' }}
        >
          <Icon name="gps_fixed" size={18} className="animate-pulse" style={{ color: 'var(--ai)' }} />
          <div className="flex-1">
            <SkeletonLoader lines={1} widths={['140px']} height="14px" />
          </div>
          <span
            className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded animate-pulse"
            style={{ background: 'var(--ai-bg-soft)', color: 'var(--ai)' }}
          >
            {t('itinerary.gps_detecting')}
          </span>
        </div>
      ) : gps.detectedLeg ? (
        gpsOverrideActive && dateBasedLeg && dateBasedLeg.id !== gps.detectedLeg.id ? (
          /* GPS Override card */
          <div
            className="rounded-2xl p-4 mb-3 flex items-center gap-3"
            style={{
              background: 'var(--surface-container-high)',
              border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'color-mix(in srgb, var(--primary) 15%, transparent)' }}
            >
              <Icon name="location_on" size={20} filled style={{ color: 'var(--primary)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold" style={{ color: 'var(--on-surface)' }}>
                {gps.detectedLeg.cityName}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--on-surface-faint)' }}>
                ({t('itinerary.gps_override_from', { city: dateBasedLeg.cityName })})
              </p>
            </div>
            <button
              onClick={() => { setGpsOverrideActive(false); setSelectedDate(today); }}
              className="btn-press px-3 py-1.5 rounded-lg font-mono text-[11px] font-bold uppercase tracking-wider shrink-0"
              style={{
                background: 'var(--primary)',
                color: 'var(--on-primary)',
              }}
            >
              {t('itinerary.gps_use_date')}
            </button>
          </div>
        ) : (
          /* GPS matched status bar */
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3"
            style={{ background: 'color-mix(in srgb, var(--primary) 8%, transparent)' }}
          >
            <Icon name="gps_fixed" size={16} className="animate-pulse" style={{ color: 'var(--primary)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--primary)' }}>
              {t('itinerary.gps_status_active')}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--on-surface-faint)' }}>·</span>
            <span
              className="inline-flex items-center gap-0.5 text-[10px] font-medium"
              style={{ color: 'var(--success)' }}
            >
              <Icon name="check_circle" size={12} style={{ color: 'var(--success)' }} />
              {t('itinerary.gps_confirmed')}
            </span>
            <div className="flex-1" />
            <button onClick={gps.disable} className="btn-press p-1 rounded-lg">
              <Icon name="close" size={14} style={{ color: 'var(--on-surface-faint)' }} />
            </button>
          </div>
        )
      ) : gps.error ? (
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3"
          style={{ background: 'color-mix(in srgb, var(--error) 10%, transparent)' }}
        >
          <Icon name="gps_off" size={16} style={{ color: 'var(--error)' }} />
          <span className="text-xs" style={{ color: 'var(--error)' }}>{t('itinerary.gps_error')}</span>
          <div className="flex-1" />
          <button onClick={gps.disable} className="btn-press p-1">
            <Icon name="close" size={14} style={{ color: 'var(--on-surface-faint)' }} />
          </button>
        </div>
      ) : null}

      {/* ═══ DATE SCROLL ═══ */}
      <div
        ref={dateScrollRef}
        className="flex gap-1.5 overflow-x-auto pb-2 -mx-[var(--page-padding-x)] px-[var(--page-padding-x)] scrollbar-hide mb-2"
      >
        {allDates.map((date) => {
          const isToday = date === today;
          const isSelected = date === selectedDate;
          const d = new Date(date + 'T12:00:00');
          const dayOfMonth = d.getDate();
          const weekday = d.toLocaleDateString(undefined, { weekday: 'narrow' });
          const dateLeg = getCurrentLeg(legs, date);
          return (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className="btn-press flex flex-col items-center shrink-0 w-11 py-1.5 rounded-xl text-xs transition-[background-color,color,transform,box-shadow] duration-200 relative"
              style={{
                background: isSelected
                  ? 'var(--primary)'
                  : isToday
                    ? 'color-mix(in srgb, var(--primary) 15%, transparent)'
                    : 'var(--surface-container-high)',
                color: isSelected
                  ? 'var(--on-primary)'
                  : isToday
                    ? 'var(--primary)'
                    : 'var(--on-surface-dim)',
                ...(isSelected ? { boxShadow: 'var(--shadow-sm)', transform: 'scale(1.05)' } : {}),
              }}
            >
              <span className="text-[10px] opacity-70 uppercase font-medium">{weekday}</span>
              <span className="font-bold text-sm leading-tight">{dayOfMonth}</span>
              {dateLeg && (
                <span
                  className="w-1.5 h-1.5 rounded-full mt-0.5"
                  style={{
                    background: isSelected
                      ? 'rgba(255,255,255,0.6)'
                      : DAY_DOT_COLOR[dateLeg.dayType] ?? 'var(--primary)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ═══ SELECTED DATE LABEL ═══ */}
      <p
        className="text-xs font-medium capitalize mb-2"
        style={{ color: 'var(--on-surface-faint)' }}
      >
        {selectedDateFormatted}
      </p>

      {/* ═══ CITY HERO BANNER ═══ */}
      {currentLeg && (
        <HeroBanner
          cityName={currentLeg.cityName}
          countryCode={currentLeg.countryCode}
          dayType={currentLeg.dayType}
          dayLabel={`${t('itinerary.context_card_day', { current: dayNum, total: allDates.length })} · ${t(`itinerary.day_type_${currentLeg.dayType}` as never)}`}
          className="mb-3"
        >
          {/* Budget in hero */}
          {spendBar && (
            <div className="flex items-end justify-between mt-2">
              <div className="flex flex-col">
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.15em] mb-0.5"
                  style={{ color: 'rgba(255,255,255,0.65)' }}
                >
                  {t('itinerary.budget_daily_label')}
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold text-white tabular">
                    {fromCents(spendBar.totalSpentCents)}
                  </span>
                  {spendBar.budgetCents !== null && (
                    <span className="text-sm text-white/60 tabular">
                      / {fromCents(spendBar.budgetCents)}
                    </span>
                  )}
                </div>
              </div>
              <BudgetStatusBadge
                spentCents={spendBar.totalSpentCents}
                budgetCents={spendBar.budgetCents}
              />
            </div>
          )}
          {spendBar && spendBar.budgetCents !== null && (
            <div
              className="w-full h-1.5 rounded-full overflow-hidden mt-1.5"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${Math.min(spendBar.percent ?? 50, 100)}%`,
                  background:
                    (spendBar.percent ?? 0) > 100
                      ? 'var(--error)'
                      : (spendBar.percent ?? 0) > 80
                        ? 'var(--warning)'
                        : 'var(--success)',
                }}
              />
            </div>
          )}
          {/* Actions button */}
          <button
            onClick={() => setActionsMenuLeg(currentLeg)}
            className="btn-press absolute top-4 right-4 p-1.5 rounded-lg z-20"
            style={{ background: 'rgba(0,0,0,0.25)' }}
          >
            <Icon name="more_vert" size={18} style={{ color: 'rgba(255,255,255,0.8)' }} />
          </button>
        </HeroBanner>
      )}

      {/* ═══ SWIPEABLE CONTENT ═══ */}
      <div
        onTouchStart={handleSwipeStart}
        onTouchMove={handleSwipeMove}
        onTouchEnd={handleSwipeEnd}
        className="transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${swipeOffset * 0.3}px)` }}
      >

        {/* ═══ SECTION LABEL ═══ */}
        {agenda.length > 0 && (
          <p
            className="font-mono text-[10px] uppercase tracking-[0.15em] font-bold mb-2 pl-0.5"
            style={{ color: 'var(--on-surface-dim)' }}
          >
            {t('itinerary.section_agenda')}
          </p>
        )}

        {/* ═══ AGENDA — TRANSIT: Timeline | FULL: Cards ═══ */}
        {agenda.length > 0 ? (
          currentLeg?.dayType === 'transit' ? (
            <TimelineView
              items={agenda.map((item, i) => agendaToTimeline(item, i, t))}
              className="mb-2"
            />
          ) : (
            <div className="flex flex-col gap-3">
              {agenda.map((item, i) => {
                const isTransport = item.type === 'departure' || item.type === 'arrival';
                const isAccommodation = item.type === 'accommodation';
                const iconName = isTransport
                  ? TRANSPORT_ICON[item.leg.arrivalTransport?.type ?? 'other'] ?? 'commute'
                  : AGENDA_ICON[item.type];

                const bookingStatus = isTransport
                  ? item.leg.arrivalTransport?.bookingStatus
                  : isAccommodation
                    ? item.leg.accommodation?.bookingStatus
                    : undefined;
                const statusStyle = bookingStatus ? BOOKING_STATUS_STYLE[bookingStatus] : undefined;

                const company = isTransport ? item.leg.arrivalTransport?.company : undefined;
                const route = isTransport ? item.leg.arrivalTransport?.route : undefined;
                const reference = isTransport
                  ? item.leg.arrivalTransport?.reference
                  : isAccommodation
                    ? item.leg.accommodation?.reference
                    : undefined;
                const costCents = isTransport
                  ? item.leg.arrivalTransport?.costCents
                  : isAccommodation
                    ? item.leg.accommodation?.costCents
                    : undefined;
                const costCurrency = isTransport
                  ? item.leg.arrivalTransport?.costCurrency
                  : isAccommodation
                    ? item.leg.accommodation?.costCurrency
                    : undefined;
                const isPrepaid = isTransport
                  ? item.leg.arrivalTransport?.isPrepaid
                  : isAccommodation
                    ? item.leg.accommodation?.isPrepaid
                    : undefined;

                const isLive = (() => {
                  if (!item.time || selectedDate !== today) return false;
                  const now = new Date();
                  const [h, m] = item.time.split(':').map(Number);
                  if (isNaN(h!) || isNaN(m!)) return false;
                  const itemMinutes = h! * 60 + m!;
                  const nowMinutes = now.getHours() * 60 + now.getMinutes();
                  return nowMinutes >= itemMinutes && nowMinutes < itemMinutes + 60;
                })();

                return (
                  <div
                    key={i}
                    className="flex items-start gap-4 p-4 rounded-xl relative overflow-hidden"
                    style={{
                      background: isLive
                        ? 'color-mix(in srgb, var(--primary) 8%, var(--surface-container))'
                        : 'var(--surface-container)',
                      border: isLive
                        ? '1px solid color-mix(in srgb, var(--primary) 30%, transparent)'
                        : '1px solid var(--border-subtle)',
                    }}
                  >
                    {/* Left accent bar */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1"
                      style={{ background: isLive ? 'var(--primary)' : 'var(--surface-container-high)' }}
                    />

                    {/* Time block */}
                    <div className="flex flex-col items-center min-w-[48px] pt-0.5 shrink-0">
                      {item.time && (
                        <span
                          className="text-base font-bold tabular"
                          style={{ color: isLive ? 'var(--primary)' : 'var(--on-surface)' }}
                        >
                          {item.time}
                        </span>
                      )}
                      {/* Transport type icon below time */}
                      <div
                        className="mt-1.5 p-1.5 rounded-lg"
                        style={{ background: 'var(--surface-container-high)' }}
                      >
                        <Icon name={iconName} size={16} style={{ color: 'var(--on-surface-dim)' }} />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h4
                          className="text-base font-semibold leading-snug"
                          style={{ color: 'var(--on-surface)' }}
                        >
                          {item.label}
                        </h4>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isLive && (
                            <span
                              className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full animate-pulse"
                              style={{
                                background: 'color-mix(in srgb, var(--error) 20%, transparent)',
                                color: 'var(--error)',
                              }}
                            >
                              {t('itinerary.live_badge')}
                            </span>
                          )}
                          <button
                            onClick={() => setActionsMenuLeg(item.leg)}
                            className="btn-press p-1 rounded-lg"
                          >
                            <Icon name="more_vert" size={18} style={{ color: 'var(--on-surface-faint)' }} />
                          </button>
                        </div>
                      </div>

                      {/* Company + Route line */}
                      {(company || route) && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {company && (
                            <span className="text-xs font-medium" style={{ color: 'var(--on-surface)' }}>
                              {company}
                            </span>
                          )}
                          {company && route && (
                            <span className="text-[10px]" style={{ color: 'var(--on-surface-faint)' }}>·</span>
                          )}
                          {route && (
                            <span className="text-xs" style={{ color: 'var(--on-surface-dim)' }}>
                              {route}
                            </span>
                          )}
                        </div>
                      )}

                      {item.detail && !route && (
                        <p className="flex items-center gap-1 text-xs" style={{ color: 'var(--on-surface-dim)' }}>
                          <Icon name="location_on" size={14} style={{ color: 'var(--on-surface-dim)' }} />
                          {item.detail}
                        </p>
                      )}

                      {/* Bottom row: booking status + cost + reference */}
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {/* Booking status badge */}
                        {statusStyle && bookingStatus && bookingStatus !== 'none' && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: statusStyle.bg, color: statusStyle.color }}
                          >
                            <Icon name={statusStyle.icon} size={12} filled style={{ color: statusStyle.color }} />
                            {t(`itinerary.checklist_${bookingStatus}` as never)}
                          </span>
                        )}

                        {/* Cost */}
                        {costCents != null && costCurrency && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-medium tabular px-2 py-0.5 rounded-full"
                            style={{
                              background: 'var(--surface-container-high)',
                              color: 'var(--on-surface)',
                            }}
                          >
                            {formatMoney(costCents, costCurrency)}
                            {isPrepaid && (
                              <Icon name="lock" size={10} style={{ color: 'var(--success)' }} />
                            )}
                          </span>
                        )}

                        {/* Reference */}
                        {reference && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full truncate max-w-[140px]"
                            style={{
                              background: 'var(--surface-container-high)',
                              color: 'var(--on-surface-dim)',
                            }}
                          >
                            <Icon name="confirmation_number" size={10} style={{ color: 'var(--on-surface-dim)' }} />
                            {reference}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'var(--surface-container-high)' }}
            >
              <Icon name="event_busy" size={28} style={{ color: 'var(--on-surface-faint)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--on-surface-dim)' }}>
              {t('itinerary.no_events')}
            </p>
          </div>
        )}

        {/* ═══ ACCOMMODATION CARD ═══ */}
        {currentLeg?.accommodation && (
          <div
            className="rounded-xl p-4 mt-3 flex items-start gap-3"
            style={{
              background: 'color-mix(in srgb, var(--tertiary) 6%, var(--surface-container))',
              border: '1px solid color-mix(in srgb, var(--tertiary) 20%, transparent)',
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'color-mix(in srgb, var(--tertiary) 20%, transparent)' }}
            >
              <Icon name="bed" size={20} filled style={{ color: 'var(--tertiary)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold truncate" style={{ color: 'var(--on-surface)' }}>
                {currentLeg.accommodation.name}
              </h4>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span
                  className="text-[10px] font-mono uppercase tracking-[0.1em] px-2 py-0.5 rounded"
                  style={{
                    background: 'var(--surface-container-high)',
                    color: 'var(--on-surface-dim)',
                  }}
                >
                  {t(`itinerary.accommodation_type_${currentLeg.accommodation.type}` as never)}
                </span>
                {currentLeg.accommodation.nights > 0 && (
                  <span className="text-xs" style={{ color: 'var(--on-surface-dim)' }}>
                    {currentLeg.accommodation.nights} {currentLeg.accommodation.nights === 1
                      ? t('itinerary.accom_nights', { count: 1 })
                      : t('itinerary.accom_nights_plural', { count: currentLeg.accommodation.nights })}
                  </span>
                )}
                {currentLeg.accommodation.costCents != null && currentLeg.accommodation.costCurrency && (
                  <span className="text-xs font-medium tabular" style={{ color: 'var(--on-surface)' }}>
                    {formatMoney(currentLeg.accommodation.costCents, currentLeg.accommodation.costCurrency)}
                  </span>
                )}
              </div>
              {currentLeg.accommodation.bookingStatus !== 'none' && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  {(() => {
                    const s = BOOKING_STATUS_STYLE[currentLeg.accommodation.bookingStatus];
                    return s ? (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: s.bg, color: s.color }}
                      >
                        <Icon name={s.icon} size={11} filled style={{ color: s.color }} />
                        {t(`itinerary.checklist_${currentLeg.accommodation.bookingStatus}` as never)}
                      </span>
                    ) : null;
                  })()}
                  {currentLeg.accommodation.reference && (
                    <span
                      className="text-[10px] font-mono truncate max-w-[120px] px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--surface-container-high)', color: 'var(--on-surface-dim)' }}
                    >
                      {currentLeg.accommodation.reference}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ BUDGET PREMISE ═══ */}
        {currentLeg?.budgetPremise && (
          <div
            className="flex items-start gap-4 p-4 rounded-xl mt-3"
            style={{
              background: 'var(--surface-container-high)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'color-mix(in srgb, var(--secondary) 20%, transparent)' }}
            >
              <Icon name="lightbulb" size={22} filled style={{ color: 'var(--secondary)' }} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>
                {t('itinerary.budget_premise_title')}
              </h4>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--on-surface-dim)' }}>
                {currentLeg.budgetPremise}
              </p>
            </div>
          </div>
        )}

        {/* ═══ PERSONAL NOTES ═══ */}
        {currentLeg && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2.5 pl-0.5">
              <p
                className="font-mono text-[10px] uppercase tracking-[0.15em] font-bold"
                style={{ color: 'var(--on-surface-dim)' }}
              >
                {t('itinerary.section_notes')}
              </p>
              <button
                onClick={() => setNotesEditing(!notesEditing)}
                className="btn-press flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg"
                style={{
                  color: 'var(--primary)',
                  background: notesEditing ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'transparent',
                }}
              >
                <Icon name={notesEditing ? 'check' : 'edit'} size={14} style={{ color: 'var(--primary)' }} />
                {notesEditing ? t('itinerary.notes_done') : t('itinerary.notes_edit')}
              </button>
            </div>
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                background: 'var(--surface-container)',
                border: notesEditing
                  ? '1.5px solid color-mix(in srgb, var(--primary) 50%, transparent)'
                  : '1px solid var(--border-subtle)',
                transition: 'border-color 0.2s ease',
              }}
            >
              {notesEditing ? (
                <textarea
                  defaultValue={currentLeg.personalNotes ?? ''}
                  placeholder={t('itinerary.notes_placeholder')}
                  autoFocus
                  onBlur={(e) => {
                    const value = e.target.value.trim() || null;
                    if (value !== (currentLeg.personalNotes ?? null)) {
                      db.itineraryLegs.update(currentLeg.id, {
                        personalNotes: value,
                        updatedAt: new Date().toISOString(),
                      });
                    }
                    setNotesEditing(false);
                  }}
                  className="w-full bg-transparent text-sm outline-none resize-y leading-relaxed min-h-[120px] p-4"
                  style={{ color: 'var(--on-surface)' }}
                  rows={5}
                />
              ) : (
                <div
                  className="cursor-pointer min-h-[72px] p-4 flex items-start gap-3"
                  onClick={() => setNotesEditing(true)}
                >
                  {!currentLeg.personalNotes && (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: 'var(--surface-container-high)' }}
                    >
                      <Icon name="sticky_note_2" size={16} style={{ color: 'var(--on-surface-faint)' }} />
                    </div>
                  )}
                  <p
                    className="text-sm leading-relaxed flex-1"
                    style={{
                      color: currentLeg.personalNotes ? 'var(--on-surface)' : 'var(--on-surface-faint)',
                      fontStyle: currentLeg.personalNotes ? 'normal' : 'italic',
                    }}
                  >
                    {currentLeg.personalNotes || t('itinerary.notes_placeholder')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ FLOATING ADD BUTTON ═══ */}
      <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2">
        <button
          onClick={() => setAddMenuOpen(!addMenuOpen)}
          className="btn-press w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center transition-transform"
          style={{
            background: 'var(--primary)',
            transform: addMenuOpen ? 'rotate(45deg)' : 'rotate(0)',
          }}
        >
          <Icon name="add" size={28} className="text-surface" />
        </button>
      </div>

      {/* ═══ ADD MENU BOTTOM SHEET ═══ */}
      <BottomSheet
        open={addMenuOpen}
        onClose={() => setAddMenuOpen(false)}
        title={t('itinerary.add_leg')}
      >
        <div className="flex flex-col gap-3 pb-2">
          <button
            onClick={() => { setAddMenuOpen(false); navigate('/itinerary/create?mode=add'); }}
            className="btn-press flex items-center gap-3 p-4 rounded-2xl bg-primary/10"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Icon name="auto_awesome" size={22} className="text-primary" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-on-surface text-sm">{t('itinerary.add_with_ai')}</p>
              <p className="text-xs text-on-surface-dim mt-0.5">{t('itinerary.add_with_ai_desc')}</p>
            </div>
          </button>

          <button
            onClick={openCreate}
            className="btn-press flex items-center gap-3 p-4 rounded-2xl bg-surface-high"
          >
            <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center">
              <Icon name="edit_note" size={22} className="text-on-surface-dim" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-on-surface text-sm">{t('itinerary.add_manual_leg')}</p>
              <p className="text-xs text-on-surface-dim mt-0.5">{t('itinerary.add_manual_leg_desc')}</p>
            </div>
          </button>
        </div>
      </BottomSheet>

      {/* ═══ LEG ACTIONS MENU ═══ */}
      <BottomSheet
        open={actionsMenuLeg !== null}
        onClose={() => setActionsMenuLeg(null)}
        title={actionsMenuLeg?.cityName ?? ''}
      >
        {actionsMenuLeg && (
          <div className="flex flex-col gap-2 pb-2">
            <button
              onClick={() => openEdit(actionsMenuLeg)}
              className="btn-press flex items-center gap-3 p-4 rounded-xl bg-surface-high"
            >
              <Icon name="edit" size={20} className="text-primary" />
              <span className="text-sm font-medium text-on-surface">{t('itinerary.edit_leg')}</span>
            </button>
            <button
              onClick={() => handleDeleteLeg(actionsMenuLeg)}
              className="btn-press flex items-center gap-3 p-4 rounded-xl bg-error/5"
            >
              <Icon name="delete" size={20} className="text-error" />
              <span className="text-sm font-medium text-error">{t('itinerary.delete_leg')}</span>
            </button>
          </div>
        )}
      </BottomSheet>

      {/* ═══ LEG FORM ═══ */}
      <LegFormSheet
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingLeg(null); }}
        onSave={handleSaveLeg}
        onDelete={editingLeg ? () => handleDeleteLeg(editingLeg) : undefined}
        tripId={trip.id}
        nextOrder={nextOrder}
        existing={editingLeg}
      />
    </div>
  );
}
