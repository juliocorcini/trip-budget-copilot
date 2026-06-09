import type { SyncMetadata, AlertType } from './common';

export interface AlertRule extends SyncMetadata {
  tripId: string;
  alertType: AlertType;
  name: string;
  isEnabled: boolean;
  thresholdPercent: number | null;
  thresholdCents: number | null;
  message: string | null;
  notes: string | null;
}
