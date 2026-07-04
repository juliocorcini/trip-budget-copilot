import { describe, it, expect } from 'vitest';
import {
  parseReceiptResponse,
  reconcileReceipt,
  matchItemsToReadTotal,
  dominantReceiptCategory,
  summarizeReceiptTotal,
} from '@/domain/receipt';
import type { ReceiptDraftItem } from '@/domain/receipt';
import { guessCategory } from '@/domain/import/wise-import';

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

describe('matchItemsToReadTotal (G4 · DEC-206)', () => {
  it('distributes a service charge so the items sum exactly to the total', () => {
    // Items sum to 9.00 but the receipt printed 10.00 (1.00 service/tax).
    const plan = parseReceiptResponse({
      total: 10.0,
      items: [
        { description: 'A', lineTotal: 4 },
        { description: 'B', lineTotal: 5 },
      ],
    });
    const next = matchItemsToReadTotal(plan);
    const sum = next.reduce((s, i) => s + i.amountCents, 0);
    expect(sum).toBe(1000);
    // Proportional: 400/900 * 1000 = 444 (rounded); last absorbs the remainder.
    expect(next[0]!.amountCents).toBe(444);
    expect(next[1]!.amountCents).toBe(556);
    // Reconciliation now reports a perfect match.
    expect(reconcileReceipt({ ...plan, items: next }).matches).toBe(true);
  });

  it('scales down for a discount (total below the line subtotal)', () => {
    const plan = parseReceiptResponse({
      total: 8.0,
      items: [
        { description: 'A', lineTotal: 4 },
        { description: 'B', lineTotal: 6 },
      ],
    });
    const next = matchItemsToReadTotal(plan);
    expect(next.reduce((s, i) => s + i.amountCents, 0)).toBe(800);
    expect(next[0]!.amountCents).toBe(320); // 400/1000 * 800
    expect(next[1]!.amountCents).toBe(480);
  });

  it('only touches included lines and keeps the original order', () => {
    const base = parseReceiptResponse({
      total: 10.0,
      items: [
        { description: 'Keep A', lineTotal: 4 },
        { description: 'Dropped', lineTotal: 3 },
        { description: 'Keep B', lineTotal: 5 },
      ],
    });
    const plan = { ...base, items: base.items.map((i, idx) => (idx === 1 ? { ...i, include: false } : i)) };
    const next = matchItemsToReadTotal(plan);
    // Excluded middle line is untouched; included A+B now total 10.00.
    expect(next[1]!.amountCents).toBe(300);
    expect(next[1]!.include).toBe(false);
    expect(next[0]!.amountCents + next[2]!.amountCents).toBe(1000);
    expect(next.map((i) => i.description)).toEqual(['Keep A', 'Dropped', 'Keep B']);
  });

  it('makes a single included line equal the total', () => {
    const plan = parseReceiptResponse({ total: 12.4, items: [{ description: 'Only', lineTotal: 9 }] });
    const next = matchItemsToReadTotal(plan);
    expect(next[0]!.amountCents).toBe(1240);
  });

  it('is a no-op without a printed total or when already matching', () => {
    const noTotal = parseReceiptResponse({ items: [{ description: 'A', lineTotal: 4 }] });
    expect(matchItemsToReadTotal(noTotal)).toBe(noTotal.items);

    const exact = parseReceiptResponse({ total: 9.0, items: [{ description: 'A', lineTotal: 4 }, { description: 'B', lineTotal: 5 }] });
    expect(matchItemsToReadTotal(exact)).toBe(exact.items);
  });
});

// D-IMP-05: name a merchant-less receipt after its dominant category so the user
// no longer sees a bare "Nota". The picker must weigh by spend, ignore noise
// (excluded / zero / `other` lines), and break ties deterministically.
describe('dominantReceiptCategory (D-IMP-05)', () => {
  const item = (category: string, amountCents: number, extra: Partial<ReceiptDraftItem> = {}): ReceiptDraftItem => ({
    id: `${category}-${amountCents}-${extra.description ?? ''}`,
    description: extra.description ?? category,
    qty: 1,
    amountCents,
    category,
    include: extra.include ?? true,
    participantIds: [],
    paidByParticipantId: null,
  });

  it('returns null for an empty list', () => {
    expect(dominantReceiptCategory([])).toBeNull();
  });

  it('returns the only meaningful category present', () => {
    expect(dominantReceiptCategory([item('market', 240), item('market', 100)])).toBe('market');
  });

  it('weighs by spend, not by line count', () => {
    // restaurant wins on total spend (3000) despite market having more lines.
    const items = [item('market', 200), item('market', 300), item('market', 100), item('restaurant', 3000)];
    expect(dominantReceiptCategory(items)).toBe('restaurant');
  });

  it('ignores excluded and zero-amount lines', () => {
    const items = [
      item('restaurant', 5000, { include: false }),
      item('market', 0),
      item('bar', 700),
    ];
    expect(dominantReceiptCategory(items)).toBe('bar');
  });

  it('never picks the uninformative "other" bucket', () => {
    const items = [item('other', 9000), item('market', 500)];
    expect(dominantReceiptCategory(items)).toBe('market');
  });

  it('returns null when only "other" (or no positive) lines exist', () => {
    expect(dominantReceiptCategory([item('other', 9000), item('other', 100)])).toBeNull();
  });

  it('breaks a spend tie by line count, then first appearance', () => {
    // Equal spend (1000 each): market has 2 lines vs bar's 1 → market wins.
    expect(dominantReceiptCategory([item('bar', 1000), item('market', 500), item('market', 500)])).toBe('market');
    // Equal spend AND equal count → the category that appeared first wins.
    expect(dominantReceiptCategory([item('transport', 800), item('restaurant', 800)])).toBe('transport');
  });
});

