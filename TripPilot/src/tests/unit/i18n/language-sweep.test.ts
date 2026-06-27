import { describe, it, expect } from 'vitest';
import ptBR from '@/i18n/locales/pt-BR.json';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';

/**
 * G4 / DEC-372 — human-language sweep.
 *
 * The common UI must never expose the internal transport vocabulary
 * ("caixa postal" / "mailbox" / "buzón") nor the technical strings the 4th
 * field review flagged ("Recebidos de outros aparelhos", "Atualizar dados",
 * "Ver respostas"). These tests flatten every locale and guard:
 *   1. no banned term survives in any translated VALUE (D1/D2/D3 sweep);
 *   2. the rewritten keys carry the new human copy in all three locales (parity).
 */

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function flattenValues(node: Json, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (typeof node === 'string') {
    out[prefix] = node;
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((item, i) => flattenValues(item, `${prefix}[${i}]`, out));
    return out;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      flattenValues(value, prefix ? `${prefix}.${key}` : key, out);
    }
  }
  return out;
}

const locales: Record<string, Record<string, string>> = {
  'pt-BR': flattenValues(ptBR as unknown as Json),
  en: flattenValues(en as unknown as Json),
  es: flattenValues(es as unknown as Json),
};

// Per-language banned substrings (lowercased) that must not appear in any value.
const BANNED: Record<string, string[]> = {
  'pt-BR': ['caixa postal', 'recebidos de outros aparelhos', 'atualizar dados', 'ver respostas'],
  en: ['mailbox', 'received from other devices', 'refresh data', 'check responses'],
  es: ['buzón', 'buzon', 'recibidos de otros dispositivos', 'actualizar datos', 'ver respuestas'],
};

describe('G4 i18n — human language sweep (DEC-372)', () => {
  for (const [lng, dict] of Object.entries(locales)) {
    it(`${lng}: no banned transport/technical term survives in any value`, () => {
      const offenders: string[] = [];
      for (const [key, value] of Object.entries(dict)) {
        const lower = value.toLowerCase();
        for (const term of BANNED[lng]!) {
          if (lower.includes(term)) offenders.push(`${key} → "${value}" (contains "${term}")`);
        }
      }
      expect(offenders, offenders.join('\n')).toEqual([]);
    });
  }

  // Keys rewritten in G4 — must exist, be non-empty, and parity across locales.
  const REWRITTEN_KEYS = [
    'mailbox.sent',
    'mailbox.send_statement',
    'mailbox.received_statements',
    'mailbox.received_backups',
    'mailbox.send_backup_title',
    'mailbox.setting_title',
    'sync.send_statement',
    'sync.received_statements',
    'shareLink.refresh',
    'shareLink.pull',
    'settings.cat_desc_connections',
  ];

  for (const key of REWRITTEN_KEYS) {
    it(`every locale has a non-empty value for ${key}`, () => {
      for (const [lng, dict] of Object.entries(locales)) {
        expect(dict[key], `${lng}.${key}`).toBeTruthy();
      }
    });
  }

  it('pt-BR carries the new human copy verbatim', () => {
    const pt = locales['pt-BR']!;
    expect(pt['sync.received_statements']).toBe('Recebido de amigos');
    expect(pt['shareLink.refresh']).toBe('Atualizar o link');
    expect(pt['shareLink.pull']).toBe('Ver quem respondeu');
    expect(pt['mailbox.setting_title']).toBe('Mensagens entre aparelhos');
  });
});
