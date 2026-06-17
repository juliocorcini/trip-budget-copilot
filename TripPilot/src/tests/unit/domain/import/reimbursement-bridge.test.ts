import { describe, it, expect } from 'vitest';
import { detectReimbursementBridges } from '@/domain/import/reimbursement-bridge';
import type { WiseImportDraft, WiseDraftKind } from '@/domain/import';

let seq = 0;
const draft = (over: Partial<WiseImportDraft> & { kind: WiseDraftKind }): WiseImportDraft => {
  seq += 1;
  const rowId = over.rowId ?? `row-${seq}`;
  return {
    rowId,
    externalRef: `wise:${rowId}`,
    status: 'new',
    amountCents: 0,
    signedAmountCents: 0,
    currency: 'EUR',
    description: '',
    merchant: null,
    counterpartyName: null,
    direction: 'out',
    city: null,
    category: 'other',
    dateIso: '2026-06-10T12:00:00.000Z',
    localDay: '2026-06-10',
    phaseId: 'phase-1',
    inPhase: true,
    manualDupTxId: null,
    importable: true,
    includeByDefault: true,
    ...over,
  };
};

const purchase = (over: Partial<WiseImportDraft>) =>
  draft({ kind: 'expense', direction: 'out', ...over });
const incoming = (over: Partial<WiseImportDraft>) =>
  draft({ kind: 'transfer', direction: 'in', ...over });

