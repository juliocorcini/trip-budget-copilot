import { describe, it, expect, vi, beforeEach } from 'vitest';

const extractReceiptViaCloud = vi.fn();
const requestAssistantIntents = vi.fn();

vi.mock('@/utils/ai-ocr', () => ({ extractReceiptViaCloud: (...a: unknown[]) => extractReceiptViaCloud(...a) }));
vi.mock('@/utils/ai-assistant', () => ({ requestAssistantIntents: (...a: unknown[]) => requestAssistantIntents(...a) }));
vi.mock('@/utils/image/compress', () => ({
  compressImageFile: vi.fn(async () => ({ blob: new Blob(['x']) })),
  blobToDataUrl: vi.fn(async () => 'data:image/jpeg;base64,xx'),
}));

import { scanReceiptForGroup, parseTextForGroup } from '@/features/group-split/group-ai';

function plan(overrides: Record<string, unknown> = {}) {
  return {
    merchant: 'Mercado Dia',
    placeLabel: null,
    purchaseDate: null,
    currency: 'EUR',
    readTotalCents: 9000,
    items: [
      { id: '1', description: 'carne', qty: 1, amountCents: 6000, category: 'market', include: true, participantIds: [], paidByParticipantId: null },
      { id: '2', description: 'cerveja', qty: 1, amountCents: 3000, category: 'market', include: true, participantIds: [], paidByParticipantId: null },
    ],
    serviceCharge: { amountCents: null, percent: null, included: null },
    adjustments: [],
    ...overrides,
  };
}

const file = new File(['x'], 'r.jpg', { type: 'image/jpeg' });

beforeEach(() => {
  extractReceiptViaCloud.mockReset();
  requestAssistantIntents.mockReset();
});

describe('scanReceiptForGroup (m3 — receipt → one group expense)', () => {
  it('summarizes a receipt into description + total + dominant category', async () => {
    extractReceiptViaCloud.mockResolvedValue({ ok: true, plan: plan() });
    const out = await scanReceiptForGroup(file);
    expect(out).toEqual({ ok: true, prefill: { description: 'Mercado Dia', amountCents: 9000, category: 'market' } });
  });

  it('maps a rate-limited cloud outcome to a typed error', async () => {
    extractReceiptViaCloud.mockResolvedValue({ ok: false, error: 'rate_limited' });
    expect(await scanReceiptForGroup(file)).toEqual({ ok: false, error: 'rate_limited' });
  });

  it('returns empty when the receipt has no readable total/items', async () => {
    extractReceiptViaCloud.mockResolvedValue({ ok: true, plan: plan({ readTotalCents: null, items: [] }) });
    expect(await scanReceiptForGroup(file)).toEqual({ ok: false, error: 'empty' });
  });
});

describe('parseTextForGroup (m3 — phrase → one group expense)', () => {
  it('extracts amount + description from the first money intent', async () => {
    requestAssistantIntents.mockResolvedValue({
      ok: true,
      intents: [{ action: 'log_expense', amount: 90, description: 'Churrasco', category: 'restaurant' }],
    });
    const out = await parseTextForGroup('churrasco 90', 'BRL', 'pt-BR');
    expect(out).toEqual({ ok: true, prefill: { description: 'Churrasco', amountCents: 9000, category: 'restaurant' } });
  });

  it('skips intents without a positive amount, falling back to empty', async () => {
    requestAssistantIntents.mockResolvedValue({ ok: true, intents: [{ action: 'navigate', amount: null }] });
    expect(await parseTextForGroup('abrir gastos', 'EUR', 'en')).toEqual({ ok: false, error: 'empty' });
  });

  it('does not call the cloud for empty text', async () => {
    expect(await parseTextForGroup('   ', 'EUR', 'en')).toEqual({ ok: false, error: 'empty' });
    expect(requestAssistantIntents).not.toHaveBeenCalled();
  });

  it('maps an offline outcome to a typed error', async () => {
    requestAssistantIntents.mockResolvedValue({ ok: false, error: 'offline' });
    expect(await parseTextForGroup('algo 10', 'EUR', 'en')).toEqual({ ok: false, error: 'offline' });
  });
});
