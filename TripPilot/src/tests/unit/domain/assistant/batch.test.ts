import { describe, it, expect } from 'vitest';
import { planAssistantBatch, collectAssistantPeople } from '@/domain/assistant/batch';
import { ownerPersonalCostCents, type PlanContext, type ExecOp } from '@/domain/assistant/plan';
import type { AiIntent } from '@/domain/assistant/intent';
import type { Participant } from '@/domain/types/participant';
import type { Wallet } from '@/domain/types/wallet';

/**
 * AI Quick Entry (DEC-246 · multi-action) — the batch planner. The canonical
 * story is the user's real failing phrase:
 *
 *  "Saí com o Bruno e com a Débora, o Bruno me pagou um sorvete de 2 euros, a
 *   Débora me pagou uma água de 1 euro, eu dividi com ela um bolo de 10 euros,
 *   depois paguei o estacionamento de 4 euros, e comprei uma pizza de 10 euros
 *   que dividimos nós 3."
 *
 * The router returns FIVE intents; the device must plan them as a group: who paid
 * what, who owes whom, in order — reusing the same money engine as the single
 * flow (no parallel math).
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

/** The five intents the router should emit for the canonical story. */
const STORY: AiIntent[] = [
  mkIntent({ action: 'someone_paid', person: 'Bruno', amount: 2, description: 'sorvete' }),
  mkIntent({ action: 'someone_paid', person: 'Débora', amount: 1, description: 'água' }),
  mkIntent({ action: 'split_expense', amount: 10, participants: ['eu', 'Débora'], description: 'bolo' }),
  mkIntent({ action: 'log_expense', amount: 4, description: 'estacionamento' }),
  mkIntent({ action: 'split_expense', amount: 10, participants: ['eu', 'Bruno', 'Débora'], description: 'pizza' }),
];

const expenseOps = (ops: ExecOp[]): Extract<ExecOp, { kind: 'expense' }>[] =>
  ops.filter((o): o is Extract<ExecOp, { kind: 'expense' }> => o.kind === 'expense');

describe('planAssistantBatch — the canonical 5-event story', () => {
  it('plans all five events as ready when the companions are known', () => {
    const plan = planAssistantBatch(STORY, mkCtx());
    expect(plan.ready).toHaveLength(5);
    expect(plan.blocked).toHaveLength(0);
    expect(plan.pendingAdd).toEqual([]);
    expect(plan.pendingChoose).toEqual([]);
  });

  it('event 1 — Bruno paid my €2 ice cream → I owe Bruno the full €2', () => {
    const plan = planAssistantBatch(STORY, mkCtx());
    const op = plan.ready[0]!.op as Extract<ExecOp, { kind: 'expense' }>;
    expect(op.kind).toBe('expense');
    expect(op.amountCents).toBe(200);
    expect(op.payerId).toBe('bruno');
    expect(op.didSplit).toBe(false);
    expect(op.walletId).toBeNull(); // someone else's money, not mine
    expect(ownerPersonalCostCents(op)).toBe(200);
    expect(plan.ready[0]!.preview.debtDirection).toBe('i_owe');
    expect(plan.ready[0]!.preview.personName).toBe('Bruno');
  });

  it('event 2 — Débora paid my €1 water → I owe Débora €1', () => {
    const plan = planAssistantBatch(STORY, mkCtx());
    const op = plan.ready[1]!.op as Extract<ExecOp, { kind: 'expense' }>;
    expect(op.amountCents).toBe(100);
    expect(op.payerId).toBe('debora');
    expect(op.didSplit).toBe(false);
    expect(ownerPersonalCostCents(op)).toBe(100);
  });

  it('event 3 — I paid €10 cake split with Débora → my share €5, Débora owes me €5', () => {
    const plan = planAssistantBatch(STORY, mkCtx());
    const op = plan.ready[2]!.op as Extract<ExecOp, { kind: 'expense' }>;
    expect(op.amountCents).toBe(1000);
    expect(op.payerId).toBe('owner');
    expect(op.didSplit).toBe(true);
    expect(op.participantIds.sort()).toEqual(['debora', 'owner']);
    expect(op.walletId).toBe('w1'); // I fronted it from my wallet
    expect(ownerPersonalCostCents(op)).toBe(500);
    expect(plan.ready[2]!.preview.perPersonCents).toBe(500);
  });

  it('event 4 — €4 parking is mine alone', () => {
    const plan = planAssistantBatch(STORY, mkCtx());
    const op = plan.ready[3]!.op as Extract<ExecOp, { kind: 'expense' }>;
    expect(op.amountCents).toBe(400);
    expect(op.payerId).toBe('owner');
    expect(op.didSplit).toBe(false);
    expect(op.participantIds).toEqual([]);
    expect(ownerPersonalCostCents(op)).toBe(400);
  });

  it('event 5 — I paid €10 pizza split 3 ways → my share ~€3.33', () => {
    const plan = planAssistantBatch(STORY, mkCtx());
    const op = plan.ready[4]!.op as Extract<ExecOp, { kind: 'expense' }>;
    expect(op.amountCents).toBe(1000);
    expect(op.payerId).toBe('owner');
    expect(op.didSplit).toBe(true);
    expect(op.participantIds.sort()).toEqual(['bruno', 'debora', 'owner']);
    expect(ownerPersonalCostCents(op)).toBe(333);
    expect(plan.ready[4]!.preview.perPersonCents).toBe(333);
  });

  it('my TOTAL personal cost across the night sums the slices, not the bills', () => {
    const plan = planAssistantBatch(STORY, mkCtx());
    const total = expenseOps(plan.ready.map((r) => r.op)).reduce(
      (sum, op) => sum + ownerPersonalCostCents(op),
      0,
    );
    // 200 (sorvete) + 100 (água) + 500 (bolo/2) + 400 (parking) + 333 (pizza/3)
    expect(total).toBe(1533);
  });
});

