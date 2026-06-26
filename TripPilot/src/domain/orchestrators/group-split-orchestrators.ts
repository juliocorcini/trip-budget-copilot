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

/**
 * DEC-355 (G8) — an existing/connected/trip person picked at creation. Seeded as a
 * `connected` slot linked by the real trip-participant id (so settle-up sync works);
 * the accept-first `group_invite` addresses their `actorId` separately, in the page.
 */
export interface CreateGroupSplitPerson {
  name: string;
  /** The trip Participant this maps to (settle-up sync), when on this trip. */
  linkedParticipantId?: string | null;
}

export interface CreateGroupSplitInput {
  name: string;
  currency: string;
  ownerName: string;
  /** Trip link for settle-up sync (DEC-297); null = standalone Tricount. */
  tripId?: string | null;
  /** Owner's trip Participant id, when this event lives inside a trip. */
  ownerLinkedParticipantId?: string | null;
  /**
   * DEC-355 (G8) — existing/connected/trip people picked at creation, seeded FIRST
   * as `connected` slots linked by real id. The invite to their device is sent by
   * the caller (it needs the published creds). Coexists with manual `peopleNames`.
   */
  linkedPeople?: CreateGroupSplitPerson[];
  /**
   * DEC-338 — extra participants (manual names) to seed at creation, in order.
   * Blanks are skipped; the owner is always seeded by `createGroupSplitEvent` first.
   * Optional: creating with no extra people still yields a valid owner-only event.
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
  // Picked existing/connected people first (kind `connected`, linked by real id)…
  for (const person of input.linkedPeople ?? []) {
    const name = person.name.trim();
    if (name.length === 0) continue;
    event = addParticipant(
      event,
      createGroupParticipant({
        name,
        kind: 'connected',
        linkedParticipantId: person.linkedParticipantId ?? null,
      }),
    );
  }
  // …then any manually-typed names (kind `manual`).
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
