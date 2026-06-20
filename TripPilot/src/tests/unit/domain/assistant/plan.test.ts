import { describe, it, expect } from 'vitest';
import { buildActionPlan, type PlanContext } from '@/domain/assistant/plan';
import type { AiIntent } from '@/domain/assistant/intent';
import type { Participant } from '@/domain/types/participant';
import type { Wallet } from '@/domain/types/wallet';

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
const ana = mkParticipant('ana', 'Ana');

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
    participants: [owner, bruno, ana],
    connectedParticipantIds: [],
    wallets: [cashWallet],
    defaultPoolId: 'pool-1',
    defaultWalletId: 'w1',
    defaultSourceWalletId: 'w1',
    defaultTargetWalletId: 'w1',
    place: null,
    now: new Date('2026-07-10T12:00:00.000Z'),
    ...overrides,
  };
}

describe('buildActionPlan — expenses & debts', () => {
  it('someone_paid → I owe the full amount (payer is the other person, no wallet move)', () => {
    const result = buildActionPlan(
      mkIntent({ action: 'someone_paid', amount: 2, currency: 'EUR', person: 'Bruno', category: 'cerveja' }),
      mkCtx(),
    );
    expect(result.status).toBe('ready');
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    const { op, preview } = result.plan;
    expect(op.kind).toBe('expense');
    if (op.kind !== 'expense') return;
    expect(op.payerId).toBe('bruno');
    expect(op.ownerId).toBe('owner');
    expect(op.didSplit).toBe(false);
    expect(op.walletId).toBeNull();
    expect(op.amountCents).toBe(200);
    expect(op.category).toBe('bar');
    expect(preview.debtDirection).toBe('i_owe');
    expect(preview.personName).toBe('Bruno');
  });

  it('i_paid_for → the other person owes me the full amount (split of one, owner pays)', () => {
    const result = buildActionPlan(
      mkIntent({ action: 'i_paid_for', amount: 10, person: 'Bruno' }),
      mkCtx(),
    );
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    const { op, preview } = result.plan;
    if (op.kind !== 'expense') return;
    expect(op.payerId).toBe('owner');
    expect(op.didSplit).toBe(true);
    expect(op.participantIds).toEqual(['bruno']);
    expect(op.walletId).toBe('w1');
    expect(preview.debtDirection).toBe('owes_me');
  });

  it('log_expense → a plain personal expense from the default wallet', () => {
    const result = buildActionPlan(mkIntent({ action: 'log_expense', amount: 12 }), mkCtx());
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    const { op, preview } = result.plan;
    if (op.kind !== 'expense') return;
    expect(op.payerId).toBe('owner');
    expect(op.didSplit).toBe(false);
    expect(op.walletId).toBe('w1');
    expect(op.amountCents).toBe(1200);
    expect(op.currency).toBe('EUR');
    expect(preview.debtDirection).toBeUndefined();
  });

  it('split_expense → owner + named participants, equal per-head preview', () => {
    const result = buildActionPlan(
      mkIntent({ action: 'split_expense', amount: 30, participants: ['Bruno'] }),
      mkCtx(),
    );
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    const { op, preview } = result.plan;
    if (op.kind !== 'expense') return;
    expect(op.didSplit).toBe(true);
    expect(op.participantIds.sort()).toEqual(['bruno', 'owner']);
    expect(op.payerId).toBe('owner');
    expect(preview.perPersonCents).toBe(1500);
  });
});

describe('buildActionPlan — clarifications', () => {
  it('asks to add an unknown person', () => {
    const result = buildActionPlan(
      mkIntent({ action: 'someone_paid', amount: 2, person: 'Carlos' }),
      mkCtx(),
    );
    expect(result.status).toBe('needs');
    if (result.status !== 'needs') return;
    expect(result.clarifications[0]).toEqual({ type: 'add_person', name: 'Carlos' });
  });

  it('asks which person when the name is ambiguous, then resolves via override', () => {
    const bruno2 = mkParticipant('bruno2', 'Bruno');
    const ctx = mkCtx({ participants: [owner, bruno, bruno2] });
    const intent = mkIntent({ action: 'someone_paid', amount: 2, person: 'Bruno' });

    const ambiguous = buildActionPlan(intent, ctx);
    expect(ambiguous.status).toBe('needs');
    if (ambiguous.status !== 'needs') return;
    const clar = ambiguous.clarifications[0];
    expect(clar?.type).toBe('choose_person');
    if (clar?.type !== 'choose_person') return;
    expect(clar.candidates.map((c) => c.id).sort()).toEqual(['bruno', 'bruno2']);

    const resolved = buildActionPlan(intent, { ...ctx, personOverrides: { bruno: 'bruno2' } });
    if (resolved.status !== 'ready' || resolved.plan.type !== 'execute') throw new Error('expected execute');
    if (resolved.plan.op.kind !== 'expense') return;
    expect(resolved.plan.op.payerId).toBe('bruno2');
  });

  it('asks for the amount when it is missing', () => {
    const result = buildActionPlan(mkIntent({ action: 'log_expense' }), mkCtx());
    expect(result.status).toBe('needs');
    if (result.status !== 'needs') return;
    expect(result.clarifications[0]).toEqual({ type: 'amount' });
  });
});

describe('buildActionPlan — other actions', () => {
  it('record_income → an income op', () => {
    const result = buildActionPlan(mkIntent({ action: 'record_income', amount: 100 }), mkCtx());
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    expect(result.plan.op.kind).toBe('income');
  });

  it('settle_debt → a settlement op defaulting to "i owe"', () => {
    const result = buildActionPlan(mkIntent({ action: 'settle_debt', person: 'Bruno' }), mkCtx());
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    const { op } = result.plan;
    if (op.kind !== 'settle') return;
    expect(op.personId).toBe('bruno');
    expect(op.direction).toBe('i_owe');
    expect(op.amountCents).toBeNull();
  });

  it('plan_purchase → a planned purchase op', () => {
    const result = buildActionPlan(
      mkIntent({ action: 'plan_purchase', itemName: 'Tênis', amount: 80 }),
      mkCtx(),
    );
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    const { op } = result.plan;
    if (op.kind !== 'plan_purchase') return;
    expect(op.name).toBe('Tênis');
    expect(op.estimatedCostCents).toBe(8000);
  });

  it('open actions navigate to the right route', () => {
    const scan = buildActionPlan(mkIntent({ action: 'open_scan_receipt' }), mkCtx());
    expect(scan.status === 'ready' && scan.plan.type === 'navigate' && scan.plan.to).toBe('/receipt/scan');

    const debts = buildActionPlan(mkIntent({ action: 'open_screen', screen: 'debts' }), mkCtx());
    expect(debts.status === 'ready' && debts.plan.type === 'navigate' && debts.plan.to).toBe('/shared');
  });
});

describe('buildActionPlan — guards', () => {
  it('unknown action is unsupported', () => {
    const result = buildActionPlan(mkIntent({ action: 'unknown' }), mkCtx());
    expect(result).toEqual({ status: 'unsupported', messageKey: 'unknown' });
  });

  it('a money action without a fund is unsupported', () => {
    const result = buildActionPlan(mkIntent({ action: 'log_expense', amount: 12 }), mkCtx({ defaultPoolId: null }));
    expect(result).toEqual({ status: 'unsupported', messageKey: 'no_pool' });
  });
});
