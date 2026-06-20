import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  resolveCategory,
  resolveAmount,
  resolvePerson,
  resolveWallet,
  resolvePlace,
  resolveDate,
} from '@/domain/assistant/resolve';
import type { Participant } from '@/domain/types/participant';
import type { Wallet } from '@/domain/types/wallet';

const meta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  revision: 1,
  sourceDeviceId: 'test',
};

function mkParticipant(id: string, name: string, overrides: Partial<Participant> = {}): Participant {
  return {
    ...meta,
    id,
    tripId: 'trip-1',
    name,
    nickname: null,
    isOwner: false,
    email: null,
    linkedUserAccountId: null,
    linkedActorId: null,
    ...overrides,
  };
}

function mkWallet(id: string, name: string, walletType: Wallet['walletType']): Wallet {
  return {
    ...meta,
    id,
    tripId: 'trip-1',
    name,
    walletType,
    currency: 'EUR',
    initialBalanceCents: 0,
    isDefault: false,
    notes: null,
  };
}

describe('normalizeText', () => {
  it('lowercases and strips accents', () => {
    expect(normalizeText('Café')).toBe('cafe');
    expect(normalizeText('  ÔNIBUS ')).toBe('onibus');
  });
});

describe('resolveCategory', () => {
  it('maps synonyms across languages to a taxonomy key', () => {
    expect(resolveCategory('cerveja')).toBe('bar');
    expect(resolveCategory('beer')).toBe('bar');
    expect(resolveCategory('Uber')).toBe('transport');
    expect(resolveCategory('almoço')).toBe('restaurant');
    expect(resolveCategory('supermercado')).toBe('market');
  });

  it('accepts a direct taxonomy key', () => {
    expect(resolveCategory('health')).toBe('health');
  });

  it('falls back to other for unknown labels and empty input', () => {
    expect(resolveCategory('quasar')).toBe('other');
    expect(resolveCategory(null)).toBe('other');
  });
});

describe('resolveAmount', () => {
  it('converts major units to cents and keeps the stated currency', () => {
    expect(resolveAmount(2, 'EUR', 'BRL')).toEqual({ amountCents: 200, currency: 'EUR' });
  });

  it('defaults to the base currency when none was stated', () => {
    expect(resolveAmount(2, null, 'BRL')).toEqual({ amountCents: 200, currency: 'BRL' });
  });

  it('rejects non-positive or missing amounts', () => {
    expect(resolveAmount(0, 'EUR', 'EUR')).toBeNull();
    expect(resolveAmount(-5, 'EUR', 'EUR')).toBeNull();
    expect(resolveAmount(null, 'EUR', 'EUR')).toBeNull();
  });
});

describe('resolvePerson', () => {
  const owner = mkParticipant('owner', 'Julio', { isOwner: true });
  const bruno = mkParticipant('bruno', 'Bruno');
  const bruna = mkParticipant('bruna', 'Bruna');
  const people = [owner, bruno, bruna];

  it('matches "me"/"eu" to the owner', () => {
    expect(resolvePerson('eu', people, owner)).toEqual({ status: 'matched', participant: owner });
  });

  it('matches an exact name even when a prefix is ambiguous', () => {
    expect(resolvePerson('Bruno', people, owner)).toEqual({ status: 'matched', participant: bruno });
  });

  it('reports ambiguity for a shared prefix', () => {
    const result = resolvePerson('bru', people, owner);
    expect(result.status).toBe('ambiguous');
    if (result.status !== 'ambiguous') return;
    expect(result.candidates.map((p) => p.id).sort()).toEqual(['bruna', 'bruno']);
  });

  it('matches by nickname', () => {
    const nick = mkParticipant('ze', 'José', { nickname: 'Zé' });
    expect(resolvePerson('ze', [owner, nick], owner)).toEqual({ status: 'matched', participant: nick });
  });

  it('returns none for an unknown name', () => {
    expect(resolvePerson('Carlos', people, owner)).toEqual({ status: 'none' });
  });
});

