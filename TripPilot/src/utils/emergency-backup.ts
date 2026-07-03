import { appSettingsRepository } from '@/data/repositories';
import { buildFullBackup } from '@/domain/orchestrators';
import { generateBackupFilename } from '@/domain/backup';
import { logger } from '@/utils/logger';

/**
 * BUG-017: last-resort data export from the ErrorBoundary recovery screen.
 * Must stay in the main bundle (not lazy) — a failed chunk load is exactly the
 * scenario where the user needs to rescue their data. Never throws.
 */
export async function downloadEmergencyBackup(): Promise<boolean> {
  try {
    const settings = await appSettingsRepository.get();
    const backup = await buildFullBackup(settings);
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = generateBackupFilename();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    logger.error('emergency_backup_failed', { module: 'emergency-backup' }, err);
    return false;
  }
}
