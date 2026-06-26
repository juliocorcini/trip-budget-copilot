import { describe, it, expect } from 'vitest';
import {
  addParticipant,
  buildGroupClaimResponse,
  buildGroupExpense,
  computeGroupBalances,
  createGroupParticipant,
  createGroupSplitEvent,
  foldEventForViewer,
  groupTotalCents,
} from '@/domain/group-split';
import type { GroupClaimExpense, GroupSplitEvent } from '@/domain/group-split';

/**
 * G3 / DEC-349 — `foldEventForViewer` is the read-side projection every viewer
 * renders. These tests pin the live-board behaviour: cross-guest convergence
 * (F10), the **"120€" delete/retract regression** (F11), the owner tombstone
 * winning (F12 — owner stays moderator), and idempotency. The arithmetic equals
 * the owner's reducer (ledger-math invariance) — only WHERE/WHEN it runs changed.
 */
function trio(): { event: GroupSplitEvent; ana: string; bruno: string; carla: string } {
  let event = createGroupSplitEvent({ name: 'Lisboa', currency: 'EUR', ownerName: 'Ana' });
  event = addParticipant(event, createGroupParticipant({ name: 'Bruno' }));
  event = addParticipant(event, createGroupParticipant({ name: 'Carla' }));
  return { event, ana: event.participants[0]!.id, bruno: event.participants[1]!.id, carla: event.participants[2]!.id };
}

function netById(event: GroupSplitEvent): Map<string, number> {
  return new Map(computeGroupBalances(event).map((b) => [b.participantId, b.netCents]));
}

describe('foldEventForViewer — live group board (DEC-349)', () => {
  it('F10 — folds every guest snapshot so all authored expenses appear for everyone', () => {
    const { event, ana, bruno, carla } = trio();
    const jantar: GroupClaimExpense = {
      id: 'g:dev-bruno:1',
      description: 'Jantar',
      amountCents: 6000,
      paidByParticipantId: bruno,
      splitMode: 'equal',
      participantIds: [ana, bruno, carla],
    };
    const taxi: GroupClaimExpense = {
      id: 'g:dev-carla:1',
      description: 'Taxi',
      amountCents: 3000,
      paidByParticipantId: carla,
      splitMode: 'equal',
      participantIds: [ana, bruno, carla],
    };
    const snapBruno = buildGroupClaimResponse({
      fromActorId: 'dev-bruno',
      fromName: 'Bruno',
      claimedParticipantId: bruno,
      markedPaid: false,
      expenses: [jantar],
    });
    const snapCarla = buildGroupClaimResponse({
      fromActorId: 'dev-carla',
      fromName: 'Carla',
      claimedParticipantId: carla,
      markedPaid: false,
      expenses: [taxi],
    });

    const folded = foldEventForViewer(event, [snapBruno, snapCarla]);

    expect(groupTotalCents(folded)).toBe(9000);
    const net = netById(folded);
    expect(net.get(bruno)).toBe(3000); // paid 6000, share 3000
    expect(net.get(carla)).toBe(0); // paid 3000, share 3000
    expect(net.get(ana)).toBe(-3000); // paid 0, share 3000
    expect((net.get(ana) ?? 0) + (net.get(bruno) ?? 0) + (net.get(carla) ?? 0)).toBe(0);
  });

  it('F11 — a guest deleting an expense recalculates the total + balances (the 120€ bug)', () => {
    const { event, ana, bruno } = trio();
    // The owner already published a base that folded Bruno's 120€ expense once.
    const base: GroupSplitEvent = {
      ...event,
      expenses: [
        {
          ...buildGroupExpense({
            description: 'Hotel',
            amountCents: 12000,
            paidByParticipantId: bruno,
            splitMode: 'equal',
            participantIds: [ana, bruno],
          }),
          id: 'g:dev-bruno:1',
          authoredByActorId: 'dev-bruno',
        },
      ],
    };
    expect(groupTotalCents(base)).toBe(12000); // the stale "120€" the board used to show

    // Bruno removes it → his next snapshot no longer lists it.
    const retract = buildGroupClaimResponse({
      fromActorId: 'dev-bruno',
      fromName: 'Bruno',
      claimedParticipantId: bruno,
      markedPaid: false,
      expenses: [],
    });

    const folded = foldEventForViewer(base, [retract]);
    expect(groupTotalCents(folded)).toBe(0); // recalculated live, not stuck at 120€
    expect(computeGroupBalances(folded).every((b) => b.netCents === 0)).toBe(true);
  });

  it('F12 — an owner tombstone wins; a re-posted guest snapshot cannot resurrect it', () => {
    const { event, ana, bruno } = trio();
    const base: GroupSplitEvent = { ...event, hiddenExpenseIds: ['g:dev-bruno:1'] };
    const resurrect = buildGroupClaimResponse({
      fromActorId: 'dev-bruno',
      fromName: 'Bruno',
      claimedParticipantId: bruno,
      markedPaid: false,
      expenses: [
        {
          id: 'g:dev-bruno:1',
          description: 'Hotel',
          amountCents: 12000,
          paidByParticipantId: bruno,
          splitMode: 'equal',
          participantIds: [ana, bruno],
        },
      ],
    });

    const folded = foldEventForViewer(base, [resurrect]);
    expect(folded.expenses.find((e) => e.id === 'g:dev-bruno:1')).toBeUndefined();
    expect(groupTotalCents(folded)).toBe(0);
  });

  it('is idempotent — folding the same snapshot twice never double-books', () => {
    const { event, ana, bruno } = trio();
    const snap = buildGroupClaimResponse({
      fromActorId: 'dev-bruno',
      fromName: 'Bruno',
      claimedParticipantId: bruno,
      markedPaid: false,
      expenses: [
        {
          id: 'g:dev-bruno:1',
          description: 'Hotel',
          amountCents: 8000,
          paidByParticipantId: bruno,
          splitMode: 'equal',
          participantIds: [ana, bruno],
        },
      ],
    });

    const once = foldEventForViewer(event, [snap]);
    const refold = foldEventForViewer(once, [snap]); // re-applying must not duplicate
    expect(once.expenses.length).toBe(1);
    expect(refold.expenses.length).toBe(1);
    expect(groupTotalCents(once)).toBe(groupTotalCents(refold));
  });
});
