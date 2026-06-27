/**
 * DEC-375 (wave 2026-06-27, G2) — honest P2P delivery status (Â-HONEST).
 *
 * A send over the E2E mailbox can fail for distinct reasons that the UI used to
 * collapse into ONE message — "sem internet, vai enviar quando voltar" — even
 * when the device was clearly online. This pure layer names the real reason and
 * maps it to honest copy + whether a real "try again" makes sense, so the app
 * never claims "offline" while online. No IO, no React — the orchestrators
 * produce the reason, the UI renders the copy.
 */

export type DeliveryReason =
  /** The blob reached the worker now. */
  | 'ok'
  /** The network itself failed (the fetch threw) — genuinely offline; queued. */
  | 'queued_offline'
  /** The server answered with an error (reachable but refused/at capacity) — retry. */
  | 'server_error'
  /** No connection key for this peer — must connect first (cannot seal to no key). */
  | 'no_peer_key';

/** The failure reasons (everything except a successful send). */
export type DeliveryFailureReason = Exclude<DeliveryReason, 'ok'>;

/**
 * Classify a thrown send error into "offline" vs "server error". `postToMailbox`
 * throws `mailbox_post_<status>` when the worker answered a non-OK HTTP status
 * (reachable but refused — e.g. the 500 from the duration cap) and a bare network
 * error (TypeError "Failed to fetch") when the fetch itself never reached a
 * server. A trailing 4xx/5xx status means the server was reached → server_error;
 * anything else is treated as offline (the only case where "no internet" is true).
 */
export function classifySendFailure(error: unknown): Extract<DeliveryReason, 'queued_offline' | 'server_error'> {
  const message = error instanceof Error ? error.message : String(error);
  return /[_-][45]\d\d$/.test(message) ? 'server_error' : 'queued_offline';
}

export type DeliveryTone = 'success' | 'info' | 'danger';

export interface DeliveryFailureCopy {
  /** i18n key for the honest toast message. */
  messageKey: string;
  tone: DeliveryTone;
  /** True only for server_error — the network is up, so a real retry can work. */
  canRetry: boolean;
}

const FAILURE_COPY: Record<DeliveryFailureReason, DeliveryFailureCopy> = {
  // The ONLY case where "sem internet — vai enviar quando voltar" is the truth.
  queued_offline: { messageKey: 'p2p.delivery_offline', tone: 'info', canRetry: false },
  // Online but the server refused/was capped — honest copy + a real "try again".
  server_error: { messageKey: 'p2p.delivery_server_error', tone: 'danger', canRetry: true },
  // We never had a key for this peer — connecting first is the real fix.
  no_peer_key: { messageKey: 'p2p.delivery_no_connection', tone: 'danger', canRetry: false },
};

/** Honest copy + retry affordance for a failed send. Total over every reason. */
export function resolveDeliveryFailureCopy(reason: DeliveryFailureReason): DeliveryFailureCopy {
  return FAILURE_COPY[reason];
}
