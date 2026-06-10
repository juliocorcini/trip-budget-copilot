import type { SyncMetadata } from './common';

/**
 * DEC-074: which activity profiles are enabled in a phase.
 * Absence of a row = enabled (permissive default — nothing changes for
 * users who never configure activities per phase).
 */
export interface PhaseProfileSetting extends SyncMetadata {
  phaseId: string;
  activityProfileId: string;
  isEnabled: boolean;
}
