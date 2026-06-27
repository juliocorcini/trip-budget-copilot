import { describe, it, expect } from 'vitest';
import {
  SETTLE_STATES,
  SETTLE_STATE_META,
  SETTLE_STATE_TRANSITIONS,
  canTransitionSettleState,
  settleStateTone,
  isSettleObligationClosed,
  isSettleTerminal,
  isSettleInFlight,
  settleShowsAsOwing,
  settleActionableBy,
  isSettleActionableBy,
  settleNotifies,
  settleStateLabelKey,
  describeSettleState,
  settleStateFromGroupPayment,
} from '@/domain/settle-flows';
import type { SettleState } from '@/domain/settle-flows';
import type { GroupPaymentStatus } from '@/domain/group-split';

/**
 * DEC-371 (G1 spec) — the pure 15-state settle model. The arithmetic is NOT
 * here (it stays in the debt engine); these tests pin the STATE invariants the
 * flows document depends on: all 15 exist, the machine is total + reversible
 * (Â9), the fairness rule (marked-paid never "deve"/danger), `confirmed` is the
 * only closed state, and the group-model bridge reconciles.
 */

describe('DEC-371 — the 15-state model exists and is well-formed', () => {
  it('declares exactly the 15 canonical states', () => {
    expect(SETTLE_STATES).toHaveLength(15);
    expect(new Set(SETTLE_STATES).size).toBe(15); // no duplicates
    const expected: SettleState[] = [
      'draft',
      'created',
      'sending',
      'sent',
      'received',
      'awaiting_acceptance',
      'accepted',
      'rejected',
      'awaiting_payment',
      'marked_paid',
      'awaiting_confirmation',
      'confirmed',
      'cancelled',
      'send_failed',
      'expired',
    ];
    expect([...SETTLE_STATES].sort()).toEqual([...expected].sort());
  });

  it('has meta + a transition list for every state (no orphans either way)', () => {
    for (const s of SETTLE_STATES) {
      expect(SETTLE_STATE_META[s]).toBeDefined();
      expect(SETTLE_STATE_TRANSITIONS[s]).toBeDefined();
    }
    expect(Object.keys(SETTLE_STATE_META).sort()).toEqual([...SETTLE_STATES].sort());
    expect(Object.keys(SETTLE_STATE_TRANSITIONS).sort()).toEqual([...SETTLE_STATES].sort());
  });

  it('every transition target is itself a known state (machine is total)', () => {
    for (const from of SETTLE_STATES) {
      for (const to of SETTLE_STATE_TRANSITIONS[from]) {
        expect(SETTLE_STATES).toContain(to);
      }
    }
  });

  it('tone is always one of the declared tones', () => {
    const tones = ['positive', 'neutral', 'pending', 'danger', 'muted'];
    for (const s of SETTLE_STATES) expect(tones).toContain(settleStateTone(s));
  });
});

describe('DEC-371 — the fairness rule (never penalise a marked-paid debtor)', () => {
  it('marked_paid and awaiting_confirmation are NEUTRAL, never danger', () => {
    expect(settleStateTone('marked_paid')).toBe('neutral');
    expect(settleStateTone('awaiting_confirmation')).toBe('neutral');
    expect(settleStateTone('marked_paid')).not.toBe('danger');
    expect(settleStateTone('awaiting_confirmation')).not.toBe('danger');
  });

  it('marked_paid and awaiting_confirmation NEVER read as "deve" (owing)', () => {
    expect(settleShowsAsOwing('marked_paid')).toBe(false);
    expect(settleShowsAsOwing('awaiting_confirmation')).toBe(false);
    // While a genuine open debt does read as owing.
    expect(settleShowsAsOwing('awaiting_payment')).toBe(true);
    expect(settleShowsAsOwing('accepted')).toBe(true);
  });

  it('a marked-paid debtor is NOT the one expected to act (the creditor confirms)', () => {
    expect(isSettleActionableBy('marked_paid', 'receiver')).toBe(false);
    expect(isSettleActionableBy('marked_paid', 'creator')).toBe(true);
    expect(isSettleActionableBy('awaiting_confirmation', 'creator')).toBe(true);
  });
});

describe('DEC-371 — obligation closing + terminal/in-flight classification', () => {
  it('ONLY confirmed closes an obligation', () => {
    expect(isSettleObligationClosed('confirmed')).toBe(true);
    const others = SETTLE_STATES.filter((s) => s !== 'confirmed');
    for (const s of others) expect(isSettleObligationClosed(s)).toBe(false);
  });

  it('flags the terminal resting states', () => {
    expect(isSettleTerminal('confirmed')).toBe(true);
    expect(isSettleTerminal('rejected')).toBe(true);
    expect(isSettleTerminal('cancelled')).toBe(true);
    expect(isSettleTerminal('expired')).toBe(true);
    expect(isSettleTerminal('awaiting_payment')).toBe(false);
    expect(isSettleTerminal('draft')).toBe(false);
  });

  it('flags the delivery (in-flight) phase only', () => {
    expect(isSettleInFlight('sending')).toBe(true);
    expect(isSettleInFlight('sent')).toBe(true);
    expect(isSettleInFlight('received')).toBe(true);
    expect(isSettleInFlight('accepted')).toBe(false);
    expect(isSettleInFlight('confirmed')).toBe(false);
  });
});

