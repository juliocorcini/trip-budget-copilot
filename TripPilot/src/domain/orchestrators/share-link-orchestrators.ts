import {
  shareLinkRepository,
  mirroredStatementRepository,
  appSettingsRepository,
} from '@/data/repositories';
import { db } from '@/data/db/database';
import { logger } from '@/utils/logger';
import { createSyncMetadata, getInstallationId } from '@/utils/entity-factory';
import {
  generateSessionKey,
  importSessionKey,
  encryptText,
  decryptText,
} from '@/data/sync/crypto';
import {
  createShare,
  putShareStatement,
  revokeShare,
  getShareStatement,
  getShareResponses,
  postShareResponse,
} from '@/data/sync/share-client';
import { buildShareUrl } from '@/domain/sync/share-link';
import { slugifyShareName, type SharePreview } from '@/domain/sync/share-preview';
import { resolveSelfShareName } from './sync-orchestrators';
import {
  buildShareResponseBatch,
  parseShareResponseBatch,
  mergeShareResponseBatches,
  type ShareResponseBatch,
  type ShareSettleProposal,
} from '@/domain/sync/share-response';
import { parseStatementPayload, type StatementPayload } from '@/domain/sync/statement-payload';
import { answerMirroredLine, clearSentResponses } from '@/domain/sync/mirrored';
import { applyPeerResponses, storeMirroredStatement } from './sync-orchestrators';
import type { ShareLink } from '@/domain/types/share-link';
import type { MirroredStatement } from '@/domain/types/mirrored-statement';

/**
 * DEC-207 — orchestrators for the shared participant link. The owner publishes
 * a per-participant statement (built by buildParticipantSharePayload — DEC-399
 * redacts the net + answerable lines to owner↔participant, with any third-party
 * debts the owner recorded carried separately as a display-only section) as
 * ciphertext to the worker; the guest opens the link, decrypts with the key from
 * the URL fragment, and answers/settles. Everything crossing the wire is E2E
 * encrypted with an AES key the worker never sees.
 */

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Owner side
// ---------------------------------------------------------------------------

export interface CreateShareLinkResult {
  url: string;
  shareLink: ShareLink;
}

/** DEC-445 kill-switch — default ON; a read failure never blocks publishing. */
async function sharePreviewAllowed(): Promise<boolean> {
  try {
    const settings = await appSettingsRepository.get();
    return settings?.sharePreviewEnabled !== false;
  } catch {
    return true;
  }
}

/**
 * Owner: create a brand-new link for a participant's statement. The optional
 * `preview` (composed by the UI in the owner's language — DEC-445) is dropped
 * here when the Settings kill-switch is off, so callers never re-check it.
 * DEC-455: the AES key ALWAYS rides to the worker for escrow — when the worker
 * acks (`keyHeld`), the returned URL drops the `#k=` fragment (short link).
 */
export async function createShareLink(
  participantId: string,
  statement: StatementPayload,
  origin: string,
  preview?: SharePreview,
): Promise<CreateShareLinkResult> {
  const key = await generateSessionKey();
  const cryptoKey = await importSessionKey(key);
  const blob = await encryptText(cryptoKey, JSON.stringify(statement));
  const allowed = preview ? await sharePreviewAllowed() : false;
  const extras = {
    ...(allowed
      ? { preview, slugBase: slugifyShareName(statement.peerName) || 'statement' }
      : {}),
    linkKey: key,
  };
  const { id, slug, keyHeld, writeToken } = await createShare(blob, 1, extras);

  const shareLink: ShareLink = {
    ...createSyncMetadata({ id }),
    participantId,
    slug: slug ?? null,
    key,
    keyOnServer: keyHeld === true,
    writeToken,
    statementRevision: 1,
    revokedAt: null,
    lastPulledAt: null,
  };
  await shareLinkRepository.create(shareLink);
  return { url: buildShareUrl(origin, slug ?? id, keyHeld === true ? null : key), shareLink };
}

