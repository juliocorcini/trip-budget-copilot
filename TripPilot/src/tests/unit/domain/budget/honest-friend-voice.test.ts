import { describe, it, expect } from 'vitest';
import {
  HONEST_FRIEND_VOICES,
  DEFAULT_HONEST_FRIEND_VOICE,
  resolveHonestFriendVoice,
  toVoiceBand,
  pickVoiceLineIndex,
  voiceLineKey,
  VOICE_LINES_PER_BAND,
  type VoiceBand,
} from '@/domain/budget';
import ptBR from '@/i18n/locales/pt-BR.json';

/**
 * FB-12 / DEC-264 — selectable Amigo Sincero voices. The picker must be tolerant
 * (existing installs have no field), the band mapping faithful to the verdict
 * tone, and the i18n bank COMPLETE (a missing line would render a raw key).
 */
describe('resolveHonestFriendVoice', () => {
  it('keeps a valid voice and falls back to padrão for anything else', () => {
    for (const voice of HONEST_FRIEND_VOICES) {
      expect(resolveHonestFriendVoice(voice)).toBe(voice);
    }
    expect(resolveHonestFriendVoice(undefined)).toBe(DEFAULT_HONEST_FRIEND_VOICE);
    expect(resolveHonestFriendVoice(null)).toBe(DEFAULT_HONEST_FRIEND_VOICE);
    expect(resolveHonestFriendVoice('nonsense')).toBe('padrao');
  });
});

describe('toVoiceBand', () => {
  it('maps the verdict tone to the coarse mood band', () => {
    expect(toVoiceBand('alert')).toBe('over');
    expect(toVoiceBand('caution')).toBe('warn');
    expect(toVoiceBand('positive')).toBe('good');
    expect(toVoiceBand('steady')).toBe('good');
    expect(toVoiceBand('neutral')).toBe('good');
  });
});

describe('pickVoiceLineIndex', () => {
  it('is deterministic, in range, and wraps with the seed', () => {
    expect(pickVoiceLineIndex(0)).toBe(0);
    expect(pickVoiceLineIndex(1)).toBe(1 % VOICE_LINES_PER_BAND);
    expect(pickVoiceLineIndex(VOICE_LINES_PER_BAND)).toBe(0);
    // negative / fractional seeds are normalised, never out of range.
    for (const seed of [-3, 2.7, 999]) {
      const idx = pickVoiceLineIndex(seed);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(VOICE_LINES_PER_BAND);
    }
  });
});

function lookup(root: Record<string, unknown>, path: string[]): unknown {
  let node: unknown = root;
  for (const part of path) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

describe('voice phrase bank coverage (pt-BR)', () => {
  const dashboard = (ptBR as { dashboard: Record<string, unknown> }).dashboard;
  const bands: VoiceBand[] = ['good', 'warn', 'over'];

  it('has a non-empty line for every voice × band × index (no raw keys leak)', () => {
    for (const voice of HONEST_FRIEND_VOICES) {
      for (const band of bands) {
        for (let i = 0; i < VOICE_LINES_PER_BAND; i += 1) {
          const value = lookup(dashboard, voiceLineKey(voice, band, i).split('.'));
          expect(typeof value, `${voice}/${band}/${i}`).toBe('string');
          expect((value as string).length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('has the reveal copy used by the discovery slide', () => {
    expect(typeof dashboard.amigo_voice_reveal).toBe('string');
    expect(typeof dashboard.amigo_voice_reveal_cta).toBe('string');
  });
});
