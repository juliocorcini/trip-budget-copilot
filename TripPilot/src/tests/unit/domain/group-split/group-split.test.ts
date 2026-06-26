import { describe, it, expect } from 'vitest';
import {
  createGroupSplitEvent,
  createGroupParticipant,
  buildGroupExpense,
  addParticipant,
  addExpense,
  removeParticipant,
  canRemoveParticipant,
  expenseShares,
  groupTotalCents,
  groupExpenseDayKey,
  groupExpensesByDay,
  computeGroupBalances,
  computeGroupTransfers,
  isGroupSettled,
  validateGroupExpense,
  setParticipantPayment,
} from '@/domain/group-split';
import type { GroupSplitEvent } from '@/domain/group-split';

/** Builds the canonical 3-person "churrasco" event A(owner)/B/C in EUR. */
function buildAbcEvent(): { event: GroupSplitEvent; a: string; b: string; c: string } {
  let event = createGroupSplitEvent({ name: 'Churrasco', currency: 'EUR', ownerName: 'Ana' });
  const a = event.ownerParticipantId;
  const bruno = createGroupParticipant({ name: 'Bruno' });
  const carla = createGroupParticipant({ name: 'Carla' });
  event = addParticipant(addParticipant(event, bruno), carla);
  return { event, a, b: bruno.id, c: carla.id };
}

describe('group-split — factories & structure', () => {
  it('seeds the creator as the owner participant', () => {
    const event = createGroupSplitEvent({ name: 'Trip', currency: 'BRL', ownerName: '  Júlio  ' });
    expect(event.participants).toHaveLength(1);
    expect(event.participants[0]!.kind).toBe('owner');
    expect(event.participants[0]!.name).toBe('Júlio');
    expect(event.ownerParticipantId).toBe(event.participants[0]!.id);
    expect(event.status).toBe('open');
    expect(event.expenses).toEqual([]);
  });
});

describe('group-split — expenseShares (Â11: Σ shares == amount)', () => {
  it('splits equally and absorbs the remainder deterministically', () => {
    const { b, c, a } = buildAbcEvent();
    const expense = buildGroupExpense({
      description: 'Pizza',
      amountCents: 1000,
      paidByParticipantId: a,
      splitMode: 'equal',
      participantIds: [a, b, c],
    });
    const shares = expenseShares(expense);
    expect(shares[a]! + shares[b]! + shares[c]!).toBe(1000);
    expect([shares[a], shares[b], shares[c]].sort()).toEqual([333, 333, 334]);
  });

  it('custom split absorbs the short remainder into the payer', () => {
    const { a, b, c } = buildAbcEvent();
    const expense = buildGroupExpense({
      description: 'Hotel',
      amountCents: 10000,
      paidByParticipantId: a,
      splitMode: 'custom',
      participantIds: [a, b, c],
      customAmountsCents: { [a]: 5000, [b]: 3000, [c]: 1500 },
    });
    const shares = expenseShares(expense);
    expect(shares[a]).toBe(5500); // 5000 + 500 remainder
    expect(shares[b]).toBe(3000);
    expect(shares[c]).toBe(1500);
    expect(shares[a]! + shares[b]! + shares[c]!).toBe(10000);
  });
});

