import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { InstallOptions } from './InstallOptions';
import { INSTALL_PATH, installAudience } from './install-content';

interface InstallSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Item A (DEC-362) — the in-context install surface. A lean sheet with the
 * platform-aware CTAs and a link to the full /install comparison page. Opened
 * from the nudge banner and from Settings.
 */
export function InstallSheet({ open, onClose }: InstallSheetProps) {
  const { t } = useTranslation();
  const audience = installAudience();

  return (
    <BottomSheet open={open} onClose={onClose} title={t('install.sheet_title')}>
      <div className="flex flex-col gap-4 pt-1">
        <InstallOptions audience={audience} />
        <Link
          to={INSTALL_PATH}
          onClick={onClose}
          className="flex items-center justify-center gap-1.5 text-[13px] font-bold text-primary btn-press py-1"
        >
          {t('install.see_full')}
          <Icon name="arrow_forward" size={16} />
        </Link>
      </div>
    </BottomSheet>
  );
}
