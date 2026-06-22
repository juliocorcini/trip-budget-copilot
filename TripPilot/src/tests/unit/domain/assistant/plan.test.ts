import { describe, it, expect } from 'vitest';
import { buildActionPlan, ownerPersonalCostCents, type PlanContext, type ExecOp } from '@/domain/assistant/plan';
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
    comparisonItems: [],
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
    participants: [owner, bruno, ana, debora],
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

describe('buildActionPlan — split paid by someone else (the field bug)', () => {
  // "Bruno pagou 12,80 pelas tortilhas, dividimos entre ele, eu e a Débora":
  // a 3-way split that BRUNO paid → I owe only my €4.27 slice, not the full bill.
  it('split_expense payer=other + named payer + several sharers → 3-way, payer is a sharer', () => {
    const result = buildActionPlan(
      mkIntent({
        action: 'split_expense',
        amount: 12.8,
        currency: 'EUR',
        payer: 'other',
        person: 'Bruno',
        participants: ['Bruno', 'Débora'],
        description: 'tortilhas',
      }),
      mkCtx(),
    );
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    const { op, preview } = result.plan;
    if (op.kind !== 'expense') return;
    expect(op.didSplit).toBe(true);
    expect(op.payerId).toBe('bruno');
    expect(op.participantIds.sort()).toEqual(['bruno', 'debora', 'owner']);
    expect(op.walletId).toBeNull(); // Bruno's money, not mine
    expect(op.amountCents).toBe(1280);
    expect(preview.perPersonCents).toBe(427); // round(1280 / 3)
    expect(preview.debtDirection).toBe('i_owe');
    expect(preview.personName).toBe('Bruno');
  });

  // Safety net: even if the planner MISLABELS the same sentence as `someone_paid`
  // (the original failure), the device must still split it, never charge the full.
  it('someone_paid + extra sharers reroutes to an equal split (no overcharge)', () => {
    const result = buildActionPlan(
      mkIntent({
        action: 'someone_paid',
        amount: 12.8,
        currency: 'EUR',
        person: 'Bruno',
        participants: ['Bruno', 'eu', 'Débora'],
      }),
      mkCtx(),
    );
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    const { op, preview } = result.plan;
    if (op.kind !== 'expense') return;
    expect(op.didSplit).toBe(true);
    expect(op.payerId).toBe('bruno');
    expect(op.participantIds.sort()).toEqual(['bruno', 'debora', 'owner']);
    expect(preview.perPersonCents).toBe(427);
    expect(preview.debtDirection).toBe('i_owe');
  });

  it('someone_paid with NO other sharers stays a full-amount debt', () => {
    const result = buildActionPlan(
      mkIntent({ action: 'someone_paid', amount: 2, currency: 'EUR', person: 'Bruno', participants: ['Bruno'] }),
      mkCtx(),
    );
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    const { op } = result.plan;
    if (op.kind !== 'expense') return;
    expect(op.didSplit).toBe(false);
    expect(op.participantIds).toEqual([]);
    expect(op.payerId).toBe('bruno');
  });

  // "dividi 100 meio a meio com o Bruno, ele pagou" → 2-way split Bruno paid.
  it('split_expense payer=other 2-way → each owes half to the payer', () => {
    const result = buildActionPlan(
      mkIntent({ action: 'split_expense', amount: 100, payer: 'other', person: 'Bruno', participants: ['Bruno'] }),
      mkCtx(),
    );
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    const { op, preview } = result.plan;
    if (op.kind !== 'expense') return;
    expect(op.payerId).toBe('bruno');
    expect(op.participantIds.sort()).toEqual(['bruno', 'owner']);
    expect(preview.perPersonCents).toBe(5000);
    expect(preview.debtDirection).toBe('i_owe');
  });

  // payer="other" but no name given: the sole non-owner sharer must be the payer.
  it('split_expense payer=other with a single non-owner infers them as payer', () => {
    const result = buildActionPlan(
      mkIntent({ action: 'split_expense', amount: 40, payer: 'other', participants: ['Ana'] }),
      mkCtx(),
    );
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    const { op } = result.plan;
    if (op.kind !== 'expense') return;
    expect(op.payerId).toBe('ana');
    expect(op.participantIds.sort()).toEqual(['ana', 'owner']);
  });
});

