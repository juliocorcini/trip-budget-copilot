import { getSyncWorkerUrl, aiRequestHeaders } from '@/data/sync/config';
import { parseAssistantIntents, type AiIntent } from '@/domain/assistant';
import type { AssistantContextPack } from '@/domain/assistant';

/**
 * DEC-246 (AI Quick Entry): client boundary for the natural-language router.
 * Posts the typed text + the low-sensitivity context pack to the `trippilot-sync`
 * Worker `/assistant` route and returns the validated `AiIntent`s — a LIST (one
 * per money event in the message; usually one). Every transport failure is folded
 * into a typed error — this never throws, so the UI can always degrade to manual
 * entry (graceful, like cloud OCR).
 */
export type AssistantError = 'not_configured' | 'rate_limited' | 'offline' | 'failed';

export type AssistantOutcome =
  | { ok: true; intent: AiIntent }
  | { ok: false; error: AssistantError };

export type AssistantListOutcome =
  | { ok: true; intents: AiIntent[] }
  | { ok: false; error: AssistantError };

/** Shared transport: POST the text+context, fold every failure into a typed
 *  error, and hand back the raw JSON for the caller to parse. */
async function postAssistant(
  text: string,
  context: AssistantContextPack,
): Promise<{ ok: true; raw: unknown } | { ok: false; error: AssistantError }> {
  let response: Response;
  try {
    response = await fetch(`${getSyncWorkerUrl()}/assistant`, {
      method: 'POST',
      headers: aiRequestHeaders(),
      body: JSON.stringify({ text, context }),
    });
  } catch {
    return { ok: false, error: 'offline' };
  }

  if (response.status === 503) return { ok: false, error: 'not_configured' };
  if (response.status === 429) return { ok: false, error: 'rate_limited' };
  if (!response.ok) return { ok: false, error: 'failed' };

  try {
    return { ok: true, raw: await response.json() };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

/** The multi-action entry point: returns one `AiIntent` per money event. */
export async function requestAssistantIntents(
  text: string,
  context: AssistantContextPack,
): Promise<AssistantListOutcome> {
  const outcome = await postAssistant(text, context);
  if (!outcome.ok) return outcome;
  const parsed = parseAssistantIntents(outcome.raw);
  if (!parsed.ok) return { ok: false, error: 'failed' };
  return { ok: true, intents: parsed.intents };
}

/** Single-intent convenience (the FIRST event) — kept for back-compat callers. */
export async function requestAssistantIntent(
  text: string,
  context: AssistantContextPack,
): Promise<AssistantOutcome> {
  const result = await requestAssistantIntents(text, context);
  if (!result.ok) return result;
  return { ok: true, intent: result.intents[0]! };
}
