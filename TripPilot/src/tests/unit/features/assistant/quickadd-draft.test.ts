import { describe, it, expect } from 'vitest';
import {
  expenseOpToQuickAddDraft,
  resolveDraftSplitState,
  isoToDatetimeLocal,
} from '@/features/assistant/assistant-quickadd-draft';
import { buildActionPlan, type PlanContext, type ExecOp } from '@/domain/assistant/plan';
import type { AiIntent } from '@/domain/assistant/intent';
import type { Participant } from '@/domain/types/participant';
import type { Wallet } from '@/domain/types/wallet';

/**
 * DEC-246 — the AI → QuickAdd "open full editor" escape hatch. These cover the
 * PURE hand-off mappings: an expense op → the pre-fill draft, the draft's
 * payer/participants → QuickAdd's split state, and the ISO → datetime-local
 * conversion. End-to-end cases drive the real planner so a misclassification can
 * never silently corrupt the pre-filled split.
 */

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test',
};

function mkParticipant(id: string, name: string, overrides: Partial<Participant> = {}): Participant {
  return {
    ...meta,
    id,
    tripId: 'trip-1',
    name,
    nickname: null,
    isOwner: false,
    email: null,
    linkedUserAccountId: null,
    linkedActorId: null,
    ...overrides,
  };
}

const owner = mkParticipant('owner', 'Julio', { isOwner: true });
const bruno = mkParticipant('bruno', 'Bruno');
const debora = mkParticipant('debora', 'Débora');

const cashWallet: Wallet = {
  ...meta,
  id: 'w1',
  tripId: 'trip-1',
  name: 'Carteira',
  walletType: 'cash',
  currency: 'EUR',
  initialBalanceCents: 0,
  isDefault: true,
  notes: null,
};

function mkIntent(partial: Partial<AiIntent> & { action: AiIntent['action'] }): AiIntent {
  return {
    amount: null,
    currency: null,
    toCurrency: null,
    description: null,
    category: null,
    person: null,
    participants: [],
    payer: null,
    direction: null,
    fromWallet: null,
    toWallet: null,
    place: null,
    date: null,
    itemName: null,
    screen: null,
    note: null,
    confidence: null,
    ...partial,
  };
}

function mkCtx(overrides: Partial<PlanContext> = {}): PlanContext {
  return {
    tripId: 'trip-1',
    baseCurrency: 'EUR',
    phaseId: 'ph-1',
    owner,
    participants: [owner, bruno, debora],
    connectedParticipantIds: [],
    wallets: [cashWallet],
    defaultPoolId: 'pool-1',
    defaultWalletId: 'w1',
    defaultSourceWalletId: 'w1',
    defaultTargetWalletId: 'w1',
    place: null,
    knownPlaces: [],
    now: new Date('2026-07-10T12:00:00.000Z'),
    ...overrides,
  };
}

function expenseOp(overrides: Partial<Extract<ExecOp, { kind: 'expense' }>> = {}): Extract<ExecOp, { kind: 'expense' }> {
  return {
    kind: 'expense',
    tripId: 'trip-1',
    phaseId: 'ph-1',
    budgetPoolId: 'pool-1',
    walletId: 'w1',
    amountCents: 1280,
    currency: 'EUR',
    category: 'restaurant',
    description: 'tortilhas',
    date: undefined,
    place: null,
    ownerId: 'owner',
    payerId: 'owner',
    didSplit: false,
    participantIds: [],
    connectedParticipantIds: [],
    ...overrides,
  };
}

describe('expenseOpToQuickAddDraft', () => {
  it('maps an own-money expense to a draft (base currency → null, cents → major)', () => {
    const draft = expenseOpToQuickAddDraft(expenseOp(), 'EUR');
    expect(draft.type).toBe('expense');
    expect(draft.amount).toBe(12.8);
    expect(draft.currency).toBeNull(); // base currency is implicit on the form
    expect(draft.category).toBe('restaurant');
    expect(draft.description).toBe('tortilhas');
    expect(draft.poolId).toBe('pool-1');
    expect(draft.walletId).toBe('w1');
    expect(draft.payerId).toBe('owner');
    expect(draft.participantIds).toEqual([]);
    expect(draft.shareType).toBe('equal');
  });

  it('keeps a FOREIGN currency code so QuickAdd shows the rate field', () => {
    const draft = expenseOpToQuickAddDraft(expenseOp({ currency: 'USD', amountCents: 5000 }), 'EUR');
    expect(draft.currency).toBe('USD');
    expect(draft.amount).toBe(50);
  });

  it('drops an empty description (QuickAdd will fall back to the category label)', () => {
    const draft = expenseOpToQuickAddDraft(expenseOp({ description: '   ' }), 'EUR');
    expect(draft.description).toBeUndefined();
  });
});

