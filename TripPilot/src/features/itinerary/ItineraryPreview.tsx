import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import type { ItineraryLeg } from '@/domain/types/itinerary-leg';
import type { SuggestedPhase } from '@/domain/itinerary/itinerary-domain';

const TRANSPORT_EMOJI: Record<string, string> = {
  flight: '✈️',
  train: '🚂',
  bus: '🚌',
  car: '🚗',
  ferry: '⛴️',
  walk: '🚶',
  other: '🚐',
};

const BOOKING_LABEL: Record<string, string> = {
  purchased: '✅',
  booked: '📋',
  priced: '💰',
  estimated: '❓',
  none: '',
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wide">
          {t('itinerary.preview_legs', { count: legs.length })}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {legs.map((leg) => {
          const expanded = expandedLeg === leg.id;
          return (
            <button
              key={leg.id}
              onClick={() => setExpandedLeg(expanded ? null : leg.id)}
              className="btn-press w-full text-left p-3 rounded-xl bg-surface-high"
            >
              <div className="flex items-center gap-2">
                {leg.arrivalTransport && (
                  <span className="text-base">{TRANSPORT_EMOJI[leg.arrivalTransport.type] ?? '🚐'}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-on-surface text-sm truncate">
                    {leg.cityName}
                    {leg.countryCode && <span className="text-on-surface-faint"> ({leg.countryCode})</span>}
                  </p>
                  <p className="text-xs text-on-surface-dim mt-0.5">
                    {leg.arrivalDate === leg.departureDate
                      ? leg.arrivalDate
                      : `${leg.arrivalDate} → ${leg.departureDate}`}
                    {leg.arrivalTime && ` · ${leg.arrivalTime}`}
                  </p>
                </div>
                <Icon name={expanded ? 'expand_less' : 'expand_more'} size={20} className="text-on-surface-faint" />
              </div>

              {expanded && (
                <div className="mt-3 pt-3 border-t border-outline/10 flex flex-col gap-2 text-xs text-on-surface-dim">
                  {leg.arrivalTransport && (
                    <div className="flex items-start gap-2">
                      <span>{TRANSPORT_EMOJI[leg.arrivalTransport.type]}</span>
                      <div>
                        <p className="font-medium text-on-surface">
                          {leg.arrivalTransport.route ?? t('itinerary.transport')}
                          {' '}{BOOKING_LABEL[leg.arrivalTransport.bookingStatus]}
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

                  {leg.accommodation && (
                    <div className="flex items-start gap-2">
                      <span>🏠</span>
                      <div>
                        <p className="font-medium text-on-surface">
                          {leg.accommodation.name}
                          {' '}{BOOKING_LABEL[leg.accommodation.bookingStatus]}
                        </p>
                        <p>{leg.accommodation.nights} {t('itinerary.nights')} · {leg.accommodation.type}</p>
                        {leg.accommodation.costCents !== null && leg.accommodation.costCurrency && (
                          <p className={leg.accommodation.isPrepaid ? 'text-success' : ''}>
                            {(leg.accommodation.costCents / 100).toFixed(2)} {leg.accommodation.costCurrency}
                            {leg.accommodation.isPrepaid && ` (${t('itinerary.prepaid')})`}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {leg.highlights.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span>⭐</span>
                      <p>{leg.highlights.join(', ')}</p>
                    </div>
                  )}

                  {leg.companions.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span>👥</span>
                      <p>{leg.companions.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {suggestedPhases.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wide mb-2">
            {t('itinerary.suggested_phases')}
          </p>
          <div className="flex flex-col gap-1.5">
            {suggestedPhases.map((phase, i) => (
              <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-high/50">
                <span className="text-sm">📅</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate">{phase.name}</p>
                  <p className="text-xs text-on-surface-dim">{phase.startDate} → {phase.endDate}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onSave}
        className="btn-press w-full py-3.5 rounded-xl font-bold text-sm mt-2"
        style={{ background: 'var(--primary)', color: 'var(--surface)' }}
      >
        ✅ {t('itinerary.save_itinerary')}
      </button>
    </div>
  );
}
