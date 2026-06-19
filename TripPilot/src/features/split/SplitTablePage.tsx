import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useLocation, useNavigate } from 'react-router';
import { parseShareKeyFromHash } from '@/domain/sync';
import {
  buildSplitClaimResponse,
  computeSplitTotals,
  reduceGuestClaims,
  type SplitSharePayload,
} from '@/domain/split';
import { connectShareSignal, type ShareSignalHandle } from '@/data/sync/share-signal';
import { formatMoney } from '@/domain/money';
import { getCategoryIcon } from '@/utils/category-icons';
import { Icon } from '@/components/Icon';
import {
  fetchSplitTable,
  postSplitClaim,
  getGuestActorId,
  getGuestName,
  setGuestName,
  type FetchTableStatus,
} from './live-link';

const POLL_FLOOR_MS = 6000;
const POST_DEBOUNCE_MS = 500;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; status: FetchTableStatus }
  | { kind: 'live'; payload: SplitSharePayload };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * G2 — the guest live table (`/t/:id#k=<key>`). Lives OUTSIDE BootGate so a
 * guest with no trip is never bounced to onboarding. The guest taps the items
 * that are theirs; their claim snapshot is encrypted and posted to the owner,
 * whose device is the single source of truth (owner-reducer). The owner's edits
 * flow back here via `upd` pings + the poll floor, so the table stays live both
 * ways without this device ever holding the financial truth.
 */
