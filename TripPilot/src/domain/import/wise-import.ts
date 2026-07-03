import type { Transaction } from '@/domain/types/transaction';
import type { Settlement } from '@/domain/types/settlement';
import type { Phase } from '@/domain/types/phase';
import { resolveActivePhase, findActivePhase } from '@/domain/dates';
import type { WiseStatementRow } from './wise-csv';
import type { WiseTransferDirection } from './wise-transfer';

/**
 * What a row becomes when imported. D-BUG-06: a `credit` (money received, no
 * counterparty) now commits as INCOME (DEC-212), not display-only.
 * FIELD-14: `transfer` = a TRANSFER to/from a PERSON — handled by the dedicated
 * classification flow (debt / wallet move / expense / split), not as an expense.
 */
export type WiseDraftKind = 'expense' | 'fee' | 'credit' | 'transfer';

/** Relationship of a row to what already exists on the device. */
export type WiseDraftStatus = 'new' | 'duplicate_import' | 'possible_manual_dup';

export const WISE_REF_PREFIX = 'wise:';

/** Builds the cross-source dedupe ref stored on the imported transaction. */
export function wiseExternalRef(rowId: string): string {
  return `${WISE_REF_PREFIX}${rowId}`;
}

export interface WiseImportDraft {
  rowId: string;
  externalRef: string;
  kind: WiseDraftKind;
  status: WiseDraftStatus;
  /** Always positive — the magnitude debited (expense/fee) or received (credit). */
  amountCents: number;
  /** Original signed amount (negative for debits). */
  signedAmountCents: number;
  currency: string;
  description: string;
  merchant: string | null;
  /** FIELD-14: counterparty person of a TRANSFER row (the payee), else null. */
  counterpartyName: string | null;
  /** FIELD-14: 'out' (I sent money) or 'in' (I received) — drives transfer kinds. */
  direction: WiseTransferDirection;
  /** Best-effort city pulled from the trailing UPPERCASE token(s) of merchant. */
  city: string | null;
  /** A {@link import('@/domain/types/common').TransactionCategory} value. */
  category: string;
  dateIso: string;
  localDay: string;
  phaseId: string | null;
  /** F16b: true when the date falls INSIDE a real phase; false when it was only
   *  attached to the nearest phase by fallback (offers "create a phase"). */
  inPhase: boolean;
  /** Existing manual transaction this row looks like a duplicate of, if any. */
  manualDupTxId: string | null;
  /** Importable rows can be committed (expense/fee as spend, credit as income). */
  importable: boolean;
  /** Whether the row starts checked in the review list. */
  includeByDefault: boolean;
}

export interface WiseImportSummary {
  /** Rows parsed across all files, BEFORE cross-file dedupe. */
  totalRowsParsed: number;
  /** Distinct rows after collapsing repeated `TransferWise ID`s. */
  uniqueRows: number;
  newCount: number;
  duplicateImportCount: number;
  possibleManualDupCount: number;
  creditCount: number;
  feeCount: number;
  expenseCount: number;
  /** FIELD-14: actionable (non-duplicate) TRANSFER rows to classify. */
  transferCount: number;
}

export interface WiseImportPlan {
  drafts: WiseImportDraft[];
  summary: WiseImportSummary;
}

export interface ClassifyWiseContext {
  /** Active transactions of the trip — for both dedupe paths. */
  existingTransactions: Transaction[];
  /** FIELD-14: existing settlements — so a re-imported transfer that only paid
   *  a debt (settlement, no transaction) is still recognized as duplicate. */
  existingSettlements?: Settlement[];
  phases: Phase[];
}

/**
 * Data-driven merchant/description → category heuristic. First match wins, so
 * the list is ordered most-specific first. Accent- and case-insensitive.
 *
 * Anchoring rule: stems (e.g. `confiter`, `recreativ`, `mercad`) are written
 * WITHOUT a trailing `\b` so they match inflected forms ("confiteria"); short
 * ambiguous tokens (`bar`, `pub`, `cine`) are whole-word `\b…\b` to avoid
 * matching inside city names ("BARcelona"). The preview is fully editable, so
 * a rare wrong guess costs the user one tap.
 *
 * DEC-420 (G3): enriched with more EU/BR/LATAM brands + two under-used existing
 * categories (`cash_adjustment` for ATM cash-outs, `communication` for SIM /
 * telco top-ups) so fewer rows fall into "other". Only DISTINCTIVE brand tokens
 * were added — ambiguous words (dia, orange, o2, claro, gol) were deliberately
 * left out so a richer dictionary never trades precision for recall.
 */