describe('group-split — balances & transfers (multi-payer)', () => {
  it('nets paid − share per person and conserves cents (Σ net == 0)', () => {
    const { event, a, b, c } = buildAbcEvent();
    let e = addExpense(
      event,
      buildGroupExpense({
        description: 'Churrasco',
        amountCents: 9000,
        paidByParticipantId: a,
        splitMode: 'equal',
        participantIds: [a, b, c],
      }),
    );
    e = addExpense(
      e,
      buildGroupExpense({
        description: 'Bebida',
        amountCents: 3000,
        paidByParticipantId: b,
        splitMode: 'equal',
        participantIds: [a, b, c],
      }),
    );

    expect(groupTotalCents(e)).toBe(12000);
    const balances = computeGroupBalances(e);
    const byId = new Map(balances.map((x) => [x.participantId, x]));
    expect(byId.get(a)!.paidCents).toBe(9000);
    expect(byId.get(a)!.shareCents).toBe(4000);
    expect(byId.get(a)!.netCents).toBe(5000);
    expect(byId.get(b)!.netCents).toBe(-1000);
    expect(byId.get(c)!.netCents).toBe(-4000);
    expect(balances.reduce((s, x) => s + x.netCents, 0)).toBe(0);
  });

  it('settles with the minimum number of transfers toward the creditor', () => {
    const { event, a, b, c } = buildAbcEvent();
    let e = addExpense(
      event,
      buildGroupExpense({
        description: 'Churrasco',
        amountCents: 9000,
        paidByParticipantId: a,
        splitMode: 'equal',
        participantIds: [a, b, c],
      }),
    );
    e = addExpense(
      e,
      buildGroupExpense({
        description: 'Bebida',
        amountCents: 3000,
        paidByParticipantId: b,
        splitMode: 'equal',
        participantIds: [a, b, c],
      }),
    );
    const transfers = computeGroupTransfers(e);
    // C owes 4000, B owes 1000 → both pay A; exactly 2 transfers.
    expect(transfers).toHaveLength(2);
    const total = transfers.reduce((s, t) => s + t.amountCents, 0);
    expect(total).toBe(5000);
    expect(transfers.every((t) => t.toParticipantId === a)).toBe(true);
    const fromC = transfers.find((t) => t.fromParticipantId === c)!;
    expect(fromC.amountCents).toBe(4000);
  });
});

describe('group-split — settled state', () => {
  it('is never settled with no expenses', () => {
    const { event } = buildAbcEvent();
    expect(isGroupSettled(event)).toBe(false);
  });

  it('is settled when every net is zero (each paid their own share)', () => {
    const { event, a } = buildAbcEvent();
    const e = addExpense(
      event,
      buildGroupExpense({
        description: 'Solo coffee',
        amountCents: 500,
        paidByParticipantId: a,
        splitMode: 'equal',
        participantIds: [a],
      }),
    );
    expect(isGroupSettled(e)).toBe(true);
  });
});

describe('group-split — participant guards', () => {
  it('never removes the owner and never removes someone inside an expense', () => {
    const { event, a, b, c } = buildAbcEvent();
    const e = addExpense(
      event,
      buildGroupExpense({
        description: 'Taxi',
        amountCents: 2000,
        paidByParticipantId: a,
        splitMode: 'equal',
        participantIds: [a, b],
      }),
    );
    expect(canRemoveParticipant(e, a)).toBe(false); // owner
    expect(canRemoveParticipant(e, b)).toBe(false); // in the expense
    expect(canRemoveParticipant(e, c)).toBe(true); // free
    expect(removeParticipant(e, a).participants).toHaveLength(3); // unchanged
    expect(removeParticipant(e, c).participants).toHaveLength(2); // removed
  });
});

describe('group-split — validation', () => {
  it('flags each invalid expense input', () => {
    const { event, a, b } = buildAbcEvent();
    const base = { amountCents: 1000, paidByParticipantId: a, splitMode: 'equal' as const, participantIds: [a, b] };
    expect(validateGroupExpense(event, { ...base, description: '   ' })).toBe('empty_description');
    expect(validateGroupExpense(event, { ...base, description: 'X', amountCents: 0 })).toBe('non_positive_amount');
    expect(validateGroupExpense(event, { ...base, description: 'X', paidByParticipantId: 'ghost' })).toBe('no_payer');
    expect(validateGroupExpense(event, { ...base, description: 'X', participantIds: [] })).toBe('no_participants');
    expect(
      validateGroupExpense(event, {
        ...base,
        description: 'X',
        splitMode: 'custom',
        customAmountsCents: { [a]: 800, [b]: 800 },
      }),
    ).toBe('custom_mismatch');
    expect(validateGroupExpense(event, { ...base, description: 'Valid' })).toBeNull();
  });
});

