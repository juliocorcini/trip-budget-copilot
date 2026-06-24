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
  type HonestFriendVoice,
} from '@/domain/budget';
import ptBR from '@/i18n/locales/pt-BR.json';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';

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

const LOCALES: Array<[string, Record<string, unknown>]> = [
  ['pt-BR', (ptBR as { dashboard: Record<string, unknown> }).dashboard],
  ['en', (en as { dashboard: Record<string, unknown> }).dashboard],
  ['es', (es as { dashboard: Record<string, unknown> }).dashboard],
];
const BANDS: VoiceBand[] = ['good', 'warn', 'over'];

function voiceLine(dashboard: Record<string, unknown>, voice: HonestFriendVoice, band: VoiceBand, i: number): string {
  return lookup(dashboard, voiceLineKey(voice, band, i).split('.')) as string;
}

describe('voice phrase bank coverage (all locales)', () => {
  it('has a non-empty line for every voice × band × index (no raw keys leak)', () => {
    for (const [name, dashboard] of LOCALES) {
      for (const voice of HONEST_FRIEND_VOICES) {
        for (const band of BANDS) {
          for (let i = 0; i < VOICE_LINES_PER_BAND; i += 1) {
            const value = voiceLine(dashboard, voice, band, i);
            expect(typeof value, `${name}/${voice}/${band}/${i}`).toBe('string');
            expect(value.length, `${name}/${voice}/${band}/${i}`).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('has the reveal copy used by the discovery slide', () => {
    const dashboard = (ptBR as { dashboard: Record<string, unknown> }).dashboard;
    expect(typeof dashboard.amigo_voice_reveal).toBe('string');
    expect(typeof dashboard.amigo_voice_reveal_cta).toBe('string');
  });
});

/**
 * M16b / DEC-291 — the whole point of voices is that they SOUND different. For the
 * same input (band + index) the four voices must yield four DISTINCT lines, in every
 * locale. A regression that collapses a tone back into "padrão" copy fails here.
 */
describe('voice tones are genuinely distinct (M16b)', () => {
  it('produces 4 distinct lines for the same band+index in every locale', () => {
    for (const [name, dashboard] of LOCALES) {
      for (const band of BANDS) {
        for (let i = 0; i < VOICE_LINES_PER_BAND; i += 1) {
          const lines = HONEST_FRIEND_VOICES.map((v) =>
            voiceLine(dashboard, v, band, i).trim().toLowerCase(),
          );
          const unique = new Set(lines);
          expect(unique.size, `${name}/${band}/${i} → ${lines.join(' | ')}`).toBe(
            HONEST_FRIEND_VOICES.length,
          );
        }
      }
    }
  });

  it('keeps each voice internally varied (no repeated line within a voice)', () => {
    for (const [name, dashboard] of LOCALES) {
      for (const voice of HONEST_FRIEND_VOICES) {
        const lines: string[] = [];
        for (const band of BANDS) {
          for (let i = 0; i < VOICE_LINES_PER_BAND; i += 1) {
            lines.push(voiceLine(dashboard, voice, band, i).trim().toLowerCase());
          }
        }
        expect(new Set(lines).size, `${name}/${voice}`).toBe(lines.length);
      }
    }
  });
});
