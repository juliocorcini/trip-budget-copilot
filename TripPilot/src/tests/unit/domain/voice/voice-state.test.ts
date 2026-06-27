import { describe, it, expect } from 'vitest';
import {
  VOICE_STATE_META,
  voiceTransition,
  canVoiceTransition,
  isVoiceMicHot,
  isVoiceListening,
  isVoiceBusy,
  voiceStateLabelKey,
  type VoiceState,
  type VoiceEvent,
} from '@/domain/voice/voice-state';

const ALL_STATES: VoiceState[] = [
  'off',
  'asking',
  'capturing',
  'processing',
  'done',
  'error',
  'cancelled',
];
const ALL_EVENTS: VoiceEvent[] = ['request', 'open', 'finish', 'resolve', 'fail', 'cancel', 'reset'];

describe('voice-state machine (DEC-365 B1)', () => {
  it('defines metadata for all seven explicit states', () => {
    ALL_STATES.forEach((state) => expect(VOICE_STATE_META[state]).toBeDefined());
    expect(Object.keys(VOICE_STATE_META)).toHaveLength(7);
  });

  it('walks the happy path off → asking → capturing → processing → done → off', () => {
    let s: VoiceState = 'off';
    s = voiceTransition(s, 'request');
    expect(s).toBe('asking');
    s = voiceTransition(s, 'open');
    expect(s).toBe('capturing');
    s = voiceTransition(s, 'finish');
    expect(s).toBe('processing');
    s = voiceTransition(s, 'resolve');
    expect(s).toBe('done');
    s = voiceTransition(s, 'reset');
    expect(s).toBe('off');
  });

  it('allows a synchronous capturing → done (no separate processing step)', () => {
    expect(voiceTransition('capturing', 'resolve')).toBe('done');
  });

  it('is total and never throws — an unknown (state, event) pair is a no-op', () => {
    ALL_STATES.forEach((state) => {
      ALL_EVENTS.forEach((event) => {
        const next = voiceTransition(state, event);
        expect(ALL_STATES).toContain(next);
      });
    });
    // Nonsense pairs hold the current state.
    expect(voiceTransition('off', 'open')).toBe('off');
    expect(voiceTransition('done', 'finish')).toBe('done');
    expect(voiceTransition('processing', 'open')).toBe('processing');
  });

  it('can always release: cancel from any hot/busy state lands on cancelled, idle stays off', () => {
    expect(voiceTransition('asking', 'cancel')).toBe('cancelled');
    expect(voiceTransition('capturing', 'cancel')).toBe('cancelled');
    expect(voiceTransition('processing', 'cancel')).toBe('cancelled');
    expect(voiceTransition('off', 'cancel')).toBe('off');
  });

  it('can always reset to off from any state (clear a terminal)', () => {
    ALL_STATES.forEach((state) => expect(voiceTransition(state, 'reset')).toBe('off'));
  });

  it('routes any failure to error', () => {
    expect(voiceTransition('asking', 'fail')).toBe('error');
    expect(voiceTransition('capturing', 'fail')).toBe('error');
    expect(voiceTransition('processing', 'fail')).toBe('error');
  });

  it('marks the mic HOT exactly while asking or capturing (so leaving them forces a teardown)', () => {
    expect(isVoiceMicHot('asking')).toBe(true);
    expect(isVoiceMicHot('capturing')).toBe(true);
    (['off', 'processing', 'done', 'error', 'cancelled'] as VoiceState[]).forEach((s) =>
      expect(isVoiceMicHot(s)).toBe(false),
    );
  });

  it('shows the live listening affordance only while capturing', () => {
    expect(isVoiceListening('capturing')).toBe(true);
    ALL_STATES.filter((s) => s !== 'capturing').forEach((s) =>
      expect(isVoiceListening(s)).toBe(false),
    );
  });

  it('flags busy for asking/capturing/processing and idle otherwise', () => {
    (['asking', 'capturing', 'processing'] as VoiceState[]).forEach((s) =>
      expect(isVoiceBusy(s)).toBe(true),
    );
    (['off', 'done', 'error', 'cancelled'] as VoiceState[]).forEach((s) =>
      expect(isVoiceBusy(s)).toBe(false),
    );
  });

  it('never leaves the mic hot in a terminal state (no leaked indicator)', () => {
    ALL_STATES.filter((s) => VOICE_STATE_META[s].terminal).forEach((s) =>
      expect(isVoiceMicHot(s)).toBe(false),
    );
  });

  it('exposes a distinct, namespaced label key per state', () => {
    const keys = ALL_STATES.map((s) => voiceStateLabelKey(s));
    keys.forEach((k) => expect(k.startsWith('voice.state_')).toBe(true));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('canVoiceTransition agrees with voiceTransition', () => {
    expect(canVoiceTransition('off', 'request')).toBe(true);
    expect(canVoiceTransition('off', 'open')).toBe(false);
    expect(canVoiceTransition('capturing', 'cancel')).toBe(true);
  });
});
