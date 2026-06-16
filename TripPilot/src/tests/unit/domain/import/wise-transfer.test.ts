import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import {
  matchParticipantByName,
  transferAllocationStatus,
  buildDefaultAllocations,
  allocationsTotalCents,
  newAllocationId,
  type WiseAllocation,
} from '@/domain/import';
import type { WiseImportDraft } from '@/domain/import';
import { commitWiseTransfers, undoWiseImportBatch } from '@/domain/orchestrators';
import { calculateDebts, buildSharesWithPayer } from '@/domain/splitting';
import { createExpenseTransaction } from '@/domain/transactions';
import type { Participant } from '@/domain/types/participant';

const participant = (id: string, name: string, overrides: Partial<Participant> = {}): Participant => ({
  id,
  tripId: 'trip-1',
  name,
  nickname: null,
  isOwner: false,
  email: null,
  linkedUserAccountId: null,
  linkedActorId: null,
  deletedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  revision: 1,
  sourceDeviceId: 'test',
  ...overrides,
});

const OWNER = participant('owner', 'Júlio', { isOwner: true });
const BRUNO = participant('bruno', 'Bruno');

const transferDraft = (overrides: Partial<WiseImportDraft> = {}): WiseImportDraft => ({
  rowId: 'TRANSFER-2188321339',
  externalRef: 'wise:TRANSFER-2188321339',
  kind: 'transfer',
  status: 'new',
  amountCents: 4400,
  signedAmountCents: -4400,
  currency: 'EUR',
  description: 'Bruno Pessoa de Oliveira',
  merchant: null,
  counterpartyName: 'Bruno Pessoa de Oliveira',
  direction: 'out',
  city: null,
  category: 'other',
  dateIso: '2026-06-12T16:25:15.000Z',
  localDay: '2026-06-12',
  phaseId: 'phase-jun',
  manualDupTxId: null,
  importable: false,
  includeByDefault: false,
  ...overrides,
});

const alloc = (kind: WiseAllocation['kind'], amountCents: number, extra: Partial<WiseAllocation> = {}): WiseAllocation => ({
  id: newAllocationId(),
  kind,
  amountCents,
  ...extra,
});

describe('matchParticipantByName', () => {
  it('matches a full statement name to a short participant name (Bruno ⊂ Bruno Pessoa de Oliveira)', () => {
    const match = matchParticipantByName('Bruno Pessoa de Oliveira', [OWNER, BRUNO]);
    expect(match?.participantId).toBe('bruno');
    expect(match!.score).toBeGreaterThanOrEqual(80);
  });

  it('never matches the owner', () => {
    const match = matchParticipantByName('Júlio César', [OWNER]);
    expect(match).toBeNull();
  });

  it('matches a nickname and ignores accents/case', () => {
    const ze = participant('ze', 'José Silva', { nickname: 'Zé' });
    expect(matchParticipantByName('ZE', [OWNER, ze])?.participantId).toBe('ze');
    expect(matchParticipantByName('jose silva', [OWNER, ze])?.participantId).toBe('ze');
  });

  it('returns null below the confidence floor', () => {
    expect(matchParticipantByName('Mercadona Burgos', [OWNER, BRUNO])).toBeNull();
    expect(matchParticipantByName('', [OWNER, BRUNO])).toBeNull();
    expect(matchParticipantByName(null, [OWNER, BRUNO])).toBeNull();
  });

  it('picks the strongest of several candidates', () => {
    const bruna = participant('bruna', 'Bruna');
    const brunoFull = participant('bruno', 'Bruno Pessoa');
    const match = matchParticipantByName('Bruno Pessoa de Oliveira', [bruna, brunoFull]);
    expect(match?.participantId).toBe('bruno');
  });
});

describe('transferAllocationStatus / allocationsTotalCents', () => {
  it('is balanced only when slices sum exactly to the transfer', () => {
    const allocs = [alloc('pay_debt', 3000), alloc('person_paid_expense', 1400, { category: 'bar' })];
    expect(allocationsTotalCents(allocs)).toBe(4400);
    const status = transferAllocationStatus(4400, allocs);
    expect(status.balanced).toBe(true);
    expect(status.remainingCents).toBe(0);
    expect(status.amountsValid).toBe(true);
  });

  it('reports the remaining amount when under/over assigned', () => {
    expect(transferAllocationStatus(4400, [alloc('pay_debt', 3000)]).remainingCents).toBe(1400);
    expect(transferAllocationStatus(4400, [alloc('pay_debt', 5000)]).remainingCents).toBe(-600);
  });

  it('ignore slices do not count toward the total', () => {
    const allocs = [alloc('settle_incoming', 1000), alloc('ignore', 500)];
    expect(allocationsTotalCents(allocs)).toBe(1000);
    expect(transferAllocationStatus(1000, allocs).balanced).toBe(true);
  });

  it('flags a non-positive slice as invalid amounts', () => {
    expect(transferAllocationStatus(1000, [alloc('pay_debt', 0)]).amountsValid).toBe(false);
  });
});

