import { getSyncWorkerUrl } from '@/data/sync/config';
import { parseAssistantResponse, type AiIntent } from '@/domain/assistant';
import type { AssistantContextPack } from '@/domain/assistant';

/**
 * DEC-246 (AI Quick Entry): client boundary for the natural-language router.
 * Posts the typed text + the low-sensitivity context pack to the `trippilot-sync`
 * Worker `/assistant` route and returns a validated `AiIntent`. Every transport
 * failure is folded into a typed error — this function never throws, so the UI
 * can always degrade to manual entry (graceful, like cloud OCR).
 */
export type AssistantError = 'not_configured' | 'rate_limited' | 'offline' | 'failed';

export type AssistantOutcome =
  | { ok: true; intent: AiIntent }
  | { ok: false; error: AssistantError };

export async function requestAssistantIntent(
  text: string,
  context: AssistantContextPack,
): Promise<AssistantOutcome> {
  let response: Response;
  try {
    response = await fetch(`${getSyncWorkerUrl()}/assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, context }),
    });
  } catch {
    return { ok: false, error: 'offline' };
  }

  if (response.status === 503) return { ok: false, error: 'not_configured' };
  if (response.status === 429) return { ok: false, error: 'rate_limited' };
  if (!response.ok) return { ok: false, error: 'failed' };

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    return { ok: false, error: 'failed' };
  }

  const parsed = parseAssistantResponse(raw);
  if (!parsed.ok) return { ok: false, error: 'failed' };
  return { ok: true, intent: parsed.intent };
}