// T3/E6 (M4): the OCR prompt now also returns a serviceCharge object and an
// adjustments array. The parser normalises both to cents, defensively, so the
// split layer can resolve the charge and rate out couvert/discount lines.
describe('parseReceiptResponse — serviceCharge (T3)', () => {
  it('reads an absolute service amount to cents', () => {
    const plan = parseReceiptResponse({
      items: [{ description: 'A', lineTotal: 50 }],
      serviceCharge: { amount: 5.5, percent: null, included: false },
    });
    expect(plan.serviceCharge.amountCents).toBe(550);
    expect(plan.serviceCharge.percent).toBeNull();
    expect(plan.serviceCharge.included).toBe(false);
  });

  it('reads a percentage rate and an "included" flag', () => {
    const plan = parseReceiptResponse({
      items: [],
      serviceCharge: { amount: null, percent: 10, included: true },
    });
    expect(plan.serviceCharge.amountCents).toBeNull();
    expect(plan.serviceCharge.percent).toBe(10);
    expect(plan.serviceCharge.included).toBe(true);
  });

  it('coerces a stringy included flag and a comma-decimal amount', () => {
    const plan = parseReceiptResponse({
      items: [],
      serviceCharge: { amount: '3,00', percent: '0', included: 'true' },
    });
    expect(plan.serviceCharge.amountCents).toBe(300);
    expect(plan.serviceCharge.percent).toBeNull(); // 0 → null
    expect(plan.serviceCharge.included).toBe(true);
  });

  it('defaults to all-null when no service charge is present or the field is junk', () => {
    expect(parseReceiptResponse({ items: [] }).serviceCharge).toEqual({
      amountCents: null,
      percent: null,
      included: null,
    });
    expect(parseReceiptResponse({ items: [], serviceCharge: 'nope' }).serviceCharge.included).toBeNull();
  });
});

describe('parseReceiptResponse — adjustments (E6)', () => {
  it('keeps couvert positive and forces a discount negative', () => {
    const plan = parseReceiptResponse({
      items: [],
      adjustments: [
        { kind: 'couvert', label: 'Couvert', amount: 4 },
        { kind: 'discount', label: '10% off', amount: 2 }, // positive in → negative out
      ],
    });
    expect(plan.adjustments).toHaveLength(2);
    expect(plan.adjustments[0]).toEqual({ kind: 'couvert', label: 'Couvert', amountCents: 400 });
    // DEC-467: discounts now also carry their scope (basket when unspecified).
    expect(plan.adjustments[1]).toEqual({
      kind: 'discount',
      label: '10% off',
      amountCents: -200,
      scope: 'basket',
      itemIndex: null,
    });
  });

  it('normalises an unknown kind to "other" and labels it from the kind when blank', () => {
    const plan = parseReceiptResponse({
      items: [],
      adjustments: [{ kind: 'tax', amount: 1.5 }],
    });
    expect(plan.adjustments[0]!.kind).toBe('other');
    expect(plan.adjustments[0]!.label).toBe('other');
    expect(plan.adjustments[0]!.amountCents).toBe(150);
  });

  it('drops zero/blank lines and survives a non-array', () => {
    const plan = parseReceiptResponse({
      items: [],
      adjustments: [{ kind: 'other', label: 'x', amount: 0 }, 'junk', null],
    });
    expect(plan.adjustments).toEqual([]);
    expect(parseReceiptResponse({ items: [], adjustments: 'nope' }).adjustments).toEqual([]);
  });

  it('honours an already-negative discount without double-negating', () => {
    const plan = parseReceiptResponse({
      items: [],
      adjustments: [{ kind: 'discount', label: 'promo', amount: -3 }],
    });
    expect(plan.adjustments[0]!.amountCents).toBe(-300);
  });
});