describe('group-split — expense date, registrant & items (DEC-336/337, additive)', () => {
  it('carries occurredAt, createdByParticipantId and items onto a built expense', () => {
    const { a, b } = buildAbcEvent();
    const expense = buildGroupExpense({
      description: 'Mercado',
      amountCents: 1200,
      paidByParticipantId: a,
      splitMode: 'equal',
      participantIds: [a, b],
      occurredAt: '2026-06-20',
      createdByParticipantId: b,
      items: [
        { id: 'i1', description: 'Pão', amountCents: 500, qty: 1 },
        { id: 'i2', description: 'Leite', amountCents: 700, qty: 2 },
      ],
    });
    expect(expense.occurredAt).toBe('2026-06-20');
    expect(expense.createdByParticipantId).toBe(b);
    expect(expense.items).toHaveLength(2);
    // Additive only: the split math is untouched (data-invariance).
    const shares = expenseShares(expense);
    expect(shares[a]! + shares[b]!).toBe(1200);
  });

  it('omits the optional fields entirely on a legacy-style expense', () => {
    const { a, b } = buildAbcEvent();
    const expense = buildGroupExpense({
      description: 'Taxi',
      amountCents: 1000,
      paidByParticipantId: a,
      splitMode: 'equal',
      participantIds: [a, b],
    });
    expect(expense.occurredAt).toBeUndefined();
    expect(expense.createdByParticipantId).toBeUndefined();
    expect(expense.items).toBeUndefined();
  });

  it('groupExpenseDayKey prefers occurredAt and falls back to createdAt', () => {
    const dated = buildGroupExpense({
      description: 'A',
      amountCents: 100,
      paidByParticipantId: 'x',
      splitMode: 'equal',
      participantIds: ['x'],
      occurredAt: '2026-01-02',
    });
    expect(groupExpenseDayKey(dated)).toBe('2026-01-02');
    // No occurredAt → the createdAt day (built just now).
    const legacy = buildGroupExpense({
      description: 'B',
      amountCents: 100,
      paidByParticipantId: 'x',
      splitMode: 'equal',
      participantIds: ['x'],
    });
    expect(groupExpenseDayKey(legacy)).toBe(legacy.createdAt.slice(0, 10));
  });

  it('buckets expenses by day, oldest first, preserving in-day order', () => {
    const mk = (id: string, day: string) =>
      ({
        ...buildGroupExpense({
          description: id,
          amountCents: 100,
          paidByParticipantId: 'x',
          splitMode: 'equal',
          participantIds: ['x'],
          occurredAt: day,
        }),
        id,
      });
    const days = groupExpensesByDay([mk('a', '2026-06-21'), mk('b', '2026-06-20'), mk('c', '2026-06-21')]);
    expect(days.map((d) => d.day)).toEqual(['2026-06-20', '2026-06-21']);
    expect(days[1]!.expenses.map((e) => e.id)).toEqual(['a', 'c']);
  });

  it('keeps the event total identical regardless of day grouping (data-invariance)', () => {
    const { event, a, b } = buildAbcEvent();
    let e = addExpense(
      event,
      buildGroupExpense({
        description: 'Day1',
        amountCents: 3000,
        paidByParticipantId: a,
        splitMode: 'equal',
        participantIds: [a, b],
        occurredAt: '2026-06-20',
      }),
    );
    e = addExpense(
      e,
      buildGroupExpense({
        description: 'Day2',
        amountCents: 2000,
        paidByParticipantId: b,
        splitMode: 'equal',
        participantIds: [a, b],
        occurredAt: '2026-06-22',
      }),
    );
    const flatTotal = groupTotalCents(e);
    const groupedTotal = groupExpensesByDay(e.expenses)
      .flatMap((d) => d.expenses)
      .reduce((s, x) => s + x.amountCents, 0);
    expect(groupedTotal).toBe(flatTotal);
    expect(flatTotal).toBe(5000);
  });
});

describe('group-split — payment lifecycle', () => {
  it('moves a person through unpaid → marked → confirmed', () => {
    const { event, b } = buildAbcEvent();
    expect(event.participants.find((p) => p.id === b)!.paymentStatus).toBe('unpaid');
    const marked = setParticipantPayment(event, b, 'marked');
    expect(marked.participants.find((p) => p.id === b)!.paymentStatus).toBe('marked');
    const confirmed = setParticipantPayment(marked, b, 'confirmed');
    expect(confirmed.participants.find((p) => p.id === b)!.paymentStatus).toBe('confirmed');
  });
});
