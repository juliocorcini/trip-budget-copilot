import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db/database';
import { getCurrentLeg, getNextTransport, getTripSummary, getDayAgenda, getDayTypeStyle, getLegSpend } from '@/domain/itinerary/itinerary-domain';
import { localDateString } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { useGpsLegDetect } from './useGpsLegDetect';
import type { ItineraryLeg } from '@/domain/types/itinerary-leg';

const TRANSPORT_EMOJI: Record<string, string> = {
  flight: '✈️', train: '🚂', bus: '🚌', car: '🚗', ferry: '⛴️', walk: '🚶', other: '🚐',
};

const LS_KEY = 'itinerary_card_expanded';

function readExpanded(): boolean {
  try { return localStorage.getItem(LS_KEY) === '1'; } catch { return false; }
}
function writeExpanded(v: boolean) {
  try { localStorage.setItem(LS_KEY, v ? '1' : '0'); } catch { /* noop */ }
}

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
  const [expanded, setExpanded] = useState(readExpanded);

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

  if (legs.length === 0) return null;

  const dayNumber = currentLeg
    ? Math.floor(
        (new Date(today).getTime() - new Date(legs[0]!.arrivalDate).getTime()) /
          (1000 * 60 * 60 * 24),
      ) + 1
    : null;

  const toggleExpanded = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !expanded;
    setExpanded(next);
    writeExpanded(next);
  };

  const goToAgenda = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('/itinerary');
  };

  return (
    <div
      onClick={toggleExpanded}
      className="w-full text-left p-4 rounded-2xl bg-surface-high mt-3 btn-press cursor-pointer"
    >
      {currentLeg ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-bold text-on-surface">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${getDayTypeStyle(currentLeg.dayType).dot} mr-1.5 align-middle`} />
            {gpsOverride && <span className="text-primary mr-1 align-middle text-xs">📍</span>}
            {currentLeg.cityName}
            {dayNumber !== null && summary.totalDays > 0 && (
              <span className="text-on-surface-dim font-normal">
                {' '}· {t('itinerary.context_card_day', { current: dayNumber, total: summary.totalDays })}
              </span>
            )}
          </p>

          {nextTransport && (
            <p className="text-xs text-on-surface-dim">
              {TRANSPORT_EMOJI[nextTransport.transportType] ?? '🚐'}{' '}
              {nextTransport.time ?? ''} → {nextTransport.destination}
            </p>
          )}

          {currentLeg.accommodation && (
            <p className="text-xs text-on-surface-faint">
              🏠 {currentLeg.accommodation.name}
            </p>
          )}

          {expanded && (
            <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-on-surface-faint/10">
              {dayAgenda.slice(0, 5).map((item, idx) => (
                <p key={idx} className="text-xs text-on-surface-dim flex items-center gap-1.5">
                  <span className="text-on-surface-faint w-10 shrink-0 text-right tabular">
                    {item.time ?? ''}
                  </span>
                  <span className="truncate">{item.label}</span>
                </p>
              ))}
              {dayAgenda.length > 5 && (
                <p className="text-[10px] text-on-surface-faint ml-[46px]">
                  +{dayAgenda.length - 5} {t('itinerary.more_items')}
                </p>
              )}

              {legSpend && baseCurrency && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-surface-container overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${
                        (legSpend.percent ?? 0) > 90
                          ? 'bg-error'
                          : (legSpend.percent ?? 0) > 70
                            ? 'bg-warning'
                            : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(legSpend.percent ?? 0, 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] tabular text-on-surface-dim shrink-0">
                    {formatMoney(legSpend.totalSpentCents, baseCurrency)}
                    {legSpend.budgetCents !== null && ` / ${formatMoney(legSpend.budgetCents, baseCurrency)}`}
                  </span>
                </div>
              )}
            </div>
          )}

          <button
            onClick={goToAgenda}
            className="text-xs text-primary font-semibold mt-1 text-left btn-press"
          >
            {t('itinerary.context_card_see_agenda')}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold text-on-surface">🗺️ {t('itinerary.title')}</p>
          <p className="text-xs text-on-surface-dim">
            {summary.totalCities} {t('itinerary.cities')} · {summary.totalDays} {t('itinerary.days')}
          </p>
          <button
            onClick={goToAgenda}
            className="text-xs text-primary font-semibold mt-1 text-left btn-press"
          >
            {t('itinerary.context_card_see_agenda')}
          </button>
        </div>
      )}
    </div>
  );
}
