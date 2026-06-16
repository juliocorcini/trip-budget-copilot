import { describe, it, expect } from 'vitest';
import { parseReceiptResponse, reconcileReceipt } from '@/domain/receipt';

// DEC-206 (G2): the parser is the source of truth for normalising a loose,
// decimal-based OCR response into a cents-based, reviewable ReceiptPlan. It must
// be defensive (vision models emit messy fields) and exact on the money math.

describe('parseReceiptResponse (DEC-206)', () => {
  it('converts a clean Groq-shaped response into cents', () => {
    const plan = parseReceiptResponse({
      merchant: 'Mercadona BURGOS',
      currency: 'EUR',
      total: 12.4,
      items: [
        { description: 'Leche', qty: 2, unitPrice: 1.2, lineTotal: 2.4 },
        { description: 'Pan', qty: 1, unitPrice: 1.0, lineTotal: 1.0 },
        { description: 'Queso', qty: 1, unitPrice: 9.0, lineTotal: 9.0 },
      ],
    });

    expect(plan.merchant).toBe('Mercadona BURGOS');
    expect(plan.currency).toBe('EUR');
    expect(plan.placeLabel).toBe('Burgos');
    expect(plan.readTotalCents).toBe(1240);
    expect(plan.items).toHaveLength(3);
    expect(plan.items.map((i) => i.amountCents)).toEqual([240, 100, 900]);
    expect(plan.items.every((i) => i.include)).toBe(true);
    expect(plan.items.every((i) => i.participantIds.length === 0)).toBe(true);
  });

  it('prefers lineTotal but falls back to unitPrice * qty', () => {
    const plan = parseReceiptResponse({
      items: [
        { description: 'A', qty: 3, unitPrice: 1.5 }, // no lineTotal → 3 * 1.5 = 4.50
        { description: 'B', qty: 1, unitPrice: 2.0, lineTotal: 7.77 }, // lineTotal wins
      ],
    });
    expect(plan.items[0]!.amountCents).toBe(450);
    expect(plan.items[1]!.amountCents).toBe(777);
  });

  it('coerces messy numeric strings (comma decimals, currency symbols)', () => {
    const plan = parseReceiptResponse({
      currency: 'eur',
      items: [
        { description: 'Café', qty: '1', lineTotal: '3,50' },
        { description: 'Agua', qty: 1, lineTotal: '€1.20' },
      ],
    });
    expect(plan.currency).toBe('EUR');
    expect(plan.items[0]!.amountCents).toBe(350);
    expect(plan.items[1]!.amountCents).toBe(120);
  });

  it('defaults a missing/invalid quantity to 1 and a missing description to "Item"', () => {
    const plan = parseReceiptResponse({
      items: [{ unitPrice: 4.0, qty: 0 }],
    });
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]!.qty).toBe(1);
    expect(plan.items[0]!.description).toBe('Item');
    expect(plan.items[0]!.amountCents).toBe(400);
  });

  it('drops lines without any positive amount', () => {
    const plan = parseReceiptResponse({
      items: [
        { description: 'Ghost' }, // no price at all → dropped
        { description: 'Free sample', unitPrice: 0, lineTotal: 0 }, // zero → dropped
        { description: 'Real', lineTotal: 5 },
      ],
    });
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]!.description).toBe('Real');
  });

  it('rejects an invalid currency code', () => {
    expect(parseReceiptResponse({ currency: 'Euros', items: [] }).currency).toBeNull();
    expect(parseReceiptResponse({ currency: '€', items: [] }).currency).toBeNull();
    expect(parseReceiptResponse({ currency: 'usd', items: [] }).currency).toBe('USD');
  });

  it('assigns a unique id to every line', () => {
    const plan = parseReceiptResponse({
      items: [
        { description: 'A', lineTotal: 1 },
        { description: 'B', lineTotal: 2 },
      ],
    });
    const ids = new Set(plan.items.map((i) => i.id));
    expect(ids.size).toBe(2);
    expect(plan.items.every((i) => typeof i.id === 'string' && i.id.length > 0)).toBe(true);
  });

  it('accepts a bare items array and survives garbage input', () => {
    expect(parseReceiptResponse([{ description: 'X', lineTotal: 3 }]).items).toHaveLength(1);
    expect(parseReceiptResponse(null).items).toEqual([]);
    expect(parseReceiptResponse('nonsense').items).toEqual([]);
    expect(parseReceiptResponse({ items: 'not-an-array' }).items).toEqual([]);
    expect(parseReceiptResponse({ items: [42, null, 'x'] }).items).toEqual([]);
  });
});

describe('reconcileReceipt (DEC-206)', () => {
  const plan = parseReceiptResponse({
    total: 10.0,
    items: [
      { description: 'A', lineTotal: 4 },
      { description: 'B', lineTotal: 5 },
    ],
  });

  it('reports the difference between kept items and the printed total', () => {
    const rec = reconcileReceipt(plan);
    expect(rec.itemsTotalCents).toBe(900);
    expect(rec.readTotalCents).toBe(1000);
    expect(rec.diffCents).toBe(-100);
    expect(rec.matches).toBe(false);
  });

  it('honours a tolerance', () => {
    const rec = reconcileReceipt(plan, 100);
    expect(rec.matches).toBe(true);
  });

  it('only counts included lines', () => {
    const trimmed = { ...plan, items: plan.items.map((i, idx) => ({ ...i, include: idx === 0 })) };
    const rec = reconcileReceipt(trimmed);
    expect(rec.itemsTotalCents).toBe(400);
    expect(rec.diffCents).toBe(-600);
  });

  it('matches trivially when the receipt had no total', () => {
    const noTotal = parseReceiptResponse({ items: [{ description: 'A', lineTotal: 4 }] });
    const rec = reconcileReceipt(noTotal);
    expect(rec.readTotalCents).toBeNull();
    expect(rec.diffCents).toBeNull();
    expect(rec.matches).toBe(true);
  });
});
