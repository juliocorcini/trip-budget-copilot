import { useCallback, useEffect, useRef, useState } from 'react';
import { connectShareSignal, type ShareSignalHandle } from '@/data/sync/share-signal';
import {
  itemsSubtotalCents,
  serviceChargeAmountCents,
  type SplitClaimResponse,
  type SplitSession,
} from '@/domain/split';
import {
  publishSplitTable,
  republishSplitTable,
  revokeSplitTable,
  pullSplitClaims,
  buildSplitTableLink,
  saveOwnerLive,
  clearOwnerLive,
  saveActiveSplitMeta,
  type SplitLiveCreds,
} from './live-link';

/**
 * G2 — the owner side of the live table. Owns the live link lifecycle:
 *   • start()  → publish the current session, open the signal channel
 *   • pull     → on every 'resp' ping (or the poll floor) fetch guest claims and
 *                hand them to the parent reducer (`onClaims` → reduceGuestClaims)
 *   • push     → on ANY session change (owner edit OR a merged claim) re-publish
 *                the session, debounced, and ping guests with 'upd'
 *   • stop()   → revoke the link and tear down
 *
 * Independence of the two loops (pull on ping/poll, push on change) is what
 * keeps it loop-free: a pull only re-publishes when the merge actually changed
 * the session (guarded by a value compare), and the signal is best-effort with
 * the poll as the guaranteed floor.
 */

const POLL_FLOOR_MS = 6000;
const REPUBLISH_DEBOUNCE_MS = 700;

export type SplitLiveStatus = 'idle' | 'starting' | 'live' | 'error';

export interface SplitLiveLink {
  status: SplitLiveStatus;
  creds: SplitLiveCreds | null;
  link: string | null;
  guestCount: number;
  /** Whether the realtime signal socket is currently open. */
  socketOpen: boolean;
  /** Epoch ms of the last successful pull (null until the first). */
  lastSyncAt: number | null;
  start: () => void;
  /**
   * Re-attach to an already-published table (after an app reopen) WITHOUT
   * minting a new link. The session must be the one just fetched from the
   * server so the first reconcile is a no-op instead of clobbering the truth.
   */
  resume: (creds: SplitLiveCreds, session: SplitSession, serverRevision: number) => void;
  /** Force an immediate re-pull (the socket auto-reconnects on its own). */
  reconnect: () => void;
  stop: () => void;
}

function serializeSession(session: SplitSession): string {
  // The published payload stamps its own timestamp, so comparing the session
  // alone tells us whether a re-publish carries new information.
  return JSON.stringify(session);
}

