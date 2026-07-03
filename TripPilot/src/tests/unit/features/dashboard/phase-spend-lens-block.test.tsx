import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@/i18n';
import { PhaseSpendLensBlock } from '@/features/dashboard/PhaseSpendLensBlock';
import { buildPhaseSpendLens, calculateFreeToSpend } from '@/domain/budget';
import { filterTransactionsByPool } from '@/domain/transactions';
import { formatMoney } from '@/domain/money';
import {
  phaseA,
  poolMain,
  poolMainEnvelopes,
  poolMainLinks,
  festivalEvent,
  detailInstantTransactions,
} from '../../domain/budget/phase-spend-lens.fixture';

/**
 * DEC-447 (G3 m2) — the lens block renders the reconciliation the user can
 * check: title, every line of the Julio fixture, and the two totals (the
 * derived envelope 884.00 and the free 282.00). The arithmetic itself is
 * proven in phase-spend-lens.test.ts; this pins the wiring + visible labels.
 */

function fixtureLens() {
  const fts = calculateFreeToSpend(
    poolMain,
    poolMainEnvelopes,
    filterTransactionsByPool(detailInstantTransactions, poolMain.id),
    poolMainLinks,
    phaseA.id,
    [festivalEvent],
    [],
  );
  return buildPhaseSpendLens({
    fts,
    transactions: detailInstantTransactions,
    phaseId: phaseA.id,
    poolId: poolMain.id,
  });
}

/** Intl uses NBSP inside currency strings; the DOM normalizer collapses it to
 *  a plain space, so the expectation must do the same to compare equal. */
function money(cents: number): string {
  return formatMoney(cents, 'EUR').replace(/\u00A0/g, ' ');
}

describe('PhaseSpendLensBlock (G3)', () => {
  it('renders the title, the fixture lines and the sums 884/282', () => {
    render(<PhaseSpendLensBlock lens={fixtureLens()} currency="EUR" />);

    expect(screen.getByText('De onde vêm esses números')).toBeInTheDocument();
    expect(screen.getByText('Orçamento configurado da verba')).toBeInTheDocument();
    expect(screen.getByText('Reservado para eventos')).toBeInTheDocument();
    expect(screen.getByText('De outras verbas, atribuído à fase')).toBeInTheDocument();
    expect(screen.getByText('Orçamento disponível calculado')).toBeInTheDocument();
    expect(screen.getByText('Gasto atribuído à fase (todas as verbas)')).toBeInTheDocument();
    expect(screen.getByText('Livre agora')).toBeInTheDocument();

    expect(screen.getByText(money(62800))).toBeInTheDocument();
    expect(screen.getByText(money(88400))).toBeInTheDocument();
    expect(screen.getByText(money(28200))).toBeInTheDocument();
  });

  it('marks the subtracted/added lines with signs and drops zero terms', () => {
    render(<PhaseSpendLensBlock lens={fixtureLens()} currency="EUR" />);

    expect(screen.getByText(`− ${money(4600)}`)).toBeInTheDocument();
    expect(screen.getByText(`+ ${money(30200)}`)).toBeInTheDocument();
    // Zero terms (protected reserve, future floor, planned purchases, income,
    // paid-for-other-phases) never render as noise rows:
    expect(screen.queryByText('Reserva protegida')).not.toBeInTheDocument();
    expect(screen.queryByText('Guardado para fases futuras')).not.toBeInTheDocument();
    expect(screen.queryByText('Pago agora para outras fases')).not.toBeInTheDocument();
  });
});
