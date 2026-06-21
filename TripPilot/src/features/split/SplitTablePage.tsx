import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useLocation, useNavigate } from 'react-router';
import { parseShareKeyFromHash } from '@/domain/sync';
import {
  buildSplitClaimResponse,
  computeSplitTotals,
  reduceGuestClaims,
  dominantSplitCategory,
  planGuestSelfExpense,
  type SplitSharePayload,
  type SplitClaimResponse,
  type SplitSession,
  type GuestSelfExpensePlan,
} from '@/domain/split';
import { connectShareSignal, type ShareSignalHandle } from '@/data/sync/share-signal';
import { formatMoney } from '@/domain/money';
import { getCategoryIcon } from '@/utils/category-icons';
import { Icon } from '@/components/Icon';
import { useAppData, notifyAppDataChanged } from '@/hooks/useAppData';
import { resolveActivePhase } from '@/domain/dates';
import { createExpenseTransaction } from '@/domain/transactions';
import { registerExpense } from '@/domain/orchestrators/expense-orchestrators';
import { setAssistantQuickAddDraft } from '@/features/assistant/assistant-quickadd-draft';
import type { ContextualSimulation } from '@/domain/forecasting';
import {
  fetchSplitTable,
  fetchSplitResponses,
  postSplitClaim,
  getGuestActorId,
  getGuestName,
  setGuestName,
  getGuestCommit,
  setGuestCommit,
  type FetchTableStatus,
} from './live-link';
import { useSplitBudgetReading } from './useSplitBudgetReading';
import { LiveStatusBadge } from './LiveStatusBadge';

const POLL_FLOOR_MS = 6000;
const POST_DEBOUNCE_MS = 500;

type TFn = ReturnType<typeof useTranslation>['t'];

/**
 * F9 — the honest one-line budget verdict for the guest's own slice, reusing the
 * SAME `split.reading_*` copy the owner sees on SplitPage so both sides speak the
 * identical "cabe no teto / sobram €X" language.
 */
