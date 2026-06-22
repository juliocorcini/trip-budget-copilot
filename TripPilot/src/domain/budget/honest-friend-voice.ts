import type { HonestFriendTone } from './honest-friend';

/**
 * FB-12 · DEC-264 — selectable "voices" for the Amigo Sincero. The verdict logic
 * is unchanged; the voice only flavors a short lead line drawn from a phrase bank
 * indexed by [voice × mood band]. Four voices ship in V1 (default = padrão); the
 * bank lives in i18n (3 languages), this module just resolves which key to read.
 */
export type HonestFriendVoice = 'padrao' | 'zen' | 'durao' | 'economico';

export const HONEST_FRIEND_VOICES: readonly HonestFriendVoice[] = [
  'padrao',
  'zen',
  'durao',
  'economico',
];

export const DEFAULT_HONEST_FRIEND_VOICE: HonestFriendVoice = 'padrao';

/** Tolerant resolver: any unknown/undefined stored value falls back to padrão,
 *  so existing installs (no field) and bad data never break the card. */
export function resolveHonestFriendVoice(value: string | null | undefined): HonestFriendVoice {
  return HONEST_FRIEND_VOICES.includes(value as HonestFriendVoice)
    ? (value as HonestFriendVoice)
    : DEFAULT_HONEST_FRIEND_VOICE;
}

/** The coarse mood the voice reacts to (the rich verdict keeps its own copy). */
export type VoiceBand = 'good' | 'warn' | 'over';

export function toVoiceBand(tone: HonestFriendTone): VoiceBand {
  if (tone === 'alert') return 'over';
  if (tone === 'caution') return 'warn';
  // positive / steady / neutral all read as "doing fine".
  return 'good';
}

/** Phrases authored per band, per voice, in each locale. Keep the locale files
 *  in sync with this count (the picker rotates over exactly this many). */
export const VOICE_LINES_PER_BAND = 2;

/**
 * Deterministic, stable-per-seed pick so the lead line does not flicker within a
 * render (the seed is the trip day number) yet rotates day to day for variety.
 */
export function pickVoiceLineIndex(seed: number, count = VOICE_LINES_PER_BAND): number {
  if (count <= 0) return 0;
  return Math.abs(Math.trunc(seed)) % count;
}

/** i18n key (under the `dashboard` namespace) for a voice's line in a band. */
export function voiceLineKey(voice: HonestFriendVoice, band: VoiceBand, index: number): string {
  return `amigo_voice.${voice}.${band}_${index}`;
}
