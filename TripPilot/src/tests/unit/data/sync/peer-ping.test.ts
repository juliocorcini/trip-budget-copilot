import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { pingPeerMailbox, subscribePeerPings } from '@/data/sync/peer-ping';

/**
 * DEC-352 (F17, G6) — peer-ping transport. The real WebSocket is replaced by a
 * controllable fake so we can assert: a send opens the PEER's room and flushes a
 * `p2p` frame on connect; a subscription fires only on inbound `p2p` pokes.
 */

type Listener = (event: unknown) => void;

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];
  url: string;
  readyState = 0; // CONNECTING
  sent: string[] = [];
  private listeners: Record<string, Listener[]> = {};

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }
  addEventListener(type: string, fn: Listener): void {
    (this.listeners[type] ??= []).push(fn);
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.readyState = 3;
    this.emit('close', {});
  }
  private emit(type: string, event: unknown): void {
    for (const fn of this.listeners[type] ?? []) fn(event);
  }
  /** Test helpers. */
  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.emit('open', {});
  }
  deliver(data: string): void {
    this.emit('message', { data });
  }
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('pingPeerMailbox', () => {
  it("opens the PEER's room and flushes a p2p frame once connected", () => {
    pingPeerMailbox('peer-actor-123');
    expect(FakeWebSocket.instances).toHaveLength(1);
    const socket = FakeWebSocket.instances[0]!;
    expect(socket.url).toContain('/share/peer-actor-123/ws');

    // Queued before open; flushes the moment the socket connects.
    expect(socket.sent).toEqual([]);
    socket.open();
    expect(socket.sent).toEqual([JSON.stringify({ t: 'p2p' })]);
  });

  it('is a no-op for an empty actorId (never opens a socket)', () => {
    pingPeerMailbox('');
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it('releases the socket after the grace window', () => {
    pingPeerMailbox('peer-actor-123');
    const socket = FakeWebSocket.instances[0]!;
    socket.open();
    expect(socket.readyState).toBe(FakeWebSocket.OPEN);
    vi.advanceTimersByTime(5_000);
    expect(socket.readyState).toBe(3); // CLOSED
  });
});

describe('subscribePeerPings', () => {
  it('fires onPing for a p2p poke and ignores other signal frames', () => {
    const onPing = vi.fn();
    const handle = subscribePeerPings('my-actor', onPing);
    expect(handle).not.toBeNull();
    const socket = FakeWebSocket.instances[0]!;
    expect(socket.url).toContain('/share/my-actor/ws');
    socket.open();

    socket.deliver(JSON.stringify({ t: 'upd', rev: 3 }));
    socket.deliver(JSON.stringify({ t: 'resp' }));
    expect(onPing).not.toHaveBeenCalled();

    socket.deliver(JSON.stringify({ t: 'p2p' }));
    expect(onPing).toHaveBeenCalledTimes(1);

    handle?.close();
  });

  it('returns null for an empty actorId', () => {
    expect(subscribePeerPings('', vi.fn())).toBeNull();
    expect(FakeWebSocket.instances).toHaveLength(0);
  });
});
