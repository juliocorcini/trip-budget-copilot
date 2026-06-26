import { describe, it, expect } from 'vitest';
import { resolveSelfName } from '@/domain/sync/self-name';

/**
 * DEC-350 (G4) — the displayed self-name precedence: onboarding owner name first,
 * an optional profileName next, the technical deviceName last. "Android · Chrome"
 * must never win over a real name.
 */
describe('resolveSelfName (DEC-350)', () => {
  it('prefers the onboarding owner name over everything', () => {
    expect(
      resolveSelfName({ ownerName: 'Júlio', profileName: 'JJ', deviceName: 'Android · Chrome' }),
    ).toBe('Júlio');
  });

  it('falls back to profileName when there is no owner name (no trip yet)', () => {
    expect(
      resolveSelfName({ ownerName: null, profileName: 'JJ', deviceName: 'Android · Chrome' }),
    ).toBe('JJ');
    expect(
      resolveSelfName({ ownerName: '   ', profileName: 'JJ', deviceName: 'Android · Chrome' }),
    ).toBe('JJ');
  });

  it('falls back to the device label only when no real name exists', () => {
    expect(
      resolveSelfName({ ownerName: null, profileName: null, deviceName: 'Android · Chrome' }),
    ).toBe('Android · Chrome');
    expect(
      resolveSelfName({ ownerName: '', profileName: '  ', deviceName: 'Android · Chrome' }),
    ).toBe('Android · Chrome');
  });

  it('trims each source and skips whitespace-only values', () => {
    expect(resolveSelfName({ ownerName: '  Maria  ' })).toBe('Maria');
    expect(resolveSelfName({ ownerName: '   ', profileName: '  Ana  ' })).toBe('Ana');
  });

  it('returns an empty string only when every source is absent', () => {
    expect(resolveSelfName({})).toBe('');
    expect(resolveSelfName({ ownerName: null, profileName: undefined, deviceName: '' })).toBe('');
  });
});
