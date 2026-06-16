import { isNativeApp } from './platform';
import { saveToDownloads } from './device-file';

/**
 * FIELD items 6 & 7: native file boundary for the APK. In the Capacitor WebView
 * `navigator.share({ files })` / `<a download>` do NOT reliably open the Android
 * share sheet or save a file, which is why "Enviar backup" did nothing. Here we
 * write the payload with `@capacitor/filesystem` and then either hand it to the
 * OS via `@capacitor/share` (send) or leave it in a user-visible folder (save).
 *
 * Both helpers are no-ops on the web (return false/null) so the caller falls
 * back to the existing browser share/download path. Plugins are imported lazily
 * so the web/PWA bundle never pulls native code.
 */

/**
 * Write the content to the cache dir and open the native share sheet. Returns
 * true when the native path handled it (incl. a user cancel — the file was
 * written and the sheet shown), false when it should fall back to the web path.
 */
export async function shareFileNative(
  content: string,
  filename: string,
  _mimeType: string,
): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
    try {
      await Share.share({ title: filename, url: uri, dialogTitle: filename });
    } catch {
      // User dismissed the sheet or no target app — the file was still written
      // and offered, so this is "handled"; do not fall back to the web anchor.
    }
    return true;
  } catch {
    // Writing/uri failed — let the caller try the web share/download path.
    return false;
  }
}

/**
 * Save the content to a real, user-reachable file. Prefers the public Downloads
 * folder (FIELD R2 item 1) via the native MediaStore plugin — the most
 * discoverable place — and falls back to the app's Documents folder if that
 * fails. Returns the file URI on success, or null on the web / on failure (the
 * caller then falls back to a browser download).
 */
export async function saveFileToDevice(
  content: string,
  filename: string,
  mimeType: string,
): Promise<string | null> {
  if (!isNativeApp()) return null;
  const downloadsUri = await saveToDownloads(content, filename, mimeType);
  if (downloadsUri) return downloadsUri;
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Documents });
    return uri;
  } catch {
    return null;
  }
}