describe('resolveWallet', () => {
  const cash = mkWallet('w-cash', 'Carteira', 'cash');
  const card = mkWallet('w-card', 'Visa', 'credit_card');
  const wallets = [cash, card];

  it('matches by name', () => {
    expect(resolveWallet('Visa', wallets)).toEqual({ status: 'matched', wallet: card });
  });

  it('matches a cash hint to the cash wallet', () => {
    expect(resolveWallet('dinheiro', wallets)).toEqual({ status: 'matched', wallet: cash });
  });

  it('returns none when nothing matches', () => {
    expect(resolveWallet('bitcoin', wallets)).toEqual({ status: 'none' });
  });
});

describe('resolvePlace', () => {
  const sticky = { label: 'Hotel Central', lat: 38.7, lng: -9.1, placeId: 'p-hotel' };
  const known = [
    { label: 'Bar do Zé', lat: 38.71, lng: -9.14, placeId: 'p-ze' },
    { label: 'Mercado da Ribeira', lat: 38.7, lng: -9.14, placeId: 'p-mkt' },
  ];

  it('keeps the sticky place when no venue is named', () => {
    expect(resolvePlace(null, known, sticky)).toEqual(sticky);
    expect(resolvePlace('', known, sticky)).toEqual(sticky);
  });

  it('snaps an accent/case-insensitive name to a known place, recovering coords', () => {
    expect(resolvePlace('bar do ze', known, sticky)).toEqual({
      label: 'Bar do Zé',
      lat: 38.71,
      lng: -9.14,
      placeId: 'p-ze',
    });
  });

  it('matches the sticky place by name (so coords are not lost)', () => {
    expect(resolvePlace('hotel central', known, sticky)).toEqual(sticky);
  });

  it('becomes a label-only place for an unknown venue', () => {
    expect(resolvePlace('Tasca Nova', known, sticky)).toEqual({
      label: 'Tasca Nova',
      lat: null,
      lng: null,
      placeId: null,
    });
  });

  it('returns null when nothing is named and there is no sticky place', () => {
    expect(resolvePlace(null, known, null)).toBeNull();
  });
});

describe('resolveDate', () => {
  const now = new Date('2026-07-10T12:00:00.000Z');

  it('returns undefined for today/now (factory defaults to now)', () => {
    expect(resolveDate('hoje', now)).toBeUndefined();
    expect(resolveDate(null, now)).toBeUndefined();
  });

  it('resolves yesterday to a -1 day ISO timestamp', () => {
    expect(resolveDate('ontem', now)).toBe('2026-07-09T12:00:00.000Z');
  });

  it('resolves anteontem to -2 days', () => {
    expect(resolveDate('anteontem', now)).toBe('2026-07-08T12:00:00.000Z');
  });

  it('resolves "semana passada"/"last week" to -7 days', () => {
    expect(resolveDate('semana passada', now)).toBe('2026-07-03T12:00:00.000Z');
    expect(resolveDate('last week', now)).toBe('2026-07-03T12:00:00.000Z');
  });

  it('resolves "N dias atrás" / "N days ago" / "hace N días"', () => {
    expect(resolveDate('3 dias atrás', now)).toBe('2026-07-07T12:00:00.000Z');
    expect(resolveDate('5 days ago', now)).toBe('2026-07-05T12:00:00.000Z');
    expect(resolveDate('hace 4 días', now)).toBe('2026-07-06T12:00:00.000Z');
  });

  it('passes ISO dates (and full datetimes) through', () => {
    expect(resolveDate('2026-07-01', now)).toBe('2026-07-01');
    expect(resolveDate('2026-07-01T09:30:00.000Z', now)).toBe('2026-07-01T09:30:00.000Z');
  });

  it('falls back to undefined for an unparseable phrase (defaults to now)', () => {
    expect(resolveDate('outro dia qualquer', now)).toBeUndefined();
  });
});
