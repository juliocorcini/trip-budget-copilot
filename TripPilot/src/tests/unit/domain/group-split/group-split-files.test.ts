import { describe, it, expect } from 'vitest';
import {
  addParticipant,
  buildGroupSharePayload,
  computeGroupBalances,
  createGroupParticipant,
  createGroupSplitEvent,
  foldEventForViewer,
  parseGroupSharePayload,
  addExpense,
} from '@/domain/group-split';
import type { GroupExpense, GroupSplitEvent } from '@/domain/group-split';
import type { FileRef } from '@/domain/media';

const samplePdf: FileRef = {
  r2Id: 'r2-hotel-pdf',
  mime: 'application/pdf',
  name: 'hotel-reservation.pdf',
  description: 'Reserva Hotel Marriott Lisboa - 3 noites',
  byteSize: 2_400_000,
};

const sampleDoc: FileRef = {
  r2Id: 'r2-itinerary-doc',
  mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  name: 'itinerary.docx',
  byteSize: 850_000,
};

function buildTestEvent(): GroupSplitEvent {
  const base = createGroupSplitEvent({ name: 'Eurotrip', currency: 'EUR', ownerName: 'Julio' });
  return addParticipant(base, createGroupParticipant({ name: 'Marina' }));
}

function makeExpenseWithFiles(event: GroupSplitEvent, fileRefs: FileRef[]): GroupExpense {
  const owner = event.participants[0]!;
  const marina = event.participants[1]!;
  return {
    id: 'exp-hotel',
    description: 'Hotel Lisboa',
    amountCents: 30000,
    paidByParticipantId: owner.id,
    splitMode: 'equal',
    participantIds: [owner.id, marina.id],
    customAmountsCents: {},
    category: 'accommodation',
    source: 'manual',
    createdAt: '2026-07-01T10:00:00.000Z',
    fileRefs,
  };
}

describe('fileRefs travel through share payload (build → serialize → parse)', () => {
  it('round-trips an expense with a single PDF file attachment', () => {
    const event = buildTestEvent();
    const expense = makeExpenseWithFiles(event, [samplePdf]);
    const withExpense: GroupSplitEvent = { ...event, expenses: [expense] };

    const payload = buildGroupSharePayload(withExpense, 1);
    const serialized = JSON.parse(JSON.stringify(payload));
    const parsed = parseGroupSharePayload(serialized);

    expect(parsed).not.toBeNull();
    const parsedExpense = parsed!.event.expenses[0]!;
    expect(parsedExpense.fileRefs).toHaveLength(1);
    expect(parsedExpense.fileRefs![0]).toEqual(samplePdf);
  });

  it('round-trips multiple file attachments on one expense', () => {
    const event = buildTestEvent();
    const expense = makeExpenseWithFiles(event, [samplePdf, sampleDoc]);
    const withExpense: GroupSplitEvent = { ...event, expenses: [expense] };

    const payload = buildGroupSharePayload(withExpense, 2);
    const serialized = JSON.parse(JSON.stringify(payload));
    const parsed = parseGroupSharePayload(serialized);

    expect(parsed).not.toBeNull();
    expect(parsed!.event.expenses[0]!.fileRefs).toEqual([samplePdf, sampleDoc]);
  });

  it('round-trips an expense without fileRefs (backward-compat)', () => {
    const event = buildTestEvent();
    const owner = event.participants[0]!;
    const marina = event.participants[1]!;
    const expenseNoFiles: GroupExpense = {
      id: 'exp-taxi',
      description: 'Taxi Airport',
      amountCents: 4500,
      paidByParticipantId: owner.id,
      splitMode: 'equal',
      participantIds: [owner.id, marina.id],
      customAmountsCents: {},
      category: 'transport',
      source: 'manual',
      createdAt: '2026-07-01T08:00:00.000Z',
    };
    const withExpense: GroupSplitEvent = { ...event, expenses: [expenseNoFiles] };

    const payload = buildGroupSharePayload(withExpense, 1);
    const serialized = JSON.parse(JSON.stringify(payload));
    const parsed = parseGroupSharePayload(serialized);

    expect(parsed).not.toBeNull();
    expect(parsed!.event.expenses[0]!.fileRefs).toBeUndefined();
  });

  it('preserves fileRef description as optional (undefined when omitted)', () => {
    const event = buildTestEvent();
    const expense = makeExpenseWithFiles(event, [sampleDoc]);
    const withExpense: GroupSplitEvent = { ...event, expenses: [expense] };

    const payload = buildGroupSharePayload(withExpense, 1);
    const serialized = JSON.parse(JSON.stringify(payload));
    const parsed = parseGroupSharePayload(serialized);

    const ref = parsed!.event.expenses[0]!.fileRefs![0]!;
    expect(ref.description).toBeUndefined();
    expect(ref.name).toBe('itinerary.docx');
  });
});