const CATEGORY_RULES: ReadonlyArray<readonly [string, RegExp]> = [
  // ATM / cash withdrawal — a bank cash-out, kept first (most specific) and also
  // reinforced by the detailsType signal (DETAILS_TYPE_CATEGORY) below.
  ['cash_adjustment', /\batm\b|cajero|geldautomat|cash ?withdrawal|\bsaque\b|retirada de efectivo|caixa ?eletron/],
  ['transport', /taxi|\bcab\b|uber|bolt|cabify|free ?now|\bdidi\b|\b99\b|renfe|train|trainline|omio|metro|tram|\bbus\b|flixbus|blablacar|\balsa\b|parking|peaje|\btoll\b|via ?verde|autopista|gasolin|petrol|\bfuel\b|combust|repsol|cepsa|shell|\bgalp\b|ryanair|easyjet|vueling|\bklm\b|lufthansa|wizz ?air|transavia|\baena\b|aeroport|airport|\bemt\b|\btmb\b|cercanias|europcar|\bhertz\b|\bavis\b|\bsixt\b/],
  ['accommodation', /hotel|hostal|hostel|camping|albergue|alojam|booking|airbnb|guesthouse|pension|pousada|\bibis\b|novotel|melia|barcelo|\briu\b|marriott|hilton|paradores|selina|expedia|hostelworld/],
  ['health', /farmac|parafarm|pharma|botica|drogaria|drogasil|panvel|\braia\b|clinic|hospital|\bsalud\b|\bsaude\b|dentist|medic|optic|\bfisio\b|laborator/],
  // SIM cards, mobile top-ups and telco — distinctive carrier brands only.
  ['communication', /vodafone|movistar|yoigo|simyo|masmovil|jazztel|lycamobile|lebara|\besim\b|holafly|airalo|recarga ?movil|\btop ?up\b/],
  ['market', /super|market|mercad|aliment|grocer|carrefour|mercadona|lidl|aldi|\bspar\b|eroski|consum|alcampo|hipercor|coviran|continente|pingo ?doce|auchan|caprabo|froiz|gadis|\bkaufland\b|\btesco\b|sainsbury|\boxxo\b|walmart/],
  ['bar', /\bbar\b|\bpub\b|cerv|brew|birra|tasca|taberna|bodega|vermut|cocktail|nightclub|recreativ|discotec|\bpint\b/],
  ['restaurant', /rest|asador|meson|pizz|burger|kebab|comida|\bfood\b|dining|cocina|grill|tapas|cafeter|confiter|pasteler|panaderi|padaria|bakery|cafe|coffee|brunch|churr|heladeri|gelat|mcdonald|\bkfc\b|telepizza|domino|starbucks|\bvips\b|goiko|sushi|\bramen\b|noodle|\bdoner\b|shawarma|falafel|nandos|five ?guys|subway|\btacos?\b|arepa|boteco/],
  // F16c: ticketing platforms + festival/venue terms — a "Paylogic" or "Eventim"
  // charge is an event ticket, not a generic "other" (Julio's Tomorrowland case).
  // Distinctive brands match as stems; short ambiguous tokens stay whole-word.
  ['entertainment', /museo|museum|\btour\b|monument|catedral|palacio|castillo|teatro|theat|cinema|\bcine\b|entrada|ticket|festival|concert|\bpark\b|\bzoo\b|aquarium|paylogic|eventim|ticketmaster|ticketone|ticketek|see ?tickets|ticketswap|ticombo|viagogo|stubhub|eventbrite|wegow|tomorrowland|\bdice\b|\bfever\b|\baxs\b|ra\.co|resident ?advisor|ingresse|sympla|spotify|netflix|\bhbo\b|prime ?video|\bdazn\b|filmin|playstation|nintendo|bowling|escape ?room|laser ?tag/],
  ['clothing', /\bzara\b|h&m|primark|decathlon|nike|adidas|tienda|\bstore\b|\bshop\b|boutique|\bmoda\b|apparel|clothes|\bropa\b|calzado|\bshoe|bershka|pull ?& ?bear|stradivarius|massimo ?dutti|uniqlo|c&a|renner|riachuelo|springfield|lefties|foot ?locker|jd ?sports|oysho|intimissimi/],
];

/**
 * DEC-420 (G3): the statement's own `Transaction Details Type` is a strong,
 * merchant-independent signal. An ATM cash-out has no useful merchant text, so
 * the type maps it directly (checked before the keyword rules). Data-driven and
 * harmless when Wise emits a type we don't map (the keyword rules still run).
 */
