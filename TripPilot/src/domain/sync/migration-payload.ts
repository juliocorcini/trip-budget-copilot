import { z } from 'zod';
import { backupFileSchema } from '@/domain/validation/schemas';
import { normalizeBackupToV4 } from '@/domain/backup';
import type { BackupData } from '@/domain/backup';

/**
 * DEC-104: device migration reuses the existing backup format end to end —
 * the channel just carries what the JSON file would carry.
 */

const migrationPayloadSchema = z.object({
  v: z.literal(1),
  kind: z.literal('backup'),
  data: backupFileSchema,
});

export interface MigrationPayload {
  v: 1;
  kind: 'backup';
  data: BackupData;
}

export function buildMigrationPayload(backup: BackupData): MigrationPayload {
  return { v: 1, kind: 'backup', data: backup };
}

export function parseMigrationPayload(raw: unknown): MigrationPayload | null {
  const result = migrationPayloadSchema.safeParse(raw);
  if (!result.success) return null;
  return {
    v: 1,
    kind: 'backup',
    data: normalizeBackupToV4(result.data.data as unknown as BackupData),
  };
}
