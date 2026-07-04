import { getSyncWorkerUrl, aiRequestHeaders } from '@/data/sync/config';
import { logger } from '@/utils/logger';
import { parseReceiptResponse, applyBasketDiscountToReceiptPlan } from '@/domain/receipt';
import { bumpTelemetryCounter } from '@/utils/telemetry-events';
import { readCooldown } from '@/utils/ai-rate-limit';
import type { ReceiptPlan } from '@/domain/receipt';
import type { AiCooldown } from '@/domain/assistant';

/**
 * Stable failure reasons for cloud OCR. The UI maps each to a localized message
 * (DEC-206 graceful degradation): the feature never crashes — when the key is
 * missing or the network is down, the user just keeps adding items manually.
 */
export type ReceiptOcrError = 'not_configured' | 'rate_limited' | 'offline' | 'failed';

export type ReceiptOcrOutcome =
  | { ok: true; plan: ReceiptPlan }
  | { ok: false; error: ReceiptOcrError; cooldown?: AiCooldown };

/**
 * DEC-206 (G2): client boundary for cloud receipt OCR. Sends the compressed
 * receipt image (as a data URL) to the `trippilot-sync` Worker `/ocr` route and
 * returns a normalized `ReceiptPlan`. All transport/HTTP failures are folded
 * into a typed error — this function never throws.
 */
export async function extractReceiptViaCloud(imageDataUrl: string): Promise<ReceiptOcrOutcome> {
  const headers = aiRequestHeaders();
  const requestId = headers['X-Request-Id'];
  let response: Response;
  try {
    response = await fetch(`${getSyncWorkerUrl()}/ocr`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ imageDataUrl }),
    });
  } catch {
    logger.info('ocr_offline', { module: 'ai-ocr', requestId });
    return { ok: false, error: 'offline' };
  }

  if (response.status === 503) return { ok: false, error: 'not_configured' };
  if (response.status === 429) return { ok: false, error: 'rate_limited', cooldown: await readCooldown(response) };
  if (!response.ok) {
    logger.warn('ocr_http_failed', { module: 'ai-ocr', requestId, status: response.status });
    return { ok: false, error: 'failed' };
  }

  try {
    const raw: unknown = await response.json();
    // DEC-467: fold classified discounts (basket + item) into the item amounts
    // deterministically, so EVERY consumer (receipt review, assistant total,
    // split, group) sees net values that sum to what was actually paid.
    const { plan } = applyBasketDiscountToReceiptPlan(parseReceiptResponse(raw));
    bumpTelemetryCounter('receiptScans'); // DEC-248: count a successful cloud scan.
    return { ok: true, plan };
  } catch (err) {
    logger.warn('ocr_parse_failed', { module: 'ai-ocr', requestId }, err);
    return { ok: false, error: 'failed' };
  }
}
