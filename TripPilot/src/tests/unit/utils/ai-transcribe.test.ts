import { describe, it, expect } from 'vitest';
import { isLikelyVoiceHallucination } from '@/utils/ai-transcribe';

/**
 * Guard for Whisper's "no speech detected" filler. Live probe (device-test
 * 2026-06-20) showed both silence and a pure tone return " E aí", so a bare
 * filler must map to "didn't catch that" — but it must NEVER swallow real speech
 * that happens to start with one.
 */
describe('isLikelyVoiceHallucination', () => {
  it('flags the confirmed pt-BR no-speech filler in every casing/spacing/accent form', () => {
    expect(isLikelyVoiceHallucination(' E aí')).toBe(true); // raw worker output
    expect(isLikelyVoiceHallucination('E aí')).toBe(true);
    expect(isLikelyVoiceHallucination('e ai')).toBe(true);
    expect(isLikelyVoiceHallucination('  EAI!  ')).toBe(true);
    expect(isLikelyVoiceHallucination('E aí.')).toBe(true);
  });

  it('flags the other well-known Whisper empty-audio hallucinations', () => {
    expect(isLikelyVoiceHallucination('Obrigado.')).toBe(true);
    expect(isLikelyVoiceHallucination('Obrigada')).toBe(true);
    expect(isLikelyVoiceHallucination('Tchau!')).toBe(true);
    expect(isLikelyVoiceHallucination('Valeu')).toBe(true);
    expect(isLikelyVoiceHallucination('Legendas pela comunidade Amara.org')).toBe(true);
  });

  it('treats empty / whitespace / punctuation-only transcripts as no speech', () => {
    expect(isLikelyVoiceHallucination('')).toBe(true);
    expect(isLikelyVoiceHallucination('   ')).toBe(true);
    expect(isLikelyVoiceHallucination('...')).toBe(true);
  });

  it('lets real speech through, even when it merely STARTS with a filler', () => {
    expect(isLikelyVoiceHallucination('e aí, paguei 5 euros')).toBe(false);
    expect(isLikelyVoiceHallucination('Bruno me pagou uma cerveja de 2 euros')).toBe(false);
    expect(isLikelyVoiceHallucination('obrigado ao Bruno, dividimos 12 euros')).toBe(false);
    expect(isLikelyVoiceHallucination('valeu a pena, gastei 30')).toBe(false);
    expect(isLikelyVoiceHallucination('cerveja 3')).toBe(false);
  });
});
