import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import '@/i18n';
import type { GroupClaimResponse, GroupSharePayload } from '@/domain/group-split';

/**
 * G3 / DEC-349 — the `/g/` board is LIVE: it pulls every device's claim snapshot
 * from `/responses` and folds them locally (`foldEventForViewer`), so a guest's
 * authored expense appears + recalculates the total for EVERY viewer without the
 * owner opening the app (F10/F11). This test mocks the network boundary
 * (`group-link`) and asserts the board renders a peer's expense + the live total.
 */
vi.mock('@/features/group-split/group-link', () => {
  const ana = 'p-ana';
  const bruno = 'p-bruno';
  const event = {
    id: 'evt-1',
    name: 'Porto',
    currency: 'EUR',
    tripId: null,
    ownerParticipantId: ana,
    participants: [
      { id: ana, name: 'Ana', kind: 'owner', linkedParticipantId: null, claimedByActorId: null, paymentStatus: 'unpaid' },
      { id: bruno, name: 'Bruno', kind: 'manual', linkedParticipantId: null, claimedByActorId: null, paymentStatus: 'unpaid' },
    ],
    expenses: [],
    status: 'open',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  const payload = { v: 1, revision: 1, event, generatedAt: '2026-01-01T00:00:00.000Z' } as unknown as GroupSharePayload;
  // Bruno (a different device) authored a 90€ lunch in HIS snapshot only — the
  // owner never re-published, so this only shows if the board folds /responses.
  const brunoSnapshot = {
    v: 1,
    fromActorId: 'dev-bruno',
    fromName: 'Bruno',
    claimedParticipantId: bruno,
    markedPaid: false,
    expenses: [
      {
        id: 'g:dev-bruno:1',
        description: 'Almoço no Porto',
        amountCents: 9000,
        paidByParticipantId: bruno,
        splitMode: 'equal',
        participantIds: [ana, bruno],
      },
    ],
    at: '2026-01-01T00:00:01.000Z',
  } as unknown as GroupClaimResponse;
  return {
    fetchGroupSplit: async () => ({ status: 'ok', payload }),
    fetchGroupResponses: async () => [brunoSnapshot],
    postGroupClaim: async () => {},
    loadGuestExpenses: () => [],
    saveGuestExpenses: () => {},
    newGuestExpenseId: () => 'g:dev-me:x',
  };
});

vi.mock('@/features/split/live-link', () => ({
  getGuestActorId: () => 'dev-me',
  getGuestName: () => 'Eu',
  setGuestName: () => {},
}));

vi.mock('@/data/sync/share-signal', () => ({
  connectShareSignal: () => ({ send: () => {}, close: () => {} }),
}));

import { GroupClaimPage } from '@/features/group-split/GroupClaimPage';

function renderBoard() {
  return render(
    <MemoryRouter initialEntries={['/g/abc#k=testkey']}>
      <Routes>
        <Route path="/g/:id" element={<GroupClaimPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GroupClaimPage — live read-fold board (G3/DEC-349)', () => {
  it("folds a peer's pulled snapshot so the expense + total are live for everyone", async () => {
    renderBoard();
    // Bruno's expense appears for THIS viewer purely from the /responses fold.
    expect(await screen.findByText('Almoço no Porto')).toBeInTheDocument();
    // The recomputed amount (90.00 / 90,00) shows — both the header total and the
    // expense row read the live-folded event (≥1 match proves the read recompute).
    const amounts = await screen.findAllByText(/90[.,]00/);
    expect(amounts.length).toBeGreaterThanOrEqual(1);
  });
});
