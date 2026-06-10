import { createWebRtcPeer } from './webrtc-transport';
import type { WebRtcPeer, RtcSignal } from './webrtc-transport';
import { encodeQrPayload, decodeQrPayload, fitsInSingleQr } from '@/domain/sync';
import type { SyncChannel } from './channel';

/**
 * DEC-103 offline mode: two-QR manual signaling. No worker, no internet —
 * both phones must share a local network (same Wi-Fi or one hosting a
 * hotspot). The SDPs ride inside QR codes; the DataChannel itself is
 * already encrypted by DTLS.
 */

const ICE_GATHERING_TIMEOUT_MS = 4000;

export class ManualSignalingError extends Error {
  constructor(public readonly code: 'qr_too_large' | 'invalid_qr' | 'connect_failed') {
    super(code);
    this.name = 'ManualSignalingError';
  }
}

function waitIceComplete(peerConnection: RTCPeerConnection): Promise<void> {
  if (peerConnection.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ICE_GATHERING_TIMEOUT_MS);
    peerConnection.addEventListener('icegatheringstatechange', () => {
      if (peerConnection.iceGatheringState === 'complete') {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

export interface ManualOfferSide {
  offerQrText: string;
  channelOpen: Promise<SyncChannel>;
  acceptAnswerQr: (qrText: string) => Promise<void>;
  destroy: () => void;
}

/** Host side: generates the first QR (offer) and waits for the answer scan. */
export async function createManualOffer(): Promise<ManualOfferSide> {
  // ICE candidates are bundled into the SDP (no trickle over QR codes).
  const peer: WebRtcPeer = createWebRtcPeer(true, () => {}, {
    iceServers: [],
    channelKind: 'manual',
  });

  await waitIceComplete(peer.peerConnection);
  const sdp = peer.peerConnection.localDescription?.sdp;
  if (!sdp) throw new ManualSignalingError('connect_failed');

  const offerQrText = encodeQrPayload({ v: 1, kind: 'offer', sdp });
  if (!fitsInSingleQr(offerQrText)) {
    peer.destroy();
    throw new ManualSignalingError('qr_too_large');
  }

  return {
    offerQrText,
    channelOpen: peer.channelOpen,
    acceptAnswerQr: async (qrText) => {
      const decoded = decodeQrPayload(qrText);
      if (!decoded || decoded.kind !== 'answer') throw new ManualSignalingError('invalid_qr');
      const signal: RtcSignal = { kind: 'rtc-answer', sdp: decoded.sdp };
      await peer.handleSignal(signal);
    },
    destroy: () => peer.destroy(),
  };
}

export interface ManualAnswerSide {
  answerQrText: string;
  channelOpen: Promise<SyncChannel>;
  destroy: () => void;
}

/** Guest side: scans the offer QR and produces the answer QR. */
export async function acceptManualOffer(offerQrText: string): Promise<ManualAnswerSide> {
  const decoded = decodeQrPayload(offerQrText);
  if (!decoded || decoded.kind !== 'offer') throw new ManualSignalingError('invalid_qr');

  let answerSdp: string | null = null;
  const peer = createWebRtcPeer(
    false,
    (signal) => {
      if (signal.kind === 'rtc-answer' && signal.sdp) answerSdp = signal.sdp;
    },
    { iceServers: [], channelKind: 'manual' },
  );

  await peer.handleSignal({ kind: 'rtc-offer', sdp: decoded.sdp });
  await waitIceComplete(peer.peerConnection);

  const finalSdp = peer.peerConnection.localDescription?.sdp ?? answerSdp;
  if (!finalSdp) {
    peer.destroy();
    throw new ManualSignalingError('connect_failed');
  }

  const answerQrText = encodeQrPayload({ v: 1, kind: 'answer', sdp: finalSdp });
  if (!fitsInSingleQr(answerQrText)) {
    peer.destroy();
    throw new ManualSignalingError('qr_too_large');
  }

  return {
    answerQrText,
    channelOpen: peer.channelOpen,
    destroy: () => peer.destroy(),
  };
}