describe('resolveDraftSplitState', () => {
  it('plain expense (I paid, no one else) → not shared', () => {
    const s = resolveDraftSplitState({ payerId: 'owner', participantIds: [] }, 'owner');
    expect(s).toEqual({
      paidById: null,
      otherPaidSplit: false,
      selectedParticipantIds: [],
      isShared: false,
    });
  });

  it('I paid and we split → shared among the listed people', () => {
    const s = resolveDraftSplitState({ payerId: 'owner', participantIds: ['owner', 'bruno'] }, 'owner');
    expect(s.paidById).toBeNull();
    expect(s.isShared).toBe(true);
    expect(s.otherPaidSplit).toBe(false);
    expect(s.selectedParticipantIds).toEqual(['owner', 'bruno']);
  });

  it('I paid FOR them (owner not a sharer) → shared, owner not selected', () => {
    const s = resolveDraftSplitState({ payerId: 'owner', participantIds: ['bruno', 'debora'] }, 'owner');
    expect(s.paidById).toBeNull();
    expect(s.isShared).toBe(true);
    expect(s.selectedParticipantIds).toEqual(['bruno', 'debora']);
  });

  it('someone paid the WHOLE thing for me → full debt, no split', () => {
    const s = resolveDraftSplitState({ payerId: 'bruno', participantIds: [] }, 'owner');
    expect(s.paidById).toBe('bruno');
    expect(s.otherPaidSplit).toBe(false);
    expect(s.isShared).toBe(false);
  });

  it('someone paid AND we split → other paid + split with everyone', () => {
    const s = resolveDraftSplitState(
      { payerId: 'bruno', participantIds: ['owner', 'bruno', 'debora'] },
      'owner',
    );
    expect(s.paidById).toBe('bruno');
    expect(s.otherPaidSplit).toBe(true);
    expect(s.selectedParticipantIds).toEqual(['owner', 'bruno', 'debora']);
  });
});

describe('isoToDatetimeLocal', () => {
  it('returns empty for undefined or invalid input', () => {
    expect(isoToDatetimeLocal(undefined)).toBe('');
    expect(isoToDatetimeLocal('not-a-date')).toBe('');
  });

  it('formats a valid ISO into a datetime-local value (YYYY-MM-DDTHH:mm)', () => {
    const out = isoToDatetimeLocal('2026-07-10T08:30:00.000Z');
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    // Round-trips back to the same instant (independent of the runner's TZ).
    expect(new Date(out).getTime()).toBe(new Date('2026-07-10T08:30:00.000Z').getTime());
  });
});

describe('escape hatch end-to-end (planner → draft → QuickAdd split state)', () => {
  it('the field bug: "Bruno pagou, dividimos entre ele, eu e a Débora" pre-fills a 3-way split he paid', () => {
    const result = buildActionPlan(
      mkIntent({
        action: 'split_expense',
        amount: 12.8,
        payer: 'other',
        person: 'Bruno',
        participants: ['Bruno', 'Débora'],
        description: 'tortilhas',
      }),
      mkCtx(),
    );
    if (result.status !== 'ready' || result.plan.type !== 'execute' || result.plan.op.kind !== 'expense') {
      throw new Error('expected an executable expense');
    }
    const draft = expenseOpToQuickAddDraft(result.plan.op, 'EUR');
    expect(draft.payerId).toBe('bruno');
    expect(draft.participantIds).toEqual(expect.arrayContaining(['owner', 'bruno', 'debora']));
    expect(draft.participantIds).toHaveLength(3);

    const split = resolveDraftSplitState(draft, 'owner');
    expect(split.paidById).toBe('bruno');
    expect(split.otherPaidSplit).toBe(true);
    expect(split.selectedParticipantIds).toEqual(expect.arrayContaining(['owner', 'bruno', 'debora']));
  });

  it('"someone paid the whole thing" pre-fills a full debt (not a split)', () => {
    const result = buildActionPlan(
      mkIntent({ action: 'someone_paid', amount: 2, person: 'Bruno', category: 'cerveja' }),
      mkCtx(),
    );
    if (result.status !== 'ready' || result.plan.type !== 'execute' || result.plan.op.kind !== 'expense') {
      throw new Error('expected an executable expense');
    }
    const draft = expenseOpToQuickAddDraft(result.plan.op, 'EUR');
    const split = resolveDraftSplitState(draft, 'owner');
    expect(split.paidById).toBe('bruno');
    expect(split.otherPaidSplit).toBe(false);
    expect(split.isShared).toBe(false);
  });
});
