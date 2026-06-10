import { getSyncWorkerUrl } from './config';

/**
 * Thin WebSocket client for the trippilot-sync room (DEC-107). Carries only
 * strings the caller already encrypted; the worker relays them opaquely.
 */

export interface SignalingEvents {
  onPeerJoined: () => void;
  onPeerLeft: () => void;
  onRelayMessage: (data: string) => void;
  onClose: () => void;
}

export interface SignalingConnection {
  send: (data: string) => void;
  close: () => void;
}

export async function createRoom(): Promise<string> {
  const response = await fetch(`${getSyncWorkerUrl()}/rooms`, { method: 'POST' });
  if (!response.ok) throw new Error('room_create_failed');
  const body = (await response.json()) as { code?: string };
  if (!body.code) throw new Error('room_create_failed');
  return body.code;
}

export function connectToRoom(code: string, events: SignalingEvents): Promise<SignalingConnection> {
  return new Promise((resolve, reject) => {
    const wsUrl = getSyncWorkerUrl().replace(/^http/, 'ws');
    const socket = new WebSocket(`${wsUrl}/rooms/${code}/ws`);
    let settled = false;

    socket.addEventListener('open', () => {
      settled = true;
      resolve({
        send: (data) => socket.send(data),
        close: () => socket.close(1000, 'done'),
      });
    });

    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return;
      // Control frames come from the DO unencrypted; everything else is
      // ciphertext relayed from the peer.
      if (event.data === '{"type":"peer-joined"}') {
        events.onPeerJoined();
        return;
      }
      if (event.data === '{"type":"peer-left"}') {
        events.onPeerLeft();
        return;
      }
      events.onRelayMessage(event.data);
    });

    socket.addEventListener('close', () => {
      if (!settled) {
        settled = true;
        reject(new Error('room_connect_failed'));
        return;
      }
      events.onClose();
    });

    socket.addEventListener('error', () => {
      if (!settled) {
        settled = true;
        reject(new Error('room_connect_failed'));
      }
    });
  });
}
