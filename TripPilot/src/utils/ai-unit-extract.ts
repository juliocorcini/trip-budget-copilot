import { getSyncWorkerUrl, aiRequestHeaders } from '@/data/sync/config';
import { logger } from '@/utils/logger';
import { parseUnitExtractResponse } from '@/domain/shopping';
import { readCooldown } from '@/utils/ai-rate-limit';
import type { ExtractedUnitItem } from '@/domain/shopping';
import type { AiCooldown } from '@/domain/assistant';

/**
 * Stable failure reasons for the comparator's photo extraction. The UI maps each
 * to a localized line (DEC-284, mirroring DEC-206 graceful degradation): the
 * feature never crashes — when the key is missing or the network is down, the
 * user just keeps typing the rows by hand.
 */
export type UnitExtractError = 'not_configured' | 'rate_limited' | 'offline' | 'failed';

export type UnitExtractOutcome =
  | { ok: true; item: ExtractedUnitItem }
  | { ok: false; error: UnitExtractError; cooldown?: AiCooldown };

/**
 * DEC-284: client boundary for ONE product photo. Sends the compressed image (as
 * a data URL) to the `trippilot-sync` Worker `/unit-extract` route and returns a
 * normalized `ExtractedUnitItem`. All transport/HTTP failures fold into a typed
 * error — this function never throws, so the caller can `Promise.all` several
 * photos and treat each result independently.
 */
export async function extractUnitItemViaCloud(imageDataUrl: string): Promise<UnitExtractOutcome> {
  const headers = aiRequestHeaders();
  const requestId = headers['X-Request-Id'];
  let response: Response;
  try {
    response = await fetch(`${getSyncWorkerUrl()}/unit-extract`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ imageDataUrl }),
    });
  } catch {
    logger.info('unit_extract_offline', { module: 'ai-unit-extract', requestId });
    return { ok: false, error: 'offline' };
  }

  if (response.status === 503) return { ok: false, error: 'not_configured' };
  if (response.status === 429) return { ok: false, error: 'rate_limited', cooldown: await readCooldown(response) };
  if (!response.ok) {
    logger.warn('unit_extract_http_failed', { module: 'ai-unit-extract', requestId, status: response.status });
    return { ok: false, error: 'failed' };
  }

  try {
    const raw: unknown = await response.json();
    return { ok: true, item: parseUnitExtractResponse(raw) };
  } catch (err) {
    logger.warn('unit_extract_parse_failed', { module: 'ai-unit-extract', requestId }, err);
    return { ok: false, error: 'failed' };
  }
}
