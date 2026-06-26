/**
 * DEC-354 (G7) — the group movement history as a pure, append-only builder. Each
 * mutation (expense add/remove, payment mark/confirm/override/contest/cancel,
 * join, revoke) appends one structured {@link GroupActivity}. It is **display-only**
 * (never a money source), lives INSIDE the event (rides the E2E share payload +
 * backup, never Worker-readable — DEC-207), and is capped so it cannot grow
 * unbounded (oldest trimmed, with a "ver tudo" in the UI).
 *
 * Pure: zero React, zero IO. The UI renders each entry's human string via `t()`.
 */
import { v4 as uuidv4 } from 'uuid';
import type { GroupActivity, GroupActivityKind, GroupSplitEvent } from './types';

/** Keep the most recent N entries (a busy trip stays portable in the payload). */
export const GROUP_ACTIVITY_CAP = 200;

export interface BuildGroupActivityInput {
  kind: GroupActivityKind;
  actorId?: string | null;
  actorName: string;
  subjectName?: string;
  counterpartName?: string;
  detail?: string;
  amountCents?: number;
  /** Overridable for tests / replay; defaults to now. */
  ts?: string;
  id?: string;
}

/** Builds one entry (pure; id + timestamp generated). Optional fields omitted when absent. */
export function buildGroupActivity(input: BuildGroupActivityInput): GroupActivity {
  const entry: GroupActivity = {
    id: input.id ?? uuidv4(),
    ts: input.ts ?? new Date().toISOString(),
    actorId: input.actorId ?? null,
    actorName: input.actorName.trim(),
    kind: input.kind,
  };
  if (input.subjectName && input.subjectName.trim()) entry.subjectName = input.subjectName.trim();
  if (input.counterpartName && input.counterpartName.trim()) entry.counterpartName = input.counterpartName.trim();
  if (input.detail && input.detail.trim()) entry.detail = input.detail.trim();
  if (typeof input.amountCents === 'number') entry.amountCents = input.amountCents;
  return entry;
}

/**
 * Appends one entry to the event's history (immutable). Caps to the most recent
 * {@link GROUP_ACTIVITY_CAP} — the oldest is trimmed so the array (and the share
 * payload) stays bounded.
 */
export function appendGroupActivity(event: GroupSplitEvent, input: BuildGroupActivityInput): GroupSplitEvent {
  const entry = buildGroupActivity(input);
  const next = [...(event.activity ?? []), entry];
  const capped = next.length > GROUP_ACTIVITY_CAP ? next.slice(next.length - GROUP_ACTIVITY_CAP) : next;
  return { ...event, activity: capped };
}

/** Newest-first copy for the timeline view (pure; does not mutate the event). */
export function groupActivityTimeline(event: GroupSplitEvent): GroupActivity[] {
  return [...(event.activity ?? [])].sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
}