describe('DEC-371 — transitions (Â9: everything reversible)', () => {
  it('walks the happy path created → … → confirmed', () => {
    expect(canTransitionSettleState('draft', 'created')).toBe(true);
    expect(canTransitionSettleState('created', 'sending')).toBe(true);
    expect(canTransitionSettleState('sending', 'sent')).toBe(true);
    expect(canTransitionSettleState('sent', 'received')).toBe(true);
    expect(canTransitionSettleState('received', 'accepted')).toBe(true);
    expect(canTransitionSettleState('accepted', 'awaiting_payment')).toBe(true);
    expect(canTransitionSettleState('awaiting_payment', 'marked_paid')).toBe(true);
    expect(canTransitionSettleState('marked_paid', 'awaiting_confirmation')).toBe(true);
    expect(canTransitionSettleState('awaiting_confirmation', 'confirmed')).toBe(true);
  });

  it('allows recovery transitions (Â9) and a bounced "paguei"', () => {
    expect(canTransitionSettleState('confirmed', 'awaiting_payment')).toBe(true); // mistap reopen
    expect(canTransitionSettleState('marked_paid', 'awaiting_payment')).toBe(true); // claim bounced
    expect(canTransitionSettleState('awaiting_confirmation', 'awaiting_payment')).toBe(true);
    expect(canTransitionSettleState('send_failed', 'sending')).toBe(true); // retry
    expect(canTransitionSettleState('rejected', 'awaiting_acceptance')).toBe(true); // changed mind
    expect(canTransitionSettleState('cancelled', 'created')).toBe(true); // re-issue
  });

  it('rejects illegal jumps and no-ops', () => {
    expect(canTransitionSettleState('draft', 'confirmed')).toBe(false);
    expect(canTransitionSettleState('created', 'received')).toBe(false);
    expect(canTransitionSettleState('confirmed', 'confirmed')).toBe(false);
    expect(canTransitionSettleState('expired', 'confirmed')).toBe(false);
  });
});

describe('DEC-371 — notifications + labels + descriptor', () => {
  it('notifies the right side on the key transitions', () => {
    expect(settleNotifies('received')).toBe('receiver'); // "X enviou pra você"
    expect(settleNotifies('accepted')).toBe('creator'); // "Y aceitou"
    expect(settleNotifies('rejected')).toBe('creator'); // "Y rejeitou"
    expect(settleNotifies('marked_paid')).toBe('creator'); // "Y marcou como pago"
    expect(settleNotifies('confirmed')).toBe('receiver'); // "X confirmou o recebimento"
    expect(settleNotifies('draft')).toBeNull();
  });

  it('derives a stable i18n label key per state', () => {
    expect(settleStateLabelKey('awaiting_acceptance')).toBe('settle_state.awaiting_acceptance');
    expect(settleStateLabelKey('confirmed')).toBe('settle_state.confirmed');
  });

  it('describeSettleState returns a one-read descriptor', () => {
    const d = describeSettleState('marked_paid');
    expect(d.state).toBe('marked_paid');
    expect(d.labelKey).toBe('settle_state.marked_paid');
    expect(d.tone).toBe('neutral');
    expect(d.showsAsOwing).toBe(false);
    expect(d.actionableBy).toBe('creator');
  });

  it('exposes actionableBy for every state via the helper', () => {
    expect(settleActionableBy('awaiting_acceptance')).toBe('receiver');
    expect(settleActionableBy('awaiting_payment')).toBe('receiver');
    expect(settleActionableBy('confirmed')).toBeNull();
    expect(settleActionableBy('sending')).toBeNull();
  });
});

describe('DEC-371 — bridge to the DEC-353 group payment model', () => {
  it('maps every group status into the 15-state vocabulary', () => {
    const cases: Array<[GroupPaymentStatus, SettleState]> = [
      ['unpaid', 'awaiting_payment'],
      ['marked', 'marked_paid'],
      ['confirmed', 'confirmed'],
      ['contested', 'awaiting_payment'],
      ['cancelled', 'cancelled'],
    ];
    for (const [group, settle] of cases) {
      expect(settleStateFromGroupPayment(group)).toBe(settle);
    }
  });

  it('the bridge preserves the closed-only-on-confirmed invariant', () => {
    // The group `confirmed` is the only one that maps to a closed settle state.
    const groupStatuses: GroupPaymentStatus[] = ['unpaid', 'marked', 'confirmed', 'contested', 'cancelled'];
    for (const g of groupStatuses) {
      const closed = isSettleObligationClosed(settleStateFromGroupPayment(g));
      expect(closed).toBe(g === 'confirmed');
    }
  });
});
