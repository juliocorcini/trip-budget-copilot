import { describe, it, expect } from 'vitest';
import { transactionsToCsvRows, rowsToCsv } from '@/domain/backup';
import type { CsvExportContext } from '@/domain/backup';
import { createExpenseTransaction } from '@/domain/transactions';
import { createSyncMetadata } from '@/utils/entity-factory';
import type { Trip } from '@/domain/types/trip';
import type { Phase } from '@/domain/types/phase';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { Wallet } from '@/domain/types/wallet';
import type { Session } from '@/domain/types/session';
import type { Participant } from '@/domain/types/participant';

const trip: Trip = {
  ...createSyncMetadata(),
  name: 'Euro trip',
  baseCurrency: 'EUR',
  startDate: '2026-07-01',
  endDate: '2026-07-31',
  status: 'active',
  notes: null,
};

const phase: Phase = {
  ...createSyncMetadata(),
  tripId: trip.id,
  name: 'Barcelona',
  startDate: '2026-07-01',
  endDate: '2026-07-10',
  order: 0,
  notes: null,
};

const pool: BudgetPool = {
  ...createSyncMetadata(),
  tripId: trip.id,
  name: 'Operacional',
  scope: 'linked_phases',
  totalAmountCents: 100000,
  currency: 'EUR',
  notes: null,
};

const wallet: Wallet = {
  ...createSyncMetadata(),
  tripId: trip.id,
  name: 'Wise',
  walletType: 'digital',
  currency: 'EUR',
  initialBalanceCents: 50000,
  isDefault: true,
  notes: null,
};

const session: Session = {
  ...createSyncMetadata(),
  tripId: trip.id,
  phaseId: phase.id,
  budgetPoolId: pool.id,
  activityProfileId: 'prof-1',
  status: 'completed',
  name: 'Bar night',
  targetCents: 3000,
  ceilingCents: 5000,
  maxCents: 7000,
  startedAt: '2026-07-02T21:00:00.000Z',
  endedAt: '2026-07-03T01:00:00.000Z',
  quickAddValuesCents: [300, 500],
  avgDrinkPriceCents: 500,
  firedAlertPercents: [],
  overMaxConfirmedAt: null,
  notes: null,
};

const payer: Participant = {
  ...createSyncMetadata(),
  tripId: trip.id,
  name: 'Marina',
  nickname: null,
  isOwner: false,
  email: null,
  linkedUserAccountId: null,
};

function buildContext(advanced: boolean): CsvExportContext {
  const tx = createExpenseTransaction({
    tripId: trip.id,
    phaseId: phase.id,
    budgetPoolId: pool.id,
    walletId: wallet.id,
    amountCents: 9000,
    currency: 'EUR',
    category: 'restaurant',
    description: 'Dinner; with friends',
    date: '2026-07-02T22:30:00.000Z',
    sessionId: session.id,
    isShared: true,
    paidByParticipantId: payer.id,
    personalCostCents: 3000,
    notes: 'Split 3 ways',
  });
  return {
    transactions: [tx],
    pools: [pool],
    wallets: [wallet],
    phases: [phase],
    trips: [trip],
    sessions: [session],
    participants: [payer],
    currency: 'EUR',
    advanced,
  };
}

describe('csv export (GAP-021 / DEC-058)', () => {
  it('basic mode exposes the 19 base columns with correct values', () => {
    const rows = transactionsToCsvRows(buildContext(false));
    const csv = rowsToCsv(rows, false);
    const [header, line] = csv.split('\n');

    expect(header!.split(';')).toEqual([
      'Data', 'Hora', 'Descrição', 'Valor', 'Valor Formatado', 'Moeda',
      'Valor em moeda base', 'Categoria', 'Tipo', 'Viagem', 'Fase', 'Fundo',
      'Carteira', 'Caixa/Sessão', 'Compartilhado', 'Quem pagou',
      'Custo pessoal', 'Valor compartilhado', 'Observações',
    ]);

    expect(line).toContain('2026-07-02');
    expect(line).toContain('22:30');
    expect(line).toContain('"Dinner; with friends"');
    expect(line).toContain('90.00');
    expect(line).toContain('Euro trip');
    expect(line).toContain('Barcelona');
    expect(line).toContain('Bar night');
    expect(line).toContain('Marina');
    expect(line).toContain('30.00'); // personal cost
    expect(line).toContain('60.00'); // shared amount
    expect(line).toContain('Split 3 ways');
  });

  it('advanced mode adds ID, status, timestamps and device columns', () => {
    const context = buildContext(true);
    const rows = transactionsToCsvRows(context);
    const csv = rowsToCsv(rows, true);
    const [header, line] = csv.split('\n');

    expect(header).toContain('ID;Status;Criado em;Atualizado em;Dispositivo');
    expect(line).toContain(context.transactions[0]!.id);
    expect(line).toContain('Ativo');
  });

  it('basic mode hides deleted transactions; advanced mode shows them with status', () => {
    const context = buildContext(false);
    context.transactions[0] = {
      ...context.transactions[0]!,
      deletedAt: '2026-07-05T00:00:00.000Z',
    };
    expect(transactionsToCsvRows(context)).toHaveLength(0);

    const advancedRows = transactionsToCsvRows({ ...context, advanced: true });
    expect(advancedRows).toHaveLength(1);
    expect(advancedRows[0]!.status).toBe('Excluído');
  });
});