/** Owner: re-publish the latest statement to an existing link (revision++). */
export async function refreshShareLink(
  shareLink: ShareLink,
  statement: StatementPayload,
  preview?: SharePreview,
): Promise<ShareLink> {
  const cryptoKey = await importSessionKey(shareLink.key);
  const blob = await encryptText(cryptoKey, JSON.stringify(statement));
  const nextRevision = shareLink.statementRevision + 1;
  const allowed = preview ? await sharePreviewAllowed() : false;
  // DEC-455 — linkKey re-escrows on every republish (upgrades legacy links).
  const result = await putShareStatement(shareLink.id, shareLink.writeToken, blob, nextRevision, {
    ...(allowed && preview ? { preview } : {}),
    linkKey: shareLink.key,
  });
  return shareLinkRepository.update({
    ...shareLink,
    statementRevision: nextRevision,
    ...(result.keyHeld ? { keyOnServer: true } : {}),
  });
}

/** Owner: revoke a link — the guest's future reads return "expired". */
export async function revokeShareLink(shareLink: ShareLink): Promise<void> {
  await revokeShare(shareLink.id, shareLink.writeToken);
  await shareLinkRepository.update({ ...shareLink, revokedAt: new Date().toISOString() });
}

export interface PullShareResponsesResult {
  appliedLines: number;
  settle: ShareSettleProposal | null;
  fromName: string | null;
}

/**
 * Owner: pull guest responses, decrypt, and reconcile. Line confirm/reject go
 * through the existing applyPeerResponses (only the participant's own pending
 * shares can change — DEC-106). A settle proposal is RETURNED, never applied
 * automatically: the owner confirms it (Julio's "ele diz que pagou → eu
 * confirmo"), so a guest can never settle money unilaterally.
 */
export async function pullShareResponses(shareLink: ShareLink): Promise<PullShareResponsesResult> {
  const items = await getShareResponses(shareLink.id, shareLink.writeToken);
  const cryptoKey = await importSessionKey(shareLink.key);
  const batches: ShareResponseBatch[] = [];
  for (const item of items) {
    const plain = await decryptText(cryptoKey, item.blob);
    if (!plain) continue;
    const batch = parseShareResponseBatch(safeJsonParse(plain));
    if (batch) batches.push(batch);
  }

  const merged = mergeShareResponseBatches(batches);
  const appliedLines = await applyPeerResponses(shareLink.participantId, merged.responses);
  await shareLinkRepository.update({ ...shareLink, lastPulledAt: new Date().toISOString() });
  return { appliedLines, settle: merged.settle, fromName: merged.fromName };
}

// ---------------------------------------------------------------------------
// Guest side
// ---------------------------------------------------------------------------

export type IngestShareResult =
  | { status: 'ok'; statement: MirroredStatement }
  | { status: 'revoked' }
  | { status: 'not_found' }
  | { status: 'bad_key' }
  /** G2 (field 06/07): the opener IS the link's owner — never mirrored back. */
  | { status: 'own_link' }
  | { status: 'error' };

/**
 * Guest: open a link — fetch the ciphertext statement, decrypt, and store it
 * as a mirrored statement tagged with its share origin (so confirm/reject +
 * settle can be pushed back). DEC-455: `key` may be null (fragment-less short
 * link) — the escrowed key from the statement GET is used instead; a fragment
 * key, when present, always wins. The guest stays a permanent, signup-less
 * local actor; this just adds to "Compartilhadas comigo".
 */
export async function ingestSharedLink(
  shareId: string,
  key: string | null,
): Promise<IngestShareResult> {
  const result = await getShareStatement(shareId);
  if (result.status !== 'ok') return result;

  const effectiveKey = key ?? result.key ?? null;
  if (!effectiveKey) return { status: 'bad_key' };
  const cryptoKey = await importSessionKey(effectiveKey);
  const plain = await decryptText(cryptoKey, result.blob);
  if (!plain) return { status: 'bad_key' };
  const payload = parseStatementPayload(safeJsonParse(plain));
  if (!payload) return { status: 'bad_key' };

  // G2 guard (field 06/07): the owner tapping their OWN link (to test it or
  // from the reminder message) must never import their statement as if a
  // friend had sent it — that's how "Júlio Corsini te deve 53 EUR" appeared
  // in "Recebido de amigos". Detected by actor identity, not URL, so it also
  // catches re-pulls of an already-stored self mirror.
  if (payload.owner.actorId === getInstallationId()) return { status: 'own_link' };

  const statement = await storeMirroredStatement(payload, { shareId, key: effectiveKey });
  return { status: 'ok', statement };
}

