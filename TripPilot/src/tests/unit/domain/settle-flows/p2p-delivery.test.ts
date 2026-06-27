import { describe, it, expect } from 'vitest';
import {
  resolveP2pDelivery,
  canDeliverDebt,
  resolveSettlementDelivery,
  type P2pDeliveryInput,
} from '@/domain/settle-flows/p2p-delivery';

/**
 * G5 / DEC-366 — the headline routing rule: connected + owed ⇒ real-time `debt`;
 * non-connected ⇒ public link; connected + settled ⇒ nothing (never a fake debt).
 */
describe('resolveP2pDelivery (DEC-366, G5)', () => {
  it('connected peer who owes me ⇒ debt for the exact net (cents-exact)', () => {
    const decision = resolveP2pDelivery({ hasPublicKey: true, netCents: 4599 });
    expect(decision.channel).toBe('debt');
    expect(decision.debtAmountCents).toBe(4599);
  });

  it('connected peer who owes nothing (net 0) ⇒ none, no debt', () => {
    const decision = resolveP2pDelivery({ hasPublicKey: true, netCents: 0 });
    expect(decision.channel).toBe('none');
    expect(decision.debtAmountCents).toBe(0);
  });

  it('connected peer I owe (negative net) ⇒ none — a debt is never inverted', () => {
    const decision = resolveP2pDelivery({ hasPublicKey: true, netCents: -2500 });
    expect(decision.channel).toBe('none');
    expect(decision.debtAmountCents).toBe(0);
  });

  it('non-connected person ⇒ link regardless of the balance direction', () => {
    for (const netCents of [3000, 0, -3000]) {
      const decision = resolveP2pDelivery({ hasPublicKey: false, netCents });
      expect(decision.channel, `net ${netCents}`).toBe('link');
      expect(decision.debtAmountCents).toBe(0);
    }
  });

  it('debtAmountCents is non-zero ONLY on the debt channel', () => {
    const inputs: P2pDeliveryInput[] = [
      { hasPublicKey: true, netCents: 100 },
      { hasPublicKey: true, netCents: 0 },
      { hasPublicKey: false, netCents: 100 },
    ];
    for (const input of inputs) {
      const d = resolveP2pDelivery(input);
      if (d.channel === 'debt') expect(d.debtAmountCents).toBeGreaterThan(0);
      else expect(d.debtAmountCents).toBe(0);
    }
  });

  it('canDeliverDebt is true only for a connected peer with a positive net', () => {
    expect(canDeliverDebt({ hasPublicKey: true, netCents: 1 })).toBe(true);
    expect(canDeliverDebt({ hasPublicKey: true, netCents: 0 })).toBe(false);
    expect(canDeliverDebt({ hasPublicKey: true, netCents: -1 })).toBe(false);
    expect(canDeliverDebt({ hasPublicKey: false, netCents: 1 })).toBe(false);
  });
});

/**
 * The money-direction guard. `ParticipantStatement.netCents` is signed the OTHER
 * way: NEGATIVE means the peer owes ME. resolveSettlementDelivery must flip it so a
 * person who owes me gets charged the right amount — and a person I owe is NEVER
 * charged (that backwards debt would corrupt the settlement). This is the single
 * highest-risk line of G5, so it is pinned with explicit cases.
 */
describe('resolveSettlementDelivery (statement sign-flip, DEC-366)', () => {
  it('statement net NEGATIVE (peer owes me) ⇒ debt for the absolute amount', () => {
    const decision = resolveSettlementDelivery({ hasPublicKey: true, statementNetCents: -4599 });
    expect(decision.channel).toBe('debt');
    expect(decision.debtAmountCents).toBe(4599);
  });

  it('statement net POSITIVE (I owe the peer) ⇒ none — never a backwards debt', () => {
    const decision = resolveSettlementDelivery({ hasPublicKey: true, statementNetCents: 4599 });
    expect(decision.channel).toBe('none');
    expect(decision.debtAmountCents).toBe(0);
  });

  it('statement net ZERO (settled up) ⇒ none', () => {
    const decision = resolveSettlementDelivery({ hasPublicKey: true, statementNetCents: 0 });
    expect(decision.channel).toBe('none');
    expect(decision.debtAmountCents).toBe(0);
  });

  it('non-connected ⇒ link no matter the statement sign', () => {
    for (const statementNetCents of [-3000, 0, 3000]) {
      const decision = resolveSettlementDelivery({ hasPublicKey: false, statementNetCents });
      expect(decision.channel, `net ${statementNetCents}`).toBe('link');
    }
  });

  it('the flip is exact and inverse of resolveP2pDelivery', () => {
    // A statement of -1234 (peer owes me 1234) must equal the raw resolver fed +1234.
    expect(resolveSettlementDelivery({ hasPublicKey: true, statementNetCents: -1234 })).toEqual(
      resolveP2pDelivery({ hasPublicKey: true, netCents: 1234 }),
    );
  });
});