export function SplitTablePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const location = useLocation();

  const id = params.id ?? null;
  const key = useMemo(() => parseShareKeyFromHash(location.hash), [location.hash]);
  const actorId = useMemo(() => getGuestActorId(), []);

  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [name, setName] = useState(() => getGuestName() ?? '');
  const [named, setNamed] = useState(() => getGuestName() !== null);
  const [mine, setMine] = useState<Set<string>>(new Set());

  const signalRef = useRef<ShareSignalHandle | null>(null);
  const seededRef = useRef(false);
  const hasPayloadRef = useRef(false);

  const seedMine = useCallback(
    (payload: SplitSharePayload) => {
      const me = payload.session.participants.find((p) => p.actorId === actorId);
      if (!me) return;
      const claimed = payload.session.items
        .filter((item) => item.claims.some((c) => c.participantId === me.id))
        .map((item) => item.id);
      if (claimed.length > 0) setMine(new Set(claimed));
    },
    [actorId],
  );

  const refetch = useCallback(async () => {
    if (!id || !key) {
      setLoad({ kind: 'error', status: 'bad_key' });
      return;
    }
    const res = await fetchSplitTable(id, key);
    if (res.status === 'ok') {
      if (!seededRef.current) {
        seedMine(res.payload);
        seededRef.current = true;
      }
      hasPayloadRef.current = true;
      setLoad({ kind: 'live', payload: res.payload });
      return;
    }
    // A wrong key / revoked / gone link is terminal; a transient network blip
    // keeps the last good table on screen.
    if (res.status === 'error' && hasPayloadRef.current) return;
    setLoad({ kind: 'error', status: res.status });
  }, [id, key, seedMine]);

  // Initial fetch.
  useEffect(() => {
    setLoad({ kind: 'loading' });
    hasPayloadRef.current = false;
    seededRef.current = false;
    void refetch();
  }, [refetch]);

  const isLive = load.kind === 'live';

  // Live channel + poll floor once the table is loaded.
  useEffect(() => {
    if (!id || !isLive) return;
    const handle = connectShareSignal(id, (msg) => {
      if (msg.t === 'upd') void refetch();
    });
    signalRef.current = handle;
    const interval = setInterval(() => void refetch(), POLL_FLOOR_MS);
    // Mobile suspends background timers and drops the socket; refetch the moment
    // the guest returns to the tab so the owner's latest edits show immediately.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refetch();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      handle.close();
      if (signalRef.current === handle) signalRef.current = null;
    };
  }, [id, isLive, refetch]);

  // Post the guest snapshot (debounced) on every claim change once named.
  useEffect(() => {
    if (!isLive || !named || !id || !key) return;
    const timer = setTimeout(() => {
      const response = buildSplitClaimResponse({
        fromActorId: actorId,
        fromName: name,
        claims: [...mine].map((itemId) => ({ itemId, fraction: 1, units: null })),
      });
      void postSplitClaim(id, key, response)
        .then(() => signalRef.current?.send({ t: 'resp' }))
        .catch(() => {});
    }, POST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [mine, named, isLive, id, key, name, actorId]);

  const preview = useMemo(() => {
    if (load.kind !== 'live') return null;
    const response = buildSplitClaimResponse({
      fromActorId: actorId,
      fromName: name || 'Guest',
      claims: [...mine].map((itemId) => ({ itemId, fraction: 1, units: null })),
    });
    const session = reduceGuestClaims(load.payload.session, [response]);
    const totals = computeSplitTotals(session);
    const meId = session.participants.find((p) => p.actorId === actorId)?.id;
    const myTotal = totals.totals.find((tt) => tt.participantId === meId)?.totalCents ?? 0;
    return { session, grandTotalCents: totals.grandTotalCents, myTotalCents: myTotal };
  }, [load, mine, name, actorId]);

  const toggle = (itemId: string) =>
    setMine((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });

  /* ── render ───────────────────────────────────────────────────────────── */

  if (load.kind === 'loading') {
    return (
      <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center gap-4 px-8">
        <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-on-surface-dim">{t('splitTable.opening')}</p>
      </div>
    );
  }

  if (load.kind === 'error') {
    const message: Record<FetchTableStatus, string> = {
      revoked: t('splitTable.err_revoked'),
      not_found: t('splitTable.err_not_found'),
      bad_key: t('splitTable.err_bad_key'),
      error: t('splitTable.err_network'),
    };
    return (
      <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center gap-4 px-8 text-center">
        <Icon name="link_off" size={40} className="text-on-surface-faint" />
        <p className="text-sm text-on-surface-dim leading-relaxed">{message[load.status]}</p>
        {load.status === 'error' && (
          <button
            onClick={() => void refetch()}
            className="px-6 py-3 rounded-xl bg-primary text-on-surface font-semibold text-sm btn-press"
          >
            {t('splitTable.retry')}
          </button>
        )}
        <button onClick={() => navigate('/')} className="text-xs text-primary btn-press">
          {t('splitTable.go_home')}
        </button>
      </div>
    );
  }

  const { payload } = load;
  const currency = payload.session.currency;

  if (!named) {
    return (
      <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center gap-4 px-8">
        <div className="w-full max-w-[360px] rounded-2xl p-6 flex flex-col gap-4" style={{ background: 'var(--surface-container)' }}>
          <div className="flex flex-col gap-1 text-center">
            <Icon name="restaurant" size={32} className="text-primary mx-auto" />
            <h1 className="text-heading font-bold text-on-surface">{payload.session.name}</h1>
            <p className="text-xs text-on-surface-dim">{t('splitTable.name_prompt')}</p>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('splitTable.name_placeholder')}
            className="w-full rounded-xl px-3 py-2.5 text-sm bg-surface-high text-on-surface outline-none text-center"
            autoFocus
          />
          <button
            onClick={() => {
              const clean = name.trim();
              if (clean === '') return;
              setGuestName(clean);
              setName(clean);
              setNamed(true);
            }}
            disabled={name.trim() === ''}
            className="w-full py-3 rounded-2xl bg-primary text-on-surface font-bold btn-press disabled:opacity-50"
          >
            {t('splitTable.name_continue')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base">
      <div className="max-w-[430px] mx-auto flex flex-col gap-4 px-5 pt-4 pb-32">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-heading font-bold text-on-surface leading-tight">{payload.session.name}</h1>
          <p className="text-[11px] text-on-surface-faint">
            {t('splitTable.live_hint')}
            {' · '}
            {t('splitTable.bill_total', { amount: formatMoney(preview?.grandTotalCents ?? 0, currency) })}
          </p>
        </div>

        <div className="rounded-xl px-3 py-2.5 text-[12px] font-medium text-on-surface-dim bg-surface-container flex items-center gap-2">
          <Icon name="touch_app" size={16} className="text-primary shrink-0" />
          {t('splitTable.tap_hint')}
        </div>

        <div className="flex flex-col gap-2">
          {payload.session.items.map((item) => {
            const mineClaim = mine.has(item.id);
            const others = item.claims
              .map((c) => payload.session.participants.find((p) => p.id === c.participantId))
              .filter((p): p is NonNullable<typeof p> => Boolean(p) && p!.actorId !== actorId);
            return (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                className={`rounded-2xl p-3 flex items-center gap-3 text-left btn-press ${mineClaim ? 'ring-2 ring-primary' : ''}`}
                style={{ background: 'var(--surface-container)' }}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${mineClaim ? 'bg-primary' : 'bg-surface-high'}`}>
                  <Icon name={mineClaim ? 'check' : getCategoryIcon(item.category)} size={18} className={mineClaim ? 'text-on-surface' : 'text-on-surface-dim'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">{item.description || t('splitTable.unnamed_item')}</p>
                  <p className="text-[11px] text-on-surface-faint">{formatMoney(item.amountCents, currency)}</p>
                </div>
                <div className="flex -space-x-1.5 shrink-0">
                  {others.slice(0, 4).map((p) => (
                    <span
                      key={p.id}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border border-surface-container bg-surface-high text-on-surface"
                    >
                      {initials(p.name)}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {payload.session.items.length === 0 && (
          <p className="text-sm text-on-surface-dim text-center py-8">{t('splitTable.empty')}</p>
        )}

        {/* T9 — onboarding door: a no-app guest can start their own trip, reusing
            the signup-less home (BootGate routes a guest with no trip to setup). */}
        <div className="mt-4 pt-4 border-t border-surface-container flex flex-col items-center gap-1.5 text-center">
          <p className="text-[11px] text-on-surface-faint">{t('splitTable.onboard_hint')}</p>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs text-primary font-bold btn-press"
          >
            <Icon name="luggage" size={14} />
            {t('splitTable.start_trip')}
          </button>
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 z-10">
        <div className="max-w-[430px] mx-auto m-4 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-lg" style={{ background: 'var(--surface-high)' }}>
          <div className="flex flex-col">
            <span className="text-[11px] text-on-surface-faint">{t('splitTable.your_part')}</span>
            <span className="text-xl font-extrabold text-on-surface">{formatMoney(preview?.myTotalCents ?? 0, currency)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-success font-semibold">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            {t('splitTable.synced')}
          </div>
        </div>
      </div>
    </div>
  );
}