describe('detectReimbursementBridges', () => {
  it('links an incoming repayment to a recent larger purchase (the Paylogic case)', () => {
    const drafts = [
      purchase({
        rowId: 'paylogic',
        description: 'Paylogic',
        amountCents: 15000,
        localDay: '2026-06-10',
        category: 'entertainment',
      }),
      incoming({
        rowId: 'bianca',
        counterpartyName: 'Bianca Souza',
        amountCents: 10000,
        localDay: '2026-06-12',
      }),
    ];

    const bridges = detectReimbursementBridges({ drafts });
    expect(bridges).toHaveLength(1);
    const [b] = bridges;
    expect(b!.transferRowId).toBe('bianca');
    expect(b!.candidate.rowId).toBe('paylogic');
    expect(b!.transferAmountCents).toBe(10000);
    expect(b!.ownerShareCents).toBe(5000); // 150 − 100
    expect(b!.daysApart).toBe(2);
    expect(b!.counterpartyName).toBe('Bianca Souza');
    expect(b!.score).toBeGreaterThanOrEqual(80);
  });

  it('rejects a repayment larger than any purchase (cannot be a share)', () => {
    const drafts = [
      purchase({ rowId: 'p', amountCents: 8000, localDay: '2026-06-10' }),
      incoming({ rowId: 't', amountCents: 12000, localDay: '2026-06-11' }),
    ];
    expect(detectReimbursementBridges({ drafts })).toHaveLength(0);
  });

  it('rejects a pairing outside the time window', () => {
    const drafts = [
      purchase({ rowId: 'p', amountCents: 10000, localDay: '2026-05-01' }),
      incoming({ rowId: 't', amountCents: 5000, localDay: '2026-06-30' }),
    ];
    expect(detectReimbursementBridges({ drafts })).toHaveLength(0);
  });

  it('honors a custom window and minScore', () => {
    const drafts = [
      purchase({ rowId: 'p', amountCents: 10000, localDay: '2026-06-01' }),
      incoming({ rowId: 't', amountCents: 5000, localDay: '2026-06-25' }), // 24 days
    ];
    expect(detectReimbursementBridges({ drafts })).toHaveLength(0); // default 21d
    expect(detectReimbursementBridges({ drafts, windowDays: 30 })).toHaveLength(1);
    // 24/30 of the window → ~64 score; a high floor drops it.
    expect(detectReimbursementBridges({ drafts, windowDays: 30, minScore: 90 })).toHaveLength(0);
  });

  it('assigns one purchase per repayment, strongest links first (greedy 1:1)', () => {
    const drafts = [
      purchase({ rowId: 'p-near', amountCents: 10000, localDay: '2026-06-10' }),
      purchase({ rowId: 'p-far', amountCents: 10000, localDay: '2026-06-01' }),
      incoming({ rowId: 't-a', amountCents: 4000, localDay: '2026-06-10' }), // same day as p-near
      incoming({ rowId: 't-b', amountCents: 4000, localDay: '2026-06-02' }), // near p-far
    ];
    const bridges = detectReimbursementBridges({ drafts });
    expect(bridges).toHaveLength(2);
    const byTransfer = Object.fromEntries(bridges.map((b) => [b.transferRowId, b.candidate.rowId]));
    expect(byTransfer['t-a']).toBe('p-near');
    expect(byTransfer['t-b']).toBe('p-far');
  });

  it('never reuses the same purchase for two repayments', () => {
    const drafts = [
      purchase({ rowId: 'only', amountCents: 20000, localDay: '2026-06-10' }),
      incoming({ rowId: 't1', amountCents: 5000, localDay: '2026-06-10' }),
      incoming({ rowId: 't2', amountCents: 5000, localDay: '2026-06-11' }),
    ];
    const bridges = detectReimbursementBridges({ drafts });
    expect(bridges).toHaveLength(1);
    expect(bridges[0]!.candidate.rowId).toBe('only');
  });

  it('detects a full reimbursement (ratio 1) with ownerShare 0 and a softer score', () => {
    const drafts = [
      purchase({ rowId: 'p', amountCents: 10000, localDay: '2026-06-10' }),
      incoming({ rowId: 't', amountCents: 10000, localDay: '2026-06-10' }),
    ];
    const [b] = detectReimbursementBridges({ drafts });
    expect(b!.ownerShareCents).toBe(0);
    // Same day full repay: 100 − 12 (ratio penalty) = 88.
    expect(b!.score).toBe(88);
  });

  it('penalizes a repayment that lands before the purchase', () => {
    const before = detectReimbursementBridges({
      drafts: [
        purchase({ rowId: 'p', amountCents: 10000, localDay: '2026-06-10' }),
        incoming({ rowId: 't', amountCents: 5000, localDay: '2026-06-08' }),
      ],
    })[0]!;
    const after = detectReimbursementBridges({
      drafts: [
        purchase({ rowId: 'p2', amountCents: 10000, localDay: '2026-06-10' }),
        incoming({ rowId: 't2', amountCents: 5000, localDay: '2026-06-12' }),
      ],
    })[0]!;
    expect(before.score).toBeLessThan(after.score);
  });

  it('ignores outgoing transfers, credits, fees, and duplicate rows', () => {
    const drafts = [
      purchase({ rowId: 'p', amountCents: 10000, localDay: '2026-06-10' }),
      // outgoing transfer — not a repayment to me
      draft({ kind: 'transfer', direction: 'out', rowId: 'out', amountCents: 5000, localDay: '2026-06-10' }),
      // incoming but already imported
      incoming({ rowId: 'dup', amountCents: 5000, localDay: '2026-06-10', status: 'duplicate_import' }),
      // credit (display-only)
      draft({ kind: 'credit', direction: 'in', rowId: 'cr', amountCents: 5000, localDay: '2026-06-10' }),
    ];
    expect(detectReimbursementBridges({ drafts })).toHaveLength(0);
  });

  it('does not match a repayment against an already-imported purchase', () => {
    const drafts = [
      purchase({ rowId: 'p', amountCents: 10000, localDay: '2026-06-10', status: 'duplicate_import', importable: false }),
      incoming({ rowId: 't', amountCents: 5000, localDay: '2026-06-10' }),
    ];
    expect(detectReimbursementBridges({ drafts })).toHaveLength(0);
  });
});
