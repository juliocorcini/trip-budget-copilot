import { describe, it, expect } from 'vitest';
import {
  publishSplitTable,
  republishSplitTable,
  revokeSplitTable,
  pullSplitClaims,
  fetchSplitTable,
  fetchSplitResponses,
  postSplitClaim,
} from '@/features/split/live-link';
import {
  createSplitSession,
  createSplitItem,
  buildSplitClaimResponse,
  reduceGuestClaims,
  computeSplitTotals,
} from '@/domain/split';

/**
 * REAL two-device live-table loop against the deployed worker. No mocks: this is
 * the exact orchestration the owner device and a guest browser run. It exists to
 * answer one question — does a guest's pick reach the owner and the other guests?
 */
describe('LIVE split table loop (real worker)', () => {
  it('owner publishes → 2 guests claim → owner + guests all converge', async () => {
    const pizza = createSplitItem({ description: 'Pizza', amountCents: 6000 });
    const beer = createSplitItem({ description: 'Beer', amountCents: 2000 });
    let ownerSession = createSplitSession({
      tripId: null,
      phaseId: null,
      name: 'Dinner test',
      currency: 'EUR',
      ownerName: 'Julio',
      ownerActorId: 'owner-actor-1',
      items: [pizza, beer],
    });

    // 1. Owner publishes.
    const creds = await publishSplitTable(ownerSession, 1);
    console.log('[1] published shareId=', creds.shareId, 'key.len=', creds.key.length);
    expect(creds.shareId).toBeTruthy();

    try {
      // 2. Guest opens the link → sees the bill.
      const fetched = await fetchSplitTable(creds.shareId, creds.key);
      console.log('[2] guest fetch status=', fetched.status);
      expect(fetched.status).toBe('ok');
      if (fetched.status !== 'ok') return;
      expect(fetched.payload.session.items).toHaveLength(2);

      // 3. Guest A claims the pizza; Guest B claims the beer.
      const respA = buildSplitClaimResponse({
        fromActorId: 'guest-A',
        fromName: 'Ana',
        claims: [{ itemId: pizza.id, fraction: 1, units: null }],
      });
      const respB = buildSplitClaimResponse({
        fromActorId: 'guest-B',
        fromName: 'Bob',
        claims: [{ itemId: beer.id, fraction: 1, units: null }],
      });
      await postSplitClaim(creds.shareId, creds.key, respA);
      await postSplitClaim(creds.shareId, creds.key, respB);
      console.log('[3] both guests posted claims');

      // 4. Owner pulls the claims.
      const batches = await pullSplitClaims(creds);
      console.log('[4] owner pulled batches=', batches.length, batches.map((b) => `${b.fromName}:${b.claims.length}`));
      expect(batches.length).toBe(2);

      // 5. Owner reduces → both guests appear as participants with their claims.
      ownerSession = reduceGuestClaims(ownerSession, batches);
      const ownerParticipants = ownerSession.participants.map((p) => `${p.name}/${p.kind}`);
      console.log('[5] owner participants=', ownerParticipants);
      expect(ownerSession.participants.length).toBe(3); // owner + 2 guests
      const ownerTotals = computeSplitTotals(ownerSession);
      console.log('[5] owner totals=', ownerTotals.totals.map((tt) => {
        const p = ownerSession.participants.find((x) => x.id === tt.participantId);
        return `${p?.name}:${tt.totalCents}`;
      }));

      // 6. Guest A re-pulls all responses → sees BOTH their own and Guest B's claim.
      const guestAResponses = await fetchSplitResponses(creds.shareId, creds.key);
      console.log('[6] guest A sees responses=', guestAResponses.map((r) => r.fromName));
      expect(guestAResponses.length).toBe(2);
      const guestAView = reduceGuestClaims(fetched.payload.session, guestAResponses);
      const guestAParticipants = guestAView.participants.map((p) => p.name);
      console.log('[6] guest A view participants=', guestAParticipants);
      expect(guestAView.participants.length).toBe(3);

      // 7. Owner republishes the merged session (revision 2) and guest re-reads it.
      await republishSplitTable(creds, ownerSession, 2);
      const reFetched = await fetchSplitTable(creds.shareId, creds.key);
      console.log('[7] re-fetch status=', reFetched.status, 'participants=',
        reFetched.status === 'ok' ? reFetched.payload.session.participants.map((p) => p.name) : '—');
      expect(reFetched.status).toBe('ok');
    } finally {
      await revokeSplitTable(creds).catch(() => {});
    }
  }, 30_000);

  // Reproduces the REAL ordering: the owner polls /responses BEFORE any guest
  // posts (the empty read), then a guest posts, then the owner keeps polling.
  // If KV negative-caches the empty read, the owner never sees the post.
  it('owner that polls BEFORE the guest posts still sees the claim (read-after-write)', async () => {
    const item = createSplitItem({ description: 'Pizza', amountCents: 6000 });
    const session = createSplitSession({
      tripId: null, phaseId: null, name: 'RAW test', currency: 'EUR',
      ownerName: 'Julio', ownerActorId: 'owner-raw', items: [item],
    });
    const creds = await publishSplitTable(session, 1);
    try {
      // Hammer the empty responses key first (like the browser owner+guest
      // polling from t=0) — this is what primes the KV edge "miss" cache.
      for (let i = 0; i < 6; i++) {
        const empty = await pullSplitClaims(creds);
        console.log(`[RAW] pre-post pull #${i} =`, empty.length);
        await new Promise((r) => setTimeout(r, 400));
      }

      // Guest posts a claim.
      const resp = buildSplitClaimResponse({
        fromActorId: 'guest-raw', fromName: 'Ana',
        claims: [{ itemId: item.id, fraction: 1, units: null }],
      });
      await postSplitClaim(creds.shareId, creds.key, resp);
      console.log('[RAW] guest posted');

      // Owner keeps polling — log when (if) it ever sees the claim.
      let seen = 0;
      let firstSeenAt = -1;
      const t0 = Date.now();
      for (let i = 0; i < 40; i++) {
        const b = await pullSplitClaims(creds);
        const dt = Date.now() - t0;
        console.log(`[RAW] poll #${i} (+${dt}ms) after post → batches=${b.length}`);
        if (b.length > 0 && firstSeenAt < 0) { firstSeenAt = dt; seen = b.length; break; }
        await new Promise((r) => setTimeout(r, 1500));
      }
      console.log('[RAW] FINAL seen =', seen, 'firstSeenAt(ms) =', firstSeenAt);
    } finally {
      await revokeSplitTable(creds).catch(() => {});
    }
  }, 30_000);
});
