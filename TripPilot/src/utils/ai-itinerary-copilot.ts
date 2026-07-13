import { getSyncWorkerUrl, aiRequestHeaders } from '@/data/sync/config';
import { logger } from '@/utils/logger';
import { readCooldown } from '@/utils/ai-rate-limit';
import type { AiCooldown } from '@/domain/assistant';

export type ItineraryCopilotError =
  | 'not_configured'
  | 'rate_limited'
  | 'offline'
  | 'timeout'
  | 'failed';

export interface BuildInput {
  tripName?: string;
  startDate?: string;
  endDate?: string;
  baseCurrency?: string;
  language?: string;
  userInput: string;
}

export interface BuildRawResponse {
  legs: unknown[];
  suggestedPhases: unknown[];
  summary: string;
}

export interface RefineInput {
  currentLegs: unknown[];
  refinement: string;
  language?: string;
}

export interface RefineRawResponse {
  legs: unknown[];
  changes: string[];
}

export type BuildOutcome =
  | { ok: true; data: BuildRawResponse }
  | { ok: false; error: ItineraryCopilotError; cooldown?: AiCooldown };

export type RefineOutcome =
  | { ok: true; data: RefineRawResponse }
  | { ok: false; error: ItineraryCopilotError; cooldown?: AiCooldown };

const TIMEOUT_MS = 20_000;

async function post<T>(path: string, body: unknown): Promise<
  | { ok: true; data: T }
  | { ok: false; error: ItineraryCopilotError; cooldown?: AiCooldown }
> {
  const url = `${getSyncWorkerUrl()}${path}`;
  const headers = aiRequestHeaders();
  const requestId = headers['X-Request-Id'];

  let response: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === 'AbortError') {
      logger.warn('itinerary_copilot_timeout', { path, requestId });
      return { ok: false, error: 'timeout' };
    }
    logger.warn('itinerary_copilot_offline', { path, requestId });
    return { ok: false, error: 'offline' };
  }
  clearTimeout(timer);

  if (response.status === 429) {
    const cooldown = await readCooldown(response);
    return { ok: false, error: 'rate_limited', cooldown };
  }
  if (response.status === 503) {
    return { ok: false, error: 'not_configured' };
  }
  if (!response.ok) {
    logger.warn('itinerary_copilot_failed', { path, status: response.status, requestId });
    return { ok: false, error: 'failed' };
  }

  try {
    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch {
    logger.warn('itinerary_copilot_parse', { path, requestId });
    return { ok: false, error: 'failed' };
  }
}

export function buildItinerary(input: BuildInput): Promise<BuildOutcome> {
  return post<BuildRawResponse>('/itinerary-copilot/build', input);
}

export function refineItinerary(input: RefineInput): Promise<RefineOutcome> {
  return post<RefineRawResponse>('/itinerary-copilot/refine', input);
}
