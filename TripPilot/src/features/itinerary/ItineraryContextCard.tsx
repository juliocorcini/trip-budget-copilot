import { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db/database';
import { getCurrentLeg, getNextTransport, getTripSummary, getDayAgenda, getLegSpend } from '@/domain/itinerary/itinerary-domain';
import { localDateString } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { useGpsLegDetect } from './useGpsLegDetect';
import { Icon } from '@/components/Icon';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { hapticSelection } from '@/utils/haptics';
import type { ItineraryLeg } from '@/domain/types/itinerary-leg';

const TRANSPORT_ICON: Record<string, string> = {
  flight: 'flight', train: 'train', bus: 'directions_bus',
  car: 'directions_car', ferry: 'directions_boat', walk: 'directions_walk', other: 'commute',
};

interface Props {
  tripId: string;
  baseCurrency?: string;
  transactions?: { date: string; amountCents: number; currency: string }[];
}

/**
 * ÂNCORA-ITIN-2: this component returns null when there are no legs,
 * ensuring zero impact on the dashboard when itinerary is not used.
 */
export function ItineraryContextCard({ tripId, baseCurrency, transactions }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const legs = useLiveQuery(
    async () =>
      db.itineraryLegs
        .where('tripId')
        .equals(tripId)
        .filter((l) => l.deletedAt === null)
        .sortBy('order'),
    [tripId],
    [] as ItineraryLeg[],
  );

  const today = localDateString();
  const now = new Date().toTimeString().slice(0, 5);

  const gps = useGpsLegDetect(legs);
  const dateBasedLeg = useMemo(() => getCurrentLeg(legs, today), [legs, today]);
  const gpsOverride = gps.detectedLeg && dateBasedLeg && gps.detectedLeg.id !== dateBasedLeg.id;
  const currentLeg = gpsOverride ? gps.detectedLeg : dateBasedLeg;
  const nextTransport = useMemo(() => getNextTransport(legs, today, now), [legs, today, now]);
  const summary = useMemo(() => getTripSummary(legs), [legs]);
  const dayAgenda = useMemo(() => getDayAgenda(legs, today), [legs, today]);
  const legSpend = useMemo(
    () => currentLeg && baseCurrency && transactions ? getLegSpend(currentLeg, transactions, baseCurrency) : null,
    [currentLeg, baseCurrency, transactions],
  );

  const [countdownText, setCountdownText] = useState<string | null>(null);
  useEffect(() => {
    if (!nextTransport?.time || nextTransport.date !== today) {
      setCountdownText(null);
      return;
    }
    const update = () => {
      const [h, m] = nextTransport.time!.split(':').map(Number);
      if (isNaN(h!) || isNaN(m!)) { setCountdownText(null); return; }
      const n = new Date();
      const departMin = h! * 60 + m!;
      const nowMin = n.getHours() * 60 + n.getMinutes();
      const diff = departMin - nowMin;
      if (diff <= 0 || diff > 24 * 60) { setCountdownText(null); return; }
      const hrs = Math.floor(diff / 60);
      const mins = diff % 60;
      setCountdownText(hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [nextTransport?.time, nextTransport?.date, today]);

  const transitCities = useMemo(() => {
    const touching = legs.filter(
      (l) => l.arrivalDate <= today && l.departureDate >= today,
    );
    if (touching.length <= 1) return [];
    return touching
      .sort((a, b) => a.order - b.order)
      .map((l) => ({
        id: l.id,
        city: l.cityName,
        isDeparture: l.departureDate === today,
        isArrival: l.arrivalDate === today,
        isCurrent: currentLeg?.id === l.id,
        transport: l.arrivalTransport?.type,
      }));
  }, [legs, today, currentLeg?.id]);

  const [expanded, setExpanded] = useState(false);

  const toggleExpand = useCallback(() => {
    hapticSelection();
    setExpanded((prev) => !prev);
  }, []);

  if (legs.length === 0) return null;

  const dayNumber = currentLeg
    ? Math.floor(
        (new Date(today).getTime() - new Date(legs[0]!.arrivalDate).getTime()) /
          (1000 * 60 * 60 * 24),
      ) + 1
    : null;

  const goToAgenda = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('/itinerary');
  };

  // GPS detecting state
  if (gps.enabled && gps.detecting) {
    return (
      <div
        className="w-full rounded-2xl p-4 mt-3 flex flex-col gap-4 relative overflow-hidden"
        style={{ background: 'var(--surface-container)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 flex items-center justify-center">
              <div
                className="absolute inset-0 rounded-full animate-ping"
                style={{
                  border: '1px solid var(--ai)',
                  opacity: 0.3,
                  animationDuration: '2s',
                }}
              />
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center z-10"
                style={{ background: 'var(--surface-container-high)' }}
              >
                <Icon name="location_on" size={16} style={{ color: 'var(--ai)' }} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <SkeletonLoader lines={1} widths={['128px']} height="18px" />
              <SkeletonLoader lines={1} widths={['80px']} height="12px" />
            </div>
          </div>
          <div
            className="px-2 py-1 rounded flex items-center gap-1"
            style={{
              background: 'var(--surface-container-high)',
              color: 'var(--on-surface-dim)',
            }}
          >
            <Icon name="sync" size={14} className="animate-spin" style={{ color: 'var(--on-surface-dim)', animationDuration: '3s' }} />
            <span className="font-mono text-[10px] uppercase tracking-wider">
              {t('itinerary.gps_detecting')}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-3 mt-1">
          <div
            className="text-sm italic flex items-center gap-2"
            style={{ color: 'var(--on-surface-dim)' }}
          >
            <Icon
              name="magic_button"
              size={14}
              className="animate-spin"
              style={{ color: 'var(--ai)', animationDuration: '3s' }}
            />
            {t('itinerary.gps_detecting_city')}
          </div>
          <div className="flex gap-2 w-full">
            <SkeletonLoader lines={1} widths={['100%']} height="56px" className="flex-1" />
            <SkeletonLoader lines={1} widths={['100%']} height="56px" className="flex-1" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full text-left rounded-2xl p-4 mt-3 relative overflow-hidden"
      style={{ background: 'var(--surface-container)', border: '1px solid var(--border-subtle)' }}
    >
      {currentLeg ? (
        <div className="flex flex-col gap-3">
          {/* Collapsed header — always visible, tappable to expand */}
          <button
            onClick={toggleExpand}
            className="btn-press w-full flex justify-between items-center text-left"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: 'var(--secondary)' }}
                />
                <h2
                  className="text-base font-bold truncate"
                  style={{ color: 'var(--on-surface)' }}
                >
                  {currentLeg.cityName}
                </h2>
                {gpsOverride && (
                  <Icon name="gps_fixed" size={14} style={{ color: 'var(--primary)' }} />
                )}
              </div>
              {dayNumber !== null && summary.totalDays > 0 && (
                <p
                  className="font-mono text-[10px] uppercase tracking-[0.15em] ml-[18px]"
                  style={{ color: 'var(--on-surface-dim)' }}
                >
                  {t('itinerary.context_card_day', { current: dayNumber, total: summary.totalDays })}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!expanded && nextTransport && countdownText && (
                <span
                  className="text-[11px] font-bold px-2 py-1 rounded-md"
                  style={{ background: 'color-mix(in srgb, var(--warning) 15%, transparent)', color: 'var(--warning)' }}
                >
                  <Icon name="timer" size={11} style={{ color: 'var(--warning)', verticalAlign: 'middle', marginRight: 2 }} />
                  {countdownText}
                </span>
              )}
              <Icon
                name="expand_more"
                size={20}
                className="text-on-surface-faint transition-transform"
                style={expanded ? { transform: 'rotate(180deg)' } : undefined}
              />
            </div>
          </button>

          {/* Collapsed: inline transport summary */}
          {!expanded && nextTransport && (
            <div className="flex items-center gap-2 ml-[18px]">
              <Icon
                name={TRANSPORT_ICON[nextTransport.transportType] ?? 'commute'}
                size={14}
                style={{ color: 'var(--secondary)' }}
              />
              <span className="text-xs" style={{ color: 'var(--on-surface-dim)' }}>
                {nextTransport.time ?? ''} {t('itinerary.to')} {nextTransport.destination}
              </span>
            </div>
          )}

          {/* Expanded content */}
          {expanded && (
            <>
              {/* Multi-city transit strip */}
              {transitCities.length > 0 && (
                <div
                  className="flex items-center gap-0 py-2 px-3 rounded-xl overflow-x-auto no-scrollbar"
                  style={{
                    background: 'color-mix(in srgb, var(--ai) 8%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--ai) 20%, transparent)',
                  }}
                >
                  {transitCities.map((c, idx) => (
                    <div key={c.id} className="flex items-center shrink-0">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="rounded-full flex items-center justify-center"
                          style={{
                            width: c.isCurrent ? '24px' : '20px',
                            height: c.isCurrent ? '24px' : '20px',
                            background: c.isCurrent
                              ? 'var(--primary)'
                              : c.isDeparture
                                ? 'var(--surface-container-high)'
                                : 'color-mix(in srgb, var(--ai) 25%, transparent)',
                            border: c.isCurrent
                              ? 'none'
                              : '1.5px solid var(--ai)',
                          }}
                        >
                          <Icon
                            name={c.isCurrent ? 'location_on' : c.isDeparture ? 'logout' : 'login'}
                            size={c.isCurrent ? 14 : 12}
                            filled={c.isCurrent}
                            style={{
                              color: c.isCurrent ? 'var(--on-primary)' : 'var(--ai)',
                            }}
                          />
                        </div>
                        <span
                          className="text-[11px] leading-tight whitespace-nowrap"
                          style={{
                            color: c.isCurrent ? 'var(--primary)' : 'var(--on-surface-dim)',
                            fontWeight: c.isCurrent ? 700 : 500,
                          }}
                        >
                          {c.city}
                        </span>
                      </div>
                      {idx < transitCities.length - 1 && (
                        <div className="flex items-center mx-2 shrink-0">
                          <div
                            className="h-[1.5px] shrink-0"
                            style={{ width: '12px', background: 'var(--ai)' }}
                          />
                          <Icon
                            name={TRANSPORT_ICON[transitCities[idx + 1]?.transport ?? 'other'] ?? 'commute'}
                            size={14}
                            style={{ color: 'var(--ai)' }}
                          />
                          <div
                            className="h-[1.5px] shrink-0"
                            style={{ width: '12px', background: 'var(--ai)' }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Transport + Accommodation 2-col grid */}
              <div className="grid grid-cols-2 gap-2">
                {/* Transport */}
                <div
                  className="rounded-lg p-3 flex items-center gap-2.5"
                  style={{ background: 'var(--surface-container-high)', border: '1px solid var(--border-subtle)' }}
                >
                  {nextTransport ? (
                    <>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--secondary) 20%, transparent)' }}
                      >
                        <Icon
                          name={TRANSPORT_ICON[nextTransport.transportType] ?? 'commute'}
                          size={16}
                          style={{ color: 'var(--secondary)' }}
                        />
                      </div>
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <span
                          className="font-mono text-[10px] uppercase tracking-[0.1em]"
                          style={{ color: 'var(--on-surface-dim)' }}
                        >
                          {t('itinerary.transport')}
                        </span>
                        <span
                          className="text-sm truncate"
                          style={{ color: 'var(--on-surface)' }}
                        >
                          {nextTransport.time ?? ''} {t('itinerary.to')} {nextTransport.destination}
                        </span>
                        {countdownText && (
                          <span
                            className="text-[11px] font-semibold mt-0.5"
                            style={{ color: 'var(--warning)' }}
                          >
                            <Icon name="timer" size={11} style={{ color: 'var(--warning)', verticalAlign: 'middle', marginRight: 2 }} />
                            {t('itinerary.departs_in', { time: countdownText })}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <span
                        className="font-mono text-[10px] uppercase tracking-[0.1em]"
                        style={{ color: 'var(--on-surface-dim)' }}
                      >
                        {t('itinerary.transport')}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--on-surface-faint)' }}>—</span>
                    </div>
                  )}
                </div>

                {/* Accommodation */}
                <div
                  className="rounded-lg p-3 flex items-center gap-2.5"
                  style={{ background: 'var(--surface-container-high)', border: '1px solid var(--border-subtle)' }}
                >
                  {currentLeg.accommodation ? (
                    <>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--tertiary) 20%, transparent)' }}
                      >
                        <Icon name="bed" size={16} style={{ color: 'var(--tertiary)' }} />
                      </div>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span
                          className="font-mono text-[10px] uppercase tracking-[0.1em]"
                          style={{ color: 'var(--on-surface-dim)' }}
                        >
                          {t('itinerary.accommodation')}
                        </span>
                        <span
                          className="text-sm truncate"
                          style={{ color: 'var(--on-surface)' }}
                        >
                          {currentLeg.accommodation.name}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <span
                        className="font-mono text-[10px] uppercase tracking-[0.1em]"
                        style={{ color: 'var(--on-surface-dim)' }}
                      >
                        {t('itinerary.accommodation')}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--on-surface-faint)' }}>—</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Mini-timeline agenda */}
              {dayAgenda.length > 0 && (
                <div className="flex flex-col gap-0 relative">
                  <h3
                    className="font-mono text-[10px] uppercase tracking-[0.15em] pb-2 mb-2"
                    style={{
                      color: 'var(--on-surface-dim)',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    {t('itinerary.section_agenda')}
                  </h3>
                  {dayAgenda.slice(0, 5).map((item, idx) => {
                    const isTransport = item.type === 'departure' || item.type === 'arrival';
                    const isActive = item.time && item.time <= now && (
                      idx === dayAgenda.length - 1 || !dayAgenda[idx + 1]?.time || dayAgenda[idx + 1]!.time! > now
                    );
                    return (
                      <div key={idx} className="flex items-center gap-3 py-1.5">
                        <span
                          className="font-mono text-[11px] w-12 shrink-0 text-right tabular"
                          style={{
                            color: isActive ? 'var(--primary)' : 'var(--on-surface-dim)',
                            fontWeight: isActive ? 700 : 500,
                          }}
                        >
                          {item.time ?? ''}
                        </span>
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            background: isActive
                              ? 'var(--primary)'
                              : isTransport
                                ? 'color-mix(in srgb, var(--primary) 30%, transparent)'
                                : 'transparent',
                            border: isActive
                              ? 'none'
                              : isTransport
                                ? 'none'
                                : '1px solid var(--on-surface-faint)',
                          }}
                        />
                        <span
                          className="text-sm truncate"
                          style={{
                            color: 'var(--on-surface)',
                            fontWeight: isActive ? 500 : 400,
                          }}
                        >
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                  {dayAgenda.length > 5 && (
                    <p
                      className="text-[10px] ml-[60px] mt-0.5"
                      style={{ color: 'var(--on-surface-faint)' }}
                    >
                      +{dayAgenda.length - 5} {t('itinerary.more_items')}
                    </p>
                  )}
                </div>
              )}

              {/* Budget progress */}
              {legSpend && baseCurrency && (
                <div
                  className="flex flex-col gap-2 pt-3"
                  style={{ borderTop: '1px solid var(--border-subtle)' }}
                >
                  <div className="flex justify-between items-end">
                    <span
                      className="font-mono text-[10px] uppercase tracking-[0.15em]"
                      style={{ color: 'var(--on-surface-dim)' }}
                    >
                      {t('itinerary.budget_daily_label')}
                    </span>
                    <span className="text-sm font-medium" style={{ color: 'var(--on-surface)' }}>
                      {formatMoney(legSpend.totalSpentCents, baseCurrency)}
                      {legSpend.budgetCents !== null && (
                        <span style={{ color: 'var(--on-surface-dim)' }}>
                          {' '}/ {formatMoney(legSpend.budgetCents, baseCurrency)}
                        </span>
                      )}
                    </span>
                  </div>
                  <div
                    className="h-2 w-full rounded-full overflow-hidden"
                    style={{ background: 'var(--surface-container-highest)' }}
                  >
                    <div
                      className="h-full rounded-full transition-[width] duration-300"
                      style={{
                        width: `${Math.min(legSpend.percent ?? 0, 100)}%`,
                        background:
                          (legSpend.percent ?? 0) > 90
                            ? 'var(--error)'
                            : (legSpend.percent ?? 0) > 70
                              ? 'var(--warning)'
                              : 'var(--primary)',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Full agenda link */}
              <button
                onClick={goToAgenda}
                className="btn-press w-full py-2.5 flex items-center justify-center gap-2 text-sm font-medium rounded-lg mt-1"
                style={{ color: 'var(--primary)' }}
              >
                {t('itinerary.context_card_full_agenda')}
                <Icon name="arrow_forward" size={16} style={{ color: 'var(--primary)' }} />
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <p className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--on-surface)' }}>
              <Icon name="map" size={16} style={{ color: 'var(--primary)' }} />
              {t('itinerary.title')}
            </p>
            <button
              onClick={goToAgenda}
              className="btn-press text-xs font-semibold"
              style={{ color: 'var(--primary)' }}
            >
              {t('itinerary.context_card_see_agenda')}
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--on-surface-dim)' }}>
            {summary.totalCities} {t('itinerary.cities')} · {summary.totalDays} {t('itinerary.days')}
          </p>
        </div>
      )}
    </div>
  );
}
