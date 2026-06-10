import {
  preparePayload,
  assemblePayload,
  parseSyncMessage,
  encodeSyncMessage,
} from '@/domain/sync';
import type {
  SyncMessage,
  SyncPayloadKind,
  HelloMessage,
  ManifestMessage,
  ChunkMessage,
  ResponsesMessage,
  StatementResponse,
} from '@/domain/sync';
import type { SyncChannel } from './channel';

/**
 * Protocol runner: the high-level send/receive flows on top of any
 * SyncChannel (WebRTC, relay or manual). Pure message logic — fully
 * testable with an in-memory channel pair.
 */

const DEFAULT_STEP_TIMEOUT_MS = 30_000;

export class SyncSessionError extends Error {
  constructor(
    public readonly code:
      | 'timeout'
      | 'channel_closed'
      | 'protocol_error'
      | 'rejected_by_peer',
  ) {
    super(code);
    this.name = 'SyncSessionError';
  }
}

/** Serializes incoming frames into awaitable reads. */
export class SyncSession {
  private queue: SyncMessage[] = [];
  private waiters: Array<(message: SyncMessage) => void> = [];
  private closed = false;
  private closeWaiters: Array<() => void> = [];

  constructor(private channel: SyncChannel) {
    channel.setMessageHandler((text) => {
      const message = parseSyncMessage(text);
      if (!message) return;
      const waiter = this.waiters.shift();
      if (waiter) waiter(message);
      else this.queue.push(message);
    });
    channel.setCloseHandler(() => {
      this.closed = true;
      for (const waiter of this.closeWaiters.splice(0)) waiter();
    });
  }

  get transportKind(): SyncChannel['kind'] {
    return this.channel.kind;
  }

  send(message: SyncMessage): void {
    this.channel.send(encodeSyncMessage(message));
  }

  close(): void {
    this.closed = true;
    this.channel.close();
  }

  private nextMessage(timeoutMs: number): Promise<SyncMessage> {
    const queued = this.queue.shift();
    if (queued) return Promise.resolve(queued);
    if (this.closed) return Promise.reject(new SyncSessionError('channel_closed'));

    return new Promise<SyncMessage>((resolve, reject) => {
      const timer = setTimeout(() => reject(new SyncSessionError('timeout')), timeoutMs);
      this.closeWaiters.push(() => {
        clearTimeout(timer);
        reject(new SyncSessionError('channel_closed'));
      });
      this.waiters.push((message) => {
        clearTimeout(timer);
        resolve(message);
      });
    });
  }

  async expect<T extends SyncMessage['t']>(
    type: T,
    timeoutMs = DEFAULT_STEP_TIMEOUT_MS,
  ): Promise<Extract<SyncMessage, { t: T }>> {
    const message = await this.nextMessage(timeoutMs);
    if (message.t !== type) throw new SyncSessionError('protocol_error');
    return message as Extract<SyncMessage, { t: T }>;
  }

  async expectAnyOf(
    types: Array<SyncMessage['t']>,
    timeoutMs = DEFAULT_STEP_TIMEOUT_MS,
  ): Promise<SyncMessage> {
    const message = await this.nextMessage(timeoutMs);
    if (!types.includes(message.t)) throw new SyncSessionError('protocol_error');
    return message;
  }
}

export interface ReceivedPayload {
  kind: SyncPayloadKind;
  payload: unknown;
  hello: HelloMessage;
}

export async function sendHello(session: SyncSession, hello: Omit<HelloMessage, 't'>): Promise<void> {
  session.send({ t: 'hello', ...hello });
}

/**
 * Sender flow: hello already exchanged → manifest → chunks → done → ack.
 * Throws if the receiver nacks or the channel dies mid-transfer.
 */
export async function sendPayload(
  session: SyncSession,
  kind: SyncPayloadKind,
  payload: unknown,
  onProgress?: (sentChunks: number, totalChunks: number) => void,
): Promise<void> {
  const { manifest, chunks } = preparePayload(kind, payload);
  session.send(manifest);
  for (const chunk of chunks) {
    session.send(chunk);
    onProgress?.(chunk.i + 1, manifest.totalChunks);
  }
  session.send({ t: 'done' });
  const ack = await session.expect('ack', 60_000);
  if (!ack.ok) throw new SyncSessionError('rejected_by_peer');
}

/** Receiver flow: manifest → chunks → done → verify → ack. */
export async function receivePayload(
  session: SyncSession,
  onProgress?: (receivedChunks: number, totalChunks: number) => void,
): Promise<{ kind: SyncPayloadKind; payload: unknown }> {
  const manifest: ManifestMessage = await session.expect('manifest');
  const chunks: ChunkMessage[] = [];

  for (;;) {
    const message = await session.expectAnyOf(['chunk', 'done']);
    if (message.t === 'done') break;
    if (message.t !== 'chunk') throw new SyncSessionError('protocol_error');
    chunks.push(message);
    onProgress?.(chunks.length, manifest.totalChunks);
  }

  try {
    const payload = assemblePayload(manifest, chunks);
    session.send({ t: 'ack', ok: true, error: null });
    return { kind: manifest.kind, payload };
  } catch {
    session.send({ t: 'ack', ok: false, error: 'integrity_check_failed' });
    throw new SyncSessionError('protocol_error');
  }
}

export function sendResponses(session: SyncSession, items: StatementResponse[]): void {
  session.send({ t: 'responses', items });
}

export async function waitForResponses(
  session: SyncSession,
  timeoutMs = DEFAULT_STEP_TIMEOUT_MS,
): Promise<StatementResponse[]> {
  const message: ResponsesMessage = await session.expect('responses', timeoutMs);
  return message.items;
}
