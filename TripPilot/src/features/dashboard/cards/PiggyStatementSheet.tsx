import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { formatMoney } from '@/domain/money';
import { formatShortDate } from '@/domain/dates';
import type { PiggyLedger, PiggyLedgerEntry } from '@/domain/budget';

export interface PiggyWithdrawOffer {
  availableCents: number;
  commonUpliftCents: number;
  peakUpliftCents: number;
  hasPeakDay: boolean;
  onWithdraw: () => void;
}

interface PiggyStatementSheetProps {
  open: boolean;
  onClose: () => void;
  ledger: PiggyLedger | null;
  currency: string;
  /** DEC-464: today's entry is provisional — tagged "simulado" until close. */
  todayIso: string;
  /** DEC-464: the SETTLED balance (closed days only) — what the card shows. */
  settledBalanceCents: number;
  /** DEC-465: resgate offer (null when there is nothing to withdraw). */
  withdrawOffer: PiggyWithdrawOffer | null;
}

/**
 * FB-08 · DEC-279 (council C14) — the cofrinho's "voice" + statement. The user
 * could not tell what the piggy was or why it moved ("ele some, é volátil");
 * this gives it a plain explanation plus a day-by-day extract derived purely
 * from the buffer ledger: where each cent came from (a day you spent under your
 * rhythm) and where it went (a day you went over).
 *
 * DEC-464 (INV-5): EVERY elapsed day is listed — flat days included — so the
 * extract never "skips" dates; today is rendered apart as a simulation. The
 * SALDO stat is the settled (closed-days) balance the Home card shows.
 * DEC-465: an explicit resgate returns parked money to the daily flow.
 */
export function PiggyStatementSheet({
  open,
  onClose,
  ledger,
  currency,
  todayIso,
  settledBalanceCents,
  withdrawOffer,
}: PiggyStatementSheetProps) {
  const { t } = useTranslation();
  const money = (cents: number): string => formatMoney(cents, currency);

  // Most-recent first, no day skipped (INV-5: hidden flat days read as "the
  // piggy lost my day"). Today floats on top with its "simulado" tag.
  const movements = [...(ledger?.entries ?? [])].reverse();
  const totalManualCents = ledger?.totalManualWithdrawnCents ?? 0;

  return (
    <BottomSheet open={open} onClose={onClose} title={t('dashboard.piggy_statement_title')}>
      <p className="text-[13px] leading-relaxed text-on-surface-dim mt-1">
        {t('dashboard.piggy_voice')}
      </p>
      {/* C10/DEC-300: spell out the three states so the balance is never read as
          spendable cash — já guardado (closed days) vs será guardado (today, at
          close) vs simulado (a forecast). */}
      <p className="text-[11px] leading-relaxed text-on-surface-faint mt-2">
        {t('dashboard.piggy_states_hint')}
      </p>

      <div className="grid grid-cols-3 gap-2 mt-4">
        <StatBox label={t('dashboard.piggy_deposited')} value={money(ledger?.totalDepositedCents ?? 0)} tone="text-success" />
        <StatBox label={t('dashboard.piggy_withdrawn')} value={money(ledger?.totalWithdrawnCents ?? 0)} tone="text-on-surface" />
        <StatBox label={t('dashboard.piggy_balance')} value={money(settledBalanceCents)} tone="text-success" />
      </div>
      {totalManualCents > 0 && (
        <p className="text-[11px] font-semibold text-on-surface-dim mt-2">
          {t('dashboard.piggy_manual_total', { amount: money(totalManualCents) })}
        </p>
      )}

      {withdrawOffer !== null && withdrawOffer.availableCents > 0 && (
        <div className="mt-4 p-3 rounded-xl" style={{ background: '#6B8F7112', border: '1px solid #6B8F7118' }}>
          <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-faint">
            {t('dashboard.piggy_withdraw_title')}
          </p>
          <p className="text-[11px] leading-relaxed text-on-surface-dim mt-1">
            {withdrawOffer.hasPeakDay
              ? t('dashboard.piggy_withdraw_hint', {
                  common: money(withdrawOffer.commonUpliftCents),
                  peak: money(withdrawOffer.peakUpliftCents),
                })
              : t('dashboard.piggy_withdraw_hint_nopeak', {
                  common: money(withdrawOffer.commonUpliftCents),
                })}
          </p>
          <button
            type="button"
            onClick={withdrawOffer.onWithdraw}
            className="mt-2.5 w-full py-2.5 rounded-xl text-[13px] font-extrabold text-white btn-press"
            style={{ background: 'var(--success, #6B8F71)' }}
          >
            {t('dashboard.piggy_withdraw_button', { amount: money(withdrawOffer.availableCents) })}
          </button>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {movements.length === 0 ? (
          <p className="text-[13px] text-on-surface-faint py-6 text-center">
            {t('dashboard.piggy_empty_statement')}
          </p>
        ) : (
          movements.map((entry) => (
            <MovementRow
              key={entry.dateIso}
              entry={entry}
              isToday={entry.dateIso === todayIso}
              money={money}
            />
          ))
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-on-surface-faint mt-3">
        {t('dashboard.piggy_uncovered_hint')}
      </p>
    </BottomSheet>
  );
}

function MovementRow({
  entry,
  isToday,
  money,
}: {
  entry: PiggyLedgerEntry;
  isToday: boolean;
  money: (cents: number) => string;
}) {
  const { t } = useTranslation();
  const isDeposit = entry.kind === 'deposit';
  const isFlat = entry.kind === 'flat';
  const overCents = Math.max(0, entry.spentCents - entry.idealCents);
  const underRhythm = entry.spentCents <= entry.idealCents;

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl bg-surface-container-high${isToday ? ' opacity-80' : ''}`}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isDeposit ? 'bg-success/15' : isFlat ? 'bg-surface-container-highest' : 'bg-error/10'
        }`}
      >
        <Icon
          name={isDeposit ? 'arrow_downward' : isFlat ? 'remove' : 'arrow_upward'}
          size={16}
          className={isDeposit ? 'text-success' : isFlat ? 'text-on-surface-faint' : 'text-error'}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-on-surface">
          {formatShortDate(entry.dateIso)}
          {isToday && (
            <span className="ml-1.5 text-[9px] font-bold tracking-wide uppercase text-primary">
              {t('dashboard.piggy_today_chip')}
            </span>
          )}
        </p>
        <p className="text-[11px] text-on-surface-faint">
          {underRhythm
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
        {entry.manualCents > 0 && (
          <p className="text-[11px] font-semibold text-primary">
            {t('dashboard.piggy_entry_manual')} · −{money(entry.manualCents)}
          </p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <p
          className={`text-[13px] font-extrabold tabular ${
            isDeposit ? 'text-success' : isFlat ? 'text-on-surface-faint' : 'text-error'
          }`}
        >
          {isFlat ? '' : isDeposit ? '+' : '\u2212'}
          {money(Math.abs(entry.deltaCents))}
        </p>
        <p className="text-[10px] text-on-surface-faint tabular">{money(entry.balanceCents)}</p>
      </div>
    </div>
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
