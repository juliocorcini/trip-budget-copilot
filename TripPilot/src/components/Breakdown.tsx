import { formatMoney } from '@/domain/money';
import { BottomSheet } from '@/components/BottomSheet';

export type BreakdownRowKind = 'base' | 'subtract' | 'add';

export interface BreakdownItem {
  /** Already-translated label for the line. */
  label: string;
  /** Non-negative magnitude; the sign is implied by `kind`. */
  cents: number;
  kind: BreakdownRowKind;
}

interface BreakdownRowsProps {
  items: BreakdownItem[];
  totalLabel: string;
  /** Signed total — rendered as-is (may be negative). */
  totalCents: number;
  currency: string;
  /** `auto` → success when ≥ 0, error when negative. */
  totalAccent?: 'auto' | 'success' | 'neutral' | 'error';
  /** Optional footnote under the total (e.g. a reserved-amount caveat). */
  note?: string;
}

const ACCENT_COLOR: Record<'success' | 'neutral' | 'error', string> = {
  success: 'var(--success)',
  neutral: 'var(--on-surface)',
  error: 'var(--error)',
};

function resolveAccent(
  accent: BreakdownRowsProps['totalAccent'],
  totalCents: number,
): string {
  if (accent === 'success' || accent === 'neutral' || accent === 'error') {
    return ACCENT_COLOR[accent];
  }
  return totalCents < 0 ? ACCENT_COLOR.error : ACCENT_COLOR.success;
}

/**
 * DEC-172: the "where this number comes from" rows, extracted from the Dashboard
 * hero so the same honest arithmetic can explain any derived figure (fund
 * balance, planner margin, …). Purely presentational — each line is a magnitude
 * plus a `kind` that carries the sign, and the total is rendered signed so an
 * over-allocation shows as a real negative instead of a hidden zero.
 */
export function BreakdownRows({
  items,
  totalLabel,
  totalCents,
  currency,
  totalAccent = 'auto',
  note,
}: BreakdownRowsProps) {
  return (
    <div className="flex flex-col gap-1">
      {items.map((item, index) => {
        const isSubtract = item.kind === 'subtract';
        const prefix = isSubtract ? '\u2212 ' : item.kind === 'add' ? '+ ' : '';
        return (
          <div key={`${item.label}-${index}`} className="flex items-baseline justify-between py-1">
            <span className="text-sm font-semibold text-on-surface-dim">{item.label}</span>
            <span
              className={`text-sm font-bold tabular ${
                isSubtract ? 'text-on-surface-faint' : 'text-on-surface'
              }`}
            >
              {prefix}
              {formatMoney(item.cents, currency)}
            </span>
          </div>
        );
      })}
      <div className="flex items-baseline justify-between pt-3 mt-1 border-t border-[var(--border-faint)]">
        <span className="text-sm font-bold text-on-surface">{totalLabel}</span>
        <span
          className="text-base font-extrabold tabular"
          style={{ color: resolveAccent(totalAccent, totalCents) }}
        >
          {formatMoney(totalCents, currency)}
        </span>
      </div>
      {note && <p className="text-[11px] text-on-surface-faint mt-2 leading-relaxed">{note}</p>}
    </div>
  );
}

interface BreakdownSheetProps extends BreakdownRowsProps {
  open: boolean;
  onClose: () => void;
  title: string;
  intro?: string;
}

/** Convenience wrapper: the same rows inside a titled bottom sheet. */
export function BreakdownSheet({ open, onClose, title, intro, ...rows }: BreakdownSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col">
        {intro && <p className="text-xs text-on-surface-dim mb-2">{intro}</p>}
        <BreakdownRows {...rows} />
      </div>
    </BottomSheet>
  );
}
