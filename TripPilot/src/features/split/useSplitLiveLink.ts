import { useCallback, useEffect, useRef, useState } from 'react';
import { connectShareSignal, type ShareSignalHandle } from '@/data/sync/share-signal';
import type { SplitClaimResponse, SplitSession } from '@/domain/split';
import {
  publishSplitTable,
  republishSplitTable,
  revokeSplitTable,
  pullSplitClaims,
  buildSplitTableLink,
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
  start: () => void;
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
        setStatus('live');
      })
      .catch(() => setStatus('error'));
  }, []);

  const stop = useCallback(() => {
    const current = credsRef.current;
    if (current) void revokeSplitTable(current).catch(() => {});
    signalRef.current?.close();
    signalRef.current = null;
    setCreds(null);
    setGuestCount(0);
    setStatus('idle');
  }, []);

  const pull = useCallback(async () => {
    const current = credsRef.current;
    if (!current || pullingRef.current) return;
    pullingRef.current = true;
    try {
      const batches = await pullSplitClaims(current);
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

  // Signal channel + poll floor while live.
  useEffect(() => {
    if (!creds) return;
    const handle = connectShareSignal(creds.shareId, (msg) => {
      if (msg.t === 'resp') void pull();
    });
    signalRef.current = handle;
    void pull(); // fold in anything posted before we connected
    const interval = setInterval(() => void pull(), POLL_FLOOR_MS);
    return () => {
      clearInterval(interval);
      handle.close();
      if (signalRef.current === handle) signalRef.current = null;
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
        .then(() => {
          lastPublishedRef.current = serialized;
          signalRef.current?.send({ t: 'upd', rev: nextRevision });
        })
        .catch(() => {});
    }, REPUBLISH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [creds, session]);

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
    start,
    stop,
  };
}