describe('collectAssistantPeople — consolidated clarification', () => {
  it('aggregates every unknown companion across events into ONE add list (deduped)', () => {
    const ctx = mkCtx({ participants: [owner] }); // nobody added yet
    const people = collectAssistantPeople(STORY, ctx);
    expect(people.add.sort()).toEqual(['Bruno', 'Débora']);
    expect(people.choose).toEqual([]);
  });

  it('skips the user themself ("eu") and bare pronouns ("ela", "nós 3")', () => {
    const ctx = mkCtx({ participants: [owner, bruno, debora] });
    const people = collectAssistantPeople(STORY, ctx);
    expect(people.add).toEqual([]); // both already known
  });

  it('surfaces an ambiguous name as a choose entry, not an add', () => {
    const bruno2 = mkParticipant('bruno2', 'Bruno');
    const ctx = mkCtx({ participants: [owner, bruno, bruno2, debora] });
    const intents = [mkIntent({ action: 'someone_paid', person: 'Bruno', amount: 2 })];
    const people = collectAssistantPeople(intents, ctx);
    expect(people.add).toEqual([]);
    expect(people.choose).toHaveLength(1);
    expect(people.choose[0]!.name).toBe('Bruno');
    expect(people.choose[0]!.candidates).toHaveLength(2);
  });
});

describe('planAssistantBatch — blocked rows (cannot auto-run)', () => {
  it('blocks a foreign-currency expense (needs a conversion rate) with reason "foreign"', () => {
    const intents = [
      mkIntent({ action: 'log_expense', amount: 4, description: 'parking' }),
      mkIntent({ action: 'log_expense', amount: 20, currency: 'USD', description: 'souvenir' }),
    ];
    const plan = planAssistantBatch(intents, mkCtx());
    expect(plan.ready).toHaveLength(1);
    expect(plan.blocked).toHaveLength(1);
    expect(plan.blocked[0]!.reasonKey).toBe('foreign');
    expect(plan.blocked[0]!.preview).not.toBeNull(); // we can still show it
  });

  it('blocks an event with a missing amount with reason "amount" (no preview)', () => {
    const intents = [
      mkIntent({ action: 'log_expense', amount: 4 }),
      mkIntent({ action: 'log_expense', description: 'something' }), // no amount
    ];
    const plan = planAssistantBatch(intents, mkCtx());
    expect(plan.ready).toHaveLength(1);
    expect(plan.blocked).toHaveLength(1);
    expect(plan.blocked[0]!.reasonKey).toBe('amount');
    expect(plan.blocked[0]!.preview).toBeNull();
  });

  it('blocks an open/navigate intent with reason "navigate"', () => {
    const intents = [
      mkIntent({ action: 'log_expense', amount: 4 }),
      mkIntent({ action: 'open_scan_receipt' }),
    ];
    const plan = planAssistantBatch(intents, mkCtx());
    expect(plan.ready).toHaveLength(1);
    expect(plan.blocked).toHaveLength(1);
    expect(plan.blocked[0]!.reasonKey).toBe('navigate');
  });

  it('blocks an unknown/unsupported action with its messageKey', () => {
    const intents = [
      mkIntent({ action: 'log_expense', amount: 4 }),
      mkIntent({ action: 'unknown' }),
    ];
    const plan = planAssistantBatch(intents, mkCtx());
    expect(plan.ready).toHaveLength(1);
    expect(plan.blocked).toHaveLength(1);
    expect(plan.blocked[0]!.reasonKey).toBe('unknown');
  });

  it('mixes ready + blocked deterministically and keeps base-currency events running', () => {
    const plan = planAssistantBatch(
      [
        mkIntent({ action: 'someone_paid', person: 'Bruno', amount: 2 }),
        mkIntent({ action: 'log_expense', amount: 20, currency: 'USD' }),
        mkIntent({ action: 'log_expense', amount: 4 }),
      ],
      mkCtx(),
    );
    expect(plan.ready).toHaveLength(2);
    expect(plan.blocked).toHaveLength(1);
    expect(plan.blocked[0]!.reasonKey).toBe('foreign');
  });
});

describe('planAssistantBatch — person overrides re-plan cleanly', () => {
  it('once unknown companions are added, the same story plans fully ready', () => {
    // Simulate the hook re-running after the user tapped "add all": the
    // participants now exist, so nothing stays pending.
    const ctxBefore = mkCtx({ participants: [owner] });
    const before = planAssistantBatch(STORY, ctxBefore);
    expect(before.pendingAdd.sort()).toEqual(['Bruno', 'Débora']);

    const ctxAfter = mkCtx({ participants: [owner, bruno, debora] });
    const after = planAssistantBatch(STORY, ctxAfter);
    expect(after.pendingAdd).toEqual([]);
    expect(after.ready).toHaveLength(5);
  });
});
