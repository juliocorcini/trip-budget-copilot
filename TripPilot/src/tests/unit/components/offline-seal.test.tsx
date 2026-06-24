import { describe, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@/i18n';
import { OfflineSeal } from '@/components/OfflineSeal';
import ptBR from '@/i18n/locales/pt-BR.json';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LOCALES: Record<string, any> = { ptBR, en, es };

/** M24 (EXP-5) — surface the always-true "works offline" trait on 0-token tools. */
describe('OfflineSeal — visible resilience (M24)', () => {
  it('renders the translated "works offline" label', () => {
    render(<OfflineSeal />);
    expect(screen.getByText(/funciona offline/i)).toBeInTheDocument();
    cleanup();
  });

  it('ships common.works_offline in every locale', () => {
    for (const [name, dict] of Object.entries(LOCALES)) {
      expect(dict.common.works_offline, `${name} missing common.works_offline`).toMatch(/.{4,}/);
    }
  });
});

/** M25 (Estudo §5.5) — teach to frame the price tag to lift the photo read rate. */
describe('Comparator capture microcopy (M25)', () => {
  it('ships comparator.scan_tip in every locale', () => {
    for (const [name, dict] of Object.entries(LOCALES)) {
      expect(dict.comparator.scan_tip, `${name} missing comparator.scan_tip`).toMatch(/.{10,}/);
    }
  });
});
