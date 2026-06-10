import { ICE_SERVERS } from './config';
import type { SyncChannel } from './channel';

/**
 * WebRTC leg of the DEC-103 channel. Signals (offer/answer/candidates) are
 * delivered by the caller — through the encrypted room online, or through
 * QR codes in the offline manual mode.
 */

export interface RtcSignal {
  kind: 'rtc-offer' | 'rtc-answer' | 'rtc-candidate';
  sdp?: string;
  candidate?: RTCIceCandidateInit | null;
}

export interface WebRtcPeer {
  peerConnection: RTCPeerConnection;
  /** Resolves when the data channel opens on both ends. */
  channelOpen: Promise<SyncChannel>;
  handleSignal: (signal: RtcSignal) => Promise<void>;
  destroy: () => void;
}

function wrapDataChannel(
  peerConnection: RTCPeerConnection,
  dataChannel: RTCDataChannel,
  kind: 'webrtc' | 'manual',
): SyncChannel {
  let messageHandler: (text: string) => void = () => {};
  let closeHandler: () => void = () => {};
  dataChannel.addEventListener('message', (event) => {
    if (typeof event.data === 'string') messageHandler(event.data);
  });
  dataChannel.addEventListener('close', () => closeHandler());
  return {
    kind,
    send: (text) => dataChannel.send(text),
    setMessageHandler: (handler) => {
      messageHandler = handler;
    },
    setCloseHandler: (handler) => {
      closeHandler = handler;
    },
    close: () => {
      try {
        dataChannel.close();
      } finally {
        peerConnection.close();
      }
    },
  };
}

export function createWebRtcPeer(
  isHost: boolean,
  sendSignal: (signal: RtcSignal) => void,
  options?: { iceServers?: RTCIceServer[]; channelKind?: 'webrtc' | 'manual' },
): WebRtcPeer {
  const peerConnection = new RTCPeerConnection({
    iceServers: options?.iceServers ?? ICE_SERVERS,
  });
  const channelKind = options?.channelKind ?? 'webrtc';

  let resolveChannel: (channel: SyncChannel) => void = () => {};
  const channelOpen = new Promise<SyncChannel>((resolve) => {
    resolveChannel = resolve;
  });

  const attachChannel = (dataChannel: RTCDataChannel) => {
    if (dataChannel.readyState === 'open') {
      resolveChannel(wrapDataChannel(peerConnection, dataChannel, channelKind));
      return;
    }
    dataChannel.addEventListener('open', () =>
      resolveChannel(wrapDataChannel(peerConnection, dataChannel, channelKind)),
    );
  };

  peerConnection.addEventListener('icecandidate', (event) => {
    sendSignal({ kind: 'rtc-candidate', candidate: event.candidate?.toJSON() ?? null });
  });

  if (isHost) {
    attachChannel(peerConnection.createDataChannel('sync'));
    void (async () => {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      sendSignal({ kind: 'rtc-offer', sdp: offer.sdp });
    })();
  } else {
    peerConnection.addEventListener('datachannel', (event) => attachChannel(event.channel));
  }

  const pendingCandidates: RTCIceCandidateInit[] = [];
  let remoteDescriptionSet = false;

  const handleSignal = async (signal: RtcSignal): Promise<void> => {
    if (signal.kind === 'rtc-offer' && !isHost && signal.sdp) {
      await peerConnection.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
      remoteDescriptionSet = true;
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      sendSignal({ kind: 'rtc-answer', sdp: answer.sdp });
    } else if (signal.kind === 'rtc-answer' && isHost && signal.sdp) {
      await peerConnection.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
      remoteDescriptionSet = true;
    } else if (signal.kind === 'rtc-candidate') {
      if (signal.candidate === null) return;
      if (!remoteDescriptionSet) {
        if (signal.candidate) pendingCandidates.push(signal.candidate);
        return;
      }
      if (signal.candidate) await peerConnection.addIceCandidate(signal.candidate);
    }
    if (remoteDescriptionSet && pendingCandidates.length > 0) {
      const queued = pendingCandidates.splice(0);
      for (const candidate of queued) await peerConnection.addIceCandidate(candidate);
    }
  };

  return {
    peerConnection,
    channelOpen,
    handleSignal,
    destroy: () => peerConnection.close(),
  };
}
