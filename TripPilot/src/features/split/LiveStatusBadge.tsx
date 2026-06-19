import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { liveConnState, type LiveConnState } from './live-status';

/**
 * L2 — the honest live-connection badge shared by the owner card and the guest
 * page. It is self-contained: given the raw socket flag + the epoch ms of the
 * last successful pull, it ticks its own clock and derives the truthful
 * {@link LiveConnState} (green=live, amber=syncing, red=offline) plus an
 * "updated Xs ago" hint. Both sides render the SAME computed truth — there is
 * no static "synced" anywhere.
 */
const STYLES: Record<LiveConnState, { dot: string; text: string; pulse: boolean }> = {
  live: { dot: 'bg-success', text: 'text-success', pulse: true },
  syncing: { dot: 'bg-warning', text: 'text-warning', pulse: true },
  offline: { dot: 'bg-error', text: 'text-error', pulse: false },
};

const LABEL_KEY: Record<LiveConnState, string> = {
  live: 'splitTable.conn_live',
  syncing: 'splitTable.conn_syncing',
  offline: 'splitTable.conn_offline',
};

const TICK_MS = 3000;

export function LiveStatusBadge({
  socketOpen,
  lastSyncAt,
  onReconnect,
}: {
  socketOpen: boolean;
  lastSyncAt: number | null;
  onReconnect?: () => void;
}) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  // Self-tick so freshness ("updated Xs ago") and the derived state stay
  // truthful between pulls without any extra network traffic.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const state = liveConnState({ socketOpen, lastSyncAt, now });
  const style = STYLES[state];
  const agoSecs = lastSyncAt === null ? null : Math.max(0, Math.round((now - lastSyncAt) / 1000));
  const sub =
    state === 'offline' || agoSecs === null
      ? null
      : agoSecs < 1
        ? t('splitTable.updated_now')
        : t('splitTable.updated_ago', { secs: agoSecs });

  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold">
      <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot} ${style.pulse ? 'animate-pulse' : ''}`} />
      <span className={style.text}>{t(LABEL_KEY[state])}</span>
      {sub ? <span className="text-on-surface-faint font-normal">· {sub}</span> : null}
      {state === 'offline' && onReconnect ? (
        <button onClick={onReconnect} className="text-primary font-bold btn-press ml-1">
          {t('splitTable.reconnect')}
        </button>
      ) : null}
    </div>
  );
}
