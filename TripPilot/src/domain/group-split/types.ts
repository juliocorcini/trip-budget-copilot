/**
 * C23 / DEC-297 — "Tricount" group split. A NEW aggregate entity (Council C-C):
 * a persistent group event that holds MANY expenses with MANY payers and divides
 * the running total among the group. It is deliberately a separate model from the
 * single-bill `SplitSession` (different mental model + lifecycle) but REUSES the
 * shared transport (public `/g/` link + the same encrypted share-client + claim),
 * the split math primitives, and the trip settle-up.
 *
 * Pure, transport- and persistence-agnostic: all math lives in pure functions
 * over this shape, money is integer cents, and the React/Dexie layers only carry
 * it. The durable form (`GroupSplitRecord`) wraps this with sync metadata.
 *
 * Invariants (Â11): for every expense, Σ(participant shares) == expense.amountCents,
 * and the event total == Σ(expense amounts). Recomputed forward, never persisted
 * as a denormalized number.
 */

export type GroupParticipantKind = 'owner' | 'manual' | 'connected';

/** Per-person net settlement lifecycle (DEC-297: debtor marks paid → owner confirms). */
export type GroupPaymentStatus = 'unpaid' | 'marked' | 'confirmed';

export interface GroupParticipant {
  /** Stable id within the event. */
  id: string;
  name: string;
  kind: GroupParticipantKind;
  /**
   * The trip `Participant` this maps to, enabling settle-up sync for people who
   * have the app (DEC-297). Null for manual names and account-less guests.
   */
  linkedParticipantId: string | null;
  /**
   * The guest device actorId that claimed this name through the public link
   * (DEC-297: "a pessoa escolhe o nome"); null until someone claims it.
   */
  claimedByActorId: string | null;
  /** Net settlement stage for this person across the whole event. */
  paymentStatus: GroupPaymentStatus;
}

export type GroupExpenseSource = 'manual' | 'ai' | 'receipt';
export type GroupSplitMode = 'equal' | 'custom';

export interface GroupExpense {
  id: string;
  description: string;
  /** Always > 0, integer cents. */
  amountCents: number;
  /** Who fronted the money (a participant id). */
  paidByParticipantId: string;
  splitMode: GroupSplitMode;
  /** Participants sharing this expense (a non-empty subset of the event). */
  participantIds: string[];
  /** participantId → cents — only meaningful for `custom` mode. */
  customAmountsCents: Record<string, number>;
  category: string;
  /** How the expense got in (manual form, AI parse, or receipt photo). */
  source: GroupExpenseSource;
  createdAt: string;
}

export type GroupSplitStatus = 'open' | 'settled';

export interface GroupSplitEvent {
  id: string;
  name: string;
  /** The group's currency (one per event; matches the trip base when linked). */
  currency: string;
  /** Optional trip link for settle-up sync; null = standalone Tricount. */
  tripId: string | null;
  /** The creator's participant id (always present in `participants`). */
  ownerParticipantId: string;
  participants: GroupParticipant[];
  expenses: GroupExpense[];
  status: GroupSplitStatus;
  createdAt: string;
}

/* ── derived (computed, never persisted) ─────────────────────────────────── */

/** What ONE person paid, owes (their share of all expenses) and their net. */
export interface GroupBalance {
  participantId: string;
  name: string;
  /** Sum of expenses this person fronted. */
  paidCents: number;
  /** Sum of this person's shares across every expense. */
  shareCents: number;
  /** paid − share: positive = the group owes them, negative = they owe the group. */
  netCents: number;
  paymentStatus: GroupPaymentStatus;
}

/** A single suggested transfer that settles the group with minimum movements. */
export interface GroupTransfer {
  fromParticipantId: string;
  fromName: string;
  toParticipantId: string;
  toName: string;
  amountCents: number;
}
