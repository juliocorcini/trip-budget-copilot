import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/data/db/database';
import { createAssistantParticipant } from '@/domain/assistant/dispatch';
import { createParticipant } from '@/domain/splitting';

/**
 * FB-06/24 (DEC-259) — the assistant's "add the person the model named" path must
 * share the SAME idempotency as the inline sheet: an existing trip person is
 * reused (no duplicate "Bruno" in the ledger), and the match is scoped to the
 * trip.
 */
describe('createAssistantParticipant idempotency', () => {
  beforeEach(async () => {
    await db.participants.clear();
  });

  it('reuses an existing trip participant matched by name (accent/case-insensitive)', async () => {
    const andre = createParticipant('trip-1', 'André', null);
    await db.participants.add(andre);

    const result = await createAssistantParticipant('trip-1', 'andre');

    expect(result.id).toBe(andre.id);
    expect(await db.participants.count()).toBe(1);
  });

  it('creates a new participant when the name is unknown to the trip', async () => {
    const result = await createAssistantParticipant('trip-1', 'Carla');

    expect(result.name).toBe('Carla');
    expect(result.isOwner).toBe(false);
    expect(await db.participants.count()).toBe(1);
  });

  it('never reuses a same-named person from another trip', async () => {
    const otherTripBruno = createParticipant('trip-OTHER', 'Bruno', null);
    await db.participants.add(otherTripBruno);

    const result = await createAssistantParticipant('trip-1', 'Bruno');

    expect(result.id).not.toBe(otherTripBruno.id);
    expect(result.tripId).toBe('trip-1');
    expect(await db.participants.count()).toBe(2);
  });
});