export interface GuestActionResult {
  statement: MirroredStatement;
  /** true when the response reached the worker; false → kept locally to retry. */
  pushed: boolean;
}

/**
 * Guest: answer a pending line locally AND push it to the share channel. The
 * local answer always persists (answerMirroredLine); the push is best-effort —
 * on success the queued answers are cleared, on failure they stay in
 * pendingResponses for the next attempt.
 */
export async function answerAndPushShareLine(
  statementId: string,
  shareId: string,
  status: 'confirmed' | 'rejected',
): Promise<GuestActionResult | null> {
  const statement = await mirroredStatementRepository.getById(statementId);
  if (!statement) return null;
  const updated = answerMirroredLine(statement, shareId, status);
  await db.mirroredStatements.put(updated);
  if (!updated.share) return { statement: updated, pushed: false };

  const pushed = await pushGuestResponses(updated, null);
  if (pushed) {
    const cleared = clearSentResponses(
      updated,
      updated.pendingResponses.map((r) => r.shareId),
    );
    await db.mirroredStatements.put(cleared);
    return { statement: cleared, pushed: true };
  }
  return { statement: updated, pushed: false };
}

/** Guest: send "I paid the whole net" as a settle proposal for the owner to confirm. */
export async function proposeSettlement(statementId: string): Promise<GuestActionResult | null> {
  const statement = await mirroredStatementRepository.getById(statementId);
  if (!statement || !statement.share) return null;
  // DEC-474 — the claim is made in the DEBT's own currency. With per-currency
  // nets, the owed bucket wins (largest when more than one); legacy statements
  // fall back to the scalar headline. A guest owing nothing proposes nothing.
  const owedBuckets = (statement.nets ?? []).filter((b) => b.amountCents < 0);
  const legacyOwed =
    statement.netCents < 0
      ? [{ currency: statement.currency, amountCents: statement.netCents }]
      : [];
  const buckets = owedBuckets.length > 0 ? owedBuckets : statement.nets ? [] : legacyOwed;
  if (buckets.length === 0) return { statement, pushed: false }; // nothing owed
  const largest = buckets.reduce((max, b) =>
    Math.abs(b.amountCents) > Math.abs(max.amountCents) ? b : max,
  );
  const settle: ShareSettleProposal = {
    amountCents: Math.abs(largest.amountCents),
    currency: largest.currency,
    note: null,
  };
  const pushed = await pushGuestResponses(statement, settle);
  return { statement, pushed };
}

/** Builds + encrypts + posts the guest's response batch. Best-effort (returns false on failure). */
async function pushGuestResponses(
  statement: MirroredStatement,
  settle: ShareSettleProposal | null,
): Promise<boolean> {
  if (!statement.share) return false;
  try {
    const settings = await appSettingsRepository.get().catch(() => null);
    // I2 / DEC-350: the owner sees the guest's REAL onboarding name, never the
    // technical device label ("Android · Chrome").
    const fromName = (await resolveSelfShareName(settings ?? undefined).catch(() => '')) || 'Convidado';
    const batch = buildShareResponseBatch({
      fromActorId: getInstallationId(),
      fromName,
      responses: statement.pendingResponses,
      settle,
    });
    const cryptoKey = await importSessionKey(statement.share.key);
    const blob = await encryptText(cryptoKey, JSON.stringify(batch));
    await postShareResponse(statement.share.shareId, crypto.randomUUID(), blob);
    return true;
  } catch (err) {
    // The guest's marks/settle proposal did NOT reach the owner — exactly the
    // silent-failure class the audit flagged (OBS-3). Still swallowed (the UI
    // keeps the pending state and retries), but now it leaves a trace.
    logger.warn('guest_response_push_failed', { module: 'share-link-orchestrators' }, err);
    return false;
  }
}

/** Guest: re-pull the latest statement for an already-opened link. */
export async function refreshSharedLink(statement: MirroredStatement): Promise<IngestShareResult> {
  if (!statement.share) return { status: 'error' };
  return ingestSharedLink(statement.share.shareId, statement.share.key);
}
