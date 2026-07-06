// @vitest-environment node
// Exercises real AES-GCM (DEC-207) end to end; jsdom ships only a
// non-functional SubtleCrypto stub, so this cycle runs in node.
import { describe, it, expect } from 'vitest';
import {
  buildStatementPayload,
  parseStatementPayload,
  applyStatementResponses,
  buildMirroredStatement,
  answerMirroredLine,
  buildShareResponseBatch,
  parseShareResponseBatch,
  mergeShareResponseBatches,
} from '@/domain/sync';
import {
  generateSessionKey,
  importSessionKey,
  encryptText,
  decryptText,
} from '@/data/sync/crypto';
import type { ParticipantStatement } from '@/domain/splitting';
import type { Participant } from '@/domain/types/participant';
import type { ParticipantShare } from '@/domain/types/participant-share';

/**
 * DEC-207 acceptance: the full shared-link cycle through REAL AES-GCM crypto —
 * owner encrypts a statement → guest decrypts, answers, and proposes "I paid" →
 * owner decrypts + merges + reconciles. No Dexie, no network: pure composition
 * of the domain + crypto, so the math and the encryption are both verified.
 */

const OWNER_ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const GUEST_ACTOR = '12121212-1212-4121-8121-121212121212';
const PARTICIPANT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TX_DINNER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const TX_TAXI = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const SHARE_DINNER = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const SHARE_TAXI = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const meta = {
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: OWNER_ACTOR,
};

const participant: Participant = {
  ...meta,
  id: PARTICIPANT_ID,
  tripId: '99999999-9999-4999-8999-999999999999',
  name: 'Cunhado',
  nickname: null,
  isOwner: false,
  email: null,
  linkedUserAccountId: null,
  linkedActorId: null,
};

function share(id: string, transactionId: string, amountCents: number): ParticipantShare {
  return {
    ...meta,
    id,
    transactionId,
    participantId: PARTICIPANT_ID,
    shareAmountCents: amountCents,
    shareType: 'equal',
    isPaid: false,
    confirmationStatus: 'pending',
    notes: null,
  };
}

const ownerShares: ParticipantShare[] = [
  share(SHARE_DINNER, TX_DINNER, 1850),
  share(SHARE_TAXI, TX_TAXI, 725),
];

const ownerStatement: ParticipantStatement = {
  participantId: PARTICIPANT_ID,
  lines: [
    {
      kind: 'owes',
      transactionId: TX_DINNER,
      sessionId: null,
      description: 'Jantar',
      category: 'restaurant',
      subcategoryId: null,
      occurredAt: '2026-06-09T21:00:00.000Z',
      amountCents: 1850,
      currency: 'BRL',
      counterpartyId: '77777777-7777-4777-8777-777777777777',
      counterpartyName: 'Julio',
      confirmationStatus: 'pending',
      isPaid: false,
      placeLabel: null,
      latitude: null,
      longitude: null,
      placeId: null,
      reassignedFromId: null,
      reassignedFromName: null,
    },
    {
      kind: 'owes',
      transactionId: TX_TAXI,
      sessionId: null,
      description: 'Táxi',
      category: 'transport',
      subcategoryId: null,
      occurredAt: '2026-06-09T23:30:00.000Z',
      amountCents: 725,
      currency: 'BRL',
      counterpartyId: '77777777-7777-4777-8777-777777777777',
      counterpartyName: 'Julio',
      confirmationStatus: 'pending',
      isPaid: false,
      placeLabel: null,
      latitude: null,
      longitude: null,
      placeId: null,
      reassignedFromId: null,
      reassignedFromName: null,
    },
  ],
  settlements: [],
  netCents: -2575, // guest owes the full 1850 + 725
  nets: [{ currency: 'BRL', amountCents: -2575 }],
};

describe('shared-link cycle through real AES-GCM (DEC-207)', () => {
  it('encrypts the statement, the guest decrypts + answers + settles, the owner reconciles', async () => {
    // 1. Owner builds the statement slice (already redacted to one participant).
    const payload = buildStatementPayload({
      owner: { actorId: OWNER_ACTOR, displayName: 'Julio' },
      participant,
      statement: ownerStatement,
      shares: ownerShares,
      currency: 'BRL',
    });

    // 2. Owner generates a link key and encrypts the payload (what goes to KV).
    const keyB64 = await generateSessionKey();
    const ownerKey = await importSessionKey(keyB64);
    const cipherStatement = await encryptText(ownerKey, JSON.stringify(payload));
    expect(cipherStatement).not.toContain('Jantar'); // ciphertext leaks nothing

    // 3. Guest opens the link: imports the SAME key from the fragment, decrypts.
    const guestKey = await importSessionKey(keyB64);
    const decrypted = await decryptText(guestKey, cipherStatement);
    expect(decrypted).not.toBeNull();
    const guestPayload = parseStatementPayload(JSON.parse(decrypted!));
    expect(guestPayload).not.toBeNull();
    expect(guestPayload!.lines.map((l) => l.amountCents)).toEqual([1850, 725]);

    // 4. Guest mirrors it, confirms dinner, rejects taxi, and proposes "I paid".
    let mirror = buildMirroredStatement(guestPayload!, null);
    mirror = answerMirroredLine(mirror, SHARE_DINNER, 'confirmed');
    mirror = answerMirroredLine(mirror, SHARE_TAXI, 'rejected');

    const batch = buildShareResponseBatch({
      fromActorId: GUEST_ACTOR,
      fromName: 'Cunhado',
      responses: mirror.pendingResponses,
      settle: { amountCents: 2575, currency: 'BRL', note: 'pix' },
    });
    const cipherResponse = await encryptText(guestKey, JSON.stringify(batch));

    // 5. Owner pulls + decrypts the response, merges, and applies (DEC-106 rules).
    const ownerDecrypted = await decryptText(ownerKey, cipherResponse);
    const parsedBatch = parseShareResponseBatch(JSON.parse(ownerDecrypted!));
    expect(parsedBatch).not.toBeNull();

    const merged = mergeShareResponseBatches([parsedBatch!]);
    expect(merged.settle).toEqual({ amountCents: 2575, currency: 'BRL', note: 'pix' });
    expect(merged.fromName).toBe('Cunhado');

    const updatedShares = applyStatementResponses(ownerShares, PARTICIPANT_ID, merged.responses);
    const dinner = updatedShares.find((s) => s.id === SHARE_DINNER)!;
    const taxi = updatedShares.find((s) => s.id === SHARE_TAXI)!;
    expect(dinner.confirmationStatus).toBe('confirmed');
    expect(dinner.shareAmountCents).toBe(1850);
    expect(taxi.confirmationStatus).toBe('rejected');
    expect(taxi.shareAmountCents).toBe(725);
  });

  it('a wrong key cannot decrypt the statement (E2E secrecy)', async () => {
    const payload = buildStatementPayload({
      owner: { actorId: OWNER_ACTOR, displayName: 'Julio' },
      participant,
      statement: ownerStatement,
      shares: ownerShares,
      currency: 'BRL',
    });
    const goodKey = await importSessionKey(await generateSessionKey());
    const cipher = await encryptText(goodKey, JSON.stringify(payload));

    const wrongKey = await importSessionKey(await generateSessionKey());
    const decrypted = await decryptText(wrongKey, cipher);
    expect(decrypted).toBeNull(); // AES-GCM auth tag rejects the wrong key
  });
});
