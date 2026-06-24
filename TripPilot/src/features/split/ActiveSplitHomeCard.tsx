import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { formatMoney } from '@/domain/money';
import { useActiveSplit } from './useActiveSplit';

/**
 * The home-screen card for a live bill division — the split sibling of the
 * active-outing card. Like a "saída de bar" you can walk back into, it surfaces
 * the running table (name, total, who is at it) at the top of the dashboard and
 * returns to the table on tap. Renders nothing when no division is live.
 */
export function ActiveSplitHomeCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const split = useActiveSplit();

  if (!split) return null;

  const peopleLine =
    split.guestCount > 0
      ? t('splitTable.guests_joined', { count: split.guestCount })
      : t('splitTable.waiting_guests');

  return (
    <button
      onClick={() => navigate('/split/scan')}
      aria-label={t('splitTable.resume_active')}
      className="w-full mt-4 p-4 rounded-2xl flex items-center gap-4 btn-press text-left"
      style={{ background: 'var(--surface-deep)', border: '1px solid var(--ai-border)' }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 relative"
        style={{ background: 'var(--ai-bg)' }}
      >
        <Icon name="splitscreen" size={24} filled className="text-[var(--ai-2)]" />
        <span className="absolute top-0 right-0 flex h-2.5 w-2.5">
          <span
            className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
            style={{ background: 'var(--ai)' }}
          />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: 'var(--ai)' }} />
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-[var(--ai-2)]">
          {t('splitTable.live_on')}
        </p>
        <p className="text-base font-extrabold mt-0.5 text-on-surface truncate">
          {split.name || t('split.default_name')}
        </p>
        <p className="text-xs font-semibold mt-0.5 text-on-surface-dim">
          {formatMoney(split.totalCents, split.currency)} · {peopleLine}
        </p>
      </div>
      <span
        className="px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0"
        style={{ background: 'var(--ai)', color: '#ffffff' }}
      >
        {t('splitTable.resume_open')}
      </span>
    </button>
  );
}
