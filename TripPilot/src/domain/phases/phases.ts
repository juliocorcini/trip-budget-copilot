import type { Phase } from '@/domain/types/phase';
import { createSyncMetadata } from '@/utils/entity-factory';

export interface CreatePhaseInput {
  tripId: string;
  name: string;
  startDate: string;
  endDate: string;
  order: number;
}

export function createPhase(input: CreatePhaseInput): Phase {
  return {
    ...createSyncMetadata(),
    tripId: input.tripId,
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate,
    order: input.order,
    rhythmPreset: null,
    peakDays: null,
    notes: null,
  };
}

export function getNextPhaseOrder(phases: Phase[]): number {
  const active = phases.filter((p) => p.deletedAt === null);
  if (active.length === 0) return 0;
  return Math.max(...active.map((p) => p.order)) + 1;
}
