import { localDayOf } from '@/domain/dates';

/**
 * DEC-200: a single normalized line of a Wise account statement. Wise exports
 * an RFC4180 CSV with 23 columns; we keep only the fields the importer needs
 * and resolve them BY HEADER NAME (not position) so a column re-order in a
 * future export can never silently shift the data.
 */
export interface WiseStatementRow {
  /** `TransferWise ID`, e.g. `CARD-3927313014`. Unique within Wise → dedupe key. */
  id: string;
  /** ISO instant derived from `Date Time` (or `Date` at local noon). */
  dateIso: string;
  /** Local calendar day `YYYY-MM-DD` of {@link dateIso}. */
  localDay: string;
  /** Signed amount in cents (negative = debit/outflow, positive = credit). */
  signedAmountCents: number;
  /** ISO-4217 code, defaults to `EUR` when the column is blank. */
  currency: string;
  description: string;
  merchant: string | null;
  paymentReference: string | null;
  payeeName: string | null;
  /** Raw, upper-cased `Transaction Type` (DEBIT / CREDIT). */
  transactionType: string;
  /** Raw, upper-cased `Transaction Details Type` (CARD / TRANSFER / ACCRUAL_CHARGE…). */
  detailsType: string;
  cardLastFour: string | null;
  note: string | null;
}

/**
 * A correct RFC4180 tokenizer. Wise fields are double-quoted and routinely
 * contain commas (e.g. a description with "7,39 EUR") and escaped quotes
 * (`""`); a naïve `split(',')` corrupts every such line. Handles CRLF and LF,
 * a leading BOM, and a final record without a trailing newline.
 */
export function parseCsvRecords(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  let started = false;

  const pushField = () => {
    record.push(field);
    field = '';
  };
  const pushRecord = () => {
    pushField();
    records.push(record);
    record = [];
    started = false;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    started = true;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      pushField();
    } else if (ch === '\n') {
      pushRecord();
    } else if (ch === '\r') {
      // CRLF: the paired '\n' (next char) finalizes the record. A lone CR is
      // ignored — Wise uses CRLF/LF, never the legacy bare-CR line ending.
    } else {
      field += ch;
    }
  }
  // Trailing record with no closing newline (or an open field).
  if (started || field.length > 0 || record.length > 0) {
    pushRecord();
  }
  return records;
}

/**
 * Parses the signed monetary amount. Wise's `Amount` column is dot-decimal
 * (`-7.39`, `563.48`); we still normalize comma-decimal and thousands
 * separators defensively so a locale-formatted export never yields NaN.
 */
export function parseAmountCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  let normalized = trimmed.replace(/\s/g, '');
  const lastDot = normalized.lastIndexOf('.');
  const lastComma = normalized.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    // Both present → the RIGHTMOST separator is the decimal point; the other is
    // the thousands grouping (handles US "1,234.56" and EU "1.234,56").
    const decimalSep = lastComma > lastDot ? ',' : '.';
    const thousandsSep = decimalSep === ',' ? '.' : ',';
    normalized = normalized.split(thousandsSep).join('').replace(decimalSep, '.');
  } else if (lastComma >= 0) {
    // Comma-only → it is the decimal separator. (Dot-only is already valid —
    // and Wise's Amount column is dot-decimal, so "2.000" means 2.00.)
    normalized = normalized.replace(/,/g, '.');
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

const WISE_DATE_RE =
  /^(\d{2})-(\d{2})-(\d{4})(?:[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?)?/;

/**
 * Builds an ISO instant from Wise's `DD-MM-YYYY[ HH:mm:ss.SSS]`. When only the
 * day is known we anchor at local noon so the day never shifts across
 * timezones (BUG-001 family). The `Date Time` column is preferred over `Date`.
 */
export function parseWiseDate(date: string, dateTime: string): string | null {
  const source = (dateTime.trim() || date.trim());
  const m = WISE_DATE_RE.exec(source);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, min, ss] = m;
  const built = new Date(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    hh !== undefined ? Number(hh) : 12,
    min !== undefined ? Number(min) : 0,
    ss !== undefined ? Number(ss) : 0,
  );
  if (Number.isNaN(built.getTime())) return null;
  return built.toISOString();
}

const COLUMN_NAMES = {
  id: 'TransferWise ID',
  date: 'Date',
  dateTime: 'Date Time',
  amount: 'Amount',
  currency: 'Currency',
  description: 'Description',
  reference: 'Payment Reference',
  payee: 'Payee Name',
  merchant: 'Merchant',
  card: 'Card Last Four Digits',
  note: 'Note',
  txType: 'Transaction Type',
  detailsType: 'Transaction Details Type',
} as const;

/**
 * Parses a full Wise statement file into normalized rows. Empty / header-only
 * files (file 3 in the sample) and blank lines yield no rows; malformed rows
 * (missing id/amount/date) are skipped rather than aborting the whole import.
 */
export function parseWiseCsv(text: string): WiseStatementRow[] {
  const records = parseCsvRecords(text);
  if (records.length < 2) return [];

  const header = records[0]!.map((h) => h.trim());
  const colIndex = (name: string): number => header.indexOf(name);
  const cols = {
    id: colIndex(COLUMN_NAMES.id),
    date: colIndex(COLUMN_NAMES.date),
    dateTime: colIndex(COLUMN_NAMES.dateTime),
    amount: colIndex(COLUMN_NAMES.amount),
    currency: colIndex(COLUMN_NAMES.currency),
    description: colIndex(COLUMN_NAMES.description),
    reference: colIndex(COLUMN_NAMES.reference),
    payee: colIndex(COLUMN_NAMES.payee),
    merchant: colIndex(COLUMN_NAMES.merchant),
    card: colIndex(COLUMN_NAMES.card),
    note: colIndex(COLUMN_NAMES.note),
    txType: colIndex(COLUMN_NAMES.txType),
    detailsType: colIndex(COLUMN_NAMES.detailsType),
  };

  // A file without the two mandatory columns is not a Wise statement.
  if (cols.id < 0 || cols.amount < 0) return [];

  const rows: WiseStatementRow[] = [];
  for (let r = 1; r < records.length; r++) {
    const record = records[r]!;
    const cell = (idx: number): string =>
      idx >= 0 && idx < record.length ? record[idx]!.trim() : '';

    const id = cell(cols.id);
    const signedAmountCents = parseAmountCents(cell(cols.amount));
    if (id.length === 0 || signedAmountCents === null) continue;

    const dateIso = parseWiseDate(cell(cols.date), cell(cols.dateTime));
    if (dateIso === null) continue;

    rows.push({
      id,
      dateIso,
      localDay: localDayOf(dateIso),
      signedAmountCents,
      currency: cell(cols.currency) || 'EUR',
      description: cell(cols.description),
      merchant: cell(cols.merchant) || null,
      paymentReference: cell(cols.reference) || null,
      payeeName: cell(cols.payee) || null,
      transactionType: cell(cols.txType).toUpperCase(),
      detailsType: cell(cols.detailsType).toUpperCase(),
      cardLastFour: cell(cols.card) || null,
      note: cell(cols.note) || null,
    });
  }
  return rows;
}
