import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { parseWiseCsv } from '@/domain/import/wise-csv';
import {
  classifyWiseRows,
  guessCategory,
  extractCity,
  wiseExternalRef,
} from '@/domain/import/wise-import';
import { commitWiseImport } from '@/domain/orchestrators';
import { createExpenseTransaction } from '@/domain/transactions';
import type { Phase } from '@/domain/types/phase';
import type { Transaction } from '@/domain/types/transaction';

const HEADER =
  '"TransferWise ID",Date,"Date Time",Amount,Currency,Description,"Payment Reference","Running Balance","Exchange From","Exchange To","Exchange Rate","Payer Name","Payee Name","Payee Account Number",Merchant,"Card Last Four Digits","Card Holder Full Name",Attachment,Note,"Total fees","Exchange To Amount","Transaction Type","Transaction Details Type"';

const ROWS = [
  'CARD-3927313014,15-06-2026,"15-06-2026 18:34:58.641",-7.39,EUR,"Transação por cartão de 7,39 EUR emitida por Dulcycor VILLATORO",,525.99,,,,,,,"Dulcycor VILLATORO",8420,"Júlio César Corcini de Medeiros",,,0.00,,DEBIT,CARD',
  'CARD-3922567943,14-06-2026,"14-06-2026 15:47:50.150",-5.20,EUR,"Transação por cartão de 5,20 EUR emitida por Confiteria Juarreno BURGOS",,533.38,,,,,,,"Confiteria Juarreno BURGOS",8420,"Júlio César Corcini de Medeiros",,,0.00,,DEBIT,CARD',
  'CARD-3915710063,13-06-2026,"13-06-2026 00:22:13.628",-10.40,EUR,"Transação por cartão de 10,40 EUR emitida por Taxi Iglesias Carton CAMPING DE FU",,538.58,,,,,,,"Taxi Iglesias Carton CAMPING DE FU",8420,"Júlio César Corcini de Medeiros",,,0.00,,DEBIT,CARD',
  'CARD-3915613973,12-06-2026,"12-06-2026 23:39:26.149",-5.50,EUR,"Transação por cartão de 5,50 EUR emitida por Delid0g VITORIA",,548.98,,,,,,,"Delid0g VITORIA",8420,"Júlio César Corcini de Medeiros",,,0.00,,DEBIT,CARD',
  'CARD-3914350459,12-06-2026,"12-06-2026 17:43:28.316",-9.00,EUR,"Transação por cartão de 9,00 EUR emitida por Pea Recreativa Castellan BURGOS",,554.48,,,,,,,"Pea Recreativa Castellan BURGOS",8420,"Júlio César Corcini de Medeiros",,,0.00,,DEBIT,CARD',
  'TRANSFER-2188321339,12-06-2026,"12-06-2026 16:25:15.689",-44.00,EUR,"Enviou dinheiro para Bruno Pessoa de Oliveira","parral + ivan",563.48,,,,,"Bruno Pessoa de Oliveira",35855771,,,,,,0.00,,DEBIT,TRANSFER',
  '"ACCRUAL_CHECKOUT-invoice-27912366",02-06-2026,"02-06-2026 14:19:05.702",-0.09,EUR,"Tarifa de serviços dos Investimentos de EUR",,607.48,,,,,,,,,,,,0.00,,DEBIT,ACCRUAL_CHARGE',
];

const STATEMENT = [HEADER, ...ROWS, ''].join('\r\n');

const phase = (overrides: Partial<Phase> = {}): Phase =>
  ({
    id: 'phase-jun',
    tripId: 'trip-1',
    name: 'June',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    order: 0,
    deletedAt: null,
    rhythmPreset: null,
    peakDays: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    revision: 1,
    sourceDeviceId: 'test',
    ...overrides,
  }) as Phase;

const PHASES = [phase()];

describe('guessCategory', () => {
  it('maps merchant/description keywords to TripPilot categories', () => {
    expect(guessCategory('Taxi Iglesias Carton CAMPING DE FU', '')).toBe('transport');
    expect(guessCategory('Confiteria Juarreno BURGOS', '')).toBe('restaurant');
    expect(guessCategory('Pea Recreativa Castellan BURGOS', '')).toBe('bar');
    expect(guessCategory('Mercadona BURGOS', '')).toBe('market');
    expect(guessCategory('Hotel Norte VITORIA', '')).toBe('accommodation');
  });

  it('falls back to "other" for an unrecognized merchant', () => {
    expect(guessCategory('Dulcycor VILLATORO', '')).toBe('other');
    expect(guessCategory(null, 'Enviou dinheiro para Bruno')).toBe('other');
  });
});

describe('extractCity', () => {
  it('pulls the trailing UPPERCASE city token(s)', () => {
    expect(extractCity('Confiteria Juarreno BURGOS')).toBe('Burgos');
    expect(extractCity('Dulcycor VILLATORO')).toBe('Villatoro');
    expect(extractCity('Delid0g VITORIA')).toBe('Vitoria');
  });

  it('returns null when there is no clear city', () => {
    expect(extractCity(null)).toBeNull();
    expect(extractCity('lowercase only')).toBeNull();
  });
});

