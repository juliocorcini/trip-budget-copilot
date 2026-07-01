import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { parseWiseCsv } from '@/domain/import/wise-csv';
import { classifyWiseRows, wiseExternalRef, newAllocationId } from '@/domain/import';
import { commitWiseTransfers } from '@/domain/orchestrators';
import { calculateTodayFreeBudget } from '@/domain/phases/rhythm';
import { createExpenseTransaction } from '@/domain/transactions';
import type { Phase } from '@/domain/types/phase';
import type { Transaction } from '@/domain/types/transaction';

/**
 * G0 characterization proofs (zero production code) for the "Import/cofrinho/
 * acerto de verdade + mapas + conversor/IA/amigo" wave (DEC-413→425). Each proof
 * documents the CURRENT (pre-fix) behaviour so the later gates can prove they
 * changed it. These are the "before" snapshots referenced by the ÂNCORA:
 *  - Proof A → G2 (import idempotence: a re-imported transfer duplicates today).
 *  - Proof B → G4 (money invariant: "livre hoje" inflates when underspending).
 *  - Proof C → G5 (Amigo variety: the trigger is the most-recent-by-date tx).
 */

/* ─────────── Proof A (→ G2): a re-imported transfer duplicates today ─────────── */

const HEADER =
  '"TransferWise ID",Date,"Date Time",Amount,Currency,Description,"Payment Reference","Running Balance","Exchange From","Exchange To","Exchange Rate","Payer Name","Payee Name","Payee Account Number",Merchant,"Card Last Four Digits","Card Holder Full Name",Attachment,Note,"Total fees","Exchange To Amount","Transaction Type","Transaction Details Type"';

// A single outgoing TRANSFER to a named person — the kind that commits ONLY as a
// Settlement (pay_debt), leaving no transaction to dedupe against.
const TRANSFER_ROW =
  'TRANSFER-2188321339,12-06-2026,"12-06-2026 16:25:15.689",-44.00,EUR,"Enviou dinheiro para Bruno Pessoa de Oliveira","parral + ivan",563.48,,,,,"Bruno Pessoa de Oliveira",35855771,,,,,,0.00,,DEBIT,TRANSFER';
const TRANSFER_STATEMENT = [HEADER, TRANSFER_ROW, ''].join('\r\n');

const proofPhase: Phase = {
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
} as Phase;

describe('G0 proof A (→ G2): re-importing a transfer duplicates it today', () => {
  beforeEach(async () => {
    await db.transactions.clear();
    await db.settlements.clear();
  });

  it('a transfer committed as a debt settlement leaves NO transaction (only a settlement with externalRef)', async () => {
    const plan = classifyWiseRows(parseWiseCsv(TRANSFER_STATEMENT), {
      existingTransactions: [],
      phases: [proofPhase],
    });
    const transfer = plan.drafts.find((d) => d.kind === 'transfer')!;
    expect(transfer).toBeDefined();
    expect(transfer.amountCents).toBe(4400);

    // Commit it as "I paid a debt to Bruno" → a Settlement, no transaction.
    const result = await commitWiseTransfers({
      specs: [
        {
          draft: transfer,
          participantId: 'bruno',
          allocations: [{ id: newAllocationId(), kind: 'pay_debt', amountCents: 4400 }],
        },
      ],
      tripId: 'trip-1',
      ownerId: 'owner-1',
      budgetPoolId: 'pool-1',
      sourceWalletId: 'wise-wallet',
      fallbackPhaseId: 'phase-jun',
      baseCurrency: 'EUR',
    });

    const txs = await db.transactions.toArray();
    const settlements = await db.settlements.toArray();
    // The transfer produced ZERO transactions and exactly one settlement…
    expect(txs).toHaveLength(0);
    expect(result.transactionIds).toHaveLength(0);
    expect(settlements).toHaveLength(1);
    // …carrying the cross-source dedupe ref (this is the only trace on the device).
    expect(settlements[0]!.externalRef).toBe(wiseExternalRef('TRANSFER-2188321339'));
  });

  it('re-classifying the same statement the way the caller does today (transactions only) shows the transfer as NEW again — the bug', async () => {
    const first = classifyWiseRows(parseWiseCsv(TRANSFER_STATEMENT), {
      existingTransactions: [],
      phases: [proofPhase],
    });
    await commitWiseTransfers({
      specs: [
        {
          draft: first.drafts.find((d) => d.kind === 'transfer')!,
          participantId: 'bruno',
          allocations: [{ id: newAllocationId(), kind: 'pay_debt', amountCents: 4400 }],
        },
      ],
      tripId: 'trip-1',
      ownerId: 'owner-1',
      budgetPoolId: 'pool-1',
      sourceWalletId: 'wise-wallet',
      fallbackPhaseId: 'phase-jun',
      baseCurrency: 'EUR',
    });

    const storedTxs = await db.transactions.toArray();
    // WiseImportPage.tsx (L293/L364) passes ONLY `existingTransactions` — never
    // `existingSettlements`. Re-classified that way, the already-imported transfer
    // is unrecognized and comes back as an actionable NEW transfer (duplicate).
    const secondAsCallerDoesToday = classifyWiseRows(parseWiseCsv(TRANSFER_STATEMENT), {
      existingTransactions: storedTxs,
      phases: [proofPhase],
    });
    const dupTransfer = secondAsCallerDoesToday.drafts.find((d) => d.kind === 'transfer')!;
    expect(dupTransfer.status).toBe('new');
    expect(secondAsCallerDoesToday.summary.transferCount).toBe(1);
    expect(secondAsCallerDoesToday.summary.duplicateImportCount).toBe(0);
  });

  it('the domain ALREADY dedupes when settlements are passed — G2 is caller wiring + a toggle, not new domain math', async () => {
    const first = classifyWiseRows(parseWiseCsv(TRANSFER_STATEMENT), {
      existingTransactions: [],
      phases: [proofPhase],
    });
    await commitWiseTransfers({
      specs: [
        {
          draft: first.drafts.find((d) => d.kind === 'transfer')!,
          participantId: 'bruno',
          allocations: [{ id: newAllocationId(), kind: 'pay_debt', amountCents: 4400 }],
        },
      ],
      tripId: 'trip-1',
      ownerId: 'owner-1',
      budgetPoolId: 'pool-1',
      sourceWalletId: 'wise-wallet',
      fallbackPhaseId: 'phase-jun',
      baseCurrency: 'EUR',
    });

    const storedSettlements = await db.settlements.toArray();
    const secondWithSettlements = classifyWiseRows(parseWiseCsv(TRANSFER_STATEMENT), {
      existingTransactions: [],
      existingSettlements: storedSettlements,
      phases: [proofPhase],
    });
    const deduped = secondWithSettlements.drafts.find((d) => d.kind === 'transfer')!;
    expect(deduped.status).toBe('duplicate_import');
    expect(secondWithSettlements.summary.duplicateImportCount).toBe(1);
    expect(secondWithSettlements.summary.transferCount).toBe(0);
  });
});

