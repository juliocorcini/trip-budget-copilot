import { describe, it, expect, afterEach, vi } from 'vitest';
import { fetchExchangeRates } from '@/utils/exchange-rates';

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

function mockFetchOnce(response: Partial<Response> & { json?: () => Promise<unknown> }): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

afterEach(() => {
  vi.unstubAllGlobals();
  setOnline(true);
});

describe('fetchExchangeRates (M11)', () => {
  it('returns null when offline (never touches the network)', async () => {
    setOnline(false);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(fetchExchangeRates('EUR')).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null for an invalid base currency code', async () => {
    setOnline(true);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(fetchExchangeRates('euro')).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('inverts the API rates into base-per-foreign and freezes them', async () => {
    setOnline(true);
    mockFetchOnce({
      ok: true,
      json: async () => ({
        result: 'success',
        base_code: 'EUR',
        rates: { EUR: 1, CZK: 25, USD: 1.25 },
      }),
    });
    const result = await fetchExchangeRates('EUR');
    expect(result).not.toBeNull();
    expect(result!.baseCurrency).toBe('EUR');
    // base itself is never a key
    expect(result!.ratesToBase.EUR).toBeUndefined();
    // 1 CZK = 1/25 = 0.04 EUR; 1 USD = 1/1.25 = 0.8 EUR
    expect(result!.ratesToBase.CZK).toBeCloseTo(0.04, 10);
    expect(result!.ratesToBase.USD).toBeCloseTo(0.8, 10);
    expect(typeof result!.fetchedAt).toBe('string');
  });

  it('lower-cases nothing but normalizes currency codes to upper-case keys', async () => {
    setOnline(true);
    mockFetchOnce({
      ok: true,
      json: async () => ({ result: 'success', rates: { czk: 25 } }),
    });
    const result = await fetchExchangeRates('eur'.toUpperCase());
    expect(result!.ratesToBase.CZK).toBeCloseTo(0.04, 10);
  });

  it('returns null when the API reports a non-success result', async () => {
    setOnline(true);
    mockFetchOnce({ ok: true, json: async () => ({ result: 'error', rates: {} }) });
    await expect(fetchExchangeRates('EUR')).resolves.toBeNull();
  });

  it('returns null on a non-OK HTTP status', async () => {
    setOnline(true);
    mockFetchOnce({ ok: false, json: async () => ({}) });
    await expect(fetchExchangeRates('EUR')).resolves.toBeNull();
  });

  it('returns null when the request throws (never blocks the caller)', async () => {
    setOnline(true);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await expect(fetchExchangeRates('EUR')).resolves.toBeNull();
  });

  it('returns null when no usable rates are present', async () => {
    setOnline(true);
    mockFetchOnce({
      ok: true,
      json: async () => ({ result: 'success', rates: { EUR: 1, XYZ: -1, BAD: 0 } }),
    });
    await expect(fetchExchangeRates('EUR')).resolves.toBeNull();
  });
});
