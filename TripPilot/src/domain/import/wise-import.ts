import type { Transaction } from '@/domain/types/transaction';
import type { Settlement } from '@/domain/types/settlement';
import type { Phase } from '@/domain/types/phase';
import { resolveActivePhase } from '@/domain/dates';
import type { WiseStatementRow } from './wise-csv';
import type { WiseTransferDirection } from './wise-transfer';

/**
 * What a row becomes when imported. Credits are shown but never imported.
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
  /** Existing manual transaction this row looks like a duplicate of, if any. */
  manualDupTxId: string | null;
  /** Importable rows can be committed; credits are display-only. */
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
 */
const CATEGORY_RULES: ReadonlyArray<readonly [string, RegExp]> = [
  ['transport', /taxi|\bcab\b|uber|bolt|cabify|free ?now|renfe|train|metro|tram|\bbus\b|flixbus|blablacar|parking|peaje|\btoll\b|gasolin|petrol|\bfuel\b|combust|repsol|cepsa|shell/],
  ['accommodation', /hotel|hostal|hostel|camping|albergue|alojam|booking|airbnb|guesthouse|pension|pousada/],
  ['health', /farmac|pharma|botica|clinic|hospital|\bsalud\b|\bsaude\b|dentist|medic|optic/],
  ['market', /super|market|mercad|aliment|grocer|carrefour|mercadona|lidl|aldi|\bspar\b|eroski|consum|alcampo|hipercor|coviran/],
  ['bar', /\bbar\b|\bpub\b|cerv|brew|tasca|taberna|bodega|cocktail|nightclub|recreativ|discotec/],
  ['restaurant', /rest|asador|meson|pizz|burger|kebab|comida|\bfood\b|dining|cocina|grill|tapas|cafeter|confiter|pasteler|panaderi|bakery|cafe|coffee|brunch|churr|heladeri|gelat/],
  ['entertainment', /museo|museum|\btour\b|monument|catedral|palacio|castillo|teatro|theat|cinema|\bcine\b|entrada|ticket|festival|concert|\bpark\b|\bzoo\b|aquarium/],
  ['clothing', /\bzara\b|h&m|primark|decathlon|nike|adidas|tienda|\bstore\b|\bshop\b|boutique|\bmoda\b|apparel|clothes|\bropa\b|calzado|\bshoe/],
];

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Heuristic category for an importable debit; defaults to `other`. */
export function guessCategory(merchant: string | null, description: string): string {
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
    const phase = resolveActivePhase(ctx.phases, new Date(row.dateIso));

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
    const importable = kind === 'expense' || kind === 'fee';
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
      category: kind === 'credit' ? 'other' : guessCategory(row.merchant, row.description),
      dateIso: row.dateIso,
      localDay: row.localDay,
      phaseId: phase?.id ?? null,
      manualDupTxId,
      importable,
      includeByDefault,
    };
  });

  // Newest first — matches the statement's own ordering and the expense list.
  drafts.sort((a, b) => b.dateIso.localeCompare(a.dateIso));
  return { drafts, summary };
}
