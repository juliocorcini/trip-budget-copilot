import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { acquireScreenWakeLock, releaseScreenWakeLock } from '@/utils/wake-lock';

/**
 * DEC-127: Bar Mode — fullscreen, OLED-black, glanceable from a meter away.
 * One giant total + giant quick-add buttons; everything else stays in the
 * normal session screen. Quick-adds here get an undo toast instead of the
 * enrichment stepper (dark bar + big buttons = fat-finger territory).
 */

interface BarModeViewProps {
  sessionName: string;
  elapsed: string;
  totalLabel: string;
  /** Pre-formatted total ("€37" style, same formatter as the session). */
  totalDisplay: string;
  /** Zone-colored status line ("Faltam €23 para a meta"). */
  statusLine: string;
  statusColor: string;
  /** "≈ 3 drinks até a meta" — null hides the line. */
  drinksLine: string | null;
  /** DEC-128 anchor ("≈ R$ 230") — null hides the line. */
  anchorHint: string | null;
  quickValuesCents: number[];
  highlightIndex: number;
  formatValue: (cents: number) => string;
  onQuickAdd: (cents: number) => void;
  onExit: () => void;
}

export function BarModeView({
  sessionName,
  elapsed,
  totalLabel,
  totalDisplay,
  statusLine,
  statusColor,
  drinksLine,
  anchorHint,
  quickValuesCents,
  highlightIndex,
  formatValue,
  onQuickAdd,
  onExit,
}: BarModeViewProps) {
  const { t } = useTranslation();

  // Keep the screen on for the whole bar session; re-acquire when the tab
  // comes back (the OS silently drops wake locks on visibility loss).
  useEffect(() => {
    void acquireScreenWakeLock();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquireScreenWakeLock();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void releaseScreenWakeLock();
    };
  }, []);

  const gridValues = quickValuesCents.slice(0, 4);

  return createPortal(
    <div className="fixed inset-0 z-[55]" style={{ background: '#000000' }}>
      <div className="max-w-[430px] mx-auto h-full flex flex-col px-6 pt-[calc(env(safe-area-inset-top)+20px)] pb-[calc(env(safe-area-inset-bottom)+24px)]">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] tracking-[0.18em] uppercase font-bold" style={{ color: '#C75B39' }}>
              {t('outing.bar_mode_label')}
            </p>
            <p className="text-sm font-bold truncate" style={{ color: '#FFFFFFCC' }}>
              {sessionName} · {elapsed}
            </p>
          </div>
          <button
            onClick={onExit}
            className="btn-press w-11 h-11 rounded-full flex items-center justify-center shrink-0"
            style={{ background: '#FFFFFF14' }}
            aria-label={t('outing.bar_mode_exit')}
          >
            <Icon name="close" size={22} style={{ color: '#FFFFFFCC' }} />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: '#FFFFFF66' }}>
            {totalLabel}
          </p>
          <p
            key={totalDisplay}
            className="font-extrabold tracking-tighter leading-none tabular mt-2"
            style={{ color: '#FFFFFF', fontSize: 'min(88px, 22vw)', animation: 'barmode-pop 0.25s ease-out' }}
          >
            {totalDisplay}
          </p>
          <p className="text-base font-bold mt-4" style={{ color: statusColor }}>
            {statusLine}
          </p>
          {drinksLine && (
            <p className="text-sm font-semibold mt-1.5" style={{ color: '#FFFFFF80' }}>
              {drinksLine}
            </p>
          )}
          {anchorHint && (
            <p className="text-sm font-semibold mt-1.5 tabular" style={{ color: '#FFFFFF59' }}>
              {anchorHint}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {gridValues.map((valueCents, i) => {
            const highlighted = i === highlightIndex;
            return (
              <button
                key={`${valueCents}-${i}`}
                onClick={() => onQuickAdd(valueCents)}
                className="btn-press h-24 rounded-3xl font-extrabold text-3xl tabular"
                style={
                  highlighted
                    ? { background: '#C75B3926', border: '1.5px solid #C75B39', color: '#FFFFFF' }
                    : { background: '#FFFFFF0F', border: '1px solid #FFFFFF1A', color: '#FFFFFFE6' }
                }
              >
                +{formatValue(valueCents)}
              </button>
            );
          })}
        </div>
        <p className="text-center text-[11px] font-semibold mt-4" style={{ color: '#FFFFFF40' }}>
          {t('outing.bar_mode_hint')}
        </p>
      </div>
      <style>{`
        @keyframes barmode-pop { from { transform: scale(1.06); } to { transform: scale(1); } }
      `}</style>
    </div>,
    document.body,
  );
}
