import { cooldownFromBody, defaultCooldown, type AiCooldown } from '@/domain/assistant';

/**
 * FB-26 (DEC-276) — read a worker 429 response into an honest client cooldown.
 * The body is untrusted; a missing/garbage body still yields a safe ~30s
 * minute-scope cooldown so the countdown is never fabricated. Consumes the
 * response body, so callers must only invoke this on the 429 branch.
 */
export async function readCooldown(response: Response): Promise<AiCooldown> {
  const now = Date.now();
  try {
    const body: unknown = await response.json();
    return cooldownFromBody(body, now) ?? defaultCooldown(now);
  } catch {
    return defaultCooldown(now);
  }
}
