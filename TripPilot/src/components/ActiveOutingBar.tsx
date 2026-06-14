import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAppData, APP_DATA_CHANGED_EVENT } from '@/hooks/useAppData';
import { sessionRepository } from '@/data/repositories/session-repository';
import { calculateSessionTotal } from '@/domain/outing';
import { formatMoney } from '@/domain/money';
import type { Session } from '@/domain/types/session';

/**
 * Council (Connector, "Spotify now-playing"): an active outing used to be
 * invisible once you left its screen — you could forget a session was running.
 * This floating chip persists across the main tabs while a session is active,
 * showing its live total and returning to it on tap. It only renders inside the
 * AppShell (main browsing tabs), never on the outing screen itself, and sits
 * clear of the centered FAB to avoid overlap.
 */
export function ActiveOutingBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { trip, transactions } = useAppData();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!trip) {
      setSession(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const active = await sessionRepository.getActive(trip.id);
      if (!cancelled) setSession(active ?? null);
    };
    load();
    // Refresh when a session starts/ends elsewhere (mutations announce here).
    window.addEventListener(APP_DATA_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(APP_DATA_CHANGED_EVENT, load);
    };
    // `transactions` re-runs the check after each data refresh (start/end/log).
  }, [trip, transactions]);

  // The dashboard already shows a dedicated active-outing card — the chip would
  // just duplicate it there. It earns its place on every OTHER tab.
  if (!trip || !session || location.pathname === '/dashboard') return null;

  const sessionTxs = transactions.filter((tx) => tx.sessionId === session.id);
  const totalCents = calculateSessionTotal(sessionTxs);

  return (
    <button
      type="button"
      onClick={() => navigate('/outings/active')}
      className="fixed bottom-[92px] right-3 z-30 flex items-center gap-2 rounded-full pl-3 pr-4 py-2 btn-press"
      style={{ background: 'var(--primary)', boxShadow: '0 6px 18px #C75B3955' }}
      aria-label={t('outing.resume_active')}
    >
      <span className="relative flex h-2.5 w-2.5">
        <span
          className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
          style={{ background: 'var(--surface)' }}
        />
        <span
          className="relative inline-flex h-2.5 w-2.5 rounded-full"
          style={{ background: 'var(--surface)' }}
        />
      </span>
      <span
        className="text-xs font-bold max-w-[38vw] truncate"
        style={{ color: 'var(--surface)' }}
      >
        {session.name}
      </span>
      <span className="text-xs font-extrabold tabular" style={{ color: 'var(--surface)' }}>
        {formatMoney(totalCents, trip.baseCurrency)}
      </span>
    </button>
  );
}
