import { createSplitItem, createSplitSession } from './split';
import type { SplitMode, SplitSession } from './types';

/** Name a split promoted from an unnamed outing (UI can rename). */
const DEFAULT_OUTING_SPLIT_NAME = 'Saída';

/** One committed outing round (a personal expense) becoming a claimable line. */
export interface OutingRoundInput {
  description: string;
  amountCents: number;
  category: string;
}

export interface BuildSplitFromOutingInput {
  tripId: string | null;
  phaseId: string | null;
  /** The outing's name, reused as the split name. */
  name: string;
  /** Trip base currency — outing rounds are always booked in base. */
  currency: string;
  /** The owner's display name in the split (the trip user). */
  ownerName: string;
  /** The owner's actor id, for live-link propagation; null when offline-only. */
  ownerActorId: string | null;
  /** The outing's rounds, in order. */
  rounds: OutingRoundInput[];
  /** Optional starting mode; defaults to the session factory's ('itemized'). */
  mode?: SplitMode;
}

/**
 * C2 (coherence §2.1) — the bridge that promotes a SOLO outing into a SHARED
 * live/divisible bill ("dividir esta saída") without rebuilding the split engine.
 * Each committed round becomes a claimable {@link SplitItem} (positive amounts
 * only), preserving its description and category so the divide screen reads like
 * the night happened. Pure: no persistence, no transport — the caller hands the
 * draft to {@link SplitPage}, and the commit (passing `supersededOuting`) atomically
 * removes the original solo rounds so the money is MOVED, never duplicated.
 */
export function buildSplitFromOuting(input: BuildSplitFromOutingInput): SplitSession {
  const items = input.rounds
    .filter((round) => round.amountCents > 0)
    .map((round) =>
      createSplitItem({
        description: round.description,
        amountCents: round.amountCents,
        qty: 1,
        category: round.category,
      }),
    );

  return createSplitSession({
    tripId: input.tripId,
    phaseId: input.phaseId,
    name: input.name.trim() || DEFAULT_OUTING_SPLIT_NAME,
    currency: input.currency,
    mode: input.mode,
    ownerName: input.ownerName,
    ownerActorId: input.ownerActorId,
    items,
  });
}
