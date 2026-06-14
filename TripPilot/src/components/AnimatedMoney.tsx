import { formatMoney } from '@/domain/money';
import { useCountUp } from '@/hooks/useCountUp';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

interface AnimatedMoneyProps {
  cents: number;
  currency: string;
  className?: string;
}

/**
 * Council ("money responds"): a money figure that tweens to its new value when
 * it changes in place — so a balance/total/saving visibly reacts to an action
 * instead of swapping silently. No intro animation on mount; snaps instantly
 * under prefers-reduced-motion. Read-only: animates only the display of an
 * already-correct number.
 */
export function AnimatedMoney({ cents, currency, className }: AnimatedMoneyProps) {
  const reducedMotion = usePrefersReducedMotion();
  const value = useCountUp(cents, !reducedMotion);
  return <span className={className}>{formatMoney(value, currency)}</span>;
}