describe('fileRefs survive foldEventForViewer without corrupting ledger math', () => {
  it('fold with empty responses preserves fileRefs on the base expense', () => {
    const event = buildTestEvent();
    const expense = makeExpenseWithFiles(event, [samplePdf]);
    const withExpense: GroupSplitEvent = { ...event, expenses: [expense] };

    const folded = foldEventForViewer(withExpense, []);

    expect(folded.expenses[0]!.fileRefs).toEqual([samplePdf]);

    const net = new Map(computeGroupBalances(folded).map((b) => [b.participantId, b.netCents]));
    const owner = event.participants[0]!;
    const marina = event.participants[1]!;
    expect(net.get(owner.id)).toBe(15000);
    expect(net.get(marina.id)).toBe(-15000);
    expect((net.get(owner.id) ?? 0) + (net.get(marina.id) ?? 0)).toBe(0);
  });

  it('coexists with imageRefs on the same expense without interference', () => {
    const event = buildTestEvent();
    const owner = event.participants[0]!;
    const marina = event.participants[1]!;
    const expense: GroupExpense = {
      id: 'exp-dinner',
      description: 'Restaurant Bill',
      amountCents: 8000,
      paidByParticipantId: owner.id,
      splitMode: 'equal',
      participantIds: [owner.id, marina.id],
      customAmountsCents: {},
      category: 'food',
      source: 'manual',
      createdAt: '2026-07-02T20:00:00.000Z',
      imageRefs: [{ r2Id: 'r2-receipt', mime: 'image/jpeg', w: 800, h: 600 }],
      fileRefs: [samplePdf],
    };
    const withExpense: GroupSplitEvent = { ...event, expenses: [expense] };

    const payload = buildGroupSharePayload(withExpense, 1);
    const parsed = parseGroupSharePayload(JSON.parse(JSON.stringify(payload)));
    expect(parsed).not.toBeNull();

    const parsedExp = parsed!.event.expenses[0]!;
    expect(parsedExp.imageRefs).toHaveLength(1);
    expect(parsedExp.imageRefs![0]!.r2Id).toBe('r2-receipt');
    expect(parsedExp.fileRefs).toHaveLength(1);
    expect(parsedExp.fileRefs![0]!.r2Id).toBe('r2-hotel-pdf');
  });
});

describe('parseGroupSharePayload rejects invalid fileRefs', () => {
  function buildMinimalPayload(fileRefs: unknown) {
    const event = buildTestEvent();
    const owner = event.participants[0]!;
    const marina = event.participants[1]!;
    return {
      v: 1,
      revision: 0,
      generatedAt: '2026-07-01T00:00:00.000Z',
      event: {
        ...event,
        expenses: [
          {
            id: 'e1',
            description: 'Test',
            amountCents: 100,
            paidByParticipantId: owner.id,
            splitMode: 'equal',
            participantIds: [owner.id, marina.id],
            customAmountsCents: {},
            category: 'other',
            source: 'manual',
            createdAt: '2026-07-01T00:00:00.000Z',
            fileRefs,
          },
        ],
      },
    };
  }

  it('rejects fileRef with negative byteSize', () => {
    const payload = buildMinimalPayload([{ ...samplePdf, byteSize: -1 }]);
    expect(parseGroupSharePayload(payload)).toBeNull();
  });

  it('rejects fileRef with non-integer byteSize', () => {
    const payload = buildMinimalPayload([{ ...samplePdf, byteSize: 1.7 }]);
    expect(parseGroupSharePayload(payload)).toBeNull();
  });

  it('rejects fileRef missing required name', () => {
    const { name: _, ...noName } = samplePdf;
    const payload = buildMinimalPayload([noName]);
    expect(parseGroupSharePayload(payload)).toBeNull();
  });

  it('rejects fileRef missing required r2Id', () => {
    const { r2Id: _, ...noId } = samplePdf;
    const payload = buildMinimalPayload([noId]);
    expect(parseGroupSharePayload(payload)).toBeNull();
  });

  it('accepts empty fileRefs array', () => {
    const payload = buildMinimalPayload([]);
    expect(parseGroupSharePayload(payload)).not.toBeNull();
    expect(parseGroupSharePayload(payload)!.event.expenses[0]!.fileRefs).toEqual([]);
  });
});