function readingLine(reading: ContextualSimulation, currency: string, t: TFn): string {
  const daily = reading.facts.find((f) => f.kind === 'daily_fits' || f.kind === 'daily_days');
  const free = reading.facts.find((f) => f.kind === 'free_impact' || f.kind === 'exceeds_free');
  if (free?.kind === 'exceeds_free') return t('split.reading_exceeds', { amount: formatMoney(free.missingCents, currency) });
  if (daily?.kind === 'daily_fits') return t('split.reading_fits_today');
  if (daily?.kind === 'daily_days') return t('split.reading_days', { days: daily.days });
  if (free?.kind === 'free_impact') return t('split.reading_left', { amount: formatMoney(free.afterCents, currency) });
  return t('split.reading_ok');
}

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
  // Every participant's claim snapshot from the server (open read). This is what
  // lets a guest see what everyone else is choosing in real time, even when the
  // organizer is offline — the live table no longer depends on the owner relay.
  const [allResponses, setAllResponses] = useState<SplitClaimResponse[]>([]);
  // L2 — real connection status (never a static "synced"): freshness of the last
  // successful pull + the signal socket state drive a truthful live/syncing/offline.
  const [socketOpen, setSocketOpen] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  const signalRef = useRef<ShareSignalHandle | null>(null);
  const seededRef = useRef(false);
  const hasPayloadRef = useRef(false);

  const seedMine = useCallback(
    (session: SplitSession) => {
      const me = session.participants.find((p) => p.actorId === actorId);
      if (!me) return;
      const claimed = session.items
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
    // The bill (statement) and the claims (responses) are two independent server
    // keys; pull both in one shot so a single round-trip refreshes the whole view.
    const [res, responses] = await Promise.all([
      fetchSplitTable(id, key),
      fetchSplitResponses(id, key).catch(() => [] as SplitClaimResponse[]),
    ]);
    if (res.status === 'ok') {
      setAllResponses(responses);
      setLastSyncAt(Date.now());
      if (!seededRef.current) {
        // Seed my local picks from the SERVER's view of my claims (my last
        // posted snapshot), so a returning guest keeps their selection.
        seedMine(reduceGuestClaims(res.payload.session, responses));
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
    const handle = connectShareSignal(
      id,
      () => {
        // ANY frame — the owner edited the bill ('upd') OR another guest posted a
        // claim ('resp') — means re-pull statement + responses so this device
        // reflects everyone's latest picks in real time.
        void refetch();
      },
      setSocketOpen,
    );
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
      setSocketOpen(false);
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

  // The live table everyone sees = the owner's bill (statement) reduced with
  // EVERY guest's claim snapshot. Deterministic, so each device converges on the
  // identical view. My own local picks (`mine`) are applied last as an optimistic
  // echo so my taps show instantly and override my last posted snapshot.
  const merged = useMemo(() => {
    if (load.kind !== 'live') return null;
    const myResponse = buildSplitClaimResponse({
      fromActorId: actorId,
      fromName: name || 'Guest',
      claims: [...mine].map((itemId) => ({ itemId, fraction: 1, units: null })),
    });
    const others = allResponses.filter((r) => r.fromActorId !== actorId);
    const session = reduceGuestClaims(load.payload.session, [...others, myResponse]);
    const totals = computeSplitTotals(session);
    const meId = session.participants.find((p) => p.actorId === actorId)?.id;
    const myTotal = totals.totals.find((tt) => tt.participantId === meId)?.totalCents ?? 0;
    const guestCount = new Set(
      [...others.map((r) => r.fromActorId), actorId],
    ).size;
    return { session, grandTotalCents: totals.grandTotalCents, myTotalCents: myTotal, guestCount };
  }, [load, allResponses, mine, name, actorId]);

  const toggle = (itemId: string) =>
    setMine((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });

  /* ── F9: recognize an app user + register their own slice ──────────────── */

  // This route lives under AppDataProvider, so an app user's OWN trip is loaded
  // here even though the guest table sits outside BootGate. A stranger has no
  // trip (`trip === null`) — that is exactly the signal that splits the two flows.
  const { trip, participants, phases, pools } = useAppData();
  const owner = useMemo(() => participants.find((p) => p.isOwner) ?? null, [participants]);
  const activePhase = useMemo(() => resolveActivePhase(phases), [phases]);
  const primaryPool = useMemo(
    () => pools.find((p) => p.scope === 'linked_phases') ?? pools[0] ?? null,
    [pools],
  );

  const [committedTxId, setCommittedTxId] = useState<string | null>(() => (id ? getGuestCommit(id) : null));
  const [committing, setCommitting] = useState(false);
  useEffect(() => {
    setCommittedTxId(id ? getGuestCommit(id) : null);
  }, [id]);

  // F9a — an app user is NOT a stranger: adopt their own profile name and skip
  // the "what's your name?" prompt entirely (only when they haven't named here).
  useEffect(() => {
    if (named) return;
    if (getGuestName() !== null) return;
    const ownerName = owner?.name?.trim();
    if (!ownerName) return;
    setGuestName(ownerName);
    setName(ownerName);
    setNamed(true);
  }, [named, owner]);

  const selfPlan = useMemo<GuestSelfExpensePlan>(() => {
    if (load.kind !== 'live' || !merged) return { kind: 'none' };
    return planGuestSelfExpense({
      myTotalCents: merged.myTotalCents,
      sessionCurrency: load.payload.session.currency,
      sessionName: load.payload.session.name,
      category: dominantSplitCategory(merged.session),
      hasTrip: trip !== null,
      tripBaseCurrency: trip?.baseCurrency ?? null,
      activePhaseId: activePhase?.id ?? null,
      primaryPoolId: primaryPool?.id ?? null,
      committedTxId,
    });
  }, [load, merged, trip, activePhase, primaryPool, committedTxId]);

  // Same-currency slice → read it through the shared contextual simulator so the
  // CTA can show the honest budget impact before the guest commits.
  const reading = useSplitBudgetReading(selfPlan.kind === 'ready' ? selfPlan.amountCents : 0);

  const registerMyPart = async () => {
    if (selfPlan.kind === 'currency_mismatch') {
      // Foreign-currency slice needs the rate UI → hand the pre-fill to the full
      // editor (same escape hatch the AI quick-entry uses).
      setAssistantQuickAddDraft({
        type: 'expense',
        amount: selfPlan.amountCents / 100,
        currency: selfPlan.currency,
        category: selfPlan.category,
        description: selfPlan.description,
      });
      navigate('/quick-add');
      return;
    }
    if (selfPlan.kind !== 'ready' || trip === null || id === null || committing) return;
    setCommitting(true);
    try {
      const tx = createExpenseTransaction({
        tripId: trip.id,
        phaseId: selfPlan.phaseId,
        budgetPoolId: selfPlan.budgetPoolId,
        walletId: null,
        amountCents: selfPlan.amountCents,
        currency: selfPlan.currency,
        category: selfPlan.category,
        description: selfPlan.description,
        // Double idempotency: the ref marks this device's slice of THIS table.
        externalRef: `splitguest:${id}`,
        excludeFromLearning: true,
      });
      await registerExpense({ transaction: tx, shares: [] });
      setGuestCommit(id, tx.id);
      setCommittedTxId(tx.id);
      notifyAppDataChanged();
    } catch {
      // Best-effort: leave the button enabled so the guest can retry.
    } finally {
      setCommitting(false);
    }
  };

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
  // The session everyone sees = bill + all merged claims (falls back to the raw
  // statement only in the impossible window before the memo computes).
  const liveSession = merged?.session ?? payload.session;

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
            {t('splitTable.bill_total', { amount: formatMoney(merged?.grandTotalCents ?? 0, currency) })}
            {merged && merged.guestCount > 1 ? ` · ${t('splitTable.at_table', { count: merged.guestCount })}` : ''}
          </p>
        </div>

        <div className="rounded-xl px-3 py-2.5 text-[12px] font-medium text-on-surface-dim bg-surface-container flex items-center gap-2">
          <Icon name="touch_app" size={16} className="text-primary shrink-0" />
          {t('splitTable.tap_hint')}
        </div>

        <div className="flex flex-col gap-2">
          {liveSession.items.map((item) => {
            const mineClaim = mine.has(item.id);
            const others = item.claims
              .map((c) => liveSession.participants.find((p) => p.id === c.participantId))
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
            the signup-less home (BootGate routes a guest with no trip to setup).
            An app user (trip !== null) is handled by the F9 CTA instead, so this
            stranger-only door no longer shows them noise. */}
        {trip === null && (
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
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 z-10">
        <div className="max-w-[430px] mx-auto m-4 flex flex-col gap-2">
          {/* F9 — register the guest's own slice in THEIR app (app users only). */}
          {selfPlan.kind === 'ready' && (
            <button
              onClick={() => void registerMyPart()}
              disabled={committing}
              className="w-full rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-lg btn-press disabled:opacity-60"
              style={{ background: 'var(--primary)' }}
            >
              <div className="flex flex-col text-left">
                <span className="text-sm font-bold text-on-surface">
                  {committing ? t('splitTable.registering') : t('splitTable.register_my_part')}
                </span>
                {reading && (
                  <span className="text-[11px] text-on-surface/80">{readingLine(reading, currency, t)}</span>
                )}
              </div>
              <span className="text-base font-extrabold text-on-surface shrink-0">
                {formatMoney(selfPlan.amountCents, currency)}
              </span>
            </button>
          )}
          {selfPlan.kind === 'currency_mismatch' && (
            <button
              onClick={() => void registerMyPart()}
              className="w-full rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-lg btn-press"
              style={{ background: 'var(--primary)' }}
            >
              <div className="flex flex-col text-left">
                <span className="text-sm font-bold text-on-surface">{t('splitTable.register_in_app')}</span>
                <span className="text-[11px] text-on-surface/80">{t('splitTable.register_hint_rate')}</span>
              </div>
              <Icon name="arrow_forward" size={18} className="text-on-surface shrink-0" />
            </button>
          )}
          {selfPlan.kind === 'already' && (
            <div className="w-full rounded-2xl px-4 py-3 flex items-center gap-2 shadow-lg" style={{ background: 'var(--surface-container)' }}>
              <Icon name="check_circle" size={18} className="text-success shrink-0" />
              <span className="text-[12px] font-semibold text-on-surface-dim">{t('splitTable.registered_done')}</span>
            </div>
          )}

          <div className="rounded-2xl p-4 flex items-center justify-between gap-3 shadow-lg" style={{ background: 'var(--surface-high)' }}>
            <div className="flex flex-col">
              <span className="text-[11px] text-on-surface-faint">{t('splitTable.your_part')}</span>
              <span className="text-xl font-extrabold text-on-surface">{formatMoney(merged?.myTotalCents ?? 0, currency)}</span>
            </div>
            <LiveStatusBadge
              socketOpen={socketOpen}
              lastSyncAt={lastSyncAt}
              onReconnect={() => void refetch()}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
