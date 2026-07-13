import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/BottomSheet';
import { createSyncMetadata } from '@/utils/entity-factory';
import type {
  ItineraryLeg,
  TransportType,
  AccommodationType,
  DayType,
  BookingStatus,
} from '@/domain/types/itinerary-leg';

const TRANSPORT_TYPES: TransportType[] = ['flight', 'train', 'bus', 'car', 'ferry', 'walk', 'other'];
const ACCOMMODATION_TYPES: AccommodationType[] = ['hotel', 'hostel', 'apartment', 'friend', 'airbnb', 'camping', 'other'];
const DAY_TYPES: DayType[] = ['full', 'transit', 'festival', 'rest', 'day_trip'];
const BOOKING_STATUSES: BookingStatus[] = ['purchased', 'booked', 'priced', 'estimated', 'none'];

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (leg: ItineraryLeg) => void;
  onDelete?: () => void;
  tripId: string;
  nextOrder: number;
  existing?: ItineraryLeg | null;
}

const INPUT_CLASS = 'bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2.5 outline-none w-full';
const LABEL_CLASS = 'text-xs font-semibold text-on-surface-dim mb-1';
const SELECT_CLASS = 'bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2.5 outline-none w-full appearance-none';

export function LegFormSheet({ open, onClose, onSave, onDelete, tripId, nextOrder, existing }: Props) {
  const { t } = useTranslation();

  const [cityName, setCityName] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [dayType, setDayType] = useState<DayType>('full');
  const [companions, setCompanions] = useState('');

  const [hasTransport, setHasTransport] = useState(false);
  const [transportType, setTransportType] = useState<TransportType>('train');
  const [transportCompany, setTransportCompany] = useState('');
  const [transportRoute, setTransportRoute] = useState('');
  const [transportBooking, setTransportBooking] = useState<BookingStatus>('none');
  const [transportCost, setTransportCost] = useState('');
  const [transportCurrency, setTransportCurrency] = useState('EUR');
  const [transportPrepaid, setTransportPrepaid] = useState(false);

  const [hasAccommodation, setHasAccommodation] = useState(false);
  const [accommodationName, setAccommodationName] = useState('');
  const [accommodationType, setAccommodationType] = useState<AccommodationType>('hostel');
  const [accommodationBooking, setAccommodationBooking] = useState<BookingStatus>('none');
  const [accommodationCost, setAccommodationCost] = useState('');
  const [accommodationCurrency, setAccommodationCurrency] = useState('EUR');
  const [accommodationNights, setAccommodationNights] = useState('1');
  const [accommodationPrepaid, setAccommodationPrepaid] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setCityName(existing.cityName);
      setCountryCode(existing.countryCode ?? '');
      setArrivalDate(existing.arrivalDate);
      setDepartureDate(existing.departureDate);
      setArrivalTime(existing.arrivalTime ?? '');
      setDepartureTime(existing.departureTime ?? '');
      setDayType(existing.dayType);
      setCompanions(existing.companions.join(', '));

      if (existing.arrivalTransport) {
        setHasTransport(true);
        setTransportType(existing.arrivalTransport.type);
        setTransportCompany(existing.arrivalTransport.company ?? '');
        setTransportRoute(existing.arrivalTransport.route ?? '');
        setTransportBooking(existing.arrivalTransport.bookingStatus);
        setTransportCost(existing.arrivalTransport.costCents ? String(existing.arrivalTransport.costCents / 100) : '');
        setTransportCurrency(existing.arrivalTransport.costCurrency ?? 'EUR');
        setTransportPrepaid(existing.arrivalTransport.isPrepaid);
      } else {
        setHasTransport(false);
      }

      if (existing.accommodation) {
        setHasAccommodation(true);
        setAccommodationName(existing.accommodation.name);
        setAccommodationType(existing.accommodation.type);
        setAccommodationBooking(existing.accommodation.bookingStatus);
        setAccommodationCost(existing.accommodation.costCents ? String(existing.accommodation.costCents / 100) : '');
        setAccommodationCurrency(existing.accommodation.costCurrency ?? 'EUR');
        setAccommodationNights(String(existing.accommodation.nights));
        setAccommodationPrepaid(existing.accommodation.isPrepaid);
      } else {
        setHasAccommodation(false);
      }
    } else {
      setCityName('');
      setCountryCode('');
      setArrivalDate('');
      setDepartureDate('');
      setArrivalTime('');
      setDepartureTime('');
      setDayType('full');
      setCompanions('');
      setHasTransport(false);
      setTransportType('train');
      setTransportCompany('');
      setTransportRoute('');
      setTransportBooking('none');
      setTransportCost('');
      setTransportCurrency('EUR');
      setTransportPrepaid(false);
      setHasAccommodation(false);
      setAccommodationName('');
      setAccommodationType('hostel');
      setAccommodationBooking('none');
      setAccommodationCost('');
      setAccommodationCurrency('EUR');
      setAccommodationNights('1');
      setAccommodationPrepaid(false);
    }
  }, [open, existing]);

  const isValid = cityName.trim() !== '' && arrivalDate !== '' && departureDate !== '';

  function handleSave() {
    if (!isValid) return;

    const costCents = (v: string) => {
      const n = parseFloat(v);
      return isNaN(n) ? null : Math.round(n * 100);
    };

    const meta = existing
      ? { ...existing, updatedAt: new Date().toISOString(), revision: existing.revision + 1 }
      : createSyncMetadata();

    const leg: ItineraryLeg = {
      ...meta,
      tripId,
      order: existing?.order ?? nextOrder,
      cityName: cityName.trim(),
      countryCode: countryCode.trim() || null,
      arrivalDate,
      arrivalTime: arrivalTime || null,
      departureDate,
      departureTime: departureTime || null,
      arrivalTransport: hasTransport
        ? {
            type: transportType,
            company: transportCompany.trim() || null,
            route: transportRoute.trim() || null,
            bookingStatus: transportBooking,
            costCents: costCents(transportCost),
            costCurrency: transportCost ? transportCurrency : null,
            isPrepaid: transportPrepaid,
            reference: null,
            notes: null,
          }
        : null,
      accommodation: hasAccommodation
        ? {
            name: accommodationName.trim() || cityName.trim(),
            type: accommodationType,
            bookingStatus: accommodationBooking,
            costCents: costCents(accommodationCost),
            costCurrency: accommodationCost ? accommodationCurrency : null,
            isPrepaid: accommodationPrepaid,
            nights: parseInt(accommodationNights) || 1,
            reference: null,
            notes: null,
          }
        : null,
      dailyBudgetCents: null,
      dailyBudgetCurrency: null,
      budgetPremise: null,
      companions: companions
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      dayType,
      highlights: existing?.highlights ?? [],
      linkedPhaseId: existing?.linkedPhaseId ?? null,
      personalNotes: existing?.personalNotes ?? null,
    };

    onSave(leg);
    onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={existing ? t('itinerary.edit_leg') : t('itinerary.add_leg')}>
      <div className="flex flex-col gap-4 pb-2" data-no-sheet-drag>
        {/* City + Country */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className={LABEL_CLASS}>{t('itinerary.field_city')} *</label>
            <input
              type="text"
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              placeholder="Roma"
              className={INPUT_CLASS}
            />
          </div>
          <div className="w-20">
            <label className={LABEL_CLASS}>{t('itinerary.field_country')}</label>
            <input
              type="text"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="IT"
              maxLength={2}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {/* Dates */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className={LABEL_CLASS}>{t('itinerary.field_arrival')} *</label>
            <input type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} className={INPUT_CLASS} />
          </div>
          <div className="flex-1">
            <label className={LABEL_CLASS}>{t('itinerary.field_departure')} *</label>
            <input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} className={INPUT_CLASS} />
          </div>
        </div>

        {/* Times */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className={LABEL_CLASS}>{t('itinerary.field_arrival_time')}</label>
            <input type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} className={INPUT_CLASS} />
          </div>
          <div className="flex-1">
            <label className={LABEL_CLASS}>{t('itinerary.field_departure_time')}</label>
            <input type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} className={INPUT_CLASS} />
          </div>
        </div>

        {/* Day type */}
        <div>
          <label className={LABEL_CLASS}>{t('itinerary.field_day_type')}</label>
          <select value={dayType} onChange={(e) => setDayType(e.target.value as DayType)} className={SELECT_CLASS}>
            {DAY_TYPES.map((dt) => (
              <option key={dt} value={dt}>{t(`itinerary.day_type_${dt}` as never)}</option>
            ))}
          </select>
        </div>

        {/* Companions */}
        <div>
          <label className={LABEL_CLASS}>{t('itinerary.field_companions')}</label>
          <input
            type="text"
            value={companions}
            onChange={(e) => setCompanions(e.target.value)}
            placeholder={t('itinerary.field_companions_hint')}
            className={INPUT_CLASS}
          />
        </div>

        {/* Transport toggle */}
        <button
          onClick={() => setHasTransport(!hasTransport)}
          className="flex items-center gap-2 py-2 text-sm font-semibold text-primary btn-press"
        >
          {hasTransport ? '▼' : '▶'} 🚂 {t('itinerary.transport')}
        </button>
        {hasTransport && (
          <div className="flex flex-col gap-3 pl-2 border-l-2" style={{ borderColor: 'var(--border-faint)' }}>
            <select value={transportType} onChange={(e) => setTransportType(e.target.value as TransportType)} className={SELECT_CLASS}>
              {TRANSPORT_TYPES.map((tt) => (
                <option key={tt} value={tt}>{tt}</option>
              ))}
            </select>
            <input type="text" value={transportCompany} onChange={(e) => setTransportCompany(e.target.value)} placeholder={t('itinerary.field_company')} className={INPUT_CLASS} />
            <input type="text" value={transportRoute} onChange={(e) => setTransportRoute(e.target.value)} placeholder={t('itinerary.field_route')} className={INPUT_CLASS} />
            <div className="flex gap-2">
              <input type="number" inputMode="decimal" step="0.01" value={transportCost} onChange={(e) => setTransportCost(e.target.value)} placeholder={t('itinerary.field_cost')} className={`${INPUT_CLASS} flex-1`} />
              <input type="text" value={transportCurrency} onChange={(e) => setTransportCurrency(e.target.value.toUpperCase())} className={`${INPUT_CLASS} w-16`} maxLength={3} />
            </div>
            <div className="flex gap-4">
              <select value={transportBooking} onChange={(e) => setTransportBooking(e.target.value as BookingStatus)} className={`${SELECT_CLASS} flex-1`}>
                {BOOKING_STATUSES.map((bs) => <option key={bs} value={bs}>{bs}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-on-surface-dim">
                <input type="checkbox" checked={transportPrepaid} onChange={(e) => setTransportPrepaid(e.target.checked)} />
                {t('itinerary.prepaid')}
              </label>
            </div>
          </div>
        )}

        {/* Accommodation toggle */}
        <button
          onClick={() => setHasAccommodation(!hasAccommodation)}
          className="flex items-center gap-2 py-2 text-sm font-semibold text-primary btn-press"
        >
          {hasAccommodation ? '▼' : '▶'} 🏠 {t('itinerary.field_accommodation')}
        </button>
        {hasAccommodation && (
          <div className="flex flex-col gap-3 pl-2 border-l-2" style={{ borderColor: 'var(--border-faint)' }}>
            <input type="text" value={accommodationName} onChange={(e) => setAccommodationName(e.target.value)} placeholder={t('itinerary.field_accommodation_name')} className={INPUT_CLASS} />
            <select value={accommodationType} onChange={(e) => setAccommodationType(e.target.value as AccommodationType)} className={SELECT_CLASS}>
              {ACCOMMODATION_TYPES.map((at) => <option key={at} value={at}>{at}</option>)}
            </select>
            <div className="flex gap-2">
              <input type="number" inputMode="decimal" step="0.01" value={accommodationCost} onChange={(e) => setAccommodationCost(e.target.value)} placeholder={t('itinerary.field_cost')} className={`${INPUT_CLASS} flex-1`} />
              <input type="text" value={accommodationCurrency} onChange={(e) => setAccommodationCurrency(e.target.value.toUpperCase())} className={`${INPUT_CLASS} w-16`} maxLength={3} />
            </div>
            <div className="flex gap-2">
              <input type="number" inputMode="numeric" value={accommodationNights} onChange={(e) => setAccommodationNights(e.target.value)} placeholder={t('itinerary.nights')} className={`${INPUT_CLASS} w-20`} min={1} />
              <span className="self-center text-xs text-on-surface-dim">{t('itinerary.nights')}</span>
            </div>
            <div className="flex gap-4">
              <select value={accommodationBooking} onChange={(e) => setAccommodationBooking(e.target.value as BookingStatus)} className={`${SELECT_CLASS} flex-1`}>
                {BOOKING_STATUSES.map((bs) => <option key={bs} value={bs}>{bs}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-on-surface-dim">
                <input type="checkbox" checked={accommodationPrepaid} onChange={(e) => setAccommodationPrepaid(e.target.checked)} />
                {t('itinerary.prepaid')}
              </label>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-2">
          {existing && onDelete && (
            <button
              onClick={() => { onDelete(); onClose(); }}
              className="py-3 px-4 rounded-xl text-sm font-semibold btn-press"
              style={{ background: 'var(--danger)', color: 'var(--surface)' }}
            >
              {t('common.delete')}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="flex-1 py-3 rounded-xl text-sm font-semibold btn-press disabled:opacity-40"
            style={{ background: 'var(--primary)', color: 'var(--surface)' }}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
