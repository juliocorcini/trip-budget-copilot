import { describe, it, expect } from 'vitest';
import {
  createGroupSplitEvent,
  createGroupParticipant,
  buildGroupExpense,
  addParticipant,
  addExpense,
  includeParticipantInWholeGroupExpenses,
  expenseShares,
  computeGroupBalances,
} from '@/domain/group-split';
import type { GroupSplitEvent } from '@/domain/group-split';

/** Owner "Ana" logs an equal expense while alone, then people arrive later. */
function ownerWithExpense(amountCents: number): { event: GroupSplitEvent; owner: string } {
  let event = createGroupSplitEvent({ name: 'Jantar', currency: 'EUR', ownerName: 'Ana' });
  const owner = event.ownerParticipantId;
  const expense = buildGroupExpense({
    description: 'Jantar',
    amountCents,
    paidByParticipantId: owner,
    splitMode: 'equal',
    participantIds: [owner], // default when the group has only the owner
  });
  event = addExpense(event, expense);
  return { event, owner };
}

function netByName(event: GroupSplitEvent): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of computeGroupBalances(event)) out[b.name] = b.netCents;
  return out;
}

describe('includeParticipantInWholeGroupExpenses (DEC-432 — retroactive whole-group re-split)', () => {
  it("the reported bug: adding people after the expense stops them reading a false 0", () => {
    // Ana logs a 100.00 dinner alone, THEN adds Bruno and Carla.
    let { event, owner } = ownerWithExpense(10000);

    const bruno = createGroupParticipant({ name: 'Bruno' });
    event = addParticipant(event, bruno);
    let res = includeParticipantInWholeGroupExpenses(event, bruno.id);
    event = res.event;
    expect(res.updatedCount).toBe(1);

    const carla = createGroupParticipant({ name: 'Carla' });
    event = addParticipant(event, carla);
    res = includeParticipantInWholeGroupExpenses(event, carla.id);
    event = res.event;
    expect(res.updatedCount).toBe(1);

    // The single expense now splits among all three.
    const shares = expenseShares(event.expenses[0]!);
    expect(shares[owner]! + shares[bruno.id]! + shares[carla.id]!).toBe(10000);
    expect([shares[owner], shares[bruno.id], shares[carla.id]].sort((a, b) => a! - b!)).toEqual([
      3333, 3333, 3334,
    ]);

    // Bruno and Carla now OWE ~33.33 to Ana — never a false 0.
    const net = netByName(event);
    expect(net['Bruno']).toBeLessThan(0);
    expect(net['Carla']).toBeLessThan(0);
    expect(net['Ana']).toBeGreaterThan(0);
    // Cents are conserved: Σ net == 0.
    expect(net['Ana']! + net['Bruno']! + net['Carla']!).toBe(0);
  });

  it('does not touch a custom split (deliberate per-person amounts stay put)', () => {
    let event = createGroupSplitEvent({ name: 'Hotel', currency: 'EUR', ownerName: 'Ana' });
    const owner = event.ownerParticipantId;
    event = addExpense(
      event,
      buildGroupExpense({
        description: 'Hotel',
        amountCents: 9000,
        paidByParticipantId: owner,
        splitMode: 'custom',
        participantIds: [owner],
        customAmountsCents: { [owner]: 9000 },
      }),
    );
    const bruno = createGroupParticipant({ name: 'Bruno' });
    event = addParticipant(event, bruno);
    const res = includeParticipantInWholeGroupExpenses(event, bruno.id);
    expect(res.updatedCount).toBe(0);
    expect(res.event.expenses[0]!.participantIds).toEqual([owner]);
  });

  it('respects a deliberate exclusion: an equal split that is a strict subset is not widened', () => {
    // Group already has Ana + Bruno; an expense splits ONLY Ana (Bruno excluded).
    let event = createGroupSplitEvent({ name: 'Trip', currency: 'EUR', ownerName: 'Ana' });
    const owner = event.ownerParticipantId;
    const bruno = createGroupParticipant({ name: 'Bruno' });
    event = addParticipant(event, bruno);
    event = addExpense(
      event,
      buildGroupExpense({
        description: 'Ana solo lunch',
        amountCents: 2000,
        paidByParticipantId: owner,
        splitMode: 'equal',
        participantIds: [owner], // strict subset of {owner, bruno}
      }),
    );
    const carla = createGroupParticipant({ name: 'Carla' });
    event = addParticipant(event, carla);
    const res = includeParticipantInWholeGroupExpenses(event, carla.id);
    expect(res.updatedCount).toBe(0);
    expect(res.event.expenses[0]!.participantIds).toEqual([owner]);
  });

  it('widens a whole-group equal expense and never double-adds', () => {
    let event = createGroupSplitEvent({ name: 'Bar', currency: 'EUR', ownerName: 'Ana' });
    const owner = event.ownerParticipantId;
    const bruno = createGroupParticipant({ name: 'Bruno' });
    event = addParticipant(event, bruno);
    // Expense splits the WHOLE group at the time (Ana + Bruno).
    event = addExpense(
      event,
      buildGroupExpense({
        description: 'Rodada',
        amountCents: 3000,
        paidByParticipantId: owner,
        splitMode: 'equal',
        participantIds: [owner, bruno.id],
      }),
    );
    const carla = createGroupParticipant({ name: 'Carla' });
    event = addParticipant(event, carla);
    const first = includeParticipantInWholeGroupExpenses(event, carla.id);
    expect(first.updatedCount).toBe(1);
    expect(first.event.expenses[0]!.participantIds).toContain(carla.id);
    // Running it again is idempotent — Carla is already there.
    const second = includeParticipantInWholeGroupExpenses(first.event, carla.id);
    expect(second.updatedCount).toBe(0);
  });

  it('is a no-op when the newcomer is the only participant (nothing to widen)', () => {
    const { event, owner } = ownerWithExpense(1000);
    // Pretend the owner is the "newcomer" — priorIds is empty, so nothing happens.
    const res = includeParticipantInWholeGroupExpenses(event, owner);
    expect(res.updatedCount).toBe(0);
    expect(res.event).toBe(event);
  });
});
