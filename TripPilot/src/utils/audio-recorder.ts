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
 *
 * DEC-473 (voice loosening — Julio device-test 2026-07-05: "alô teste passa,
 * qualquer outra coisa não"): 0.006 rejected NATURAL-distance speech on devices
 * whose mic (with suppression on) delivers a very low signal — only loud,
 * close-to-the-phone test phrases survived. Lowered to reject ONLY a truly dead
 * capture; quiet-but-real speech now passes and is gain-normalized below.
 */
export const SILENCE_PEAK = 0.0015;
/**
 * DEC-473: captures quieter than this peak are linearly amplified before the
 * WAV encode (Whisper transcribes normalized speech far more reliably than a
 * near-silent waveform). Cap the gain so residual noise is never blown up into
 * a fake "signal".
 */
export const NORMALIZE_TARGET_PEAK = 0.95;
const MAX_NORMALIZE_GAIN = 25;

type WindowAudio = typeof window & { webkitAudioContext?: typeof AudioContext };

function getAudioContextCtor(): typeof AudioContext | null {
  const w = window as WindowAudio;
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** True when we can capture raw PCM (Web Audio + getUserMedia available). */
export function isPcmRecordingSupported(): boolean {
  return getAudioContextCtor() !== null && !!navigator.mediaDevices?.getUserMedia;
}

/**
 * ONE reused AudioContext for the app's lifetime. Recreating + close()ing a
 * context per recording is what broke repeat captures on the Android WebView:
 * the 2nd/3rd context was born `suspended` and a resume() fired outside a live
 * user-gesture window silently failed, so no frames arrived and the clip came
 * back empty ("não captei o áudio"). Reusing one warm context fixes that.
 */
let sharedContext: AudioContext | null = null;

function acquireContext(): AudioContext {
  const AudioCtx = getAudioContextCtor();
  if (!AudioCtx) throw new Error('audio_unsupported');
  if (!sharedContext || sharedContext.state === 'closed') sharedContext = new AudioCtx();
  return sharedContext;
}

/**
 * Mono + voice cleanups, but degrade gracefully: some engines/devices
 * (and headless Chromium's fake device) reject the constrained request with
 * NotSupportedError/OverconstrainedError — a plain `audio:true` still yields a
 * usable mic rather than dead-ending the whole capture. getUserMedia is also
 * what triggers the native RECORD_AUDIO prompt on Android (declared in manifest).
 *
 * DEC-473 (voice loosening): `autoGainControl: true` asks the engine to boost a
 * quiet mic at the source, and `noiseSuppression: false` stops aggressive
 * suppressors from eating sustained natural speech (Whisper is robust to
 * background noise; it is NOT robust to speech that was suppressed away).
 */
async function acquireMicStream(): Promise<MediaStream> {
  const media = navigator.mediaDevices;
  try {
    return await media.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: true,
      },
    });
  } catch (err) {
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'NotSupportedError' || name === 'OverconstrainedError' || name === 'TypeError') {
      return media.getUserMedia({ audio: true });
    }
    throw err;
  }
}

export interface PcmRecording {
  /** Stops capture, releases the mic, and resolves the recorded WAV blob. */
  stop: () => Promise<Blob>;
}

export async function startPcmRecording(): Promise<PcmRecording> {
  const context = acquireContext();
  // Warm the context BEFORE opening the mic so the node graph delivers audio from
  // the first frame (a resume() that lands after speech starts is what clipped
  // the opening words — "só captou o fim da frase").
  if (context.state === 'suspended') await context.resume().catch(() => undefined);

  const stream = await acquireMicStream();

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
    processor.onaudioprocess = null;
    try {
      processor.disconnect();
      source.disconnect();
      sink.disconnect();
    } catch {
      /* nodes may already be detached */
    }
    // Release the mic (drops the recording indicator) but KEEP the shared context
    // alive and running for the next capture — see sharedContext note above.
    stream.getTracks().forEach((track) => track.stop());
  };

  const stop = async (): Promise<Blob> => {
    if (stopped) return new Blob([], { type: 'audio/wav' });
    stopped = true;
    const inputRate = context.sampleRate;
    cleanup();
    const merged = mergeFrames(frames);
    if (peakAmplitude(merged) < SILENCE_PEAK) return new Blob([], { type: 'audio/wav' });
    const samples = downsample(merged, inputRate, TARGET_SAMPLE_RATE);
    // DEC-473: boost quiet-but-real speech to a healthy level before encoding —
    // this is what turned "works only when I shout 'alô teste' at the phone"
    // into reliable natural-distance capture.
    return encodeWav(normalizePeak(samples), TARGET_SAMPLE_RATE);
  };

  return { stop };
}

/**
 * DEC-473: linear peak normalization — scale the clip so its loudest sample
 * approaches {@link NORMALIZE_TARGET_PEAK}. Gain is capped (never amplify a
 * near-silent capture into fake speech) and clips already at a healthy level
 * pass through untouched. Pure.
 */
export function normalizePeak(samples: Float32Array): Float32Array {
  const peak = peakAmplitude(samples);
  if (peak <= 0 || peak >= NORMALIZE_TARGET_PEAK) return samples;
  const gain = Math.min(NORMALIZE_TARGET_PEAK / peak, MAX_NORMALIZE_GAIN);
  if (gain <= 1) return samples;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i]! * gain;
  return out;
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