describe('buildActionPlan — split robustness (pronouns, self, multi, fallback)', () => {
  it('drops a self-term ("eu") from the sharer list instead of duplicating the owner', () => {
    const result = buildActionPlan(
      mkIntent({ action: 'split_expense', amount: 30, payer: 'me', participants: ['eu', 'Bruno'] }),
      mkCtx(),
    );
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    const { op, preview } = result.plan;
    if (op.kind !== 'expense') return;
    expect(op.participantIds.sort()).toEqual(['bruno', 'owner']);
    expect(op.payerId).toBe('owner');
    expect(preview.perPersonCents).toBe(1500);
  });

  it('skips a bare pronoun ("ele") in participants without asking who it is', () => {
    const result = buildActionPlan(
      mkIntent({ action: 'split_expense', amount: 20, payer: 'other', person: 'Bruno', participants: ['ele'] }),
      mkCtx(),
    );
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    const { op } = result.plan;
    if (op.kind !== 'expense') return;
    expect(op.payerId).toBe('bruno');
    expect(op.participantIds.sort()).toEqual(['bruno', 'owner']);
  });

  it('i_paid_for several people → I cover the bill, they split it among themselves', () => {
    const result = buildActionPlan(
      mkIntent({ action: 'i_paid_for', amount: 40, person: 'Bruno', participants: ['Bruno', 'Ana'] }),
      mkCtx(),
    );
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    const { op, preview } = result.plan;
    if (op.kind !== 'expense') return;
    expect(op.payerId).toBe('owner');
    expect(op.didSplit).toBe(true);
    expect(op.participantIds.sort()).toEqual(['ana', 'bruno']); // owner NOT a sharer
    expect(op.walletId).toBe('w1');
    expect(preview.debtDirection).toBe('owes_me');
    expect(preview.perPersonCents).toBe(2000);
  });

  it('split_expense with no names falls back to the whole trip', () => {
    const result = buildActionPlan(
      mkIntent({ action: 'split_expense', amount: 90 }),
      mkCtx({ participants: [owner, bruno, ana] }),
    );
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    const { op, preview } = result.plan;
    if (op.kind !== 'expense') return;
    expect(op.participantIds.sort()).toEqual(['ana', 'bruno', 'owner']);
    expect(op.payerId).toBe('owner');
    expect(preview.perPersonCents).toBe(3000);
  });
});

describe('buildActionPlan — wallet from a stated payment method', () => {
  const creditWallet: Wallet = {
    ...meta,
    id: 'w2',
    tripId: 'trip-1',
    name: 'Cartão Crédito',
    walletType: 'credit_card',
    currency: 'EUR',
    initialBalanceCents: 0,
    isDefault: false,
    notes: null,
  };
  const multiWalletCtx = (overrides: Partial<PlanContext> = {}): PlanContext =>
    mkCtx({ wallets: [cashWallet, creditWallet], ...overrides });

  it('log_expense "no crédito" → the credit-card wallet (not the default)', () => {
    const result = buildActionPlan(
      mkIntent({ action: 'log_expense', amount: 15, fromWallet: 'crédito' }),
      multiWalletCtx(),
    );
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    const { op } = result.plan;
    if (op.kind !== 'expense') return;
    expect(op.walletId).toBe('w2');
  });

  it('log_expense with no payment method → the default wallet', () => {
    const result = buildActionPlan(mkIntent({ action: 'log_expense', amount: 15 }), multiWalletCtx());
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    const { op } = result.plan;
    if (op.kind !== 'expense') return;
    expect(op.walletId).toBe('w1');
  });

  it('split_expense I pay "em dinheiro" → my cash wallet', () => {
    const result = buildActionPlan(
      mkIntent({ action: 'split_expense', amount: 30, participants: ['Bruno'], fromWallet: 'dinheiro' }),
      multiWalletCtx(),
    );
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    const { op } = result.plan;
    if (op.kind !== 'expense') return;
    expect(op.payerId).toBe('owner');
    expect(op.walletId).toBe('w1');
  });

  it('someone_paid keeps walletId null even if a method is mentioned (not my money)', () => {
    const result = buildActionPlan(
      mkIntent({ action: 'someone_paid', amount: 2, person: 'Bruno', fromWallet: 'crédito' }),
      multiWalletCtx(),
    );
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    const { op } = result.plan;
    if (op.kind !== 'expense') return;
    expect(op.walletId).toBeNull();
  });
});

