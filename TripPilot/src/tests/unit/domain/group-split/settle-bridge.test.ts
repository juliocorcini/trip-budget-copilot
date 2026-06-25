import { describe, it, expect } from 'vitest';
import {
  createGroupSplitEvent,
  createGroupParticipant,
  buildGroupExpense,
  addParticipant,
  addExpense,
  setParticipantPayment,
  groupSplitToDebts,
  groupSplitsToTripDebts,
} from '@/domain/group-split';
import type { GroupSplitEvent } from '@/domain/group-split';

/**
 * Owner Ana (linked to trip participant `t-ana`) fronts a 90.00 EUR expense split
 * equally three ways with Bruno (`t-bruno`, linked) and Carla (unlinked manual).
 * → Bruno owes 30.00, Carla owes 30.00, Ana is +60.00. Only the Ana↔Bruno edge
 * is bridgeable (both linked); Carla's edge is dropped (no app/trip link).
 */
function buildTripEvent(): { event: GroupSplitEvent; tAna: string; tBruno: string; brunoId: string } {
  let event = createGroupSplitEvent({
    name: 'Churrasco',
    currency: 'EUR',
    ownerName: 'Ana',
    tripId: 'trip-1',
    ownerLinkedParticipantId: 't-ana',
  });
  const a = event.ownerParticipantId;
  const bruno = createGroupParticipant({ name: 'Bruno', kind: 'connected', linkedParticipantId: 't-bruno' });
  const carla = createGroupParticipant({ name: 'Carla' }); // manual, unlinked
  event = addParticipant(addParticipant(event, bruno), carla);
  event = addExpense(
    event,
    buildGroupExpense({
      description: 'Meat',
      amountCents: 9000,
      paidByParticipantId: a,
      splitMode: 'equal',
      participantIds: [a, bruno.id, carla.id],
    }),
  );
  return { event, tAna: 't-ana', tBruno: 't-bruno', brunoId: bruno.id };
}

describe('groupSplitToDebts (C23/DEC-306 settle bridge)', () => {
  it('bridges only edges where both sides are trip-linked, in trip-participant space', () => {
    const { event, tAna, tBruno } = buildTripEvent();
    const debts = groupSplitToDebts(event, 'EUR');
    // Only Bruno → Ana (30.00). Carla (unlinked) contributes nothing.
    expect(debts).toHaveLength(1);
    expect(debts[0]).toMatchObject({
      debtorId: tBruno,
      creditorId: tAna,
      amountCents: 3000,
    });
  });

  it('drops a debtor edge once their group payment is confirmed (settled in-group)', () => {
    const { event, brunoId } = buildTripEvent();
    const confirmed = setParticipantPayment(event, brunoId, 'confirmed');
    expect(groupSplitToDebts(confirmed, 'EUR')).toHaveLength(0);
  });

  it('keeps the edge while the debtor only "marked" (not yet confirmed)', () => {
    const { event, brunoId } = buildTripEvent();
    const marked = setParticipantPayment(event, brunoId, 'marked');
    expect(groupSplitToDebts(marked, 'EUR')).toHaveLength(1);
  });

  it('bridges nothing when the group currency differs from the trip base', () => {
    const { event } = buildTripEvent();
    expect(groupSplitToDebts(event, 'BRL')).toHaveLength(0);
  });

  it('flattens only trip-scoped, same-currency events', () => {
    const { event } = buildTripEvent();
    // A standalone (no trip) event must never contribute to the trip settle-up.
    let standalone = createGroupSplitEvent({ name: 'Solo', currency: 'EUR', ownerName: 'Ana' });
    const x = createGroupParticipant({ name: 'X', kind: 'connected', linkedParticipantId: 't-x' });
    standalone = addParticipant(standalone, x);
    standalone = addExpense(
      standalone,
      buildGroupExpense({
        description: 'Foo',
        amountCents: 4000,
        paidByParticipantId: standalone.ownerParticipantId,
        splitMode: 'equal',
        participantIds: [standalone.ownerParticipantId, x.id],
      }),
    );
    const debts = groupSplitsToTripDebts([event, standalone], 'trip-1', 'EUR');
    expect(debts).toHaveLength(1); // only the trip-1 event's Bruno→Ana edge
    expect(debts[0]!.amountCents).toBe(3000);
  });
});
