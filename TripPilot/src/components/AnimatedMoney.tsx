import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '@/domain/money';
import { useCountUp } from '@/hooks/useCountUp';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

interface AnimatedMoneyProps {
  cents: number;
  currency: string;
  className?: string;
  /**
   * DEC-194: briefly pop the figure when it changes in place (e.g. a drink
   * added bumps the live total). Only fires on a real change while mounted —
   * never on mount or on a route remount — so it stays a deliberate "reacted to
   * your action" cue, not decoration.
   */
  pulseOnChange?: boolean;
}

/**
 * Council ("money responds"): a money figure that tweens to its new value when
 * it changes in place — so a balance/total/saving visibly reacts to an action
 * instead of swapping silently. No intro animation on mount; snaps instantly
 * under prefers-reduced-motion. Read-only: animates only the display of an
 * already-correct number.
 */
export function AnimatedMoney({ cents, currency, className, pulseOnChange = false }: AnimatedMoneyProps) {
  const reducedMotion = usePrefersReducedMotion();
  const value = useCountUp(cents, !reducedMotion);
  const prev = useRef(cents);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (cents === prev.current) return;
    prev.current = cents;
    if (!pulseOnChange || reducedMotion) return;
    setPulsing(true);
    const timer = window.setTimeout(() => setPulsing(false), 320);
    return () => window.clearTimeout(timer);
  }, [cents, pulseOnChange, reducedMotion]);

  // Stable inline-block when pulsing is possible, so toggling the animation
  // never reflows the baseline.
  const classes = [className, pulseOnChange ? 'inline-block' : '', pulsing ? 'money-pulse' : '']
    .filter(Boolean)
    .join(' ');
  return <span className={classes || undefined}>{formatMoney(value, currency)}</span>;
}
