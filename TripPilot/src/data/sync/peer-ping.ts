import { connectShareSignal, type ShareSignalHandle } from './share-signal';

/**
 * DEC-352 (F17, G6) — real-time peer-ping over the existing signal relay.
 *
 * The async mailbox already delivers sealed P2P blobs (debt/payment/connect/
 * statement); the gap was *latency* — a recipient only drained on open/focus, so
 * a charge "only showed up after a reload" (Julio's field test). This adds a
 * best-effort poke: on send we ping the recipient's room, and an open app
 * subscribed to **its own** room drains immediately.
 *
 * It reuses the generic `ShareSignal` Durable Object (`/share/<id>/ws`), which
 * already broadcasts any small frame to the OTHER sockets in a room — here the
 * room id is the peer's `actorId` (a different DO instance than any shareId, no
 * collision). The ping carries **no payload** ("drain now"): the content stays
 * E2E-sealed in the mailbox (DEC-207). When the relay is down or the peer is
 * offline the ping is simply lost — the guaranteed floor is the async pull on
 * the next open. Nothing here persists.
 */

/** How long to keep a one-shot sender socket open so it can connect + flush. */
const PEER_PING_GRACE_MS = 4_000;

/**
 * Fire-and-forget: poke `peerActorId` to drain their mailbox now. Opens a short
 * socket to the peer's room, sends one `p2p` frame, and releases it. Best-effort
 * — never throws, never blocks the caller (the blob is already queued/posted).
 */
export function pingPeerMailbox(peerActorId: string): void {
  if (!peerActorId) return;
  let handle: ShareSignalHandle | null = null;
  try {
    handle = connectShareSignal(peerActorId, () => {});
    handle.send({ t: 'p2p' });
  } catch {
    // best-effort — relay unavailable
  }
  // The socket connects asynchronously; the queued ping flushes on open. Give it
  // a grace window, then close so we never leak a socket per send.
  setTimeout(() => {
    try {
      handle?.close();
    } catch {
      // ignore
    }
  }, PEER_PING_GRACE_MS);
}

/**
 * Subscribe to MY OWN room and run `onPing` whenever a peer pokes me. Returns a
 * handle whose `close()` releases the socket (auto-reconnect/backoff is handled
 * by the underlying relay client). `'upd'/'resp'` frames are ignored here — only
 * a `p2p` poke triggers a mailbox drain.
 */
export function subscribePeerPings(
  myActorId: string,
  onPing: () => void,
): ShareSignalHandle | null {
  if (!myActorId) return null;
  try {
    return connectShareSignal(myActorId, (msg) => {
      if (msg.t === 'p2p') onPing();
    });
  } catch {
    return null;
  }
}