/* ───── Proof B (→ G4): "livre hoje" inflates when a day is underspent ───── */

describe('G0 proof B (→ G4): calculateTodayFreeBudget raises tomorrow\'s allowance when today is underspent', () => {
  // Uniform 10-day phase; €90 of free money remaining, nothing spent yet.
  const phase10: Phase = { ...proofPhase, startDate: '2026-06-10', endDate: '2026-06-19' };
  const freeCents = 9000;

  it('same remaining free money spread over fewer days → the daily number goes UP', () => {
    // Day 1 of the window: 10 effective days → €9/day.
    const day1 = calculateTodayFreeBudget(freeCents, 0, phase10, '2026-06-10');
    // Next day, still €90 free (yesterday was a no-spend day): 9 days → €10/day.
    const day2 = calculateTodayFreeBudget(freeCents, 0, phase10, '2026-06-11');

    expect(day1.todayAllowanceCents).toBe(900); // round(9000 * 1 / 10)
    expect(day2.todayAllowanceCents).toBe(1000); // round(9000 * 1 / 9)
    // The leftover from not spending re-inflates the daily hero instead of being
    // parked (the cofrinho keeps it correctly — G4 caps the hero to match).
    expect(day2.todayAllowanceCents).toBeGreaterThan(day1.todayAllowanceCents);
  });

  it('the total free money is unchanged — only the daily reading inflates', () => {
    const day1 = calculateTodayFreeBudget(freeCents, 0, phase10, '2026-06-10');
    const day2 = calculateTodayFreeBudget(freeCents, 0, phase10, '2026-06-11');
    // The flat "average to the end" also tells the honest story (€90 / days left),
    // and it is NOT the inflated hero number — G4 makes the hero respect this cap.
    expect(day1.avgUntilEndFlatCents).toBe(900); // 9000 / 10
    expect(day2.avgUntilEndFlatCents).toBe(1000); // 9000 / 9
  });
});

/* ───── Proof C (→ G5): the Amigo trigger is the most-recent-by-date tx ───── */

function expenseAt(dateIso: string, amountCents: number): Transaction {
  return createExpenseTransaction({
    tripId: 'trip-1',
    phaseId: 'phase-jun',
    budgetPoolId: 'pool-1',
    walletId: 'wallet-1',
    amountCents,
    currency: 'EUR',
    baseCurrencyAmountCents: amountCents,
    exchangeRate: null,
    category: 'other',
    description: `expense ${amountCents}`,
    date: dateIso,
  });
}

describe('G0 proof C (→ G5): amigoTriggerTx picks the most recent by date, ignoring relevance', () => {
  // Mirrors useDashboardModel.ts L726-729 EXACTLY (the trigger selection today):
  //   [...phaseTxsForInsights].filter(expense).sort((a,b)=>b.date.localeCompare(a.date))[0]
  const selectAmigoTrigger = (txs: Transaction[]): Transaction | null =>
    [...txs]
      .filter((tx) => tx.type === 'expense')
      .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;

  it('a trivial recent expense is chosen over a much larger older one', () => {
    const bigOld = expenseAt('2026-06-01', 20000); // €200, the notable spend
    const tinyRecent = expenseAt('2026-06-15', 300); // €3 coffee, most recent
    const picked = selectAmigoTrigger([bigOld, tinyRecent]);
    // The €3 coffee wins purely because it is the latest date — magnitude/relevance
    // is never considered, so the Amigo fixates on the wrong expense.
    expect(picked?.id).toBe(tinyRecent.id);
    expect(picked?.amountCents).toBe(300);
  });

  it('an old expensive expense stays "stuck" until something with a later date arrives', () => {
    const expensiveTicket = expenseAt('2026-06-02', 15000); // €150 concert ticket
    const cheaperButOlder = expenseAt('2026-05-30', 500);
    // With no later-dated expense, the batch's newest is the €150 ticket and it
    // remains the trigger indefinitely (the reported "always the same expense").
    expect(selectAmigoTrigger([expensiveTicket, cheaperButOlder])?.id).toBe(expensiveTicket.id);
  });
});
