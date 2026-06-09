import type { Transaction } from '@/domain/types/transaction';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { Wallet } from '@/domain/types/wallet';
import type { Phase } from '@/domain/types/phase';
import { fromCents, formatMoney } from '@/domain/money';

interface CsvRow {
  date: string;
  description: string;
  amount: string;
  amountFormatted: string;
  category: string;
  type: string;
  fund: string;
  wallet: string;
  phase: string;
  isShared: string;
}

export function transactionsToCsvRows(
  transactions: Transaction[],
  pools: BudgetPool[],
  wallets: Wallet[],
  phases: Phase[],
  currency: string,
): CsvRow[] {
  const poolMap = new Map(pools.map((p) => [p.id, p.name]));
  const walletMap = new Map(wallets.map((w) => [w.id, w.name]));
  const phaseMap = new Map(phases.map((p) => [p.id, p.name]));

  return transactions
    .filter((t) => t.deletedAt === null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => ({
      date: t.date.slice(0, 10),
      description: t.description,
      amount: fromCents(t.amountCents).toFixed(2),
      amountFormatted: formatMoney(t.amountCents, currency),
      category: t.category ?? '',
      type: t.type,
      fund: t.budgetPoolId ? (poolMap.get(t.budgetPoolId) ?? '') : '',
      wallet: t.walletId ? (walletMap.get(t.walletId) ?? 'Não informada') : 'Não informada',
      phase: phaseMap.get(t.phaseId) ?? '',
      isShared: t.isShared ? 'Sim' : 'Não',
    }));
}

export function rowsToCsv(rows: CsvRow[]): string {
  const headers = [
    'Data', 'Descrição', 'Valor', 'Valor Formatado',
    'Categoria', 'Tipo', 'Fundo', 'Carteira', 'Fase', 'Compartilhado',
  ];
  const lines = [headers.join(';')];
  for (const row of rows) {
    lines.push([
      row.date, escapeCsv(row.description), row.amount, row.amountFormatted,
      row.category, row.type, escapeCsv(row.fund), escapeCsv(row.wallet),
      escapeCsv(row.phase), row.isShared,
    ].join(';'));
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