// FB-10 (DEC-258): the OCR now also returns a receipt date, a merchant location
// and a per-item category. The parser must trust a clean AI category, reject a
// guessed/garbage one (falling back to the heuristic), and only accept a real
// YYYY-MM-DD date so a wrong day never lands on the expense.
describe('parseReceiptResponse — per-item category (FB-10)', () => {
  it('trusts a valid taxonomy category from the model (it wins over the heuristic)', () => {
    const plan = parseReceiptResponse({
      merchant: 'Mercadona BURGOS',
      items: [
        { description: 'Cerveja', lineTotal: 3, category: 'market' },
        { description: 'Uber ride', lineTotal: 10, category: 'transport' },
      ],
    });
    expect(plan.items[0]!.category).toBe('market');
    expect(plan.items[1]!.category).toBe('transport');
  });

  it('accepts an upper/mixed-case category (normalised to the taxonomy key)', () => {
    const plan = parseReceiptResponse({ items: [{ description: 'X', lineTotal: 5, category: 'BAR' }] });
    expect(plan.items[0]!.category).toBe('bar');
  });

  it('falls back to the heuristic when the model category is junk', () => {
    const merchant = 'Some Shop';
    const plan = parseReceiptResponse({
      merchant,
      items: [{ description: 'Mystery thing', lineTotal: 5, category: 'spaceship' }],
    });
    expect(plan.items[0]!.category).toBe(guessCategory(merchant, 'Mystery thing'));
  });

  it('treats a model "other" as no real hit and lets the heuristic try', () => {
    const merchant = 'Restaurante Lisboa';
    const plan = parseReceiptResponse({
      merchant,
      items: [{ description: 'Prato do dia', lineTotal: 12, category: 'other' }],
    });
    expect(plan.items[0]!.category).toBe(guessCategory(merchant, 'Prato do dia'));
  });

  it('uses the heuristic when the model omits the category (back-compat)', () => {
    const merchant = 'Mercadona BURGOS';
    const plan = parseReceiptResponse({ merchant, items: [{ description: 'Leche', lineTotal: 2 }] });
    expect(plan.items[0]!.category).toBe(guessCategory(merchant, 'Leche'));
  });
});

describe('parseReceiptResponse — receipt date (FB-10)', () => {
  it('keeps a valid YYYY-MM-DD purchase date', () => {
    expect(parseReceiptResponse({ date: '2026-06-20', items: [] }).purchaseDate).toBe('2026-06-20');
  });

  it('rejects a non-canonical or impossible date (no guessing)', () => {
    // The model is told to convert to YYYY-MM-DD; anything else is rejected.
    expect(parseReceiptResponse({ date: '20/06/2026', items: [] }).purchaseDate).toBeNull();
    expect(parseReceiptResponse({ date: '2026-13-40', items: [] }).purchaseDate).toBeNull();
    expect(parseReceiptResponse({ date: '2026-02-30', items: [] }).purchaseDate).toBeNull();
  });

  it('defaults to null when no date is printed', () => {
    expect(parseReceiptResponse({ items: [] }).purchaseDate).toBeNull();
  });
});

describe('parseReceiptResponse — place (FB-10)', () => {
  it('prefers the location the model read off the receipt', () => {
    const plan = parseReceiptResponse({ merchant: 'Mercadona BURGOS', place: 'Lisboa, Portugal', items: [] });
    expect(plan.placeLabel).toBe('Lisboa, Portugal');
  });

  it('falls back to the city derived from the merchant when no place is printed', () => {
    const plan = parseReceiptResponse({ merchant: 'Mercadona BURGOS', items: [] });
    expect(plan.placeLabel).toBe('Burgos');
  });
});

describe('summarizeReceiptTotal (F7 — read a note inside an outing)', () => {
  it('uses the printed total + merchant when present', () => {
    const plan = parseReceiptResponse({
      merchant: 'Bar Pelourinho',
      currency: 'EUR',
      total: 23.5,
      items: [
        { description: 'Cerveja', qty: 2, unitPrice: 3.5, lineTotal: 7.0 },
        { description: 'Tapas', qty: 1, lineTotal: 16.5 },
      ],
    });
    expect(summarizeReceiptTotal(plan)).toEqual({ amountCents: 2350, merchant: 'Bar Pelourinho' });
  });

  it('falls back to the sum of kept positive items when there is no printed total', () => {
    const plan = parseReceiptResponse({
      merchant: null,
      items: [
        { description: 'A', qty: 1, lineTotal: 4.0 },
        { description: 'B', qty: 1, lineTotal: 6.25 },
      ],
    });
    // no total → 400 + 625; null merchant surfaces as null (caller localizes a fallback)
    expect(summarizeReceiptTotal(plan)).toEqual({ amountCents: 1025, merchant: null });
  });

  it('returns null for an unreadable note (nothing positive to add)', () => {
    const plan = parseReceiptResponse({ merchant: null, total: null, items: [] });
    expect(summarizeReceiptTotal(plan)).toBeNull();
  });
});
