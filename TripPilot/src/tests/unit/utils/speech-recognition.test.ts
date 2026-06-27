import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  startVoiceCapture,
  isSpeechRecognitionSupported,
  toSpeechLocale,
} from '@/utils/speech-recognition';

/**
 * DEC-365 (B1) — the hardened Web Speech boundary. A fake engine lets us prove
 * the mic is RELEASED on every exit (result / end / error / cancel / failed
 * start) via `abort()` + detached handlers, without a real microphone.
 */
class FakeRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  startCalls = 0;
  stopCalls = 0;
  abortCalls = 0;
  startThrows = false;

  start(): void {
    this.startCalls++;
    if (this.startThrows) throw new Error('InvalidStateError');
  }
  stop(): void {
    this.stopCalls++;
  }
  abort(): void {
    this.abortCalls++;
  }

  emitResult(transcript: string): void {
    this.onresult?.({ results: [{ 0: { transcript } }] });
  }
  emitEnd(): void {
    this.onend?.();
  }
  emitError(error: string): void {
    this.onerror?.({ error });
  }
}

let instances: FakeRecognition[] = [];

function installEngine(): void {
  instances = [];
  (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = class {
    constructor() {
      const inst = new FakeRecognition();
      instances.push(inst);
      return inst as unknown as object;
    }
  };
}

function uninstallEngine(): void {
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
}

const last = () => instances[instances.length - 1]!;

describe('toSpeechLocale', () => {
  it('maps app languages to BCP-47 tags', () => {
    expect(toSpeechLocale('es')).toBe('es-ES');
    expect(toSpeechLocale('en')).toBe('en-US');
    expect(toSpeechLocale('pt-BR')).toBe('pt-BR');
    expect(toSpeechLocale('anything-else')).toBe('pt-BR');
  });
});

describe('startVoiceCapture — hardened lifecycle (DEC-365 B1)', () => {
  beforeEach(installEngine);
  afterEach(uninstallEngine);

  it('reports support and starts the engine', () => {
    expect(isSpeechRecognitionSupported()).toBe(true);
    const controller = startVoiceCapture('pt-BR', { onResult: () => {} });
    expect(controller).not.toBeNull();
    expect(last().startCalls).toBe(1);
    expect(last().lang).toBe('pt-BR');
  });

  it('returns null when the browser has no recognition engine', () => {
    uninstallEngine();
    expect(isSpeechRecognitionSupported()).toBe(false);
    expect(startVoiceCapture('pt-BR', { onResult: () => {} })).toBeNull();
  });

  it('delivers the transcript through onResult', () => {
    const onResult = vi.fn();
    startVoiceCapture('en', { onResult });
    last().emitResult('cerveja 5 euros');
    expect(onResult).toHaveBeenCalledWith('cerveja 5 euros');
  });

  it('graceful stop() finishes, then onend releases the mic (abort + handlers detached)', () => {
    const onEnd = vi.fn();
    const controller = startVoiceCapture('pt-BR', { onResult: () => {}, onEnd })!;
    controller.stop();
    expect(last().stopCalls).toBe(1);
    expect(last().abortCalls).toBe(0); // not yet — waiting for the final result
    last().emitEnd();
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(last().abortCalls).toBe(1); // teardown aborted to drop the mic indicator
    expect(last().onresult).toBeNull();
    expect(last().onend).toBeNull();
  });

  it('cancel() releases the mic IMMEDIATELY via abort(), with no result and no callbacks', () => {
    const onEnd = vi.fn();
    const onResult = vi.fn();
    const controller = startVoiceCapture('pt-BR', { onResult, onEnd })!;
    controller.cancel();
    expect(last().abortCalls).toBe(1);
    expect(onEnd).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
    expect(last().onend).toBeNull();
  });

  it('an engine error tears down once and notifies onError + onEnd', () => {
    const onError = vi.fn();
    const onEnd = vi.fn();
    startVoiceCapture('pt-BR', { onResult: () => {}, onError, onEnd });
    last().emitError('no-speech');
    expect(onError).toHaveBeenCalledWith('no-speech');
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(last().abortCalls).toBe(1);
  });

  it('teardown is idempotent — stop → onend → cancel aborts only once', () => {
    const onEnd = vi.fn();
    const controller = startVoiceCapture('pt-BR', { onResult: () => {}, onEnd })!;
    controller.stop();
    last().emitEnd();
    controller.cancel();
    controller.cancel();
    expect(last().abortCalls).toBe(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('returns null and reports start_failed when the engine refuses to start', () => {
    const onError = vi.fn();
    const onEnd = vi.fn();
    // Make the next constructed engine throw on start().
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = class {
      constructor() {
        const inst = new FakeRecognition();
        inst.startThrows = true;
        instances.push(inst);
        return inst as unknown as object;
      }
    };
    const controller = startVoiceCapture('pt-BR', { onResult: () => {}, onError, onEnd });
    expect(controller).toBeNull();
    expect(onError).toHaveBeenCalledWith('start_failed');
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(last().abortCalls).toBe(1); // even a failed start releases anything held
  });
});
