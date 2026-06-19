import { getSyncWorkerUrl } from './config';

/**
 * DEC-207 — HTTP client for the worker's persistent share channel. Mirrors
 * mailbox-client: plain fetch to the worker (which sends `Access-Control-Allow-
 * Origin: *`, so it works from the native WebView too). Every payload is opaque
 * ciphertext — the worker can read nothing. The owner holds a write token that
 * gates statement update / revoke / response pull.
 */

const TOKEN_HEADER = 'X-Share-Token';

function shareUrl(path = ''): string {
  return `${getSyncWorkerUrl()}/share${path}`;
}

export interface CreateShareResult {
  id: string;
  writeToken: string;
  expiresAt: number;
}

export async function createShare(blob: string, revision: number): Promise<CreateShareResult> {
  const res = await fetch(shareUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blob, revision }),
  });
  if (!res.ok) throw new Error(`share_create_${res.status}`);
  return (await res.json()) as CreateShareResult;
}

export type ShareStatementResult =
  | { status: 'ok'; blob: string; revision: number; updatedAt: number }
  | { status: 'revoked' }
  | { status: 'not_found' }
  | { status: 'error' };

export async function getShareStatement(id: string): Promise<ShareStatementResult> {
  let res: Response;
  try {
    // `no-store`: this is a live polling read. Without it the browser/WebView
    // (and any intermediary) may serve a cached body, so a guest never sees the
    // owner's later edits — the live table looks frozen. The worker also sends
    // `Cache-Control: no-store`, but forcing it here covers older deploys too.
    res = await fetch(shareUrl(`/${encodeURIComponent(id)}`), { cache: 'no-store' });
  } catch {
    return { status: 'error' };
  }
  if (res.status === 410) return { status: 'revoked' };
  if (res.status === 404) return { status: 'not_found' };
  if (!res.ok) return { status: 'error' };
  const json = (await res.json()) as { blob: string; revision: number; updatedAt: number };
  return { status: 'ok', blob: json.blob, revision: json.revision, updatedAt: json.updatedAt };
}

export async function putShareStatement(
  id: string,
  writeToken: string,
  blob: string,
  revision: number,
): Promise<void> {
  const res = await fetch(shareUrl(`/${encodeURIComponent(id)}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', [TOKEN_HEADER]: writeToken },
    body: JSON.stringify({ blob, revision }),
  });
  if (!res.ok) throw new Error(`share_put_${res.status}`);
}

export async function revokeShare(id: string, writeToken: string): Promise<void> {
  const res = await fetch(shareUrl(`/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: { [TOKEN_HEADER]: writeToken },
  });
  // A revoked/expired link is already gone — treat 404/410 as success.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`share_revoke_${res.status}`);
  }
}

export async function postShareResponse(id: string, responseId: string, blob: string): Promise<void> {
  const res = await fetch(shareUrl(`/${encodeURIComponent(id)}/responses`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: responseId, blob }),
  });
  if (!res.ok) throw new Error(`share_response_${res.status}`);
}

export interface ShareResponseItem {
  id: string;
  blob: string;
  at: number;
}

/**
 * Read responses. The write token is OPTIONAL: the worker treats the read as a
 * capability of the link itself (any holder can already read the statement), so
 * a guest with only the id+key can pull every guest's (still-encrypted) response
 * and compute the live table deterministically — no owner relay required. The
 * owner may still pass its token; it is simply ignored for reads.
 */
export async function getShareResponses(id: string, writeToken?: string): Promise<ShareResponseItem[]> {
  const headers: Record<string, string> = {};
  if (writeToken) headers[TOKEN_HEADER] = writeToken;
  // `no-store`: this is the live claim poll. Browser HTTP caching of this GET is
  // exactly what froze the live table (even the writer read back its own empty
  // list), so every poll must hit the network.
  const res = await fetch(shareUrl(`/${encodeURIComponent(id)}/responses`), { headers, cache: 'no-store' });
  if (!res.ok) throw new Error(`share_responses_${res.status}`);
  const json = (await res.json()) as { items?: ShareResponseItem[] };
  return json.items ?? [];
}
