/**
 * AI Quick Entry · voice (device-test 2026-06-20): records the microphone as a
 * 16 kHz mono 16-bit PCM WAV — the format Whisper decodes most reliably.
 *
 * Why NOT MediaRecorder/webm here: on the Android System WebView, MediaRecorder
 * emits Opus-in-webm WITHOUT duration cues (a live stream). Groq's server-side
 * decoder then transcribes only the first fragment, so a full spoken sentence
 * came back as a stray "E aí" hallucination. A self-contained WAV with a correct
 * RIFF header sidesteps that entirely and is exactly what Whisper wants.
 */

export const TARGET_SAMPLE_RATE = 16000;
/** ScriptProcessor frame size — a good latency/throughput balance on WebView. */
const FRAME_SIZE = 4096;
/**
 * Peak amplitude below this means the capture carried no real signal (mic muted,
 * or the engine never delivered frames). We return an empty blob so the caller
 * shows "didn't catch that" instead of paying Whisper to hallucinate on silence.
 * Deliberately tiny — even a quiet talker peaks far above this, so real speech is
 * never rejected.
 */
export const SILENCE_PEAK = 0.006;

type WindowAudio = typeof window & { webkitAudioContext?: typeof AudioContext };

function getAudioContextCtor(): typeof AudioContext | null {
  const w = window as WindowAudio;
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** True when we can capture raw PCM (Web Audio + getUserMedia available). */
export function isPcmRecordingSupported(): boolean {
  return getAudioContextCtor() !== null && !!navigator.mediaDevices?.getUserMedia;
}

export interface PcmRecording {
  /** Stops capture, releases the mic, and resolves the recorded WAV blob. */
  stop: () => Promise<Blob>;
}

export async function startPcmRecording(): Promise<PcmRecording> {
  const AudioCtx = getAudioContextCtor();
  if (!AudioCtx) throw new Error('audio_unsupported');

  // Mono + the usual voice cleanups. getUserMedia is what triggers the native
  // RECORD_AUDIO prompt on Android (declared in the manifest).
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });

  const context = new AudioCtx();
  // Some engines suspend a freshly created context until a user gesture; the tap
  // that started recording counts, but resume() is a cheap safety net.
  if (context.state === 'suspended') await context.resume().catch(() => undefined);

  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(FRAME_SIZE, 1, 1);
  const frames: Float32Array[] = [];

  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    // Copy: the engine reuses the underlying buffer after this callback returns.
    frames.push(new Float32Array(input));
  };

  // A muted gain sink keeps onaudioprocess firing without echoing audio out.
  const sink = context.createGain();
  sink.gain.value = 0;
  source.connect(processor);
  processor.connect(sink);
  sink.connect(context.destination);

  let stopped = false;
  const cleanup = (): void => {
    try {
      processor.disconnect();
      source.disconnect();
      sink.disconnect();
    } catch {
      /* nodes may already be detached */
    }
    stream.getTracks().forEach((track) => track.stop());
  };

  const stop = async (): Promise<Blob> => {
    if (stopped) return new Blob([], { type: 'audio/wav' });
    stopped = true;
    const inputRate = context.sampleRate;
    cleanup();
    await context.close().catch(() => undefined);
    const merged = mergeFrames(frames);
    if (peakAmplitude(merged) < SILENCE_PEAK) return new Blob([], { type: 'audio/wav' });
    const samples = downsample(merged, inputRate, TARGET_SAMPLE_RATE);
    return encodeWav(samples, TARGET_SAMPLE_RATE);
  };

  return { stop };
}

export function peakAmplitude(samples: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]!);
    if (abs > peak) peak = abs;
  }
  return peak;
}

function mergeFrames(frames: Float32Array[]): Float32Array {
  let length = 0;
  for (const frame of frames) length += frame.length;
  const out = new Float32Array(length);
  let offset = 0;
  for (const frame of frames) {
    out.set(frame, offset);
    offset += frame.length;
  }
  return out;
}

/** Averaging decimator — good enough for speech, avoids aliasing artefacts. */
export function downsample(samples: Float32Array, inputRate: number, targetRate: number): Float32Array {
  if (targetRate >= inputRate || samples.length === 0) return samples;
  const ratio = inputRate / targetRate;
  const newLength = Math.floor(samples.length / ratio);
  const out = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(samples.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      sum += samples[j]!;
      count++;
    }
    out[i] = count > 0 ? sum / count : 0;
  }
  return out;
}

export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate (sampleRate * blockAlign)
  view.setUint16(32, 2, true); // block align (channels * bytesPerSample)
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}
