import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { parseWiseCsv } from '@/domain/import/wise-csv';
import {
  classifyWiseRows,
  guessCategory,
  extractCity,
  wiseExternalRef,
} from '@/domain/import/wise-import';
import { commitWiseImport, commitWiseTransfers } from '@/domain/orchestrators';
import { detectReimbursementBridges } from '@/domain/import/reimbursement-bridge';
import { createExpenseTransaction, createIncomeTransaction } from '@/domain/transactions';
import { calculateDebts, createParticipant } from '@/domain/splitting';
import { newAllocationId } from '@/domain/import';
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

// D-BUG-06: a pure credit (positive amount, NO payee/counterparty) — a refund or
// balance top-up. Mirrors the ACCRUAL row's column layout, only the values differ.
const CREDIT_ROW =
  'CREDIT-9001,10-06-2026,"10-06-2026 09:00:00.000",50.00,EUR,"Reembolso recebido",,650.00,,,,,,,,,,,,0.00,,CREDIT,DEPOSIT';
const CREDIT_STATEMENT = [HEADER, CREDIT_ROW, ''].join('\r\n');

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

// Two trechos that split June by date, for per-phase pool routing tests.
const EARLY_PHASE = phase({ id: 'ph-early', startDate: '2026-06-01', endDate: '2026-06-12' });
const LATE_PHASE = phase({ id: 'ph-late', startDate: '2026-06-13', endDate: '2026-06-30' });
const TWO_PHASES = [EARLY_PHASE, LATE_PHASE];

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

  it('F16c: maps ticketing platforms and festivals to entertainment', () => {
    expect(guessCategory('Paylogic AMSTERDAM', '')).toBe('entertainment');
    expect(guessCategory('PAYLOGIC.COM', '')).toBe('entertainment');
    expect(guessCategory('Eventim BERLIN', '')).toBe('entertainment');
    expect(guessCategory('Ticketmaster', '')).toBe('entertainment');
    expect(guessCategory('See Tickets', '')).toBe('entertainment');
    expect(guessCategory('Tomorrowland BOOM', '')).toBe('entertainment');
    expect(guessCategory(null, 'DICE event ticket')).toBe('entertainment');
  });

  it('F16c: ticketing keywords never shadow a clearer category', () => {
    // "fever" is whole-word only, so it must not fire inside another token.
    expect(guessCategory('Feverish Cafe BURGOS', '')).toBe('restaurant');
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

  it('F16b: flags rows outside every phase as not inPhase (fallback still attaches)', () => {
    const narrow = [phase({ startDate: '2026-06-13', endDate: '2026-06-30' })];
    const plan = classifyWiseRows(parseWiseCsv(STATEMENT), {
      existingTransactions: [],
      phases: narrow,
    });
    const inside = plan.drafts.find((d) => d.rowId === 'CARD-3927313014'); // 15-06
    const outside = plan.drafts.find((d) => d.rowId === 'CARD-3914350459'); // 12-06
    expect(inside?.inPhase).toBe(true);
    expect(outside?.inPhase).toBe(false);
    // Fallback still attaches the out-of-phase row to the nearest phase.
    expect(outside?.phaseId).toBe('phase-jun');
  });

  it('D-BUG-06: a pure credit (no counterparty) is an importable income draft, on by default', () => {
    const plan = classifyWiseRows(parseWiseCsv(CREDIT_STATEMENT), {
      existingTransactions: [],
      phases: PHASES,
    });
    const credit = plan.drafts.find((d) => d.rowId === 'CREDIT-9001');
    expect(credit?.kind).toBe('credit');
    expect(credit?.importable).toBe(true);
    expect(credit?.includeByDefault).toBe(true); // status 'new' → checked by default
    expect(credit?.direction).toBe('in');
    expect(credit?.counterpartyName).toBeNull();
    expect(credit?.amountCents).toBe(5000);
    expect(plan.summary.creditCount).toBe(1);
    // The credit is now a real, committable row, so it counts toward "new".
    expect(plan.summary.newCount).toBe(1);
  });

  it('D-BUG-06: a re-imported credit is recognized as duplicate (externalRef dedupe)', () => {
    const existing: Transaction[] = [
      {
        ...createIncomeTransaction({
          tripId: 'trip-1',
          phaseId: 'phase-jun',
          budgetPoolId: 'pool-1',
          walletId: 'wise-wallet',
          amountCents: 5000,
          currency: 'EUR',
          description: 'Reembolso recebido',
          date: '2026-06-10T09:00:00.000Z',
        }),
        externalRef: wiseExternalRef('CREDIT-9001'),
      },
    ];
    const plan = classifyWiseRows(parseWiseCsv(CREDIT_STATEMENT), {
      existingTransactions: existing,
      phases: PHASES,
    });
    const credit = plan.drafts.find((d) => d.rowId === 'CREDIT-9001');
    expect(credit?.status).toBe('duplicate_import');
    expect(credit?.includeByDefault).toBe(false);
    expect(plan.summary.duplicateImportCount).toBe(1);
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

  it('D-BUG-06: commits a credit as income — grows the pool, credits the wallet, deduped', async () => {
    const plan = classifyWiseRows(parseWiseCsv(CREDIT_STATEMENT), {
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

    expect(result.transactionIds).toHaveLength(1);
    const stored = await db.transactions.toArray();
    expect(stored).toHaveLength(1);
    const income = stored[0]!;
    expect(income.type).toBe('income'); // NOT an expense
    expect(income.amountCents).toBe(5000);
    expect(income.walletId).toBe('wise-wallet'); // credits the Wise wallet
    expect(income.budgetPoolId).toBe('pool-1'); // grows the operational pool
    expect(income.category).toBeNull(); // income is never categorized
    expect(income.personalCostCents).toBeNull(); // never a personal cost
    expect(income.excludeFromLearning).toBe(true); // never feeds value learning
    expect(income.externalRef).toBe(wiseExternalRef('CREDIT-9001')); // re-import dedupe
  });

  it('F16 bridge: commits a purchase as split (owner paid, person owes a slice)', async () => {
    await db.participantShares.clear();
    const plan = classifyWiseRows(parseWiseCsv(STATEMENT), {
      existingTransactions: [],
      phases: PHASES,
    });
    // Pea Recreativa Castellan BURGOS — 9.00 EUR card purchase.
    const purchase = plan.drafts.find((d) => d.rowId === 'CARD-3914350459')!;
    expect(purchase.amountCents).toBe(900);

    const result = await commitWiseImport({
      drafts: plan.drafts,
      tripId: 'trip-1',
      budgetPoolId: 'pool-1',
      walletId: 'wise-wallet',
      fallbackPhaseId: 'phase-jun',
      ownerId: 'owner-1',
      bridges: { 'CARD-3914350459': { participantId: 'bianca', shareAmountCents: 400 } },
    });
    expect(result.transactionIds).toHaveLength(6);

    const stored = await db.transactions.toArray();
    const bridged = stored.find((t) => t.externalRef === wiseExternalRef('CARD-3914350459'))!;
    expect(bridged.isShared).toBe(true);
    expect(bridged.paidByParticipantId).toBe('owner-1');
    expect(bridged.personalCostCents).toBe(500); // 900 − 400

    const shares = await db.participantShares.where('transactionId').equals(bridged.id).toArray();
    expect(shares).toHaveLength(2);
    expect(shares.every((s) => s.confirmationStatus === 'confirmed')).toBe(true);
    const biancaShare = shares.find((s) => s.participantId === 'bianca')!;
    expect(biancaShare.shareAmountCents).toBe(400);
    expect(biancaShare.isPaid).toBe(false);

    // The other 5 expenses stay plain (not shared).
    expect(stored.filter((t) => t.isShared)).toHaveLength(1);
  });

  it('F16 bridge: split + incoming settlement net to zero debt (end to end)', async () => {
    await db.participantShares.clear();
    await db.settlements.clear();
    const participants = [
      createParticipant('trip-1', 'Me', null),
      { ...createParticipant('trip-1', 'Bianca', null), id: 'bianca' },
    ];
    const owner = { ...participants[0]!, isOwner: true };
    const allParticipants = [owner, participants[1]!];

    const plan = classifyWiseRows(parseWiseCsv(STATEMENT), {
      existingTransactions: [],
      phases: PHASES,
    });
    const purchase = plan.drafts.find((d) => d.rowId === 'CARD-3914350459')!; // 900

    // Commit the purchase split: Bianca owes 400 of 900.
    await commitWiseImport({
      drafts: [purchase],
      tripId: 'trip-1',
      budgetPoolId: 'pool-1',
      walletId: 'wise-wallet',
      fallbackPhaseId: 'phase-jun',
      ownerId: owner.id,
      bridges: { 'CARD-3914350459': { participantId: 'bianca', shareAmountCents: 400 } },
    });

    // The incoming repayment settles Bianca's 400.
    const incoming = { ...purchase, rowId: 'INCOMING-1', direction: 'in' as const, kind: 'transfer' as const };
    await commitWiseTransfers({
      specs: [
        {
          draft: incoming,
          participantId: 'bianca',
          allocations: [{ id: newAllocationId(), kind: 'settle_incoming', amountCents: 400 }],
        },
      ],
      tripId: 'trip-1',
      ownerId: owner.id,
      budgetPoolId: 'pool-1',
      sourceWalletId: 'wise-wallet',
      fallbackPhaseId: 'phase-jun',
      baseCurrency: 'EUR',
    });

    const txs = await db.transactions.toArray();
    const shares = await db.participantShares.toArray();
    const settlements = await db.settlements.toArray();
    const debts = calculateDebts(txs, shares, allParticipants, settlements, owner.id);
    // Born (Bianca owes 400) and immediately repaid → no outstanding debt.
    expect(debts.totalDebtCents).toBe(0);
  });

  it('F16 bridge: detector → commit wiring links the lone purchase', async () => {
    await db.participantShares.clear();
    const plan = classifyWiseRows(parseWiseCsv(STATEMENT), {
      existingTransactions: [],
      phases: PHASES,
    });
    const purchase = plan.drafts.find((d) => d.rowId === 'CARD-3914350459')!; // 900 @ 06-12
    const incoming = {
      ...purchase,
      rowId: 'INCOMING-9',
      kind: 'transfer' as const,
      direction: 'in' as const,
      counterpartyName: 'Bianca',
      amountCents: 400,
      localDay: '2026-06-13',
      importable: false,
    };
    // Only the purchase + its repayment in scope → unambiguous link.
    const bridges = detectReimbursementBridges({ drafts: [purchase, incoming] });
    expect(bridges).toHaveLength(1);
    expect(bridges[0]!.candidate.rowId).toBe('CARD-3914350459');
    expect(bridges[0]!.ownerShareCents).toBe(500);

    const { participantId } = { participantId: 'bianca' };
    const result = await commitWiseImport({
      drafts: [purchase],
      tripId: 'trip-1',
      budgetPoolId: 'pool-1',
      walletId: 'wise-wallet',
      fallbackPhaseId: 'phase-jun',
      ownerId: 'owner-1',
      bridges: { [bridges[0]!.candidate.rowId]: { participantId, shareAmountCents: bridges[0]!.transferAmountCents } },
    });
    expect(result.transactionIds).toHaveLength(1);
    const shares = await db.participantShares.toArray();
    expect(shares.find((s) => s.participantId === 'bianca')?.shareAmountCents).toBe(400);
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

  // Julio field feedback: each imported row must land in the pool of the phase
  // that owns ITS date — not the first linked pool. With two trechos split by
  // date, the 13–15 Jun rows go to the late pool, the 02/12 Jun rows to early.
  it('routes each row to the pool of the phase that owns its date', async () => {
    const plan = classifyWiseRows(parseWiseCsv(STATEMENT), {
      existingTransactions: [],
      phases: TWO_PHASES,
    });
    await commitWiseImport({
      drafts: plan.drafts,
      tripId: 'trip-1',
      budgetPoolId: 'pool-fallback',
      walletId: 'wise-wallet',
      fallbackPhaseId: 'ph-late',
      poolByPhaseId: { 'ph-early': 'pool-early', 'ph-late': 'pool-late' },
    });

    const stored = await db.transactions.toArray();
    const late = stored.find((t) => t.externalRef === wiseExternalRef('CARD-3927313014'));
    expect(late?.phaseId).toBe('ph-late'); // 15 Jun
    expect(late?.budgetPoolId).toBe('pool-late');

    const early = stored.find((t) => t.externalRef === wiseExternalRef('CARD-3915613973'));
    expect(early?.phaseId).toBe('ph-early'); // 12 Jun
    expect(early?.budgetPoolId).toBe('pool-early');

    // No row leaked into the fallback pool — every date matched a phase.
    expect(stored.every((t) => t.budgetPoolId !== 'pool-fallback')).toBe(true);
  });

  // The import-level override forces ALL rows into one phase + its pool,
  // regardless of each row's date.
  it('forcePhaseId overrides every row into one phase and its pool', async () => {
    const plan = classifyWiseRows(parseWiseCsv(STATEMENT), {
      existingTransactions: [],
      phases: TWO_PHASES,
    });
    await commitWiseImport({
      drafts: plan.drafts,
      tripId: 'trip-1',
      budgetPoolId: 'pool-fallback',
      walletId: 'wise-wallet',
      fallbackPhaseId: 'ph-late',
      poolByPhaseId: { 'ph-early': 'pool-early', 'ph-late': 'pool-late' },
      forcePhaseId: 'ph-early',
    });

    const stored = await db.transactions.toArray();
    expect(stored.every((t) => t.phaseId === 'ph-early')).toBe(true);
    expect(stored.every((t) => t.budgetPoolId === 'pool-early')).toBe(true);
  });
});
