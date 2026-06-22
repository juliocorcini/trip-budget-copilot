import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { formatMoney } from '@/domain/money';
import { formatShortDate } from '@/domain/dates';
import type { PiggyLedger } from '@/domain/budget';

interface PiggyStatementSheetProps {
  open: boolean;
  onClose: () => void;
  ledger: PiggyLedger | null;
  currency: string;
}

/**
 * FB-08 · DEC-279 (council C14) — the cofrinho's "voice" + statement. The user
 * could not tell what the piggy was or why it moved ("ele some, é volátil");
 * this gives it a plain explanation plus a day-by-day extract derived purely
 * from the buffer ledger: where each cent came from (a day you spent under your
 * rhythm) and where it went (a day you went over). Read-only (ÂNCORA 11).
 */
export function PiggyStatementSheet({ open, onClose, ledger, currency }: PiggyStatementSheetProps) {
  const { t } = useTranslation();
  const money = (cents: number): string => formatMoney(cents, currency);

  // Most-recent first; only days that actually moved the piggy (skip flat days,
  // which are pure noise in a statement).
  const movements = (ledger?.entries ?? []).filter((entry) => entry.kind !== 'flat').reverse();

  return (
    <BottomSheet open={open} onClose={onClose} title={t('dashboard.piggy_statement_title')}>
      <p className="text-[13px] leading-relaxed text-on-surface-dim mt-1">
        {t('dashboard.piggy_voice')}
      </p>

      <div className="grid grid-cols-3 gap-2 mt-4">
        <StatBox label={t('dashboard.piggy_deposited')} value={money(ledger?.totalDepositedCents ?? 0)} tone="text-success" />
        <StatBox label={t('dashboard.piggy_withdrawn')} value={money(ledger?.totalWithdrawnCents ?? 0)} tone="text-on-surface" />
        <StatBox label={t('dashboard.piggy_balance')} value={money(ledger?.balanceCents ?? 0)} tone="text-success" />
      </div>

      <div className="mt-4 space-y-2">
        {movements.length === 0 ? (
          <p className="text-[13px] text-on-surface-faint py-6 text-center">
            {t('dashboard.piggy_empty_statement')}
          </p>
        ) : (
          movements.map((entry) => {
            const isDeposit = entry.kind === 'deposit';
            const overCents = Math.max(0, entry.spentCents - entry.idealCents);
            return (
              <div
                key={entry.dateIso}
                className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-high"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isDeposit ? 'bg-success/15' : 'bg-error/10'
                  }`}
                >
                  <Icon
                    name={isDeposit ? 'arrow_downward' : 'arrow_upward'}
                    size={16}
                    className={isDeposit ? 'text-success' : 'text-error'}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-on-surface">{formatShortDate(entry.dateIso)}</p>
                  <p className="text-[11px] text-on-surface-faint">
                    {isDeposit
                      ? t('dashboard.piggy_entry_deposit_desc', {
                          spent: money(entry.spentCents),
                          ideal: money(entry.idealCents),
                        })
                      : t('dashboard.piggy_entry_withdrawal_desc', {
                          spent: money(entry.spentCents),
                          over: money(overCents),
                        })}
                    {entry.uncoveredCents > 0 &&
                      ` · ${t('dashboard.piggy_uncovered', { amount: money(entry.uncoveredCents) })}`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p
                    className={`text-[13px] font-extrabold tabular ${
                      isDeposit ? 'text-success' : 'text-error'
                    }`}
                  >
                    {isDeposit ? '+' : '\u2212'}
                    {money(Math.abs(entry.deltaCents))}
                  </p>
                  <p className="text-[10px] text-on-surface-faint tabular">{money(entry.balanceCents)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </BottomSheet>
  );
}

function StatBox({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="p-2.5 rounded-xl bg-surface-container-high text-center">
      <p className="text-[9px] font-bold tracking-wide uppercase text-on-surface-faint">{label}</p>
      <p className={`text-[13px] font-extrabold tabular mt-0.5 ${tone}`}>{value}</p>
    </div>
  );
}
