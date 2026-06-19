import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '@/domain/money';
import { useActiveSplit } from '@/features/split/useActiveSplit';

/**
 * The split counterpart of {@link ActiveOutingBar}: while a bill division is
 * live, this floating chip persists across the main tabs so the "saída de bar"
 * is never invisible once you leave the table — tapping it returns to the
 * division. It uses the indigo "split" accent (vs the outing's orange) and sits
 * bottom-LEFT so the two chips never overlap. Hidden on the dashboard (a
 * dedicated card lives there) and on the split editor itself.
 */
export function ActiveSplitBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const split = useActiveSplit();

  if (!split) return null;
  if (location.pathname === '/dashboard' || location.pathname.startsWith('/split')) return null;

  return (
    <button
      type="button"
      onClick={() => navigate('/split/scan')}
      className="fixed bottom-[92px] left-3 z-30 flex items-center gap-2 rounded-full pl-3 pr-4 py-2 btn-press"
      style={{ background: '#6366F1', boxShadow: '0 6px 18px #6366F155' }}
      aria-label={t('splitTable.resume_active')}
    >
      <span className="relative flex h-2.5 w-2.5">
        <span
          className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
          style={{ background: '#ffffff' }}
        />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: '#ffffff' }} />
      </span>
      <span className="text-xs font-bold max-w-[34vw] truncate" style={{ color: '#ffffff' }}>
        {split.name || t('splitTable.live_on')}
      </span>
      <span className="text-xs font-extrabold tabular" style={{ color: '#ffffff' }}>
        {formatMoney(split.totalCents, split.currency)}
      </span>
    </button>
  );
}