describe('buildActionPlan — place & date carried from the message', () => {
  it('a named venue becomes the expense place (label-only when unknown)', () => {
    const result = buildActionPlan(
      mkIntent({ action: 'log_expense', amount: 8, place: 'Bar do Zé' }),
      mkCtx(),
    );
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    const { op, preview } = result.plan;
    if (op.kind !== 'expense') return;
    expect(op.place).toEqual({ label: 'Bar do Zé', lat: null, lng: null, placeId: null });
    expect(preview.placeLabel).toBe('Bar do Zé');
  });

  it('a named venue snaps to a known place, recovering its coordinates', () => {
    const result = buildActionPlan(
      mkIntent({ action: 'log_expense', amount: 8, place: 'bar do ze' }),
      mkCtx({
        knownPlaces: [{ label: 'Bar do Zé', lat: 38.7, lng: -9.1, placeId: 'p-ze' }],
      }),
    );
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    const { op } = result.plan;
    if (op.kind !== 'expense') return;
    expect(op.place).toEqual({ label: 'Bar do Zé', lat: 38.7, lng: -9.1, placeId: 'p-ze' });
  });

  it('keeps the sticky place when the message names none', () => {
    const sticky = { label: 'Hotel', lat: 1, lng: 2, placeId: null };
    const result = buildActionPlan(mkIntent({ action: 'log_expense', amount: 8 }), mkCtx({ place: sticky }));
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    const { op } = result.plan;
    if (op.kind !== 'expense') return;
    expect(op.place).toEqual(sticky);
  });

  it('a named venue overrides the sticky place', () => {
    const sticky = { label: 'Hotel', lat: 1, lng: 2, placeId: null };
    const result = buildActionPlan(
      mkIntent({ action: 'log_expense', amount: 8, place: 'Mercado' }),
      mkCtx({ place: sticky }),
    );
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    const { op } = result.plan;
    if (op.kind !== 'expense') return;
    expect(op.place?.label).toBe('Mercado');
  });

  it('a relative date ("3 dias atrás") resolves to a back-dated ISO timestamp', () => {
    const result = buildActionPlan(
      mkIntent({ action: 'log_expense', amount: 8, date: '3 dias atrás' }),
      mkCtx(),
    );
    if (result.status !== 'ready' || result.plan.type !== 'execute') throw new Error('expected execute');
    const { op } = result.plan;
    if (op.kind !== 'expense') return;
    expect(op.date).toBe('2026-07-07T12:00:00.000Z'); // now (07-10) − 3d
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

  // FB-04: a "quanto é X em Y?" question becomes a navigate to the converter,
  // carrying the parsed amount/pair as query — the converter does the math.
  it('convert_currency navigates to the converter prefilled with amount + pair', () => {
    const r = buildActionPlan(
      mkIntent({ action: 'convert_currency', amount: 20, currency: 'EUR', toCurrency: 'BRL' }),
      mkCtx(),
    );
    expect(r.status).toBe('ready');
    if (r.status !== 'ready' || r.plan.type !== 'navigate') throw new Error('expected navigate plan');
    expect(r.plan.to).toBe('/converter?amount=20&from=EUR&to=BRL');
    expect(r.plan.preview.navKey).toBe('converter');
  });

  it('convert_currency with no amount/pair still opens the bare converter', () => {
    const r = buildActionPlan(mkIntent({ action: 'convert_currency' }), mkCtx());
    expect(r.status === 'ready' && r.plan.type === 'navigate' && r.plan.to).toBe('/converter');
  });

  it('convert_currency omits a zero/negative amount from the query', () => {
    const r = buildActionPlan(
      mkIntent({ action: 'convert_currency', amount: 0, currency: 'USD', toCurrency: 'BRL' }),
      mkCtx(),
    );
    expect(r.status === 'ready' && r.plan.type === 'navigate' && r.plan.to).toBe('/converter?from=USD&to=BRL');
  });

  // DEC-283: a "qual vale mais?" question becomes a navigate to the comparator,
  // carrying the parsed product lines as a JSON query — the comparator ranks them.
  it('compare_unit_price navigates to the comparator with the items as JSON', () => {
    const r = buildActionPlan(
      mkIntent({
        action: 'compare_unit_price',
        comparisonItems: [
          { price: 1, quantity: 120, unit: 'g', label: null },
          { price: 2, quantity: 200, unit: 'g', label: null },
        ],
      }),
      mkCtx(),
    );
    expect(r.status).toBe('ready');
    if (r.status !== 'ready' || r.plan.type !== 'navigate') throw new Error('expected navigate plan');
    expect(r.plan.preview.navKey).toBe('comparator');
    expect(r.plan.to.startsWith('/comparator?items=')).toBe(true);
    const items = JSON.parse(new URLSearchParams(r.plan.to.split('?')[1]).get('items')!);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ price: 1, quantity: 120, unit: 'g' });
  });

  it('compare_unit_price with no parsed items opens the bare comparator', () => {
    const r = buildActionPlan(mkIntent({ action: 'compare_unit_price' }), mkCtx());
    expect(r.status === 'ready' && r.plan.type === 'navigate' && r.plan.to).toBe('/comparator');
  });
});

