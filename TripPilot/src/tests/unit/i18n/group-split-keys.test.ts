import { describe, it, expect } from 'vitest';
import ptBR from '@/i18n/locales/pt-BR.json';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';

/**
 * G1 — guard the capture-rename (F05), the manual-item keys (F05) and the
 * shortened payment-status copy (F02) across all three locales, so no surface
 * falls back to a missing/hard-coded string.
 */
type Dict = { group_split: Record<string, string>; group_claim: Record<string, string> };
const locales: Record<string, Dict> = {
  'pt-BR': ptBR as unknown as Dict,
  en: en as unknown as Dict,
  es: es as unknown as Dict,
};

const REQUIRED_GROUP_SPLIT = [
  'scan_full',
  'scan_items',
  'ai_ask',
  'add_item',
  'item_desc_ph',
  'registered_by',
  'items_title',
  'items_total',
  'use_full_bill',
];

describe('G1 i18n — group-split capture + manual-item + status keys', () => {
  for (const [lng, dict] of Object.entries(locales)) {
    it(`${lng}: every group_split capture/item key is present and non-empty`, () => {
      for (const key of REQUIRED_GROUP_SPLIT) {
        expect(dict.group_split[key], `${lng}.group_split.${key}`).toBeTruthy();
      }
    });

    it(`${lng}: group_claim.awaiting is the short, card-fitting copy (F02)`, () => {
      const awaiting = dict.group_claim.awaiting ?? '';
      expect(awaiting, `${lng}.group_claim.awaiting`).toBeTruthy();
      // The old copy ("…waiting for the organizer to confirm") overflowed the card.
      expect(awaiting.length).toBeLessThan(60);
    });
  }

  it('pt-BR uses the F02 directive string verbatim', () => {
    expect(locales['pt-BR']!.group_claim.awaiting).toBe('Marcado como pago · aguardando confirmação');
  });

  it('pt-BR capture labels carry the F05 renames', () => {
    const gs = locales['pt-BR']!.group_split;
    expect(gs.scan_full).toBe('Enviar nota (tudo)');
    expect(gs.scan_items).toBe('Enviar nota e escolher itens');
    expect(gs.ai_ask).toBe('Descrever por texto');
  });
});
