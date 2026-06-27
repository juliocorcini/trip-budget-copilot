import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { InstallSheet } from './InstallSheet';
import { dismissInstallNudge, shouldShowInstallNudge } from './install-nudge';

/**
 * Item A (DEC-362) — the gentle, dismissible install nudge. Mounted once in the
 * app shell; shows only to non-installed web users (gate in `install-nudge`).
 * "X" snoozes for 7 days; "não mostrar de novo" silences it for good. Opening
 * the sheet also hides the banner for this session.
 */
export function InstallNudge() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(() => shouldShowInstallNudge());
  const [sheetOpen, setSheetOpen] = useState(false);

  const snooze = () => {
    dismissInstallNudge(false);
    setVisible(false);
  };
  const never = () => {
    dismissInstallNudge(true);
    setVisible(false);
  };

  // DEC-364 (A1): the sheet is rendered OUTSIDE the `visible` gate. The old
  // `if (!visible) return null` above the sheet unmounted it the instant the CTA
  // hid the banner — "clico no aviso e ele some sem levar a lugar nenhum". Now
  // the banner is conditional but the sheet always stays mounted.
  return (
    <>
      {visible && (
        <div
          className="mt-2 mb-3 p-3 rounded-2xl flex items-center gap-3"
          style={{ background: 'var(--surface-container)', border: '1px solid var(--surface-high)' }}
        >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'var(--primary)' }}
        >
          <Icon name="install_mobile" size={20} className="text-on-surface" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-on-surface leading-tight">{t('install.nudge_title')}</p>
          <p className="text-[11px] text-on-surface-dim leading-snug">{t('install.nudge_subtitle')}</p>
          <button
            onClick={never}
            className="text-[10px] font-semibold text-on-surface-faint mt-1 btn-press"
          >
            {t('install.nudge_never')}
          </button>
        </div>
        <button
          onClick={() => {
            setSheetOpen(true);
            setVisible(false);
          }}
          className="shrink-0 px-3 py-2 rounded-xl text-[12px] font-bold text-on-surface btn-press"
          style={{ background: 'var(--primary)' }}
        >
          {t('install.nudge_cta')}
        </button>
        <button
          onClick={snooze}
          aria-label={t('common.close')}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full btn-press text-on-surface-dim"
        >
          <Icon name="close" size={18} />
        </button>
        </div>
      )}
      <InstallSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
