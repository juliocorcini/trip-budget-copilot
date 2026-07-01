import type { SyncMetadata } from './common';

/**
 * DEC-414 (G6 · Â-DEBT-TRACEABLE): an audit record of moving a debt from one
 * person to another by reassigning the underlying shares (A→B). It captures WHICH
 * shares moved, the two people, the total, and WHEN — so the move has a traceable
 * history and can be undone as a single action.
 *
 * DEVICE-LOCAL (never backed up — like `localSnapshots`): the authoritative
 * financial truth lives on the shares themselves (`participantId` + `reassignedFrom`),
 * which ARE backed up, so a restore reconstructs correct balances and per-item
 * attribution. This log is only the local history/undo convenience on top.
 */
export interface DebtMovement extends SyncMetadata {
  tripId: string;
  fromParticipantId: string;
  toParticipantId: string;
  /** The shares whose participantId was flipped from `from` to `to`. */
  shareIds: string[];
  /** Sum of the moved shares' amounts (display only — the shares stay the truth). */
  amountCents: number;
  movedAt: string;
  /** Set when the move was undone — kept for history, excluded from "active". */
  undoneAt: string | null;
}
