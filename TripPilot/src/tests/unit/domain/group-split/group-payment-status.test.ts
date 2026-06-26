import { describe, it, expect } from 'vitest';
import {
  createGroupSplitEvent,
  createGroupParticipant,
  buildGroupExpense,
  addParticipant,
  addExpense,
  setParticipantPayment,
  computeGroupTransfers,
  buildGroupSettlementStatus,
  canTransitionGroupPayment,
  isGroupObligationClosed,
  groupPaymentTone,
  isGroupPaymentActionable,
  groupPaymentStatusLabelKey,
  GROUP_PAYMENT_TRANSITIONS,
  buildGroupActivity,
  appendGroupActivity,
  groupActivityTimeline,
  GROUP_ACTIVITY_CAP,
} from '@/domain/group-split';
import type { GroupSplitEvent, GroupPaymentStatus } from '@/domain/group-split';

/**
 * G7 (DEC-353/354) — the payment fairness model + the activity log. The math is
 * unchanged (asserted via the settlement-status reuse of `computeGroupTransfers`);
 * these tests pin the STATES (never penalise marked-paid) + the history builder.
 */

/** Ana(owner) paid 30€ for the three of them → Bruno & Carla each owe 10€. */
function buildOwedEvent(): { event: GroupSplitEvent; a: string; b: string; c: string } {
  let event = createGroupSplitEvent({ name: 'Churrasco', currency: 'EUR', ownerName: 'Ana' });
  const a = event.ownerParticipantId;
  const bruno = createGroupParticipant({ name: 'Bruno' });
  const carla = createGroupParticipant({ name: 'Carla' });
  event = addParticipant(addParticipant(event, bruno), carla);
  event = addExpense(
    event,
    buildGroupExpense({
      description: 'Churrasco',
      amountCents: 3000,
      paidByParticipantId: a,
      splitMode: 'equal',
      participantIds: [a, bruno.id, carla.id],
    }),
  );
  return { event, a, b: bruno.id, c: carla.id };
}

describe('DEC-353 — payment lifecycle state machine', () => {
  it('only `confirmed` closes an obligation (marked is still awaiting)', () => {
    expect(isGroupObligationClosed('confirmed')).toBe(true);
    expect(isGroupObligationClosed('marked')).toBe(false);
    expect(isGroupObligationClosed('unpaid')).toBe(false);
    expect(isGroupObligationClosed('contested')).toBe(false);
    expect(isGroupObligationClosed('cancelled')).toBe(false);
  });

  it('NEVER penalises a marked-paid payer — `marked` is neutral, never danger', () => {
    expect(groupPaymentTone('marked')).toBe('neutral');
    expect(groupPaymentTone('confirmed')).toBe('positive');
    expect(groupPaymentTone('contested')).toBe('danger');
    expect(groupPaymentTone('unpaid')).toBe('pending');
    expect(groupPaymentTone('cancelled')).toBe('pending');
    // The fairness invariant: no tone for a non-rejected state is ever "danger".
    const nonRejected: GroupPaymentStatus[] = ['unpaid', 'marked', 'confirmed', 'cancelled'];
    for (const s of nonRejected) expect(groupPaymentTone(s)).not.toBe('danger');
  });

  it('marks a row actionable only when it genuinely needs movement', () => {
    expect(isGroupPaymentActionable('unpaid')).toBe(true);
    expect(isGroupPaymentActionable('contested')).toBe(true);
    expect(isGroupPaymentActionable('cancelled')).toBe(true);
    // Awaiting the OTHER side / already closed → not yours to act on.
    expect(isGroupPaymentActionable('marked')).toBe(false);
    expect(isGroupPaymentActionable('confirmed')).toBe(false);
  });

  it('allows the documented transitions and rejects illegal/no-op ones', () => {
    expect(canTransitionGroupPayment('unpaid', 'marked')).toBe(true);
    expect(canTransitionGroupPayment('unpaid', 'confirmed')).toBe(true);
    expect(canTransitionGroupPayment('marked', 'confirmed')).toBe(true);
    expect(canTransitionGroupPayment('marked', 'contested')).toBe(true);
    expect(canTransitionGroupPayment('confirmed', 'unpaid')).toBe(true); // Â9: revertible
    expect(canTransitionGroupPayment('contested', 'marked')).toBe(true);
    // illegal / no-op
    expect(canTransitionGroupPayment('unpaid', 'contested')).toBe(false);
    expect(canTransitionGroupPayment('cancelled', 'confirmed')).toBe(false);
    expect(canTransitionGroupPayment('confirmed', 'confirmed')).toBe(false);
  });

  it('every transition target is itself a known state (machine is total)', () => {
    const states = Object.keys(GROUP_PAYMENT_TRANSITIONS) as GroupPaymentStatus[];
    for (const from of states) {
      for (const to of GROUP_PAYMENT_TRANSITIONS[from]) {
        expect(states).toContain(to);
      }
    }
  });

  it('derives a stable i18n label key per status', () => {
    expect(groupPaymentStatusLabelKey('marked')).toBe('group_split.pay_status_marked');
    expect(groupPaymentStatusLabelKey('confirmed')).toBe('group_split.pay_status_confirmed');
  });
});

