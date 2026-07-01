import { describe, it, expect } from 'vitest';
import {
  createGroupSplitEvent,
  createGroupParticipant,
  buildGroupExpense,
  addParticipant,
  addExpense,
  withOwnerPaymentMethods,
  computeGroupBalances,
  buildGroupSharePayload,
  parseGroupSharePayload,
} from '@/domain/group-split';
import { createPaymentMethod, type PaymentMethod } from '@/domain/payment';
import type { GroupSplitEvent } from '@/domain/group-split';

function eventWithGuest(): { event: GroupSplitEvent; owner: string; guest: string } {
  let event = createGroupSplitEvent({ name: 'Viagem', currency: 'EUR', ownerName: 'Ana' });
  const owner = event.ownerParticipantId;
  const guest = createGroupParticipant({ name: 'Bruno' });
  event = addParticipant(event, guest);
  event = addExpense(
    event,
    buildGroupExpense({
      description: 'Táxi',
      amountCents: 2000,
      paidByParticipantId: owner,
      splitMode: 'equal',
      participantIds: [owner, guest.id],
    }),
  );
  return { event, owner, guest: guest.id };
}

describe('withOwnerPaymentMethods (DEC-433 — publish the owner repayment methods)', () => {
  it('stamps only ENABLED, non-empty methods onto the owner (non-owners untouched)', () => {
    const { event, owner, guest } = eventWithGuest();
    const methods: PaymentMethod[] = [
      createPaymentMethod('pix', 'CPF', '123.456.789-00'),
      { ...createPaymentMethod('wise', 'Wise', '@ana'), enabled: false }, // disabled → excluded
      createPaymentMethod('bank', 'Banco', ''), // empty value → excluded
    ];
    const stamped = withOwnerPaymentMethods(event, methods);
    const ownerP = stamped.participants.find((p) => p.id === owner)!;
    const guestP = stamped.participants.find((p) => p.id === guest)!;
    expect(ownerP.paymentMethods).toHaveLength(1);
    expect(ownerP.paymentMethods![0]!.value).toBe('123.456.789-00');
    expect(guestP.paymentMethods).toBeUndefined();
  });

  it('strips the field when there is nothing usable (stays additive/clean)', () => {
    const { event, owner } = eventWithGuest();
    const stamped = withOwnerPaymentMethods(event, []);
    const ownerP = stamped.participants.find((p) => p.id === owner)!;
    expect(ownerP.paymentMethods).toBeUndefined();
    expect('paymentMethods' in ownerP).toBe(false);
  });

  it('is money-neutral: balances are identical with and without stamped methods', () => {
    const { event } = eventWithGuest();
    const stamped = withOwnerPaymentMethods(event, [createPaymentMethod('pix', 'CPF', 'key')]);
    expect(computeGroupBalances(stamped)).toEqual(computeGroupBalances(event));
  });

  it('rides the E2E share payload and survives the round-trip', () => {
    const { event } = eventWithGuest();
    const stamped = withOwnerPaymentMethods(event, [
      createPaymentMethod('pix', 'CPF', 'key-123'),
      createPaymentMethod('wise', '', '@ana'),
    ]);
    const payload = buildGroupSharePayload(stamped, 3);
    const parsed = parseGroupSharePayload(JSON.parse(JSON.stringify(payload)));
    expect(parsed).not.toBeNull();
    const ownerP = parsed!.event.participants.find((p) => p.id === stamped.ownerParticipantId)!;
    expect(ownerP.paymentMethods).toHaveLength(2);
    expect(ownerP.paymentMethods!.map((m) => m.kind)).toEqual(['pix', 'wise']);
  });

  it('a legacy payload with no paymentMethods still parses (back-compat)', () => {
    const { event } = eventWithGuest();
    const payload = buildGroupSharePayload(event, 1);
    const parsed = parseGroupSharePayload(JSON.parse(JSON.stringify(payload)));
    expect(parsed).not.toBeNull();
    expect(parsed!.event.participants.every((p) => p.paymentMethods === undefined)).toBe(true);
  });
});