describe('buildDefaultAllocations', () => {
  it('outgoing: settles the existing debt first, then the rest is a reimbursed expense', () => {
    const allocs = buildDefaultAllocations({
      direction: 'out',
      transferAmountCents: 4400,
      debtToPersonCents: 3000,
      debtFromPersonCents: 0,
      hasParticipant: true,
      defaultCategory: 'other',
    });
    expect(allocs.map((a) => [a.kind, a.amountCents])).toEqual([
      ['pay_debt', 3000],
      ['person_paid_expense', 1400],
    ]);
    expect(allocationsTotalCents(allocs)).toBe(4400);
  });

  it('outgoing without a participant is a plain expense', () => {
    const allocs = buildDefaultAllocations({
      direction: 'out',
      transferAmountCents: 4400,
      debtToPersonCents: 0,
      debtFromPersonCents: 0,
      hasParticipant: false,
      defaultCategory: 'transport',
    });
    expect(allocs).toHaveLength(1);
    expect(allocs[0]!.kind).toBe('my_expense');
    expect(allocs[0]!.category).toBe('transport');
  });

  it('incoming settles what the person owes me, leaving any surplus to the user', () => {
    const allocs = buildDefaultAllocations({
      direction: 'in',
      transferAmountCents: 5000,
      debtToPersonCents: 0,
      debtFromPersonCents: 3000,
      hasParticipant: true,
      defaultCategory: 'other',
    });
    expect(allocs.map((a) => [a.kind, a.amountCents])).toEqual([
      ['settle_incoming', 3000],
      ['ignore', 2000],
    ]);
  });
});

