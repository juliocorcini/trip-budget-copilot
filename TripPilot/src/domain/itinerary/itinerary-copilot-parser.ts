import { v4 as uuidv4 } from 'uuid';
import type {
  ItineraryLeg,
  TransportType,
  BookingStatus,
  DayType,
  AccommodationType,
  ArrivalTransport,
  LegAccommodation,
} from '@/domain/types/itinerary-leg';
import { createSyncMetadata } from '@/utils/entity-factory';

const VALID_TRANSPORT_TYPES: TransportType[] = ['flight', 'train', 'bus', 'car', 'ferry', 'walk', 'other'];
const VALID_BOOKING_STATUSES: BookingStatus[] = ['purchased', 'booked', 'priced', 'estimated', 'none'];
const VALID_DAY_TYPES: DayType[] = ['full', 'transit', 'festival', 'rest', 'day_trip'];
const VALID_ACCOMMODATION_TYPES: AccommodationType[] = ['hotel', 'hostel', 'apartment', 'friend', 'airbnb', 'camping', 'other'];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export interface ParsedBuildResponse {
  legs: ItineraryLeg[];
  suggestedPhases: Array<{ name: string; startDate: string; endDate: string }>;
  summary: string;
}

export interface ParsedRefineResponse {
  legs: ItineraryLeg[];
  changes: string[];
}

function coerceString(val: unknown): string | null {
  if (typeof val === 'string' && val.trim().length > 0) return val.trim();
  return null;
}

function coerceInt(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return Math.round(val);
  if (typeof val === 'string') {
    const n = Number(val);
    if (Number.isFinite(n)) return Math.round(n);
  }
  return null;
}

function coerceBoolean(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (val === 'true' || val === 1) return true;
  return false;
}

function coerceStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((v) => typeof v === 'string' && v.trim().length > 0).map((v) => (v as string).trim());
}

function coerceDate(val: unknown): string | null {
  const s = coerceString(val);
  if (!s) return null;
  if (ISO_DATE_RE.test(s)) return s;
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function coerceTime(val: unknown): string | null {
  const s = coerceString(val);
  if (!s) return null;
  if (TIME_RE.test(s)) return s;
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (m) return `${m[1]!.padStart(2, '0')}:${m[2]}`;
  return null;
}

function coerceEnum<T extends string>(val: unknown, valid: T[], fallback: T): T {
  const s = coerceString(val);
  if (s && valid.includes(s as T)) return s as T;
  return fallback;
}

function parseTransport(raw: unknown): ArrivalTransport | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  return {
    type: coerceEnum(obj.type, VALID_TRANSPORT_TYPES, 'other'),
    company: coerceString(obj.company),
    route: coerceString(obj.route),
    bookingStatus: coerceEnum(obj.bookingStatus, VALID_BOOKING_STATUSES, 'estimated'),
    costCents: coerceInt(obj.costCents),
    costCurrency: coerceString(obj.costCurrency),
    isPrepaid: coerceBoolean(obj.isPrepaid),
    reference: coerceString(obj.reference),
    notes: coerceString(obj.notes),
  };
}

function parseAccommodation(raw: unknown): LegAccommodation | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const name = coerceString(obj.name);
  if (!name) return null;
  return {
    name,
    type: coerceEnum(obj.type, VALID_ACCOMMODATION_TYPES, 'other'),
    bookingStatus: coerceEnum(obj.bookingStatus, VALID_BOOKING_STATUSES, 'estimated'),
    costCents: coerceInt(obj.costCents),
    costCurrency: coerceString(obj.costCurrency),
    isPrepaid: coerceBoolean(obj.isPrepaid),
    nights: coerceInt(obj.nights) ?? 1,
    reference: coerceString(obj.reference),
    notes: coerceString(obj.notes),
  };
}

function parseLeg(raw: unknown, tripId: string, order: number): ItineraryLeg | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const cityName = coerceString(obj.cityName);
  const arrivalDate = coerceDate(obj.arrivalDate);
  const departureDate = coerceDate(obj.departureDate) ?? arrivalDate;

  if (!cityName || !arrivalDate || !departureDate) return null;

  const meta = createSyncMetadata({ id: uuidv4() });
  return {
    ...meta,
    tripId,
    order,
    cityName,
    countryCode: coerceString(obj.countryCode),
    arrivalDate,
    arrivalTime: coerceTime(obj.arrivalTime),
    departureDate,
    departureTime: coerceTime(obj.departureTime),
    arrivalTransport: parseTransport(obj.arrivalTransport),
    accommodation: parseAccommodation(obj.accommodation),
    dailyBudgetCents: coerceInt(obj.dailyBudgetCents),
    dailyBudgetCurrency: coerceString(obj.dailyBudgetCurrency),
    budgetPremise: coerceString(obj.budgetPremise),
    companions: coerceStringArray(obj.companions),
    dayType: coerceEnum(obj.dayType, VALID_DAY_TYPES, 'full'),
    highlights: coerceStringArray(obj.highlights),
    linkedPhaseId: null,
    personalNotes: null,
  };
}

/**
 * Parses the raw AI /build response into validated ItineraryLeg[].
 * IDs are generated client-side (ÂNCORA-AI-1: never trust AI for IDs).
 * Invalid legs are silently dropped.
 */
export function parseBuildResponse(raw: unknown, tripId: string): ParsedBuildResponse {
  const empty: ParsedBuildResponse = { legs: [], suggestedPhases: [], summary: '' };
  if (!raw || typeof raw !== 'object') return empty;

  const obj = raw as Record<string, unknown>;
  const rawLegs = Array.isArray(obj.legs) ? obj.legs : [];
  const legs: ItineraryLeg[] = [];

  for (let i = 0; i < rawLegs.length; i++) {
    const leg = parseLeg(rawLegs[i], tripId, i + 1);
    if (leg) legs.push(leg);
  }

  const rawPhases = Array.isArray(obj.suggestedPhases) ? obj.suggestedPhases : [];
  const suggestedPhases: ParsedBuildResponse['suggestedPhases'] = [];
  for (const p of rawPhases) {
    if (!p || typeof p !== 'object') continue;
    const po = p as Record<string, unknown>;
    const name = coerceString(po.name);
    const startDate = coerceDate(po.startDate);
    const endDate = coerceDate(po.endDate);
    if (name && startDate && endDate) suggestedPhases.push({ name, startDate, endDate });
  }

  return {
    legs,
    suggestedPhases,
    summary: coerceString(obj.summary) ?? '',
  };
}

/**
 * Parses the raw AI /refine response into validated ItineraryLeg[].
 * IDs are generated client-side for new legs; existing legs get new IDs too
 * since the AI response is a full replacement.
 */
export function parseRefineResponse(raw: unknown, tripId: string): ParsedRefineResponse {
  const empty: ParsedRefineResponse = { legs: [], changes: [] };
  if (!raw || typeof raw !== 'object') return empty;

  const obj = raw as Record<string, unknown>;
  const rawLegs = Array.isArray(obj.legs) ? obj.legs : [];
  const legs: ItineraryLeg[] = [];

  for (let i = 0; i < rawLegs.length; i++) {
    const leg = parseLeg(rawLegs[i], tripId, i + 1);
    if (leg) legs.push(leg);
  }

  return {
    legs,
    changes: coerceStringArray(obj.changes),
  };
}
