import { getSyncWorkerUrl } from './config';

/**
 * FIELD item 8: thin HTTP client for the worker mailbox. POST drops a sealed
 * blob addressed to the recipient's actorId; GET drains (and deletes) every
 * message waiting for our own actorId. The worker only ever sees ciphertext.
 */

export interface DrainedMessage {
  id: string;
  at: number;
  blob: string;
}

function mailboxUrl(actorId: string): string {
  return `${getSyncWorkerUrl()}/mailbox/${encodeURIComponent(actorId)}`;
}

export async function postToMailbox(recipientActorId: string, sealedBlob: string): Promise<void> {
  const res = await fetch(mailboxUrl(recipientActorId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blob: sealedBlob }),
  });
  if (!res.ok) throw new Error(`mailbox_post_${res.status}`);
}

export async function drainMailbox(actorId: string): Promise<DrainedMessage[]> {
  const res = await fetch(mailboxUrl(actorId));
  if (!res.ok) throw new Error(`mailbox_drain_${res.status}`);
  const json = (await res.json()) as { messages?: DrainedMessage[] };
  return json.messages ?? [];
}
