/**
 * DEC-132: rescue mode — "I need to save €X by the end of the phase".
 * A calculator, not a commitment: it shows the new daily allowance and
 * which planned occasions to skip; nothing is persisted.
 */

export interface RescueOccasionInput {
  profileId: string;
  profileName: string;
  /** Planned occasions still remaining in the phase. */
  remaining: number;
  typicalValueCents: number;
}

export interface RescueSuggestion {
  profileId: string;
  profileName: string;
  /** How many of the remaining occasions to skip. */
  skipCount: number;
  savingsCents: number;
}

export interface RescuePlan {
  saveTargetCents: number;
  remainingDays: number;
  currentDailyFreeCents: number;
  newDailyFreeCents: number;
  dailyCutCents: number;
  /** false when the target exceeds the remaining free budget. */
  feasible: boolean;
  suggestions: RescueSuggestion[];
  coveredBySuggestionsCents: number;
}

export interface BuildRescuePlanInput {
  saveTargetCents: number;
  freeToSpendCents: number;
  /** Calendar days left in the phase, today inclusive (>= 1). */
  remainingDays: number;
  remainingOccasions: RescueOccasionInput[];
}

/**
 * Greedy cover: skip the most expensive remaining occasions first until the
 * savings target is reached (or the plan runs out of skippable occasions).
 */
function buildSuggestions(
  occasions: RescueOccasionInput[],
  targetCents: number,
): { suggestions: RescueSuggestion[]; coveredCents: number } {
  const sorted = occasions
    .filter((o) => o.remaining > 0 && o.typicalValueCents > 0)
    .sort((a, b) => b.typicalValueCents - a.typicalValueCents);

  const skipsByProfile = new Map<string, RescueSuggestion>();
  let coveredCents = 0;

  for (const occasion of sorted) {
    for (let i = 0; i < occasion.remaining && coveredCents < targetCents; i++) {
      const entry = skipsByProfile.get(occasion.profileId) ?? {
        profileId: occasion.profileId,
        profileName: occasion.profileName,
        skipCount: 0,
        savingsCents: 0,
      };
      entry.skipCount += 1;
      entry.savingsCents += occasion.typicalValueCents;
      skipsByProfile.set(occasion.profileId, entry);
      coveredCents += occasion.typicalValueCents;
    }
    if (coveredCents >= targetCents) break;
  }

  return { suggestions: [...skipsByProfile.values()], coveredCents };
}

export function buildRescuePlan(input: BuildRescuePlanInput): RescuePlan {
  const days = Math.max(1, input.remainingDays);
  const currentDailyFreeCents = Math.floor(Math.max(0, input.freeToSpendCents) / days);
  const freeAfterSavingCents = input.freeToSpendCents - input.saveTargetCents;
  const feasible = freeAfterSavingCents >= 0;
  const newDailyFreeCents = Math.floor(Math.max(0, freeAfterSavingCents) / days);

  const { suggestions, coveredCents } = buildSuggestions(
    input.remainingOccasions,
    input.saveTargetCents,
  );

  return {
    saveTargetCents: input.saveTargetCents,
    remainingDays: days,
    currentDailyFreeCents,
    newDailyFreeCents,
    dailyCutCents: currentDailyFreeCents - newDailyFreeCents,
    feasible,
    suggestions,
    coveredBySuggestionsCents: coveredCents,
  };
}
