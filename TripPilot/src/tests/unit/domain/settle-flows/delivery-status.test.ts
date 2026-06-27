import { describe, it, expect } from 'vitest';
import {
  classifySendFailure,
  resolveDeliveryFailureCopy,
  type DeliveryFailureReason,
} from '@/domain/settle-flows/delivery-status';

/**
 * DEC-375 (G2, Â-HONEST) — the app must never claim "sem internet" while online.
 * classifySendFailure reads the thrown send error and decides offline vs server
 * error; resolveDeliveryFailureCopy maps every reason to honest copy + whether a
 * real "try again" makes sense.
 */
describe('classifySendFailure (DEC-375)', () => {
  it('treats a trailing HTTP 5xx status as server_error (reachable but refused)', () => {
    // postToMailbox throws `mailbox_post_<status>` when the worker answered non-OK.
    expect(classifySendFailure(new Error('mailbox_post_500'))).toBe('server_error');
    expect(classifySendFailure(new Error('mailbox_post_503'))).toBe('server_error');
  });

  it('treats a trailing HTTP 4xx status as server_error (server reached, refused)', () => {
    expect(classifySendFailure(new Error('mailbox_post_404'))).toBe('server_error');
    expect(classifySendFailure(new Error('mailbox_post_429'))).toBe('server_error');
  });

  it('treats a bare network failure (fetch threw) as queued_offline', () => {
    // The only case where "no internet" is the truth: the fetch never reached a server.
    expect(classifySendFailure(new TypeError('Failed to fetch'))).toBe('queued_offline');
    expect(classifySendFailure(new Error('NetworkError when attempting to fetch resource.'))).toBe(
      'queued_offline',
    );
  });

  it('treats a non-Error throw as queued_offline (no status to read)', () => {
    expect(classifySendFailure('boom')).toBe('queued_offline');
    expect(classifySendFailure(undefined)).toBe('queued_offline');
  });

  it('does not misread a 3-digit run inside a word as a status code', () => {
    // Only a status at the END of the message counts — avoids false server_error.
    expect(classifySendFailure(new Error('timeout_after_5000ms'))).toBe('queued_offline');
  });
});

describe('resolveDeliveryFailureCopy (DEC-375)', () => {
  it('offline is informative, no retry button (the queue auto-retries when back)', () => {
    const copy = resolveDeliveryFailureCopy('queued_offline');
    expect(copy.messageKey).toBe('p2p.delivery_offline');
    expect(copy.tone).toBe('info');
    expect(copy.canRetry).toBe(false);
  });

  it('server_error is the ONLY reason that offers a real retry (network is up)', () => {
    const copy = resolveDeliveryFailureCopy('server_error');
    expect(copy.messageKey).toBe('p2p.delivery_server_error');
    expect(copy.tone).toBe('danger');
    expect(copy.canRetry).toBe(true);
  });

  it('no_peer_key points at connecting first, never a pointless retry', () => {
    const copy = resolveDeliveryFailureCopy('no_peer_key');
    expect(copy.messageKey).toBe('p2p.delivery_no_connection');
    expect(copy.tone).toBe('danger');
    expect(copy.canRetry).toBe(false);
  });

  it('is total over every failure reason (no missing branch)', () => {
    const reasons: DeliveryFailureReason[] = ['queued_offline', 'server_error', 'no_peer_key'];
    for (const reason of reasons) {
      const copy = resolveDeliveryFailureCopy(reason);
      expect(typeof copy.messageKey).toBe('string');
      expect(copy.messageKey.length).toBeGreaterThan(0);
      expect(['success', 'info', 'danger']).toContain(copy.tone);
      // Exactly one reason allows a real retry.
      expect(copy.canRetry).toBe(reason === 'server_error');
    }
  });
});
