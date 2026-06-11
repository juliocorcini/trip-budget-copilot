import { createMessageBuffer } from './channel';
import { generateSessionKey, importSessionKey, encryptText, decryptText } from './crypto';
import { createRoom, connectToRoom } from './signaling-client';
import type { SignalingConnection } from './signaling-client';
import { createWebRtcPeer } from './webrtc-transport';
import type { RtcSignal } from './webrtc-transport';
import { WEBRTC_CONNECT_TIMEOUT_MS } from './config';
import type { SyncChannel } from './channel';
import type { SyncPurpose } from '@/domain/sync';
import { encodeQrPayload } from '@/domain/sync';
import type { SessionQrPayload } from '@/domain/sync';

/**
 * DEC-103 connection orchestrator. The host opens a room and shows a QR with
 * `{ code, key }`; the guest scans and joins. Both try WebRTC first; if the
 * data channel does not open in time, the HOST decides the fallback and both
 * sides keep talking through the room as an encrypted relay — same
 * SyncChannel interface, caller never knows the difference.
 */

interface RoomEnvelope {
  kind: RtcSignal['kind'] | 'use-relay' | 'data';
  sdp?: string;
  candidate?: RTCIceCandidateInit | null;
  data?: string;
}

export interface HostedSession {
  qrText: string;
  code: string;
  /** Resolves when a peer joined and a channel (webrtc or relay) is open. */
  channel: Promise<SyncChannel>;
  cancel: () => void;
}

function createRelayChannel(
  connection: SignalingConnection,
  key: CryptoKey,
  registerDataHandler: (handler: (envelope: RoomEnvelope) => void) => void,
  registerCloseHandler: (handler: () => void) => void,
): SyncChannel {
  // R6-07: frames received before setMessageHandler are buffered, not dropped.
  const buffer = createMessageBuffer();
  let closeHandler: () => void = () => {};
  registerDataHandler((envelope) => {
    if (envelope.kind === 'data' && typeof envelope.data === 'string') {
      buffer.push(envelope.data);
    }
  });
  registerCloseHandler(() => closeHandler());
  return {
    kind: 'relay',
    send: (text) => {
      void encryptText(key, JSON.stringify({ kind: 'data', data: text })).then((cipher) =>
        connection.send(cipher),
      );
    },
    setMessageHandler: (handler) => buffer.setHandler(handler),
    setCloseHandler: (handler) => {
      closeHandler = handler;
    },
    close: () => connection.close(),
  };
}

interface SessionWiring {
  channel: Promise<SyncChannel>;
  cancel: () => void;
}

function wireSession(
  isHost: boolean,
  key: CryptoKey,
  connection: SignalingConnection,
  envelopeHandlers: Array<(envelope: RoomEnvelope) => void>,
  closeHandlers: Array<() => void>,
  peerJoined: Promise<void>,
): SessionWiring {
  let cancelled = false;
  let settled = false;

  const sendEnvelope = (envelope: RoomEnvelope) => {
    void encryptText(key, JSON.stringify(envelope)).then((cipher) => connection.send(cipher));
  };

  const peer = createWebRtcPeer(isHost, (signal) => sendEnvelope(signal));

  const relayChannel = () =>
    createRelayChannel(
      connection,
      key,
      (handler) => envelopeHandlers.push(handler),
      (handler) => closeHandlers.push(handler),
    );

  const channel = new Promise<SyncChannel>((resolve, reject) => {
    envelopeHandlers.push((envelope) => {
      if (envelope.kind === 'use-relay' && !settled) {
        settled = true;
        peer.destroy();
        resolve(relayChannel());
        return;
      }
      if (
        envelope.kind === 'rtc-offer' ||
        envelope.kind === 'rtc-answer' ||
        envelope.kind === 'rtc-candidate'
      ) {
        void peer.handleSignal(envelope as RtcSignal);
      }
    });

    void peer.channelOpen.then((openChannel) => {
      if (settled || cancelled) return;
      settled = true;
      // The room stays open underneath for 'responses' round-trips, but the
      // payload path is now P2P.
      resolve(openChannel);
    });

    void peerJoined.then(() => {
      // Host arbitrates the fallback after the timeout.
      if (!isHost) return;
      setTimeout(() => {
        if (settled || cancelled) return;
        settled = true;
        peer.destroy();
        sendEnvelope({ kind: 'use-relay' });
        resolve(relayChannel());
      }, WEBRTC_CONNECT_TIMEOUT_MS);
    });

    closeHandlers.push(() => {
      if (!settled) {
        settled = true;
        reject(new Error('peer_disconnected'));
      }
    });
  });

  return {
    channel,
    cancel: () => {
      cancelled = true;
      peer.destroy();
      connection.close();
    },
  };
}

async function openRoomConnection(
  code: string,
  key: CryptoKey,
): Promise<{
  connection: SignalingConnection;
  envelopeHandlers: Array<(envelope: RoomEnvelope) => void>;
  closeHandlers: Array<() => void>;
  peerJoined: Promise<void>;
  peerLeft: Promise<void>;
}> {
  const envelopeHandlers: Array<(envelope: RoomEnvelope) => void> = [];
  const closeHandlers: Array<() => void> = [];
  let resolveJoined: () => void = () => {};
  let resolveLeft: () => void = () => {};
  const peerJoined = new Promise<void>((resolve) => {
    resolveJoined = resolve;
  });
  const peerLeft = new Promise<void>((resolve) => {
    resolveLeft = resolve;
  });

  const connection = await connectToRoom(code, {
    onPeerJoined: () => resolveJoined(),
    onPeerLeft: () => resolveLeft(),
    onRelayMessage: (cipher) => {
      void decryptText(key, cipher).then((plain) => {
        if (plain === null) return;
        let envelope: RoomEnvelope;
        try {
          envelope = JSON.parse(plain) as RoomEnvelope;
        } catch {
          return;
        }
        for (const handler of [...envelopeHandlers]) handler(envelope);
      });
    },
    onClose: () => {
      for (const handler of [...closeHandlers]) handler();
    },
  });

  return { connection, envelopeHandlers, closeHandlers, peerJoined, peerLeft };
}

export async function hostSyncSession(purpose: SyncPurpose): Promise<HostedSession> {
  const code = await createRoom();
  const encodedKey = await generateSessionKey();
  const key = await importSessionKey(encodedKey);

  const { connection, envelopeHandlers, closeHandlers, peerJoined } = await openRoomConnection(
    code,
    key,
  );

  const wiring = wireSession(true, key, connection, envelopeHandlers, closeHandlers, peerJoined);

  const qrPayload: SessionQrPayload = { v: 1, kind: 'session', code, key: encodedKey, purpose };

  return {
    qrText: encodeQrPayload(qrPayload),
    code,
    channel: wiring.channel,
    cancel: wiring.cancel,
  };
}

export interface JoinedSession {
  channel: Promise<SyncChannel>;
  cancel: () => void;
}

export async function joinSyncSession(session: SessionQrPayload): Promise<JoinedSession> {
  const key = await importSessionKey(session.key);
  const { connection, envelopeHandlers, closeHandlers } = await openRoomConnection(
    session.code,
    key,
  );
  // Guest side: the host is already in the room, so signaling can start
  // immediately — peerJoined is irrelevant for the guest's fallback logic.
  const wiring = wireSession(
    false,
    key,
    connection,
    envelopeHandlers,
    closeHandlers,
    Promise.resolve(),
  );
  return { channel: wiring.channel, cancel: wiring.cancel };
}
