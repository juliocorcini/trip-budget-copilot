/**
 * DEC-350 (G4) — resolve the name a peer sees for ME in every share / connect /
 * P2P / claim context. Julio: "no onboarding já colocamos o nome, então pega o
 * nome do onboarding." So the active trip's OWNER participant name wins; an
 * optional `profileName` is only a fallback when there is no trip yet; the
 * auto-seeded `deviceName` (DEC-266, e.g. "Android · Chrome") is the last-resort
 * TECHNICAL label and must NEVER be shown to a peer as a person when a real name
 * exists.
 *
 * Pure (zero React / zero IO) so the precedence is unit-testable; the impure
 * gathering (read the owner participant + settings) lives in an orchestrator.
 */
export interface SelfNameSources {
  /** The active trip's owner participant name (the onboarding name). */
  ownerName?: string | null;
  /** Optional social name set in Settings — only when there is no trip yet. */
  profileName?: string | null;
  /** Auto-seeded device/backup label — the last-resort technical fallback. */
  deviceName?: string | null;
}

/**
 * Resolution order: `ownerName ?? profileName ?? deviceName` (each trimmed; an
 * empty/whitespace value is skipped). Returns `''` only when every source is
 * absent — callers cap/trim at their own boundary as before.
 */
export function resolveSelfName(sources: SelfNameSources): string {
  const owner = sources.ownerName?.trim();
  if (owner) return owner;
  const profile = sources.profileName?.trim();
  if (profile) return profile;
  const device = sources.deviceName?.trim();
  if (device) return device;
  return '';
}
