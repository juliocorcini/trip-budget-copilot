import { groupSplitRepository } from '@/data/repositories';
import { createGroupSplitEvent, createGroupParticipant, addParticipant } from '@/domain/group-split';
import type { GroupSplitEvent } from '@/domain/group-split';
import type { GroupSplitRecord } from '@/domain/types/group-split-record';

/**
 * C23 / DEC-297 — orchestration seam for Tricount group splits. The math lives in
 * the pure `group-split` domain; pages mutate the event with those pure functions
 * and call {@link persistGroupSplit} to write the new state. This keeps business
 * logic out of components and the persistence in one place.
 */

export interface CreateGroupSplitInput {
  name: string;
  currency: string;
  ownerName: string;
  /** Trip link for settle-up sync (DEC-297); null = standalone Tricount. */
  tripId?: string | null;
  /** Owner's trip Participant id, when this event lives inside a trip. */
  ownerLinkedParticipantId?: string | null;
  /**
   * DEC-338 — extra participants (names) to seed at creation, in order. Blanks are
   * skipped; the owner is always seeded by `createGroupSplitEvent` first. Optional:
   * creating with no extra people still yields a valid owner-only event.
   */
  peopleNames?: string[];
}

/** Builds a fresh event (owner + any seeded people) and persists it; returns the live event. */
export async function createGroupSplit(input: CreateGroupSplitInput): Promise<GroupSplitEvent> {
  let event = createGroupSplitEvent({
    name: input.name,
    currency: input.currency,
    ownerName: input.ownerName,
    tripId: input.tripId ?? null,
    ownerLinkedParticipantId: input.ownerLinkedParticipantId ?? null,
  });
  for (const rawName of input.peopleNames ?? []) {
    const name = rawName.trim();
    if (name.length === 0) continue;
    event = addParticipant(event, createGroupParticipant({ name }));
  }
  await groupSplitRepository.createFromEvent(event);
  return event;
}

/** The single write seam: persist a pure-mutated event, refreshing projections. */
export async function persistGroupSplit(event: GroupSplitEvent): Promise<GroupSplitRecord | undefined> {
  return groupSplitRepository.saveEvent(event);
}

/** Soft-deletes a group split (Â9: hidden, recoverable from a backup, never purged). */
export async function deleteGroupSplit(id: string): Promise<void> {
  await groupSplitRepository.delete(id);
}
