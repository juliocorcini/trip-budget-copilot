import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MirroredStatement } from '@/domain/types/mirrored-statement';
import { mirroredStatementRepository } from '@/data/repositories';
import { answerMirroredStatementLine } from '@/domain/orchestrators';
import { formatMoney } from '@/domain/money';
import { formatShortDate } from '@/domain/dates';
import { findSubcategory } from '@/domain/outing';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { showToast } from '@/components/Toast';

/**
 * DEC-106 mirror side (P2P-13): read-only statements received from paired
 * owner devices. Pending lines can be confirmed/rejected — answers queue in
 * pendingResponses and flush on the next session with that peer. The
 * received-at timestamp is ALWAYS visible (council HIGH risk).
 */
export function MirroredStatementsSection() {
  const { t } = useTranslation();
  const [statements, setStatements] = useState<MirroredStatement[]>([]);
  const [target, setTarget] = useState<MirroredStatement | null>(null);

  const load = async () => {
    const all = await mirroredStatementRepository.getAll();
    setStatements(all.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)));
  };

  useEffect(() => {
    void load();
  }, []);

  const handleAnswer = async (shareId: string, status: 'confirmed' | 'rejected') => {
    if (!target) return;
    const updated = await answerMirroredStatementLine(target.id, shareId, status);
    if (updated) {
      setTarget(updated);
      showToast(t('sync.responses_queued'), 'success');
      await load();
    }
  };

  if (statements.length === 0) return null;

  const netLabel = (statement: MirroredStatement): { text: string; tone: string } => {
    if (statement.netCents < 0) {
      return {
        text: t('sync.net_you_owe', {
          amount: formatMoney(Math.abs(statement.netCents), statement.currency),
        }),
        tone: 'text-error',
      };
    }
    if (statement.netCents > 0) {
      return {
        text: t('sync.net_owes_you', {
          amount: formatMoney(statement.netCents, statement.currency),
        }),
        tone: 'text-success',
      };
    }
    return { text: t('sync.net_settled'), tone: 'text-on-surface-faint' };
  };

  const lineLabel = (line: MirroredStatement['lines'][number]): string => {
    const sub = findSubcategory(line.subcategoryId);
    if (sub) return t(sub.labelKey as never);
    if (line.description) return line.description;
    if (line.category) return t(`categories.${line.category}` as never);
    return t('shared.statement_unnamed');
  };

  const statusStyle: Record<string, string> = {
    pending: 'bg-warning/15 text-warning',
    confirmed: 'bg-success/20 text-success',
    rejected: 'bg-error/15 text-error',
  };

  return (
    <div>
      <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
        {t('sync.received_statements')}
      </p>
      {statements.map((statement) => {
        const net = netLabel(statement);
        return (
          <button
            key={statement.id}
            onClick={() => setTarget(statement)}
            className="bg-surface-container rounded-xl px-4 py-3 mb-1 flex items-center gap-3 w-full text-left btn-press"
          >
            <Icon name="sync_alt" size={20} className="text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-on-surface truncate">{statement.peerName}</p>
              <p className="text-[10px] text-on-surface-faint">
                {t('sync.received_at', { date: formatShortDate(statement.receivedAt) })}
              </p>
            </div>
            <p className={`text-xs font-semibold tabular shrink-0 ${net.tone}`}>{net.text}</p>
            <Icon name="chevron_right" size={16} className="text-on-surface-faint shrink-0" />
          </button>
        );
      })}

      <BottomSheet
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target?.peerName ?? ''}
      >
        {target && (
          <div className="flex flex-col gap-3">
            <p className={`text-lg font-extrabold tabular ${netLabel(target).tone}`}>
              {netLabel(target).text}
            </p>
            {/* Timestamp always visible — a mirrored statement without a date breeds distrust */}
            <p className="text-[10px] text-on-surface-faint -mt-2">
              {t('sync.received_at', { date: formatShortDate(target.receivedAt) })}
            </p>

            {target.lines.length === 0 && (
              <p className="text-sm text-on-surface-dim">{t('shared.statement_empty')}</p>
            )}

            <div className="flex flex-col gap-1.5 max-h-[45vh] overflow-y-auto no-scrollbar">
              {target.lines.map((line) => (
                <div key={line.shareId} className="bg-surface-high rounded-xl px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-on-surface truncate">{lineLabel(line)}</p>
                    <p
                      className={`text-xs font-bold tabular shrink-0 ${
                        line.kind === 'owes' ? 'text-error' : 'text-success'
                      }`}
                    >
                      {line.kind === 'owes' ? '−' : '+'}
                      {formatMoney(line.amountCents, target.currency)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="text-[10px] text-on-surface-faint truncate">
                      {formatShortDate(line.occurredAt)} ·{' '}
                      {line.kind === 'owes'
                        ? t('shared.statement_paid_by', { name: line.counterpartyName })
                        : t('shared.statement_owes_you', { name: line.counterpartyName })}
                    </p>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${statusStyle[line.confirmationStatus]}`}
                    >
                      {t(`shared.status_${line.confirmationStatus}` as never)}
                    </span>
                  </div>
                  {line.confirmationStatus === 'pending' && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleAnswer(line.shareId, 'confirmed')}
                        className="flex-1 py-1.5 rounded-lg bg-success/20 text-success text-xs font-medium btn-press"
                      >
                        {t('common.confirm')}
                      </button>
                      <button
                        onClick={() => handleAnswer(line.shareId, 'rejected')}
                        className="flex-1 py-1.5 rounded-lg bg-error/15 text-error text-xs font-medium btn-press"
                      >
                        {t('sync.reject')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {target.pendingResponses.length > 0 && (
              <p className="text-[10px] text-on-surface-faint">{t('sync.responses_queued')}</p>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