const DETAILS_TYPE_CATEGORY: ReadonlyArray<readonly [string, string]> = [
  ['ATM', 'cash_adjustment'],
  ['CASH_WITHDRAWAL', 'cash_adjustment'],
];

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Heuristic category for an importable debit; defaults to `other`. The optional
 * `detailsType` (Wise's uppercase `Transaction Details Type`) is consulted first
 * as a merchant-independent signal (DEC-420); receipt OCR omits it.
 */
export function guessCategory(merchant: string | null, description: string, detailsType = ''): string {
  for (const [token, category] of DETAILS_TYPE_CATEGORY) {
    if (detailsType.includes(token)) return category;
  }
  const haystack = normalizeText(`${merchant ?? ''} ${description}`);
  for (const [category, pattern] of CATEGORY_RULES) {
    if (pattern.test(haystack)) return category;
  }
  return 'other';
}

/**
 * Wise merchant strings end with the city in UPPERCASE
 * (e.g. "Confiteria Juarreno BURGOS"). Pulls the trailing all-caps token(s)
 * as a best-effort place label; returns null when there is no clear city.
 */
export function extractCity(merchant: string | null): string | null {
  if (merchant === null) return null;
  const tokens = merchant.trim().split(/\s+/);
  const caps: string[] = [];
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i]!;
    // A city token is 2+ chars and has no lowercase letter (digits/accents ok).
    if (token.length >= 2 && token === token.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(token)) {
      caps.unshift(token);
    } else {
      break;
    }
  }
  if (caps.length === 0) return null;
  const city = caps.join(' ');
  return city
    .toLowerCase()
    .replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
}

/**
 * Field v2.1 (DEC-434): the ESTABLISHMENT part of a Wise merchant string — the
 * merchant WITHOUT the trailing UPPERCASE city token(s) that {@link extractCity}
 * pulls (e.g. "Confiteria Juarreno BURGOS" → "Confiteria Juarreno"). This is what
 * belongs in the expense's "local" (placeLabel), so the venue — not the city —
 * names the spend; the full merchant string still rides in the description.
 *
 * Returns null when the merchant is empty or is ONLY a city / all-caps token
 * (nothing distinct to name), so the caller can fall back to the city label; the
 * background forward-geocode later upgrades either to the real OSM venue name.
 */
export function extractMerchantName(merchant: string | null): string | null {
  if (merchant === null) return null;
  const tokens = merchant.trim().split(/\s+/).filter((token) => token.length > 0);
  if (tokens.length === 0) return null;
  let cityTokenCount = 0;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i]!;
    // Same trailing "city" heuristic as extractCity: 2+ chars, no lowercase.
    if (token.length >= 2 && token === token.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(token)) {
      cityTokenCount++;
    } else {
      break;
    }
  }
  const name = tokens.slice(0, tokens.length - cityTokenCount).join(' ').trim();
  return name === '' ? null : name;
}

function classifyKind(row: WiseStatementRow): WiseDraftKind {
  // FIELD-14: a TRANSFER with a named counterparty is a person-to-person move
  // (either direction) — never a plain card purchase. Checked first so an
  // incoming transfer is a `transfer`, not a generic `credit`.
  const hasCounterparty = (row.payeeName?.trim().length ?? 0) > 0;
  if (row.detailsType.includes('TRANSFER') && hasCounterparty) return 'transfer';
  if (row.signedAmountCents > 0) return 'credit';
  if (row.detailsType.includes('ACCRUAL') || /\b(tarifa|fee|charge|comision|comissao)\b/.test(normalizeText(row.description))) {
    return 'fee';
  }
  return 'expense';
}

function buildDescription(row: WiseStatementRow): string {
  if (row.merchant && row.merchant.trim().length > 0) return row.merchant.trim();
  if (row.payeeName && row.payeeName.trim().length > 0) {
    return row.paymentReference && row.paymentReference.trim().length > 0
      ? `${row.payeeName.trim()} · ${row.paymentReference.trim()}`
      : row.payeeName.trim();
  }
  return row.description.trim() || row.id;
}

/** Key for spotting a row that duplicates a manual entry: day + magnitude. */
function manualDupKey(localDay: string, amountCents: number): string {
  return `${localDay}:${amountCents}`;
}

/**
 * Turns parsed rows (possibly from several files) into a reviewable import
 * plan. Responsibilities, all pure:
 *  - cross-file dedupe by `TransferWise ID` (file 1 == file 2 in the sample);
 *  - flag rows already imported before (`externalRef` present) → duplicate_import;
 *  - flag rows that match an existing MANUAL expense (same day + amount) →
 *    possible_manual_dup (shown, unchecked by default);
 *  - classify kind (expense / fee / credit), category and target phase-by-date.
 */