describe('commitWiseTransfers', () => {
  beforeEach(async () => {
    await Promise.all([
      db.transactions.clear(),
      db.participantShares.clear(),
      db.settlements.clear(),
    ]);
  });

  const baseInput = {
    tripId: 'trip-1',
    ownerId: 'owner',
    budgetPoolId: 'pool-1',
    sourceWalletId: 'wise',
    fallbackPhaseId: 'phase-jun',
    baseCurrency: 'EUR',
  };

  it('person_paid_expense records the expense and settles the debt → net zero, budget +expense', async () => {
    const result = await commitWiseTransfers({
      ...baseInput,
      specs: [
        {
          draft: transferDraft({ amountCents: 1400 }),
          participantId: 'bruno',
          allocations: [alloc('person_paid_expense', 1400, { category: 'bar' })],
        },
      ],
    });

    const txs = await db.transactions.toArray();
    const shares = await db.participantShares.toArray();
    const settlements = await db.settlements.toArray();

    expect(txs).toHaveLength(1);
    expect(txs[0]!.type).toBe('expense');
    expect(txs[0]!.category).toBe('bar');
    expect(txs[0]!.personalCostCents).toBe(1400);
    expect(txs[0]!.paidByParticipantId).toBe('bruno');
    expect(txs[0]!.walletId).toBeNull();
    expect(txs[0]!.externalRef).toBe('wise:TRANSFER-2188321339');
    expect(settlements).toHaveLength(1);
    expect(settlements[0]!.debtorParticipantId).toBe('owner');
    expect(settlements[0]!.creditorParticipantId).toBe('bruno');
    expect(settlements[0]!.externalRef).toBe('wise:TRANSFER-2188321339');
    expect(result.transactionIds).toHaveLength(1);
    expect(result.settlementIds).toHaveLength(1);

    const debts = calculateDebts(txs, shares, [OWNER, BRUNO], settlements, 'owner');
    expect(debts.totalDebtCents).toBe(0);
  });

  it('pay_debt clears a pre-existing debt I owe the person (net zero)', async () => {
    // Pre-existing debt: Bruno paid €30 for me earlier → I owe Bruno 30.
    const prior = createExpenseTransaction({
      tripId: 'trip-1',
      phaseId: 'phase-jun',
      budgetPoolId: 'pool-1',
      walletId: null,
      amountCents: 3000,
      currency: 'EUR',
      category: 'other',
      description: 'cash from Bruno',
      isShared: true,
      paidByParticipantId: 'bruno',
    });
    const priorShares = buildSharesWithPayer({
      transactionId: prior.id,
      amountCents: 3000,
      participantIds: ['owner'],
      paidByParticipantId: 'bruno',
      shareType: 'equal',
      customAmountsCents: {},
    }).map((s) => (s.participantId === 'owner' ? { ...s, confirmationStatus: 'confirmed' as const } : s));
    await db.transactions.add(prior);
    await db.participantShares.bulkAdd(priorShares);

    const before = calculateDebts(
      await db.transactions.toArray(),
      await db.participantShares.toArray(),
      [OWNER, BRUNO],
      [],
      'owner',
    );
    expect(before.totalDebtCents).toBe(3000);

    await commitWiseTransfers({
      ...baseInput,
      specs: [
        {
          draft: transferDraft({ amountCents: 3000 }),
          participantId: 'bruno',
          allocations: [alloc('pay_debt', 3000)],
        },
      ],
    });

    const after = calculateDebts(
      await db.transactions.toArray(),
      await db.participantShares.toArray(),
      [OWNER, BRUNO],
      await db.settlements.toArray(),
      'owner',
    );
    expect(after.totalDebtCents).toBe(0);
  });

  it('wallet_transfer creates a Wise→target move (no settlement, no budget pool)', async () => {
    await commitWiseTransfers({
      ...baseInput,
      specs: [
        {
          draft: transferDraft({ amountCents: 3000 }),
          participantId: 'bruno',
          allocations: [alloc('wallet_transfer', 3000, { targetWalletId: 'cash' })],
        },
      ],
    });
    const txs = await db.transactions.toArray();
    const settlements = await db.settlements.toArray();
    expect(settlements).toHaveLength(0);
    expect(txs).toHaveLength(1);
    expect(txs[0]!.type).toBe('transfer');
    expect(txs[0]!.sourceWalletId).toBe('wise');
    expect(txs[0]!.targetWalletId).toBe('cash');
    expect(txs[0]!.budgetPoolId).toBeNull();
    expect(txs[0]!.externalRef).toBe('wise:TRANSFER-2188321339');
  });

  it('splits one transfer into pay_debt + person_paid_expense summing exactly', async () => {
    const result = await commitWiseTransfers({
      ...baseInput,
      specs: [
        {
          draft: transferDraft({ amountCents: 4400 }),
          participantId: 'bruno',
          allocations: [
            alloc('pay_debt', 3000),
            alloc('person_paid_expense', 1400, { category: 'bar' }),
          ],
        },
      ],
    });
    const txs = await db.transactions.toArray();
    const settlements = await db.settlements.toArray();
    expect(txs).toHaveLength(1); // only the reimbursed expense
    expect(settlements).toHaveLength(2); // pay_debt + the reimbursement
    const totalSettled = settlements.reduce((s, x) => s + x.amountCents, 0);
    expect(totalSettled).toBe(4400);
    expect(result.transactionIds).toHaveLength(1);
    expect(result.settlementIds).toHaveLength(2);
  });

  it('incoming settle_incoming records the person paying me back', async () => {
    await commitWiseTransfers({
      ...baseInput,
      specs: [
        {
          draft: transferDraft({ amountCents: 2000, direction: 'in', signedAmountCents: 2000 }),
          participantId: 'bruno',
          allocations: [alloc('settle_incoming', 2000)],
        },
      ],
    });
    const settlements = await db.settlements.toArray();
    expect(settlements).toHaveLength(1);
    expect(settlements[0]!.debtorParticipantId).toBe('bruno');
    expect(settlements[0]!.creditorParticipantId).toBe('owner');
  });

  it('undo soft-deletes every record the transfer created', async () => {
    const result = await commitWiseTransfers({
      ...baseInput,
      specs: [
        {
          draft: transferDraft({ amountCents: 4400 }),
          participantId: 'bruno',
          allocations: [
            alloc('pay_debt', 3000),
            alloc('person_paid_expense', 1400, { category: 'bar' }),
          ],
        },
      ],
    });
    await undoWiseImportBatch(result);

    const txs = await db.transactions.toArray();
    const shares = await db.participantShares.toArray();
    const settlements = await db.settlements.toArray();
    expect(txs.every((t) => t.deletedAt !== null)).toBe(true);
    expect(shares.every((s) => s.deletedAt !== null)).toBe(true);
    expect(settlements.every((s) => s.deletedAt !== null)).toBe(true);
  });
});
