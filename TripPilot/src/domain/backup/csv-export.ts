import type { Transaction } from '@/domain/types/transaction';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { Wallet } from '@/domain/types/wallet';
import type { Phase } from '@/domain/types/phase';
import type { Trip } from '@/domain/types/trip';
import type { Session } from '@/domain/types/session';
import type { Participant } from '@/domain/types/participant';
import type { ParticipantShare } from '@/domain/types/participant-share';
import { fromCents, formatMoney } from '@/domain/money';
import { localDayOf, localClockTime } from '@/domain/dates';

export interface CsvExportContext {
  transactions: Transaction[];
  pools: BudgetPool[];
  wallets: Wallet[];
  phases: Phase[];
  trips: Trip[];
  sessions: Session[];
  participants: Participant[];
  /** DEC-071 (v3): share confirmation summary in the advanced column. */
  shares: ParticipantShare[];
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
  subcategory: string;
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
  shareConfirmation: string;
}

const BASE_HEADERS = [
  'Data', 'Hora', 'Descrição', 'Valor', 'Valor Formatado', 'Moeda',
  'Valor em moeda base', 'Categoria', 'Subcategoria', 'Tipo', 'Viagem', 'Fase', 'Fundo',
  'Carteira', 'Caixa/Sessão', 'Compartilhado', 'Quem pagou',
  'Custo pessoal', 'Valor compartilhado', 'Observações',
];

const ADVANCED_HEADERS = ['ID', 'Status', 'Criado em', 'Atualizado em', 'Dispositivo', 'Confirmação do rateio'];

function baseColumns(row: CsvRow): string[] {
  return [
    row.date, row.time, escapeCsv(row.description), row.amount, row.amountFormatted,
    row.currency, row.baseCurrencyAmount, row.category, row.subcategory, row.type,
    escapeCsv(row.trip), escapeCsv(row.phase), escapeCsv(row.fund),
    escapeCsv(row.wallet), escapeCsv(row.session), row.isShared,
    escapeCsv(row.paidBy), row.personalCost, row.sharedAmount, escapeCsv(row.notes),
  ];
}

function advancedColumns(row: CsvRow): string[] {
  return [row.id, row.status, row.createdAt, row.updatedAt, row.device, row.shareConfirmation];
}

function summarizeShareConfirmation(shares: ParticipantShare[]): string {
  const active = shares.filter((s) => s.deletedAt === null);
  if (active.length === 0) return '';
  const counts = { confirmed: 0, pending: 0, rejected: 0 };
  for (const s of active) counts[s.confirmationStatus]++;
  const parts: string[] = [];
  if (counts.confirmed > 0) parts.push(`${counts.confirmed} confirmado(s)`);
  if (counts.pending > 0) parts.push(`${counts.pending} pendente(s)`);
  if (counts.rejected > 0) parts.push(`${counts.rejected} rejeitado(s)`);
  return parts.join(' / ');
}

export function transactionsToCsvRows(context: CsvExportContext): CsvRow[] {
  const poolMap = new Map(context.pools.map((p) => [p.id, p.name]));
  const walletMap = new Map(context.wallets.map((w) => [w.id, w.name]));
  const phaseMap = new Map(context.phases.map((p) => [p.id, p.name]));
  const tripMap = new Map(context.trips.map((t) => [t.id, t.name]));
  const sessionMap = new Map(context.sessions.map((s) => [s.id, s.name]));
  const participantMap = new Map(context.participants.map((p) => [p.id, p.name]));
  const sharesByTx = new Map<string, ParticipantShare[]>();
  for (const share of context.shares) {
    const list = sharesByTx.get(share.transactionId) ?? [];
    list.push(share);
    sharesByTx.set(share.transactionId, list);
  }

  return context.transactions
    .filter((t) => context.advanced || t.deletedAt === null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => {
      const sharedAmountCents =
        t.isShared && t.personalCostCents !== null ? t.amountCents - t.personalCostCents : 0;
      return {
        // BUG-001 (R6-01): export the local day/time, not the UTC slice.
        date: localDayOf(t.date),
        time: localClockTime(t.date),
        description: t.description,
        amount: fromCents(t.amountCents).toFixed(2),
        amountFormatted: formatMoney(t.amountCents, context.currency),
        currency: t.currency,
        baseCurrencyAmount: fromCents(t.baseCurrencyAmountCents).toFixed(2),
        category: t.category ?? '',
        subcategory: t.subcategoryId ?? '',
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
        shareConfirmation: t.isShared ? summarizeShareConfirmation(sharesByTx.get(t.id) ?? []) : '',
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

// DEC-110: iOS standalone PWAs ignore `a.download` and navigate the webview
// to the blob URL — revoking it synchronously used to brick the app. Prefer
// the native share sheet on mobile; fall back to an anchor that opens a new
// context and only revoke after the navigation had time to complete.
export async function downloadFile(content: string, filename: string, mimeType: string): Promise<void> {
  const blob = new Blob([content], { type: mimeType });

  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    const file = new File([blob], filename, { type: mimeType });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return;
      } catch (err) {
        // User cancelled the share sheet — not an error, nothing to download.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // Any other failure falls through to the anchor path.
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Deferred revoke: browsers without `download` support need the blob URL
  // alive while the new tab/viewer loads it.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