export function classifyWiseRows(
  rows: WiseStatementRow[],
  ctx: ClassifyWiseContext,
): WiseImportPlan {
  const totalRowsParsed = rows.length;

  // 1) Cross-file dedupe — first occurrence of each id wins.
  const uniqueById = new Map<string, WiseStatementRow>();
  for (const row of rows) {
    if (!uniqueById.has(row.id)) uniqueById.set(row.id, row);
  }
  const uniqueRows = [...uniqueById.values()];

  // 2) Indexes over what already exists on the device.
  const importedRefs = new Set<string>();
  const manualByKey = new Map<string, string>();
  for (const tx of ctx.existingTransactions) {
    if (tx.deletedAt !== null) continue;
    if (typeof tx.externalRef === 'string' && tx.externalRef.length > 0) {
      importedRefs.add(tx.externalRef);
    } else if (tx.type === 'expense') {
      // Only manual expenses participate in the "looks like a duplicate" hint.
      manualByKey.set(manualDupKey(tx.date.slice(0, 10), tx.amountCents), tx.id);
    }
  }
  // FIELD-14: a transfer that only settled a debt leaves no transaction — its
  // ref lives on the settlement, so include those to dedupe re-imports.
  for (const settlement of ctx.existingSettlements ?? []) {
    if (settlement.deletedAt !== null) continue;
    if (typeof settlement.externalRef === 'string' && settlement.externalRef.length > 0) {
      importedRefs.add(settlement.externalRef);
    }
  }

  const summary: WiseImportSummary = {
    totalRowsParsed,
    uniqueRows: uniqueRows.length,
    newCount: 0,
    duplicateImportCount: 0,
    possibleManualDupCount: 0,
    creditCount: 0,
    feeCount: 0,
    expenseCount: 0,
    transferCount: 0,
  };

  const drafts: WiseImportDraft[] = uniqueRows.map((row) => {
    const kind = classifyKind(row);
    const amountCents = Math.abs(row.signedAmountCents);
    const externalRef = wiseExternalRef(row.id);
    const rowDate = new Date(row.dateIso);
    const phase = resolveActivePhase(ctx.phases, rowDate);
    // F16b: strict membership — null when the row is only attached by fallback.
    const inPhase = findActivePhase(ctx.phases, rowDate) !== null;

    let status: WiseDraftStatus = 'new';
    let manualDupTxId: string | null = null;
    if (importedRefs.has(externalRef)) {
      status = 'duplicate_import';
    } else if (kind === 'expense' || kind === 'fee') {
      // The "looks like a manual entry" hint is for plain card purchases only —
      // a transfer (which the user classifies by hand) should never be flagged.
      const dupId = manualByKey.get(manualDupKey(row.localDay, amountCents));
      if (dupId !== undefined) {
        status = 'possible_manual_dup';
        manualDupTxId = dupId;
      }
    }

    // FIELD-14: transfers are committed through the classification flow, so they
    // are not "importable" as plain expenses (the expense commit path skips them).
    // D-BUG-06: a pure credit (positive, no counterparty) IS importable now — it
    // commits as income (DEC-212). Transfers with a person stay on their own flow.
    const importable = kind === 'expense' || kind === 'fee' || kind === 'credit';
    const includeByDefault = importable && status === 'new';

    if (kind === 'credit') summary.creditCount++;
    else if (kind === 'fee') summary.feeCount++;
    else if (kind === 'transfer') {
      if (status !== 'duplicate_import') summary.transferCount++;
    } else summary.expenseCount++;
    if (status === 'new' && importable) summary.newCount++;
    else if (status === 'duplicate_import') summary.duplicateImportCount++;
    else if (status === 'possible_manual_dup') summary.possibleManualDupCount++;

    return {
      rowId: row.id,
      externalRef,
      kind,
      status,
      amountCents,
      signedAmountCents: row.signedAmountCents,
      currency: row.currency,
      description: buildDescription(row),
      merchant: row.merchant,
      counterpartyName: kind === 'transfer' ? (row.payeeName?.trim() || null) : null,
      direction: row.signedAmountCents < 0 ? 'out' : 'in',
      city: extractCity(row.merchant),
      category: kind === 'credit' ? 'other' : guessCategory(row.merchant, row.description, row.detailsType),
      dateIso: row.dateIso,
      localDay: row.localDay,
      phaseId: phase?.id ?? null,
      inPhase,
      manualDupTxId,
      importable,
      includeByDefault,
    };
  });

  // Newest first — matches the statement's own ordering and the expense list.
  drafts.sort((a, b) => b.dateIso.localeCompare(a.dateIso));
  return { drafts, summary };
}
