import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { createSyncMetadata } from '@/utils/entity-factory';
import type {
  ItineraryLeg,
  TransportType,
  AccommodationType,
  DayType,
  BookingStatus,
} from '@/domain/types/itinerary-leg';

const TRANSPORT_TYPES: TransportType[] = ['flight', 'train', 'bus', 'car', 'ferry', 'walk', 'other'];
const TRANSPORT_TYPE_ICONS: Record<TransportType, string> = {
  flight: 'flight', train: 'train', bus: 'directions_bus',
  car: 'directions_car', ferry: 'directions_boat', walk: 'directions_walk', other: 'commute',
};
const ACCOMMODATION_TYPES: AccommodationType[] = ['hotel', 'hostel', 'apartment', 'friend', 'airbnb', 'camping', 'other'];
const DAY_TYPES: DayType[] = ['full', 'transit', 'festival', 'rest', 'day_trip'];
const DAY_TYPE_ICONS: Record<DayType, string> = {
  full: 'directions_run', transit: 'flight_takeoff', festival: 'celebration',
  rest: 'weekend', day_trip: 'hiking',
};
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

const INPUT_STYLE: React.CSSProperties = {
  background: 'var(--surface-container-high)',
  color: 'var(--on-surface)',
  border: '1px solid var(--on-surface-faint)',
};
const INPUT_CLASS = 'text-sm rounded-lg px-3 py-3 outline-none w-full transition-[border-color] duration-200 focus:border-[var(--primary)]';
const LABEL_CLASS = 'block font-mono text-[10px] uppercase tracking-[0.15em] mb-1';
const LABEL_STYLE: React.CSSProperties = { color: 'var(--on-surface-dim)' };
const SELECT_CLASS = 'text-sm rounded-lg px-3 py-3 outline-none w-full appearance-none transition-[border-color] duration-200 focus:border-[var(--primary)]';

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
      <div className="flex flex-col gap-0 pb-24" data-no-sheet-drag>
        {/* Header */}
        <div className="mb-6">
          <h1
            className="text-xl font-bold"
            style={{ color: 'var(--on-surface)' }}
          >
            {existing ? t('itinerary.edit_leg') : t('itinerary.add_leg')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--on-surface-dim)' }}>
            {t('itinerary.leg_form_subtitle')}
          </p>
        </div>

        {/* ═══ BASIC INFO SECTION ═══ */}
        <section
          className="rounded-xl p-4 mb-4 flex flex-col gap-4"
          style={{ background: 'var(--surface-container)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Icon name="location_on" size={20} filled style={{ color: 'var(--primary)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--on-surface)' }}>
              {t('itinerary.section_basic_info')}
            </h2>
          </div>

          {/* City + Country */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={LABEL_CLASS} style={LABEL_STYLE}>{t('itinerary.field_city')} *</label>
              <input
                type="text"
                value={cityName}
                onChange={(e) => setCityName(e.target.value)}
                placeholder="Roma"
                className={INPUT_CLASS}
                style={INPUT_STYLE}
              />
            </div>
            <div className="w-20">
              <label className={LABEL_CLASS} style={LABEL_STYLE}>{t('itinerary.field_country')}</label>
              <input
                type="text"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="IT"
                maxLength={2}
                className={INPUT_CLASS}
                style={INPUT_STYLE}
              />
            </div>
          </div>

          {/* Dates side-by-side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS} style={LABEL_STYLE}>{t('itinerary.field_arrival')} *</label>
              <input type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} className={INPUT_CLASS} style={INPUT_STYLE} />
            </div>
            <div>
              <label className={LABEL_CLASS} style={LABEL_STYLE}>{t('itinerary.field_departure')} *</label>
              <input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} className={INPUT_CLASS} style={INPUT_STYLE} />
            </div>
          </div>

          {/* Times side-by-side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS} style={LABEL_STYLE}>{t('itinerary.field_arrival_time')}</label>
              <input type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} className={INPUT_CLASS} style={INPUT_STYLE} />
            </div>
            <div>
              <label className={LABEL_CLASS} style={LABEL_STYLE}>{t('itinerary.field_departure_time')}</label>
              <input type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} className={INPUT_CLASS} style={INPUT_STYLE} />
            </div>
          </div>

          {/* Day type as chip selector */}
          <div>
            <label className={LABEL_CLASS} style={LABEL_STYLE}>{t('itinerary.field_day_type')}</label>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {DAY_TYPES.map((dt) => (
                <button
                  key={dt}
                  type="button"
                  onClick={() => setDayType(dt)}
                  className="btn-press flex items-center gap-1.5 px-3 py-2 rounded-full whitespace-nowrap transition-[background-color,border-color,color] duration-200"
                  style={{
                    border: dayType === dt
                      ? '1px solid var(--primary)'
                      : '1px solid var(--on-surface-faint)',
                    background: dayType === dt
                      ? 'color-mix(in srgb, var(--primary) 15%, transparent)'
                      : 'transparent',
                    color: dayType === dt
                      ? 'var(--primary)'
                      : 'var(--on-surface-dim)',
                  }}
                >
                  <Icon name={DAY_TYPE_ICONS[dt]} size={16} style={{ color: dayType === dt ? 'var(--primary)' : 'var(--on-surface-dim)' }} />
                  <span className="font-mono text-[10px] uppercase tracking-wider">
                    {t(`itinerary.day_type_${dt}` as never)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Companions */}
          <div>
            <label className={LABEL_CLASS} style={LABEL_STYLE}>{t('itinerary.field_companions')}</label>
            <input
              type="text"
              value={companions}
              onChange={(e) => setCompanions(e.target.value)}
              placeholder={t('itinerary.field_companions_hint')}
              className={INPUT_CLASS}
              style={INPUT_STYLE}
            />
          </div>
        </section>

        {/* ═══ TRANSPORT SECTION ═══ */}
        <section
          className="rounded-xl p-4 mb-4 flex flex-col gap-4"
          style={{ background: 'var(--surface-container)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Icon name="flight_takeoff" size={20} filled style={{ color: 'var(--ai)' }} />
              <h2 className="text-base font-semibold" style={{ color: 'var(--on-surface)' }}>
                {t('itinerary.transport')}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setHasTransport(!hasTransport)}
              className="btn-press relative w-10 h-5 rounded-full transition-[background-color] duration-200"
              style={{
                background: hasTransport ? 'var(--success)' : 'var(--surface-container-high)',
              }}
              role="switch"
              aria-checked={hasTransport}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full transition-[left] duration-200"
                style={{
                  background: 'var(--on-surface)',
                  left: hasTransport ? '22px' : '2px',
                }}
              />
            </button>
          </div>

          {hasTransport && (
            <div className="flex flex-col gap-4">
              {/* Transport type as icon grid */}
              <div>
                <label className={LABEL_CLASS} style={LABEL_STYLE}>{t('itinerary.field_transport_mode')}</label>
                <div className="grid grid-cols-4 gap-2">
                  {TRANSPORT_TYPES.filter((tt) => tt !== 'other').map((tt) => (
                    <button
                      key={tt}
                      type="button"
                      onClick={() => setTransportType(tt)}
                      className="btn-press flex flex-col items-center justify-center p-2.5 rounded-lg transition-[border-color,background-color] duration-200"
                      style={{
                        border: transportType === tt
                          ? '1px solid var(--ai)'
                          : '1px solid var(--on-surface-faint)',
                        background: transportType === tt
                          ? 'color-mix(in srgb, var(--ai) 12%, transparent)'
                          : 'transparent',
                        color: transportType === tt ? 'var(--ai)' : 'var(--on-surface-dim)',
                      }}
                    >
                      <Icon name={TRANSPORT_TYPE_ICONS[tt]} size={20} style={{ color: transportType === tt ? 'var(--ai)' : 'var(--on-surface-dim)' }} />
                      <span className="font-mono text-[9px] uppercase mt-1">{tt}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Company + Route */}
              <div>
                <label className={LABEL_CLASS} style={LABEL_STYLE}>{t('itinerary.field_company')}</label>
                <input type="text" value={transportCompany} onChange={(e) => setTransportCompany(e.target.value)} placeholder={t('itinerary.field_company')} className={INPUT_CLASS} style={INPUT_STYLE} />
              </div>
              <div>
                <label className={LABEL_CLASS} style={LABEL_STYLE}>{t('itinerary.field_route')}</label>
                <input type="text" value={transportRoute} onChange={(e) => setTransportRoute(e.target.value)} placeholder={t('itinerary.field_route')} className={`${INPUT_CLASS} font-mono uppercase`} style={INPUT_STYLE} />
              </div>

              {/* Cost */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={LABEL_CLASS} style={LABEL_STYLE}>{t('itinerary.field_cost')}</label>
                  <input type="number" inputMode="decimal" step="0.01" value={transportCost} onChange={(e) => setTransportCost(e.target.value)} placeholder="0.00" className={INPUT_CLASS} style={INPUT_STYLE} />
                </div>
                <div className="w-16">
                  <label className={LABEL_CLASS} style={LABEL_STYLE}>&nbsp;</label>
                  <input type="text" value={transportCurrency} onChange={(e) => setTransportCurrency(e.target.value.toUpperCase())} className={`${INPUT_CLASS} font-mono`} style={INPUT_STYLE} maxLength={3} />
                </div>
              </div>

              {/* Booking status + prepaid */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={LABEL_CLASS} style={LABEL_STYLE}>{t('itinerary.checklist_title')}</label>
                  <select value={transportBooking} onChange={(e) => setTransportBooking(e.target.value as BookingStatus)} className={SELECT_CLASS} style={INPUT_STYLE}>
                    {BOOKING_STATUSES.map((bs) => <option key={bs} value={bs}>{bs}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-1.5 text-xs self-end pb-3 shrink-0" style={{ color: 'var(--on-surface-dim)' }}>
                  <input type="checkbox" checked={transportPrepaid} onChange={(e) => setTransportPrepaid(e.target.checked)} />
                  {t('itinerary.prepaid')}
                </label>
              </div>
            </div>
          )}
        </section>

        {/* ═══ ACCOMMODATION SECTION ═══ */}
        <section
          className="rounded-xl p-4 mb-4 flex flex-col gap-4"
          style={{ background: 'var(--surface-container)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Icon name="hotel" size={20} filled style={{ color: 'var(--warning)' }} />
              <h2 className="text-base font-semibold" style={{ color: 'var(--on-surface)' }}>
                {t('itinerary.field_accommodation')}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setHasAccommodation(!hasAccommodation)}
              className="btn-press relative w-10 h-5 rounded-full transition-[background-color] duration-200"
              style={{
                background: hasAccommodation ? 'var(--success)' : 'var(--surface-container-high)',
              }}
              role="switch"
              aria-checked={hasAccommodation}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full transition-[left] duration-200"
                style={{
                  background: 'var(--on-surface)',
                  left: hasAccommodation ? '22px' : '2px',
                }}
              />
            </button>
          </div>

          {hasAccommodation && (
            <div className="flex flex-col gap-4">
              {/* Accommodation type chips */}
              <div>
                <label className={LABEL_CLASS} style={LABEL_STYLE}>{t('itinerary.field_accommodation_type')}</label>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {ACCOMMODATION_TYPES.filter((at) => ['hotel', 'hostel', 'apartment', 'airbnb'].includes(at)).map((at) => (
                    <button
                      key={at}
                      type="button"
                      onClick={() => setAccommodationType(at)}
                      className="btn-press flex items-center gap-1.5 px-3 py-2 rounded-full whitespace-nowrap transition-[border-color,background-color] duration-200"
                      style={{
                        border: accommodationType === at
                          ? '1px solid var(--warning)'
                          : '1px solid var(--on-surface-faint)',
                        background: accommodationType === at
                          ? 'color-mix(in srgb, var(--warning) 12%, transparent)'
                          : 'transparent',
                        color: accommodationType === at
                          ? 'var(--warning)'
                          : 'var(--on-surface-dim)',
                      }}
                    >
                      <span className="font-mono text-[10px] uppercase tracking-wider">{at}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className={LABEL_CLASS} style={LABEL_STYLE}>{t('itinerary.field_accommodation_name')}</label>
                <input type="text" value={accommodationName} onChange={(e) => setAccommodationName(e.target.value)} placeholder={t('itinerary.field_accommodation_name')} className={INPUT_CLASS} style={INPUT_STYLE} />
              </div>

              {/* Cost + Currency */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={LABEL_CLASS} style={LABEL_STYLE}>{t('itinerary.field_cost')}</label>
                  <input type="number" inputMode="decimal" step="0.01" value={accommodationCost} onChange={(e) => setAccommodationCost(e.target.value)} placeholder="0.00" className={INPUT_CLASS} style={INPUT_STYLE} />
                </div>
                <div className="w-16">
                  <label className={LABEL_CLASS} style={LABEL_STYLE}>&nbsp;</label>
                  <input type="text" value={accommodationCurrency} onChange={(e) => setAccommodationCurrency(e.target.value.toUpperCase())} className={`${INPUT_CLASS} font-mono`} style={INPUT_STYLE} maxLength={3} />
                </div>
              </div>

              {/* Nights */}
              <div className="flex items-center gap-3">
                <div className="w-20">
                  <label className={LABEL_CLASS} style={LABEL_STYLE}>{t('itinerary.nights')}</label>
                  <input type="number" inputMode="numeric" value={accommodationNights} onChange={(e) => setAccommodationNights(e.target.value)} className={INPUT_CLASS} style={INPUT_STYLE} min={1} />
                </div>
                <span className="text-xs self-end pb-3" style={{ color: 'var(--on-surface-dim)' }}>{t('itinerary.nights')}</span>
              </div>

              {/* Booking + prepaid */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={LABEL_CLASS} style={LABEL_STYLE}>{t('itinerary.checklist_title')}</label>
                  <select value={accommodationBooking} onChange={(e) => setAccommodationBooking(e.target.value as BookingStatus)} className={SELECT_CLASS} style={INPUT_STYLE}>
                    {BOOKING_STATUSES.map((bs) => <option key={bs} value={bs}>{bs}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-1.5 text-xs self-end pb-3 shrink-0" style={{ color: 'var(--on-surface-dim)' }}>
                  <input type="checkbox" checked={accommodationPrepaid} onChange={(e) => setAccommodationPrepaid(e.target.checked)} />
                  {t('itinerary.prepaid')}
                </label>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ═══ STICKY FOOTER (3 buttons) ═══ */}
      <div
        className="sticky bottom-0 left-0 right-0 p-4 flex items-center justify-between z-20"
        style={{
          background: 'var(--surface-container-high)',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <div>
          {existing && onDelete && (
            <button
              onClick={() => { onDelete(); onClose(); }}
              className="btn-press px-4 py-3 rounded-xl font-mono text-[11px] uppercase tracking-[0.1em] font-medium flex items-center gap-2 transition-[background-color] duration-200"
              style={{
                border: '1px solid color-mix(in srgb, var(--error) 30%, transparent)',
                color: 'var(--error)',
                background: 'transparent',
              }}
            >
              <Icon name="delete" size={16} style={{ color: 'var(--error)' }} />
              {t('common.delete')}
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="btn-press px-5 py-3 rounded-xl font-mono text-[11px] uppercase tracking-[0.1em] transition-[color] duration-200"
            style={{ color: 'var(--on-surface-dim)' }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="btn-press px-6 py-3 rounded-xl font-mono text-[11px] uppercase tracking-[0.1em] font-bold disabled:opacity-40 transition-[background-color] duration-200"
            style={{
              background: 'var(--primary)',
              color: '#fff',
            }}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
