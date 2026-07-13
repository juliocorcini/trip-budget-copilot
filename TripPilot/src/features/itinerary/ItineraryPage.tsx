import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db/database';
import { useAppData } from '@/hooks/useAppData';
import { getDayAgenda, getCurrentLeg, getTripSummary, getDayTypeStyle, getLegSpend, formatItineraryShareText } from '@/domain/itinerary/itinerary-domain';
import { fromCents } from '@/domain/money';
import { localDateString } from '@/domain/dates';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { LegFormSheet } from './LegFormSheet';
import { useGpsLegDetect } from './useGpsLegDetect';
import { shareOrCopyText } from '@/utils/native/link-share';
import { showToast } from '@/components/Toast';
import type { ItineraryLeg } from '@/domain/types/itinerary-leg';
import type { DayAgendaItem } from '@/domain/itinerary/itinerary-domain';

const TRANSPORT_ICON: Record<string, string> = {
  flight: 'flight', train: 'train', bus: 'directions_bus',
  car: 'directions_car', ferry: 'directions_boat', walk: 'directions_walk', other: 'commute',
};

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

  if (appData.loading || !trip) return null;

  // ─── Empty state ───
  if (legs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-5 py-12 px-6 text-center">
        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon name="route" size={48} className="text-primary" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-on-surface">{t('itinerary.empty_title')}</h2>
          <p className="text-sm text-on-surface-dim mt-2 leading-relaxed max-w-xs mx-auto">
            {t('itinerary.empty_desc')}
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs mt-2">
          <button
            onClick={() => navigate('/itinerary/create')}
            className="btn-press flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-sm font-bold shadow-sm"
            style={{ background: 'var(--primary)', color: 'var(--surface)' }}
          >
            <Icon name="auto_awesome" size={18} className="text-surface" />
            {t('itinerary.create_with_ai')}
          </button>
          <button
            onClick={openCreate}
            className="btn-press flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-sm font-semibold border"
            style={{ background: 'var(--surface-high)', color: 'var(--on-surface)', borderColor: 'var(--border-faint)' }}
          >
            <Icon name="edit_note" size={18} className="text-on-surface-dim" />
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

      {/* ═══ PROGRESS BAR ═══ */}
      {allDates.length > 0 && (
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-1.5 rounded-full bg-surface-high overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs text-on-surface-dim tabular shrink-0">
            {isBefore
              ? t('itinerary.starts_in', { days: Math.round((new Date(firstDate).getTime() - new Date(today).getTime()) / 86400000) })
              : isAfter
                ? t('itinerary.trip_done')
                : t('itinerary.context_card_day', { current: dayNum, total: allDates.length })}
          </span>
        </div>
      )}

      {/* ═══ GPS ═══ */}
      {!gps.enabled ? (
        <button
          onClick={gps.enable}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-high btn-press self-start mb-3"
        >
          <Icon name="gps_fixed" size={14} className="text-on-surface-faint" />
          <span className="text-xs text-on-surface-dim">{t('itinerary.gps_enable')}</span>
        </button>
      ) : gps.detecting ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-high self-start mb-3">
          <Icon name="gps_fixed" size={14} className="text-primary animate-pulse" />
          <span className="text-xs text-on-surface-dim">{t('itinerary.gps_detecting')}</span>
        </div>
      ) : gps.detectedLeg ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 self-start mb-3">
          <Icon name="gps_fixed" size={14} className="text-primary" />
          <span className="text-xs text-primary font-medium">
            {gps.detectedLeg.cityName}
            {gpsOverrideActive && dateBasedLeg && dateBasedLeg.id !== gps.detectedLeg.id && (
              <span className="text-on-surface-faint font-normal ml-1">
                ({t('itinerary.gps_override_from', { city: dateBasedLeg.cityName })})
              </span>
            )}
          </span>
          {gpsOverrideActive && (
            <button
              onClick={() => {
                setGpsOverrideActive(false);
                setSelectedDate(today);
              }}
              className="btn-press text-[10px] text-on-surface-dim ml-1 px-1.5 py-0.5 rounded bg-surface-high"
            >
              {t('itinerary.gps_use_date')}
            </button>
          )}
          <button onClick={gps.disable} className="btn-press ml-1">
            <Icon name="close" size={12} className="text-on-surface-faint" />
          </button>
        </div>
      ) : gps.error ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-error/10 self-start mb-3">
          <Icon name="gps_off" size={14} className="text-error" />
          <span className="text-xs text-error">{t('itinerary.gps_error')}</span>
          <button onClick={gps.disable} className="btn-press ml-1">
            <Icon name="close" size={12} className="text-on-surface-faint" />
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
          const dayStyle = dateLeg ? getDayTypeStyle(dateLeg.dayType) : null;
          return (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className={`btn-press flex flex-col items-center shrink-0 w-11 py-1.5 rounded-xl text-xs transition-[background-color,color,transform,box-shadow] duration-200 relative ${
                isSelected
                  ? 'bg-primary text-on-primary shadow-sm scale-105'
                  : isToday
                    ? 'bg-primary/15 text-primary'
                    : 'bg-surface-high text-on-surface-dim'
              }`}
            >
              <span className="text-[10px] opacity-70 uppercase font-medium">{weekday}</span>
              <span className="font-bold text-sm leading-tight">{dayOfMonth}</span>
              {dayStyle && (
                <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-on-primary/60' : dayStyle.dot}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* ═══ SELECTED DATE LABEL ═══ */}
      <p className="text-xs text-on-surface-faint font-medium capitalize mb-2">{selectedDateFormatted}</p>

      {/* ═══ CITY HERO CARD ═══ */}
      {currentLeg && (() => {
        const style = getDayTypeStyle(currentLeg.dayType);
        return (
          <div className={`rounded-2xl p-4 mb-3 ${style.bg} border-l-4 ${style.border}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-on-surface leading-tight">
                  {currentLeg.cityName}
                  {currentLeg.countryCode && (
                    <span className="text-sm font-normal text-on-surface-dim ml-1">({currentLeg.countryCode})</span>
                  )}
                </h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${style.bg} ${style.text}`}>
                    {t(`itinerary.day_type_${currentLeg.dayType}` as never)}
                  </span>
                  {currentLeg.companions.length > 0 && (
                    <span className="text-xs text-on-surface-dim">
                      {currentLeg.companions.join(', ')}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setActionsMenuLeg(currentLeg)}
                className="btn-press p-1.5 rounded-lg bg-white/30 dark:bg-black/20"
              >
                <Icon name="more_vert" size={18} className="text-on-surface-dim" />
              </button>
            </div>

            {/* Spend vs budget bar */}
            {spendBar && (
              <div className="flex items-center gap-2 mt-3">
                <div className="flex-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 ${
                      (spendBar.percent ?? 0) > 100 ? 'bg-red-500'
                      : (spendBar.percent ?? 0) > 80 ? 'bg-amber-500'
                      : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(spendBar.percent ?? 50, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-on-surface-dim tabular shrink-0">
                  {fromCents(spendBar.totalSpentCents)}
                  {spendBar.budgetCents !== null && ` / ${fromCents(spendBar.budgetCents)}`}
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══ SWIPEABLE CONTENT ═══ */}
      <div
        onTouchStart={handleSwipeStart}
        onTouchMove={handleSwipeMove}
        onTouchEnd={handleSwipeEnd}
        className="transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${swipeOffset * 0.3}px)` }}
      >

        {/* ═══ AGENDA CARDS ═══ */}
        {agenda.length > 0 ? (
          <div className="flex flex-col gap-2">
            {agenda.map((item, i) => {
              const iconName = item.type === 'arrival' || item.type === 'departure'
                ? TRANSPORT_ICON[item.leg.arrivalTransport?.type ?? 'other'] ?? 'commute'
                : AGENDA_ICON[item.type];

              const borderColor = item.type === 'arrival' ? 'border-l-teal-500'
                : item.type === 'departure' ? 'border-l-amber-500'
                : item.type === 'accommodation' ? 'border-l-indigo-500'
                : 'border-l-primary';

              const bgColor = item.type === 'arrival' ? 'bg-teal-500'
                : item.type === 'departure' ? 'bg-amber-500'
                : item.type === 'accommodation' ? 'bg-indigo-500'
                : 'bg-primary';

              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-xl bg-surface-high border-l-[3px] ${borderColor} transition-shadow`}
                >
                  <div className={`w-8 h-8 rounded-lg ${bgColor}/15 flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon name={iconName} size={16} className={`${bgColor.replace('bg-', 'text-')}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    {item.time && (
                      <span className="text-[11px] font-mono font-bold text-primary">
                        {item.time}
                      </span>
                    )}
                    <p className="text-sm text-on-surface leading-snug">{item.label}</p>
                    {item.detail && (
                      <p className="text-xs text-on-surface-dim mt-0.5">{item.detail}</p>
                    )}
                  </div>

                  <button
                    onClick={() => setActionsMenuLeg(item.leg)}
                    className="btn-press p-1 rounded-lg shrink-0"
                  >
                    <Icon name="more_vert" size={16} className="text-on-surface-faint" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-14 h-14 rounded-full bg-surface-high flex items-center justify-center">
              <Icon name="event_busy" size={28} className="text-on-surface-faint" />
            </div>
            <p className="text-sm text-on-surface-dim">{t('itinerary.no_events')}</p>
          </div>
        )}

        {/* ═══ BUDGET PREMISE ═══ */}
        {currentLeg?.budgetPremise && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 mt-3">
            <Icon name="lightbulb" size={16} className="text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-primary mb-0.5">{t('itinerary.budget_hint')}</p>
              <p className="text-xs text-on-surface-dim leading-relaxed">{currentLeg.budgetPremise}</p>
            </div>
          </div>
        )}

        {/* ═══ PERSONAL NOTES ═══ */}
        {currentLeg && (
          <div className="p-3 rounded-xl bg-surface-high mt-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon name="sticky_note_2" size={14} className="text-on-surface-faint" />
              <p className="text-xs font-semibold text-on-surface-dim">{t('itinerary.personal_notes')}</p>
            </div>
            <textarea
              defaultValue={currentLeg.personalNotes ?? ''}
              placeholder={t('itinerary.notes_placeholder')}
              onBlur={(e) => {
                const value = e.target.value.trim() || null;
                if (value !== (currentLeg.personalNotes ?? null)) {
                  db.itineraryLegs.update(currentLeg.id, {
                    personalNotes: value,
                    updatedAt: new Date().toISOString(),
                  });
                }
              }}
              className="w-full bg-transparent text-sm text-on-surface outline-none resize-none leading-relaxed min-h-[2.5rem]"
              rows={2}
            />
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
