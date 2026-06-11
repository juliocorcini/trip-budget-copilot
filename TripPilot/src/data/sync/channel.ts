/** Transport-agnostic channel both WebRTC and the encrypted relay implement. */
export interface SyncChannel {
  readonly kind: 'webrtc' | 'relay' | 'manual';
  send: (text: string) => void;
  setMessageHandler: (handler: (text: string) => void) => void;
  setCloseHandler: (handler: () => void) => void;
  close: () => void;
}

export interface MessageBuffer {
  push: (text: string) => void;
  setHandler: (handler: (text: string) => void) => void;
}

/**
 * R6-07: buffers frames that arrive before the consumer attaches its handler.
 * A data channel can open (and deliver) milliseconds before the SyncSession
 * starts listening — without this buffer those frames were silently dropped,
 * which is why first connection attempts timed out on both sides.
 */
export function createMessageBuffer(): MessageBuffer {
  let handler: ((text: string) => void) | null = null;
  const pending: string[] = [];
  return {
    push: (text) => {
      if (handler) handler(text);
      else pending.push(text);
    },
    setHandler: (next) => {
      handler = next;
      for (const text of pending.splice(0)) next(text);
    },
  };
}
