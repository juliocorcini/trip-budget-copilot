import type { Transaction } from '@/domain/types/transaction';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { Wallet } from '@/domain/types/wallet';
import type { Phase } from '@/domain/types/phase';
import type { Trip } from '@/domain/types/trip';
import type { Session } from '@/domain/types/session';
import type { Participant } from '@/domain/types/participant';
import { fromCents, formatMoney } from '@/domain/money';

export interface CsvExportContext {
  transactions: Transaction[];
  pools: BudgetPool[];
  wallets: Wallet[];
  phases: Phase[];
  trips: Trip[];
  sessions: Session[];
  participants: Participant[];
  currency: string;
  /** DEC-058 advanced mode: adds ID, status, timestamps and device columns. */
  advanced: boolean;
}

interface CsvRow {
  date: string;
  time: string;
  description: string;
  amount: string;
  amountFormatted: string;
  currency: string;
  baseCurrencyAmount: string;
  category: string;
  type: string;
  trip: string;
  phase: string;
  fund: string;
  wallet: string;
  session: string;
  isShared: string;
  paidBy: string;
  personalCost: string;
  sharedAmount: string;
  notes: string;
  // Advanced-only columns
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  device: string;
}

const BASE_HEADERS = [
  'Data', 'Hora', 'Descrição', 'Valor', 'Valor Formatado', 'Moeda',
  'Valor em moeda base', 'Categoria', 'Tipo', 'Viagem', 'Fase', 'Fundo',
  'Carteira', 'Caixa/Sessão', 'Compartilhado', 'Quem pagou',
  'Custo pessoal', 'Valor compartilhado', 'Observações',
];

const ADVANCED_HEADERS = ['ID', 'Status', 'Criado em', 'Atualizado em', 'Dispositivo'];

function baseColumns(row: CsvRow): string[] {
  return [
    row.date, row.time, escapeCsv(row.description), row.amount, row.amountFormatted,
    row.currency, row.baseCurrencyAmount, row.category, row.type,
    escapeCsv(row.trip), escapeCsv(row.phase), escapeCsv(row.fund),
    escapeCsv(row.wallet), escapeCsv(row.session), row.isShared,
    escapeCsv(row.paidBy), row.personalCost, row.sharedAmount, escapeCsv(row.notes),
  ];
}

function advancedColumns(row: CsvRow): string[] {
  return [row.id, row.status, row.createdAt, row.updatedAt, row.device];
}

export function transactionsToCsvRows(context: CsvExportContext): CsvRow[] {
  const poolMap = new Map(context.pools.map((p) => [p.id, p.name]));
  const walletMap = new Map(context.wallets.map((w) => [w.id, w.name]));
  const phaseMap = new Map(context.phases.map((p) => [p.id, p.name]));
  const tripMap = new Map(context.trips.map((t) => [t.id, t.name]));
  const sessionMap = new Map(context.sessions.map((s) => [s.id, s.name]));
  const participantMap = new Map(context.participants.map((p) => [p.id, p.name]));

  return context.transactions
    .filter((t) => context.advanced || t.deletedAt === null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => {
      const sharedAmountCents =
        t.isShared && t.personalCostCents !== null ? t.amountCents - t.personalCostCents : 0;
      return {
        date: t.date.slice(0, 10),
        time: t.date.slice(11, 16),
        description: t.description,
        amount: fromCents(t.amountCents).toFixed(2),
        amountFormatted: formatMoney(t.amountCents, context.currency),
        currency: t.currency,
        baseCurrencyAmount: fromCents(t.baseCurrencyAmountCents).toFixed(2),
        category: t.category ?? '',
        type: t.type,
        trip: tripMap.get(t.tripId) ?? '',
        phase: phaseMap.get(t.phaseId) ?? '',
        fund: t.budgetPoolId ? (poolMap.get(t.budgetPoolId) ?? '') : '',
        wallet: t.walletId ? (walletMap.get(t.walletId) ?? 'Não informada') : 'Não informada',
        session: t.sessionId ? (sessionMap.get(t.sessionId) ?? '') : '',
        isShared: t.isShared ? 'Sim' : 'Não',
        paidBy: t.paidByParticipantId ? (participantMap.get(t.paidByParticipantId) ?? '') : '',
        personalCost:
          t.personalCostCents !== null ? fromCents(t.personalCostCents).toFixed(2) : '',
        sharedAmount: sharedAmountCents > 0 ? fromCents(sharedAmountCents).toFixed(2) : '',
        notes: t.notes ?? '',
        id: t.id,
        status: t.deletedAt === null ? 'Ativo' : 'Excluído',
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        device: t.sourceDeviceId,
      };
    });
}

export function rowsToCsv(rows: CsvRow[], advanced: boolean = false): string {
  const headers = advanced ? [...BASE_HEADERS, ...ADVANCED_HEADERS] : BASE_HEADERS;
  const lines = [headers.join(';')];
  for (const row of rows) {
    const columns = advanced
      ? [...baseColumns(row), ...advancedColumns(row)]
      : baseColumns(row);
    lines.push(columns.join(';'));
  }
  return lines.join('\n');
}

function escapeCsv(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
