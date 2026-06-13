import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { Transaction } from '@/domain/types/transaction';
import type { Session } from '@/domain/types/session';

/**
 * E7 (M18/M19) — in-trip learning SUGGESTIONS. A profile's typical value is the
 * cost of ONE OCCASION (a bar night, a dinner), so learning samples whole
 * SESSIONS (DEC-115: 1 session = 1 occasion), never individual items. Special
 * or excluded items never teach (DEC-006). Everything here is pure and
 * side-effect free — the engine only PROPOSES; the profile is written on the
 * user's accept (ÂNCORA 12 / DEC-007).
 */

/** Recent closed sessions sampled per profile for the average. */
export const VALUE_SUGGESTION_RECENT_OUTINGS = 5;
/** Minimum occasions before a change is worth proposing. */
export const VALUE_SUGGESTION_MIN_SAMPLES = 3;
/** The real average must diverge from the typical by at least this fraction… */
export const VALUE_SUGGESTION_MIN_RATIO = 0.2;
/** …and by at least this many cents, so tiny absolute gaps stay silent. */
export const VALUE_SUGGESTION_MIN_DELTA_CENTS = 500;
/** safe = typical × this — mirrors the per-item learning engine. */
const SAFE_MULTIPLIER = 1.3;

export interface ProfileOccasionAverage {
  profileId: string;
  averageCents: number;
  sampleCount: number;
}

export interface ComputeOccasionAveragesInput {
  sessions: Session[];
  transactions: Transaction[];
}

/**
 * M18: the average cost of a profile's recent OCCASIONS. Each closed session is
 * one sample — the sum of its non-special, non-excluded expense items. The most
 * recent VALUE_SUGGESTION_RECENT_OUTINGS occasions per profile feed the average,
 * so a bar night of 9 drinks counts ONCE (DEC-115), never nine times.
 */
export function computeProfileOccasionAverages(
  input: ComputeOccasionAveragesInput,
): ProfileOccasionAverage[] {
  const learnableBySession = new Map<string, number>();
  for (const tx of input.transactions) {
    if (
      tx.deletedAt !== null ||
      tx.type !== 'expense' ||
      tx.sessionId === null ||
      tx.isSpecialOccasion ||
      tx.excludeFromLearning
    ) {
      continue;
    }
    const prev = learnableBySession.get(tx.sessionId) ?? 0;
    learnableBySession.set(tx.sessionId, prev + (tx.personalCostCents ?? tx.amountCents));
  }

  const samplesByProfile = new Map<string, number[]>();
  const closed = input.sessions
    .filter((s) => s.deletedAt === null && s.endedAt !== null && s.activityProfileId !== null)
    .sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? ''));

  for (const session of closed) {
    const total = learnableBySession.get(session.id);
    if (total === undefined || total <= 0) continue;
    const profileId = session.activityProfileId!;
    const list = samplesByProfile.get(profileId) ?? [];
    if (list.length >= VALUE_SUGGESTION_RECENT_OUTINGS) continue;
    list.push(total);
    samplesByProfile.set(profileId, list);
  }

  const result: ProfileOccasionAverage[] = [];
  for (const [profileId, totals] of samplesByProfile) {
    const sum = totals.reduce((acc, value) => acc + value, 0);
    result.push({
      profileId,
      averageCents: Math.round(sum / totals.length),
      sampleCount: totals.length,
    });
  }
  return result;
}

export interface ValueSuggestion {
  profileId: string;
  profileName: string;
  currentTypicalCents: number;
  suggestedTypicalCents: number;
  suggestedSafeCents: number;
  sampleCount: number;
}

export interface DetectValueSuggestionInput {
  profiles: ActivityProfile[];
  sessions: Session[];
  transactions: Transaction[];
  /** settings.valueSuggestionsDismissed — profiles the user chose to keep. */
  dismissedProfileIds: string[];
}

/**
 * M19: the single most-divergent profile whose recent occasion average is far
 * enough from its stored typical to be worth proposing ("your bars cost €22,
 * not €15 — update?"). Returns null when nothing diverges enough, there are too
 * few samples, or the user already dismissed it (anti-spam, ÂNCORA 8/12).
 */
export function detectValueSuggestion(
  input: DetectValueSuggestionInput,
): ValueSuggestion | null {
  const averages = computeProfileOccasionAverages({
    sessions: input.sessions,
    transactions: input.transactions,
  });
  const dismissed = new Set(input.dismissedProfileIds);

  let best: ValueSuggestion | null = null;
  let bestRatio = 0;
  for (const avg of averages) {
    if (avg.sampleCount < VALUE_SUGGESTION_MIN_SAMPLES) continue;
    if (dismissed.has(avg.profileId)) continue;
    const profile = input.profiles.find((p) => p.id === avg.profileId && p.deletedAt === null);
    if (!profile || profile.typicalValueCents <= 0) continue;

    const absDelta = Math.abs(avg.averageCents - profile.typicalValueCents);
    if (absDelta < VALUE_SUGGESTION_MIN_DELTA_CENTS) continue;
    const ratio = absDelta / profile.typicalValueCents;
    if (ratio < VALUE_SUGGESTION_MIN_RATIO) continue;

    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = {
        profileId: profile.id,
        profileName: profile.name,
        currentTypicalCents: profile.typicalValueCents,
        suggestedTypicalCents: avg.averageCents,
        suggestedSafeCents: Math.round(avg.averageCents * SAFE_MULTIPLIER),
        sampleCount: avg.sampleCount,
      };
    }
  }
  return best;
}

/** Append a profile id to the dismissed list (idempotent). */
export function markValueSuggestionDismissed(dismissed: string[], profileId: string): string[] {
  return dismissed.includes(profileId) ? dismissed : [...dismissed, profileId];
}
