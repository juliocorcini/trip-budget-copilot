/** Transport-agnostic channel both WebRTC and the encrypted relay implement. */
export interface SyncChannel {
  readonly kind: 'webrtc' | 'relay' | 'manual';
  send: (text: string) => void;
  setMessageHandler: (handler: (text: string) => void) => void;
  setCloseHandler: (handler: () => void) => void;
  close: () => void;
}