describe('classifyWiseRows', () => {
  it('dedupes identical rows across files by TransferWise ID', () => {
    const rows = [...parseWiseCsv(STATEMENT), ...parseWiseCsv(STATEMENT)]; // file 1 + file 2
    const plan = classifyWiseRows(rows, { existingTransactions: [], phases: PHASES });
    expect(plan.summary.totalRowsParsed).toBe(14);
    expect(plan.summary.uniqueRows).toBe(7);
    expect(plan.drafts).toHaveLength(7);
  });

  it('classifies kinds: 5 card debits as expense, the accrual as fee, the person transfer as transfer', () => {
    const plan = classifyWiseRows(parseWiseCsv(STATEMENT), {
      existingTransactions: [],
      phases: PHASES,
    });
    expect(plan.summary.expenseCount).toBe(5);
    expect(plan.summary.feeCount).toBe(1);
    expect(plan.summary.transferCount).toBe(1);
    expect(plan.summary.creditCount).toBe(0);
    // newCount counts only importable-as-expense rows (5 cards + 1 fee).
    expect(plan.summary.newCount).toBe(6);
    expect(plan.drafts.filter((d) => d.kind !== 'transfer').every((d) => d.importable)).toBe(true);
    expect(plan.drafts.every((d) => d.phaseId === 'phase-jun')).toBe(true);
  });

  it('classifies the TRANSFER-to-a-person row as a non-importable transfer', () => {
    const plan = classifyWiseRows(parseWiseCsv(STATEMENT), {
      existingTransactions: [],
      phases: PHASES,
    });
    const transfer = plan.drafts.find((d) => d.rowId === 'TRANSFER-2188321339');
    expect(transfer?.kind).toBe('transfer');
    expect(transfer?.importable).toBe(false);
    expect(transfer?.includeByDefault).toBe(false);
    expect(transfer?.direction).toBe('out');
    expect(transfer?.counterpartyName).toBe('Bruno Pessoa de Oliveira');
    expect(transfer?.amountCents).toBe(4400);
  });

  it('flags an already-imported row as duplicate_import (re-import safe)', () => {
    const existing: Transaction[] = [
      createExpenseTransaction({
        tripId: 'trip-1',
        phaseId: 'phase-jun',
        budgetPoolId: 'pool-1',
        walletId: 'w1',
        amountCents: 739,
        currency: 'EUR',
        category: 'other',
        description: 'Dulcycor VILLATORO',
        date: '2026-06-15T18:34:58.000Z',
        externalRef: wiseExternalRef('CARD-3927313014'),
      }),
    ];
    const plan = classifyWiseRows(parseWiseCsv(STATEMENT), {
      existingTransactions: existing,
      phases: PHASES,
    });
    const dup = plan.drafts.find((d) => d.rowId === 'CARD-3927313014');
    expect(dup?.status).toBe('duplicate_import');
    expect(dup?.includeByDefault).toBe(false);
    expect(plan.summary.duplicateImportCount).toBe(1);
    expect(plan.summary.newCount).toBe(5);
  });

  it('flags a same day+amount manual expense as possible_manual_dup (unchecked)', () => {
    const manual: Transaction[] = [
      createExpenseTransaction({
        tripId: 'trip-1',
        phaseId: 'phase-jun',
        budgetPoolId: 'pool-1',
        walletId: null,
        amountCents: 520, // 5,20 — same as Confiteria on 14-06
        currency: 'EUR',
        category: 'restaurant',
        description: 'Padaria (manual)',
        date: '2026-06-14T10:00:00.000Z',
      }),
    ];
    const plan = classifyWiseRows(parseWiseCsv(STATEMENT), {
      existingTransactions: manual,
      phases: PHASES,
    });
    const draft = plan.drafts.find((d) => d.rowId === 'CARD-3922567943');
    expect(draft?.status).toBe('possible_manual_dup');
    expect(draft?.manualDupTxId).toBe(manual[0]!.id);
    expect(draft?.includeByDefault).toBe(false);
    expect(plan.summary.possibleManualDupCount).toBe(1);
  });
});

describe('commitWiseImport', () => {
  beforeEach(async () => {
    await db.transactions.clear();
  });

  it('persists selected drafts as expenses with the external ref and wallet', async () => {
    const plan = classifyWiseRows(parseWiseCsv(STATEMENT), {
      existingTransactions: [],
      phases: PHASES,
    });
    const result = await commitWiseImport({
      drafts: plan.drafts,
      tripId: 'trip-1',
      budgetPoolId: 'pool-1',
      walletId: 'wise-wallet',
      fallbackPhaseId: 'phase-jun',
    });

    // The person transfer is NOT imported as an expense (5 cards + 1 fee).
    expect(result.transactionIds).toHaveLength(6);
    const stored = await db.transactions.toArray();
    expect(stored).toHaveLength(6);
    expect(stored.every((t) => t.walletId === 'wise-wallet')).toBe(true);
    expect(stored.every((t) => t.externalRef?.startsWith('wise:'))).toBe(true);
    expect(stored.every((t) => t.excludeFromLearning)).toBe(true);

    const dulcycor = stored.find((t) => t.externalRef === wiseExternalRef('CARD-3927313014'));
    expect(dulcycor?.amountCents).toBe(739);
    expect(dulcycor?.placeLabel).toBe('Villatoro');
  });

  it('re-importing the same statement finds everything already imported', async () => {
    const first = classifyWiseRows(parseWiseCsv(STATEMENT), {
      existingTransactions: [],
      phases: PHASES,
    });
    await commitWiseImport({
      drafts: first.drafts,
      tripId: 'trip-1',
      budgetPoolId: 'pool-1',
      walletId: 'wise-wallet',
      fallbackPhaseId: 'phase-jun',
    });

    const stored = await db.transactions.toArray();
    const second = classifyWiseRows(parseWiseCsv(STATEMENT), {
      existingTransactions: stored,
      phases: PHASES,
    });
    expect(second.summary.duplicateImportCount).toBe(6);
    expect(second.summary.newCount).toBe(0);
    expect(second.drafts.every((d) => d.includeByDefault === false)).toBe(true);
  });
});
