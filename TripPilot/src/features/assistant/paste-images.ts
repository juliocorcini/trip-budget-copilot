/**
 * DEC-408 (G7): pull image File(s) off a paste/drop DataTransfer (skip plain
 * text / non-image items). Some browsers expose pasted images only via `items`,
 * others via `files` — read both so a screenshot/photo paste is caught either
 * way, and de-duplicate so a single image counted in both lists is added once.
 */
export function imageFilesFromTransfer(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  const files: File[] = [];
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  if (files.length === 0) {
    for (const file of Array.from(dt.files ?? [])) {
      if (file.type.startsWith('image/')) files.push(file);
    }
  }
  return files;
}
