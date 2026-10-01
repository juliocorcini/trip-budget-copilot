import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import type { ItineraryLeg } from '@/domain/types/itinerary-leg';
import type { SuggestedPhase } from '@/domain/itinerary/itinerary-domain';

const TRANSPORT_ICON: Record<string, string> = {
  flight: 'flight', train: 'train', bus: 'directions_bus',
  car: 'directions_car', ferry: 'directions_boat', walk: 'directions_walk', other: 'commute',
};

const ACCOMMODATION_ICON: Record<string, string> = {
  hotel: 'hotel', hostel: 'bed', apartment: 'apartment',
  airbnb: 'house', camping: 'camping', other: 'night_shelter',
};

interface Props {
  legs: ItineraryLeg[];
  suggestedPhases: SuggestedPhase[];
  tripId: string;
  onSave: () => void;
}

export function ItineraryPreview({ legs, suggestedPhases, onSave }: Props) {
  const { t } = useTranslation();
  const [expandedLeg, setExpandedLeg] = useState<string | null>(null);

  const totalDays = (() => {
    if (legs.length === 0) return 0;
    const first = new Date(legs[0]!.arrivalDate + 'T12:00:00');
    const last = new Date(legs[legs.length - 1]!.departureDate + 'T12:00:00');
    return Math.max(1, Math.floor((last.getTime() - first.getTime()) / 86400000) + 1);
  })();
  const totalCities = new Set(legs.map((l) => l.cityName.toLowerCase().trim())).size;
  const totalCountries = new Set(legs.filter((l) => l.countryCode).map((l) => l.countryCode!.toUpperCase())).size;

  function computeDayRange(leg: ItineraryLeg): string {
    const first = new Date(legs[0]!.arrivalDate + 'T12:00:00');
    const start = new Date(leg.arrivalDate + 'T12:00:00');
    const end = new Date(leg.departureDate + 'T12:00:00');
    const dayStart = Math.floor((start.getTime() - first.getTime()) / 86400000) + 1;
    const dayEnd = Math.floor((end.getTime() - first.getTime()) / 86400000) + 1;
    return dayEnd > dayStart ? `${dayStart}-${dayEnd}` : `${dayStart}`;
  }

  function formatDateMono(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary header */}
      <div className="text-center">
        <p className="text-sm" style={{ color: 'var(--on-surface-dim)' }}>
          {totalDays} {t('itinerary.days')}, {totalCities} {t('itinerary.cities')}
          {totalCountries > 0 && `, ${totalCountries} ${t('itinerary.countries')}`}
        </p>
      </div>

      {/* City cards */}
      <div className="flex flex-col gap-0">
        {legs.map((leg, idx) => {
          const expanded = expandedLeg === leg.id;
          const daysLabel = computeDayRange(leg);
          const dateRange = `${formatDateMono(leg.arrivalDate)} - ${formatDateMono(leg.departureDate)} · ${daysLabel} ${t('itinerary.days').toUpperCase()}`;

          return (
            <div key={leg.id}>
              {/* Transport connector between cities */}
              {idx > 0 && legs[idx - 1]?.arrivalTransport && (
                <div
                  className="flex items-center gap-3 py-2 px-4"
                  style={{ color: 'var(--on-surface-dim)' }}
                >
                  <div
                    className="w-0.5 h-4 ml-3"
                    style={{ background: 'var(--border-subtle)' }}
                  />
                  <Icon
                    name={TRANSPORT_ICON[legs[idx - 1]!.arrivalTransport!.type] ?? 'commute'}
                    size={16}
                    style={{ color: 'var(--on-surface-dim)' }}
                  />
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em]">
                    {legs[idx - 1]!.arrivalTransport!.company ?? legs[idx - 1]!.arrivalTransport!.route ?? t('itinerary.transport')}
                  </span>
                </div>
              )}

              {/* City card */}
              <button
                onClick={() => setExpandedLeg(expanded ? null : leg.id)}
                className="btn-press w-full text-left p-4 rounded-xl relative overflow-hidden"
                style={{
                  background: 'var(--surface-container)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {/* Left accent bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{ background: 'var(--primary)' }}
                />

                {/* Header with city + dates */}
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--on-surface)' }}>
                      {leg.cityName}{leg.countryCode ? `, ${leg.countryCode}` : ''}
                    </h3>
                    <p
                      className="font-mono text-[10px] uppercase tracking-[0.1em] mt-0.5"
                      style={{ color: 'var(--on-surface-dim)' }}
                    >
                      {dateRange}
                    </p>
                  </div>
                  <Icon
                    name={expanded ? 'expand_less' : 'expand_more'}
                    size={20}
                    style={{ color: 'var(--on-surface-faint)' }}
                  />
                </div>

                {/* Accommodation sub-card */}
                {leg.accommodation && (
                  <div
                    className="flex items-center gap-3 p-3 rounded-lg mt-2"
                    style={{
                      background: 'var(--surface-container-high)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <Icon
                      name={ACCOMMODATION_ICON[leg.accommodation.type] ?? 'hotel'}
                      size={18}
                      style={{ color: 'var(--on-surface-dim)' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--on-surface)' }}>
                        {leg.accommodation.name}
                      </p>
                      <p
                        className="font-mono text-[10px] mt-0.5"
                        style={{ color: 'var(--on-surface-dim)' }}
                      >
                        Check-in: {leg.arrivalTime ?? '—'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Expanded details */}
                {expanded && (
                  <div
                    className="mt-3 pt-3 flex flex-col gap-2"
                    style={{ borderTop: '1px solid var(--border-subtle)' }}
                  >
                    {leg.arrivalTransport && (
                      <div className="flex items-start gap-3">
                        <Icon
                          name={TRANSPORT_ICON[leg.arrivalTransport.type] ?? 'commute'}
                          size={16}
                          style={{ color: 'var(--on-surface-dim)' }}
                        />
                        <div className="flex-1 text-xs" style={{ color: 'var(--on-surface-dim)' }}>
                          <p className="font-medium" style={{ color: 'var(--on-surface)' }}>
                            {leg.arrivalTransport.route ?? t('itinerary.transport')}
                          </p>
                          {leg.arrivalTransport.company && <p>{leg.arrivalTransport.company}</p>}
                          {leg.arrivalTransport.costCents !== null && leg.arrivalTransport.costCurrency && (
                            <p className={leg.arrivalTransport.isPrepaid ? 'text-success' : ''}>
                              {(leg.arrivalTransport.costCents / 100).toFixed(2)} {leg.arrivalTransport.costCurrency}
                              {leg.arrivalTransport.isPrepaid && ` (${t('itinerary.prepaid')})`}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {leg.highlights.length > 0 && (
                      <div className="flex items-start gap-3">
                        <Icon name="star" size={16} style={{ color: 'var(--warning)' }} />
                        <p className="text-xs" style={{ color: 'var(--on-surface-dim)' }}>
                          {leg.highlights.join(', ')}
                        </p>
                      </div>
                    )}

                    {leg.companions.length > 0 && (
                      <div className="flex items-start gap-3">
                        <Icon name="group" size={16} style={{ color: 'var(--on-surface-dim)' }} />
                        <p className="text-xs" style={{ color: 'var(--on-surface-dim)' }}>
                          {leg.companions.join(', ')}
                        </p>
                      </div>
                    )}

                    {leg.budgetPremise && (
                      <div className="flex items-start gap-3">
                        <Icon name="lightbulb" size={16} style={{ color: 'var(--secondary)' }} />
                        <p className="text-xs" style={{ color: 'var(--on-surface-dim)' }}>
                          {leg.budgetPremise}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Suggested phases */}
      {suggestedPhases.length > 0 && (
        <div>
          <p
            className="font-mono text-[10px] uppercase tracking-[0.15em] font-bold mb-2 px-1"
            style={{ color: 'var(--on-surface-dim)' }}
          >
            {t('itinerary.suggested_phases')}
          </p>
          <div className="flex flex-col gap-1.5">
            {suggestedPhases.map((phase, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{
                  background: 'var(--surface-container)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <Icon name="date_range" size={18} style={{ color: 'var(--primary)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--on-surface)' }}>
                    {phase.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--on-surface-dim)' }}>
                    {phase.startDate} → {phase.endDate}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save button */}
      <button
        onClick={onSave}
        className="btn-press w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 mt-2"
        style={{ background: 'var(--primary)', color: '#fff' }}
      >
        {t('itinerary.save_itinerary')}
        <Icon name="check_circle" size={18} style={{ color: '#fff' }} />
      </button>
    </div>
  );
}