export function useSplitLiveLink(
  session: SplitSession | null,
  onClaims: (batches: SplitClaimResponse[]) => void,
): SplitLiveLink {
  const [status, setStatus] = useState<SplitLiveStatus>('idle');
  const [creds, setCreds] = useState<SplitLiveCreds | null>(null);
  const [guestCount, setGuestCount] = useState(0);
  const [socketOpen, setSocketOpen] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const credsRef = useRef<SplitLiveCreds | null>(null);
  credsRef.current = creds;
  const onClaimsRef = useRef(onClaims);
  onClaimsRef.current = onClaims;

  const signalRef = useRef<ShareSignalHandle | null>(null);
  const revisionRef = useRef(1);
  const lastPublishedRef = useRef('');
  const pullingRef = useRef(false);

  const start = useCallback(() => {
    const current = sessionRef.current;
    if (!current || credsRef.current) return;
    setStatus('starting');
    revisionRef.current = 1;
    publishSplitTable(current, 1)
      .then((next) => {
        lastPublishedRef.current = serializeSession(current);
        setCreds(next);
        saveOwnerLive(next);
        setLastSyncAt(Date.now());
        setStatus('live');
      })
      .catch(() => setStatus('error'));
  }, []);

  // L2.M5 — re-attach to a persisted table after a reopen. The caller passes the
  // freshly fetched server session so we prime lastPublishedRef with it: the
  // re-publish effect then sees "no change" and stays quiet, while the signal
  // effect (keyed on creds) connects + pulls the latest guest claims.
  const resume = useCallback((restored: SplitLiveCreds, session: SplitSession, serverRevision: number) => {
    if (credsRef.current) return;
    revisionRef.current = Math.max(restored.revision, serverRevision);
    lastPublishedRef.current = serializeSession(session);
    setCreds(restored);
    saveOwnerLive(restored);
    setLastSyncAt(Date.now());
    setStatus('live');
  }, []);

  const stop = useCallback(() => {
    const current = credsRef.current;
    if (current) void revokeSplitTable(current).catch(() => {});
    clearOwnerLive();
    signalRef.current?.close();
    signalRef.current = null;
    setCreds(null);
    setGuestCount(0);
    setSocketOpen(false);
    setLastSyncAt(null);
    setStatus('idle');
  }, []);

  const pull = useCallback(async () => {
    const current = credsRef.current;
    if (!current || pullingRef.current) return;
    pullingRef.current = true;
    try {
      const batches = await pullSplitClaims(current);
      setLastSyncAt(Date.now());
      if (batches.length > 0) {
        setGuestCount(new Set(batches.map((b) => b.fromActorId)).size);
        onClaimsRef.current(batches);
      }
    } catch {
      // best-effort; the next poll retries
    } finally {
      pullingRef.current = false;
    }
  }, []);

  // L2.M6 — manual reconnect: force a pull now instead of waiting for the next
  // poll/backoff. Honest by construction — it only flips the badge to "live"
  // again if the pull actually succeeds (it stamps lastSyncAt).
  const reconnect = useCallback(() => {
    void pull();
  }, [pull]);

  // Signal channel + poll floor while live.
  useEffect(() => {
    if (!creds) return;
    const handle = connectShareSignal(
      creds.shareId,
      (msg) => {
        if (msg.t === 'resp') void pull();
      },
      setSocketOpen,
    );
    signalRef.current = handle;
    void pull(); // fold in anything posted before we connected
    const interval = setInterval(() => void pull(), POLL_FLOOR_MS);
    // Mobile throttles/suspends background timers and drops the socket. When the
    // owner returns to the app (e.g. after sharing the link), pull immediately so
    // guest claims that arrived while backgrounded appear at once instead of
    // after the next poll tick.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pull();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      handle.close();
      if (signalRef.current === handle) signalRef.current = null;
      setSocketOpen(false);
    };
  }, [creds, pull]);

  // Re-publish on any session change (owner edit OR merged guest claims).
  useEffect(() => {
    if (!creds || !session) return;
    if (serializeSession(session) === lastPublishedRef.current) return;
    const timer = setTimeout(() => {
      const liveCreds = credsRef.current;
      const liveSession = sessionRef.current;
      if (!liveCreds || !liveSession) return;
      const serialized = serializeSession(liveSession);
      if (serialized === lastPublishedRef.current) return;
      const nextRevision = revisionRef.current + 1;
      revisionRef.current = nextRevision;
      republishSplitTable(liveCreds, liveSession, nextRevision)
        .then((result) => {
          lastPublishedRef.current = serialized;
          // Keep the persisted revision in step so a reopen resumes at the right
          // point instead of replaying a stale one. DEC-455: a republish also
          // escrows the key — the ack upgrades pre-escrow tables so their next
          // shared link drops the `#k=` fragment.
          const upgraded: SplitLiveCreds = {
            ...liveCreds,
            revision: nextRevision,
            ...(result.keyHeld ? { keyOnServer: true } : {}),
          };
          saveOwnerLive(upgraded);
          if (result.keyHeld && !liveCreds.keyOnServer) {
            // One-time flip (never on routine republishes — creds identity feeds
            // the signal effect): re-render so the displayed link shortens.
            credsRef.current = upgraded;
            setCreds(upgraded);
          }
          signalRef.current?.send({ t: 'upd', rev: nextRevision });
        })
        .catch(() => {});
    }, REPUBLISH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [creds, session]);

  // Persist a render-ready snapshot of the live split so the home card, the
  // floating chip and the FAB can surface "a division is still happening" on
  // every screen without a network round-trip. Re-runs on any owner edit, merged
  // guest claim, or guest join (guestCount); cleared with the credentials on
  // stop/commit (clearOwnerLive), so navigating away never loses the table.
  useEffect(() => {
    if (!creds || !session) return;
    // The card shows the TABLE's worth (the whole bill), not just what's been
    // claimed — an itemized table with nothing claimed yet is still worth its
    // full total, so we sum items + service + adjustments rather than the
    // per-person grand total (which is 0 until people start claiming).
    const subtotal = itemsSubtotalCents(session);
    const billTotalCents =
      subtotal +
      serviceChargeAmountCents(session.serviceCharge, subtotal) +
      session.adjustments.reduce((sum, a) => sum + a.amountCents, 0);
    saveActiveSplitMeta({
      shareId: creds.shareId,
      name: session.name,
      currency: session.currency,
      totalCents: billTotalCents,
      participantCount: session.participants.length,
      guestCount,
      updatedAt: Date.now(),
    });
  }, [creds, session, guestCount]);

  // Safety net: revoke if the component unmounts while live.
  useEffect(() => {
    return () => {
      signalRef.current?.close();
      signalRef.current = null;
    };
  }, []);

  return {
    status,
    creds,
    link: creds ? buildSplitTableLink(creds) : null,
    guestCount,
    socketOpen,
    lastSyncAt,
    start,
    resume,
    reconnect,
    stop,
  };
}
