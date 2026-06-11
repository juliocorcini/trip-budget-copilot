import { describe, it, expect } from 'vitest';
import { createMessageBuffer } from '@/data/sync/channel';
import type { SyncChannel } from '@/data/sync/channel';
import {
  SyncSession,
  sendHello,
  sendPayload,
  receivePayload,
  sendResponses,
  waitForResponses,
} from '@/data/sync/session';
import type { HelloMessage } from '@/domain/sync';

/**
 * R6-06/R6-07 (P2P-09, P2P-12/13): regression tests for the two field bugs —
 * the sender never consumed the receiver's hello (protocol_error on every
 * send) and frames delivered before the app attached its handler were
 * silently dropped (first attempt always timed out).
 */

/** Channel pair built on the production message buffer (race-safe). */
function createBufferedChannelPair(): [SyncChannel, SyncChannel] {
  const buffers = [createMessageBuffer(), createMessageBuffer()];
  const closeHandlers: Array<() => void> = [() => {}, () => {}];
  let open = true;

  const make = (self: number, other: number): SyncChannel => ({
    kind: 'webrtc',
    send: (text) => {
      if (!open) return;
      queueMicrotask(() => buffers[other]!.push(text));
    },
    setMessageHandler: (handler) => buffers[self]!.setHandler(handler),
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

const ACTOR_IDS: Record<string, string> = {
  sender: '11111111-1111-4111-9111-111111111111',
  receiver: '22222222-2222-4222-9222-222222222222',
  owner: '33333333-3333-4333-9333-333333333333',
  mirror: '44444444-4444-4444-9444-444444444444',
};

function hello(name: string): Omit<HelloMessage, 't'> {
  return { actorId: ACTOR_IDS[name]!, name, purpose: 'statement', appVersion: '0.6.0' };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('createMessageBuffer (R6-07)', () => {
  it('delivers messages pushed before the handler attaches, in order', () => {
    const buffer = createMessageBuffer();
    buffer.push('first');
    buffer.push('second');

    const received: string[] = [];
    buffer.setHandler((text) => received.push(text));
    buffer.push('third');

    expect(received).toEqual(['first', 'second', 'third']);
  });
});

describe('sync flow reliability (R6-06 + R6-07)', () => {
  it('survives frames sent before the receiver session exists (first-attempt race)', async () => {
    const [a, b] = createBufferedChannelPair();

    // Sender starts immediately — hello hits the wire before the receiver
    // attaches any handler (the exact first-attempt race from the field).
    const senderSession = new SyncSession(a);
    await sendHello(senderSession, hello('sender'));
    await flush();

    // Receiver only now starts listening; the buffered hello must survive.
    const receiverSession = new SyncSession(b);
    await sendHello(receiverSession, hello('receiver'));

    const receiverFlow = (async () => {
      const peerHello = await receiverSession.expect('hello', 5_000);
      const { kind, payload } = await receivePayload(receiverSession);
      return { peerHello, kind, payload };
    })();

    const senderFlow = (async () => {
      // R6-06: symmetric hello consumption before the payload.
      const peerHello = await senderSession.expect('hello', 5_000);
      await sendPayload(senderSession, 'statement', { lines: [1, 2, 3] });
      return peerHello;
    })();

    const [received, senderPeerHello] = await Promise.all([receiverFlow, senderFlow]);

    expect(received.peerHello.name).toBe('sender');
    expect(senderPeerHello.name).toBe('receiver');
    expect(received.kind).toBe('statement');
    expect(received.payload).toEqual({ lines: [1, 2, 3] });
  });

  it('completes the full statement round-trip without protocol errors', async () => {
    const [a, b] = createBufferedChannelPair();
    const owner = new SyncSession(a);
    const mirror = new SyncSession(b);

    const items = [{ shareId: '4f9c8a52-1234-4abc-9def-0123456789ab', status: 'confirmed' as const }];

    // Mirrors SyncReceivePage.handleReceived.
    const mirrorFlow = (async () => {
      await sendHello(mirror, hello('mirror'));
      await mirror.expect('hello', 5_000);
      const { payload } = await receivePayload(mirror);
      sendResponses(mirror, items);
      const ack = await mirror.expect('ack', 5_000);
      return { payload, ackOk: ack.ok };
    })();

    // Mirrors SyncTransferFlow.runSender + SharedExpensesPage.onSent.
    const ownerFlow = (async () => {
      await sendHello(owner, hello('owner'));
      await owner.expect('hello', 5_000);
      await sendPayload(owner, 'statement', { statement: true });
      const responses = await waitForResponses(owner, 5_000);
      owner.send({ t: 'ack', ok: true, error: null });
      return responses;
    })();

    const [mirrorResult, responses] = await Promise.all([mirrorFlow, ownerFlow]);

    expect(mirrorResult.payload).toEqual({ statement: true });
    expect(mirrorResult.ackOk).toBe(true);
    expect(responses).toEqual(items);
  });
});
