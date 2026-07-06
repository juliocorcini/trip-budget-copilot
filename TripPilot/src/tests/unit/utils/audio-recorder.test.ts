// @vitest-environment node
// Pure DSP + binary container checks; the node env gives a real Blob.arrayBuffer()
// (jsdom's Blob lacks it). audio-recorder only touches window/navigator inside
// functions we don't call here, so importing it under node is safe.
import { describe, it, expect } from 'vitest';
import {
  encodeWav,
  downsample,
  peakAmplitude,
  normalizePeak,
  SILENCE_PEAK,
  NORMALIZE_TARGET_PEAK,
  TARGET_SAMPLE_RATE,
} from '@/utils/audio-recorder';

/**
 * Voice capture fix (device-test 2026-06-20). The Android WebView regression was
 * NOT a Whisper failure — MediaRecorder emitted duration-less webm and Whisper
 * transcribed a fragment as a stray "E aí". The fix records a self-contained
 * 16 kHz mono PCM WAV. These tests verify that container is byte-correct and
 * self-describing (a complete RIFF header + exact data length), the property a
 * streaming webm lacks, plus the DSP math that feeds it.
 */

async function readBytes(blob: Blob): Promise<DataView> {
  return new DataView(await blob.arrayBuffer());
}

function readAscii(view: DataView, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += String.fromCharCode(view.getUint8(offset + i));
  return out;
}

describe('audio-recorder · WAV container (voice fix)', () => {
  it('writes a complete, self-describing 16 kHz mono 16-bit RIFF/WAVE header', async () => {
    const sampleCount = 1600; // 0.1 s @ 16 kHz
    const view = await readBytes(encodeWav(new Float32Array(sampleCount), TARGET_SAMPLE_RATE));

    // Total file = 44-byte header + 2 bytes per sample. A complete length is the
    // whole point: Whisper needs to know where the audio ends.
    expect(view.byteLength).toBe(44 + sampleCount * 2);

    expect(readAscii(view, 0, 4)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(36 + sampleCount * 2); // RIFF chunk size
    expect(readAscii(view, 8, 4)).toBe('WAVE');

    expect(readAscii(view, 12, 4)).toBe('fmt ');
    expect(view.getUint32(16, true)).toBe(16); // PCM fmt chunk size
    expect(view.getUint16(20, true)).toBe(1); // audioFormat = PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(16000); // sample rate
    expect(view.getUint32(28, true)).toBe(32000); // byteRate = 16000 * 2
    expect(view.getUint16(32, true)).toBe(2); // blockAlign = channels * bytesPerSample
    expect(view.getUint16(34, true)).toBe(16); // bits per sample

    expect(readAscii(view, 36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(sampleCount * 2); // data chunk size
  });

  it('quantises float samples to int16 and hard-clamps out-of-range input', async () => {
    const view = await readBytes(encodeWav(new Float32Array([0, 1, -1, 0.5, 2, -2]), 16000));

    // Read the six PCM samples back from the data section (starts at byte 44).
    const pcm = [0, 1, 2, 3, 4, 5].map((i) => view.getInt16(44 + i * 2, true));

    expect(pcm[0]).toBe(0); // silence
    expect(pcm[1]).toBe(32767); // +1.0 → +full scale
    expect(pcm[2]).toBe(-32768); // -1.0 → -full scale
    expect(pcm[3]).toBe(16383); // 0.5 * 32767 = 16383.5, truncated toward zero
    expect(pcm[4]).toBe(32767); // 2.0 clamped to +1.0
    expect(pcm[5]).toBe(-32768); // -2.0 clamped to -1.0
  });
});

describe('audio-recorder · downsample', () => {
  it('averages 48 kHz → 16 kHz in fixed 3-sample windows', () => {
    const input = new Float32Array([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const out = downsample(input, 48000, 16000);

    expect(Array.from(out)).toEqual([1, 4, 7]); // avg(0,1,2), avg(3,4,5), avg(6,7,8)
  });

  it('never upsamples — returns the input untouched when target ≥ input rate', () => {
    const input = new Float32Array([0.1, 0.2, 0.3]);
    expect(downsample(input, 16000, 16000)).toBe(input);
    expect(downsample(input, 8000, 16000)).toBe(input);
  });
});

describe('audio-recorder · silence detection', () => {
  // DEC-473 (voice loosening): 0.006 rejected quiet-but-real speech on weak
  // mics ("works only for 'alô teste' shouted at the phone"). The gate now only
  // rejects a truly dead capture; quiet speech passes and is normalized below.
  it('keeps the silence threshold loose enough that quiet real speech is never rejected', () => {
    expect(SILENCE_PEAK).toBe(0.0015);
    expect(TARGET_SAMPLE_RATE).toBe(16000);
  });

  it('flags a truly dead capture as below threshold (→ "didn’t catch that")', () => {
    const dead = new Float32Array([0.0002, -0.0009, 0.0004, -0.001]);
    expect(peakAmplitude(dead)).toBeLessThan(SILENCE_PEAK);
  });

  it('accepts a quiet-but-real capture that the old 0.006 gate rejected', () => {
    const quietSpeech = new Float32Array([0.001, -0.003, 0.002, -0.0015]);
    expect(peakAmplitude(quietSpeech)).toBeGreaterThan(SILENCE_PEAK);
  });

  it('accepts a normal-volume capture (peak well above threshold)', () => {
    const speech = new Float32Array([0.01, -0.5, 0.2, -0.33]);
    expect(peakAmplitude(speech)).toBeCloseTo(0.5, 5);
    expect(peakAmplitude(speech)).toBeGreaterThan(SILENCE_PEAK);
  });
});

describe('audio-recorder · peak normalization (DEC-473)', () => {
  it('boosts a quiet clip toward the target peak', () => {
    // Peak 0.05 → needs 19× (inside the 25× cap) to hit the 0.95 target.
    const quiet = new Float32Array([0.025, -0.05, 0.0125]);
    const out = normalizePeak(quiet);
    expect(peakAmplitude(out)).toBeCloseTo(NORMALIZE_TARGET_PEAK, 3);
    // Relative shape preserved (linear gain): 0.025/0.05 stays 1/2.
    expect(out[0]! / out[1]!).toBeCloseTo(quiet[0]! / quiet[1]!, 5);
  });

  it('caps the gain so a near-dead capture is never blown into fake speech', () => {
    const nearDead = new Float32Array([0.002, -0.001]);
    const out = normalizePeak(nearDead);
    // Max gain 25×: 0.002 → 0.05, far from the 0.95 target.
    expect(peakAmplitude(out)).toBeCloseTo(0.05, 5);
  });

  it('leaves an already-healthy clip untouched', () => {
    const healthy = new Float32Array([0.5, -0.96, 0.3]);
    expect(normalizePeak(healthy)).toBe(healthy);
  });
});