describe('ownerPersonalCostCents — the budget/anomaly figure (device-test 2026-06-20)', () => {
  const expenseBase: Extract<ExecOp, { kind: 'expense' }> = {
    kind: 'expense',
    tripId: 'trip-1',
    phaseId: 'ph-1',
    budgetPoolId: 'pool-1',
    walletId: 'w1',
    amountCents: 1200,
    currency: 'EUR',
    category: 'other',
    description: '',
    place: null,
    ownerId: 'owner',
    payerId: 'owner',
    didSplit: false,
    participantIds: [],
    connectedParticipantIds: [],
  };

  it('I paid, no split → the full amount counts against my budget', () => {
    expect(ownerPersonalCostCents(expenseBase)).toBe(1200);
  });

  it('someone else paid, no split → I owe (and budget) the FULL amount', () => {
    expect(ownerPersonalCostCents({ ...expenseBase, payerId: 'bruno', walletId: null })).toBe(1200);
  });

  it('3-way split someone else paid → only my €4 slice hits the budget (NOT €12)', () => {
    const op = {
      ...expenseBase,
      payerId: 'bruno',
      walletId: null,
      didSplit: true,
      participantIds: ['owner', 'bruno', 'debora'],
    };
    expect(ownerPersonalCostCents(op)).toBe(400);
  });

  it('I paid a split I share → my equal slice', () => {
    const op = { ...expenseBase, didSplit: true, participantIds: ['owner', 'bruno'] };
    expect(ownerPersonalCostCents(op)).toBe(600);
  });

  it('I paid FOR others (not a sharer) → 0 budget impact (it is all owed back to me)', () => {
    const op = { ...expenseBase, amountCents: 4000, didSplit: true, participantIds: ['ana', 'bruno'] };
    expect(ownerPersonalCostCents(op)).toBe(0);
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
