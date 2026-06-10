import { describe, it, expect } from 'vitest';
import type { SyncChannel } from '@/data/sync/channel';
import {
  SyncSession,
  sendPayload,
  receivePayload,
  sendResponses,
  waitForResponses,
  SyncSessionError,
} from '@/data/sync/session';

/** In-memory channel pair — exercises the full protocol without WebRTC. */
function createChannelPair(): [SyncChannel, SyncChannel] {
  const handlers: Array<(text: string) => void> = [() => {}, () => {}];
  const closeHandlers: Array<() => void> = [() => {}, () => {}];
  let open = true;

  const make = (self: number, other: number): SyncChannel => ({
    kind: 'webrtc',
    send: (text) => {
      if (!open) return;
      // Async delivery mirrors real transports.
      queueMicrotask(() => handlers[other]!(text));
    },
    setMessageHandler: (handler) => {
      handlers[self] = handler;
    },
    setCloseHandler: (handler) => {
      closeHandlers[self] = handler;
    },
    close: () => {
      if (!open) return;
      open = false;
      queueMicrotask(() => {
        closeHandlers[0]!();
        closeHandlers[1]!();
      });
    },
  });

  return [make(0, 1), make(1, 0)];
}

function buildPayload(): Record<string, unknown> {
  return {
    rows: Array.from({ length: 800 }, (_, i) => ({
      id: `tx-${i}`,
      amountCents: 100 + i,
      note: `row ${i} ${(i * 7919).toString(36)}`,
    })),
  };
}

describe('SyncSession protocol runner', () => {
  it('transfers a payload end-to-end with progress and ack', async () => {
    const [a, b] = createChannelPair();
    const sender = new SyncSession(a);
    const receiver = new SyncSession(b);

    const payload = buildPayload();
    const sentProgress: number[] = [];
    const receivedProgress: number[] = [];

    const [, received] = await Promise.all([
      sendPayload(sender, 'backup', payload, (sent) => sentProgress.push(sent)),
      receivePayload(receiver, (got) => receivedProgress.push(got)),
    ]);

    expect(received.kind).toBe('backup');
    expect(received.payload).toEqual(payload);
    expect(sentProgress.length).toBeGreaterThan(0);
    expect(receivedProgress.length).toBe(sentProgress.length);
  });

  it('exchanges statement responses both ways', async () => {
    const [a, b] = createChannelPair();
    const owner = new SyncSession(a);
    const mirror = new SyncSession(b);

    const items = [
      { shareId: '4f9c8a52-1234-4abc-9def-0123456789ab', status: 'confirmed' as const },
      { shareId: '5f9c8a52-1234-4abc-9def-0123456789ab', status: 'rejected' as const },
    ];
    sendResponses(mirror, items);
    expect(await waitForResponses(owner)).toEqual(items);
  });

  it('sender fails with rejected_by_peer when the receiver nacks', async () => {
    const [a, b] = createChannelPair();
    const sender = new SyncSession(a);
    const receiver = new SyncSession(b);

    // Receiver immediately nacks whatever arrives.
    receiver.send({ t: 'ack', ok: false, error: 'integrity_check_failed' });

    await expect(sendPayload(sender, 'backup', { x: 1 })).rejects.toMatchObject({
      code: 'rejected_by_peer',
    });
  });

  it('pending reads reject when the channel closes', async () => {
    const [a, b] = createChannelPair();
    const sender = new SyncSession(a);
    new SyncSession(b);

    const pending = sender.expect('manifest');
    sender.close();
    await expect(pending).rejects.toBeInstanceOf(SyncSessionError);
  });

  it('ignores garbage frames without breaking the stream', async () => {
    const [a, b] = createChannelPair();
    const sender = new SyncSession(a);
    const receiver = new SyncSession(b);

    a.send('not json at all');
    a.send('{"t":"unknown-type"}');
    const exchange = Promise.all([
      sendPayload(sender, 'statement', { ok: true }),
      receivePayload(receiver),
    ]);
    const [, received] = await exchange;
    expect(received.payload).toEqual({ ok: true });
  });
});
