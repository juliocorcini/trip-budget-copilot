import { registerPlugin } from '@capacitor/core';

import { isNativeApp } from './platform';

/**
 * FIELD R2 item 1: adapter for the custom `DeviceFile` Capacitor plugin, which
 * writes a file to the public Downloads folder via Android MediaStore (there is
 * no `Directory.Downloads` in `@capacitor/filesystem`). No-op on the web so the
 * caller falls back to the existing Documents / browser-download path.
 */

interface DeviceFilePlugin {
  saveToDownloads(options: { name: string; data: string; mimeType: string }): Promise<{ uri: string }>;
}

const DeviceFile = registerPlugin<DeviceFilePlugin>('DeviceFile');

/**
 * Saves a UTF-8 text file to the device's public Downloads folder. Returns the
 * resulting URI, or null on the web / on any failure (never throws), so the
 * caller can fall back to another save path.
 */
export async function saveToDownloads(
  content: string,
  filename: string,
  mimeType: string,
): Promise<string | null> {
  if (!isNativeApp()) return null;
  try {
    const { uri } = await DeviceFile.saveToDownloads({ name: filename, data: content, mimeType });
    return uri ?? null;
  } catch {
    return null;
  }
}
