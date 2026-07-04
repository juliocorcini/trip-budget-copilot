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
 * DEC-447 (G3 m2) + DEC-456 — the lens block renders the reconciliation the
 * user can check: title, the phase-money lines of the Julio fixture, the two
 * totals (envelope 582.00 · free 282.00) and the INFORMATIVE "fora deste
 * cálculo" section carrying the pot money (302.00) named per fund. The
 * arithmetic itself is proven in phase-spend-lens.test.ts; this pins the
 * wiring + visible labels.
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

describe('PhaseSpendLensBlock (G3 + DEC-456)', () => {
  it('renders the title, the phase-money lines and the sums 582/282', () => {
    render(<PhaseSpendLensBlock lens={fixtureLens()} currency="EUR" />);

    expect(screen.getByText('De onde vêm esses números')).toBeInTheDocument();
    expect(screen.getByText('Orçamento configurado da verba')).toBeInTheDocument();
    expect(screen.getByText('Reservado para eventos')).toBeInTheDocument();
    expect(screen.getByText('Orçamento disponível calculado')).toBeInTheDocument();
    expect(screen.getByText('Gasto da verba da fase')).toBeInTheDocument();
    expect(screen.getByText('Livre agora')).toBeInTheDocument();

    expect(screen.getByText(money(62800))).toBeInTheDocument();
    expect(screen.getByText(money(58200))).toBeInTheDocument();
    expect(screen.getByText(money(28200))).toBeInTheDocument();
  });

  it('marks the subtracted lines with signs and drops zero terms', () => {
    render(<PhaseSpendLensBlock lens={fixtureLens()} currency="EUR" />);

    expect(screen.getByText(`− ${money(4600)}`)).toBeInTheDocument();
    expect(screen.getByText(`− ${money(30000)}`)).toBeInTheDocument();
    // Zero terms (protected reserve, future floor, planned purchases, income,
    // paid-for-other-phases) never render as noise rows:
    expect(screen.queryByText('Reserva protegida')).not.toBeInTheDocument();
    expect(screen.queryByText('Guardado para fases futuras')).not.toBeInTheDocument();
    expect(screen.queryByText('Pago agora para outras fases')).not.toBeInTheDocument();
  });

  it('DEC-456: pot money renders in the informative section, named, without a sign', () => {
    const poolNames = new Map([['pool-extras', 'Extras']]);
    const { container } = render(
      <PhaseSpendLensBlock lens={fixtureLens()} currency="EUR" poolNameById={poolNames} />,
    );

    expect(screen.getByText('Fora deste cálculo')).toBeInTheDocument();
    expect(screen.getByText('Pago por potes e outras verbas')).toBeInTheDocument();
    expect(screen.getByText('Extras')).toBeInTheDocument();
    // The pot total shows as a plain value — never as "+ €302,00" (not summed):
    expect(screen.queryByText(`+ ${money(30200)}`)).not.toBeInTheDocument();
    expect(screen.getAllByText(money(30200)).length).toBeGreaterThanOrEqual(1);
    expect(container.querySelector('[data-lens-info-section]')).not.toBeNull();
    expect(
      screen.getByText('Potes são dinheiro à parte da viagem — não entram no orçamento da fase.'),
    ).toBeInTheDocument();
  });
});
