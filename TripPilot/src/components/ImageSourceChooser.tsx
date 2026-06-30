import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';

interface UseImageSourceChooserOptions {
  /** Override the sheet title (defaults to attachments.source_title). */
  title?: string;
  /**
   * CC-IMG-MULTI: let the GALLERY picker select several images at once (the
   * camera always takes a single shot). When set, `onPick` fires once per chosen
   * file. Defaults to false → unchanged single-pick behavior for every caller.
   */
  multiple?: boolean;
}

interface ImageSourceChooser {
  /** Open the chooser — call this INSIDE the click handler. */
  open: () => void;
  /** Render once anywhere in the tree (hidden inputs + the source sheet). */
  element: ReactNode;
}

/**
 * CC-IMG (DEC-275): the canonical "take a photo now / choose from gallery"
 * chooser, extracted from AttachmentSection (DEC-206) so EVERY image entry in
 * the app reuses the exact same pattern instead of inventing a second one.
 *
 * The two hidden inputs are camera (`capture="environment"`) and gallery (no
 * capture). The actual `.click()` fires on the sheet button tap — itself a
 * fresh synchronous user gesture — which keeps the native camera/picker allowed
 * on iOS Safari and inside the native WebView.
 */
export function useImageSourceChooser(
  onPick: (file: File) => void,
  options?: UseImageSourceChooserOptions,
): ImageSourceChooser {
  const { t } = useTranslation();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  const handlePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (picked.length === 0) return;
    // Multi-select (gallery) fires onPick once per file; single mode is unchanged.
    if (options?.multiple) picked.forEach((file) => onPick(file));
    else onPick(picked[0]!);
  };

  const pickFrom = (source: 'camera' | 'gallery') => {
    setOpen(false);
    const ref = source === 'camera' ? cameraInputRef : galleryInputRef;
    ref.current?.click();
  };

  const element = (
    <>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePick}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple={options?.multiple ?? false}
        className="hidden"
        onChange={handlePick}
      />

      <BottomSheet open={open} onClose={() => setOpen(false)} title={options?.title ?? t('attachments.source_title')}>
        <div className="flex flex-col gap-2 mt-4">
          <button
            onClick={() => pickFrom('camera')}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-surface-high btn-press text-left"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: '#C75B3918' }}
            >
              <Icon name="photo_camera" size={20} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-on-surface">{t('attachments.take_photo')}</p>
              <p className="text-[11px] font-medium text-on-surface-dim">{t('attachments.take_photo_desc')}</p>
            </div>
          </button>
          <button
            onClick={() => pickFrom('gallery')}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-surface-high btn-press text-left"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: '#6B8F7118' }}
            >
              <Icon name="image" size={20} className="text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-on-surface">{t('attachments.choose_gallery')}</p>
              <p className="text-[11px] font-medium text-on-surface-dim">{t('attachments.choose_gallery_desc')}</p>
            </div>
          </button>
        </div>
      </BottomSheet>
    </>
  );

  return { open: () => setOpen(true), element };
}
