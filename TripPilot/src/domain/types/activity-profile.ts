import type { SyncMetadata, ConfidenceLevel } from './common';

export interface ActivityProfile extends SyncMetadata {
  tripId: string;
  name: string;
  category: string;
  iconName: string | null;
  color: string | null;
  typicalValueCents: number;
  safeValueCents: number;
  confidence: ConfidenceLevel;
  dataPointCount: number;
  expectedFrequencyPerPhase: number | null;
  isCustom: boolean;
  defaultTargetCents: number | null;
  defaultCeilingCents: number | null;
  defaultMaxCents: number | null;
  defaultAvgDrinkPriceCents: number | null;
  quickAddValuesCents: number[] | null;
  notes: string | null;
}
