import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/Icon';

/**
 * M04 (escopo C1): the home's anchor number answers "how much is free?"; this
 * shortcut answers the next question — "can I spend ___?". It opens the
 * Simulator already primed with the free amount as a concrete starting point
 * (never empty — see Council C1 Critic), which the user edits to their real
 * amount. No new "free" number is introduced (the rule is one per screen); this
 * is purely the path from the existing number to a decision.
 *
 * D10 · DEC-316: kept, but COMPACT — a discreet pill right under "free today"
 * (the natural next question to the anchor number), never a tall card that
 * competes with it.
 */
export function AskToSpendShortcut({ prefillCents }: { prefillCents?: number | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const open = () => {
    const major =
      prefillCents && prefillCents > 0 ? (prefillCents / 100).toFixed(2) : null;
    navigate(major ? `/simulator?amount=${encodeURIComponent(major)}` : '/simulator');
  };

  return (
    <button
      onClick={open}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full btn-press"
      style={{ background: 'var(--surface-container)', border: '1px solid var(--border-faint)' }}
    >
      <Icon name="calculate" size={15} className="text-primary" />
      <span className="text-xs font-semibold text-on-surface-dim">
        {t('dashboard.ask_to_spend')}
      </span>
    </button>
  );
}