describe('F22 — who-paid / who-falta settlement status', () => {
  it('tags each transfer with the debtor state and counts settled vs pending', () => {
    const { event, b } = buildOwedEvent();
    const transfers = computeGroupTransfers(event);
    expect(transfers).toHaveLength(2); // Bruno→Ana 10, Carla→Ana 10

    // Nothing confirmed yet → all pending.
    const before = buildGroupSettlementStatus(event);
    expect(before.lines).toHaveLength(2);
    expect(before.settledCount).toBe(0);
    expect(before.pendingCount).toBe(2);
    expect(before.lines.every((l) => l.status === 'unpaid')).toBe(true);

    // Bruno marks paid (awaiting) → still NOT settled (fairness: marked ≠ closed).
    const marked = setParticipantPayment(event, b, 'marked');
    const mid = buildGroupSettlementStatus(marked);
    expect(mid.settledCount).toBe(0);
    expect(mid.lines.find((l) => l.fromParticipantId === b)!.status).toBe('marked');

    // Ana (receiver) confirms Bruno → one obligation closed.
    const confirmed = setParticipantPayment(marked, b, 'confirmed');
    const after = buildGroupSettlementStatus(confirmed);
    expect(after.settledCount).toBe(1);
    expect(after.pendingCount).toBe(1);
    // Amounts unchanged — settlement math invariance.
    expect(after.lines.reduce((s, l) => s + l.amountCents, 0)).toBe(2000);
  });
});

describe('DEC-354 — append-only group activity log', () => {
  it('builds a structured entry, trimming optional empties', () => {
    const entry = buildGroupActivity({
      kind: 'payment_confirmed',
      actorName: '  Ana  ',
      subjectName: ' Bruno ',
      counterpartName: '',
      amountCents: 1000,
      ts: '2026-06-26T10:00:00.000Z',
    });
    expect(entry.kind).toBe('payment_confirmed');
    expect(entry.actorName).toBe('Ana');
    expect(entry.subjectName).toBe('Bruno');
    expect(entry).not.toHaveProperty('counterpartName'); // empty dropped
    expect(entry.amountCents).toBe(1000);
    expect(entry.id).toBeTruthy();
    expect(entry.actorId).toBeNull();
  });

  it('appends immutably and exposes a newest-first timeline', () => {
    const { event } = buildOwedEvent();
    expect(event.activity).toBeUndefined();
    const a1 = appendGroupActivity(event, {
      kind: 'expense_added',
      actorName: 'Ana',
      detail: 'Churrasco',
      amountCents: 3000,
      ts: '2026-06-26T10:00:00.000Z',
    });
    const a2 = appendGroupActivity(a1, {
      kind: 'payment_marked',
      actorName: 'Bruno',
      ts: '2026-06-26T11:00:00.000Z',
    });
    expect(event.activity).toBeUndefined(); // original untouched
    expect(a2.activity).toHaveLength(2);
    const timeline = groupActivityTimeline(a2);
    expect(timeline[0]!.kind).toBe('payment_marked'); // newest first
    expect(timeline[1]!.kind).toBe('expense_added');
  });

  it('caps history at GROUP_ACTIVITY_CAP (oldest trimmed)', () => {
    let event = buildOwedEvent().event;
    for (let i = 0; i < GROUP_ACTIVITY_CAP + 25; i++) {
      event = appendGroupActivity(event, {
        kind: 'expense_added',
        actorName: 'Ana',
        detail: `e${i}`,
        ts: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
      });
    }
    expect(event.activity).toHaveLength(GROUP_ACTIVITY_CAP);
    // The oldest 25 were trimmed; the most recent survives.
    const last = event.activity![event.activity!.length - 1]!;
    expect(last.detail).toBe(`e${GROUP_ACTIVITY_CAP + 24}`);
    expect(event.activity!.find((a) => a.detail === 'e0')).toBeUndefined();
  });
});
