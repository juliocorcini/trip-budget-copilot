import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { formatMoney } from '@/domain/money';
import { useActiveSplit } from './useActiveSplit';

/**
 * Tapping "Dividir conta" while a division is already live opens this chooser
 * (Julio: "se tiver uma divisão já acontecendo... perguntar se cria uma nova ou
 * entra em uma ainda aberta"). Resuming returns to the live table; starting a new
 * one carries `?new=1` so the split screen bypasses auto-resume and opens fresh.
 * Rendered by the BottomNav (a sibling of the FAB overlay) so it survives the
 * FAB closing.
 */
export function SplitResumeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const split = useActiveSplit();

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  const peopleLine =
    split && split.guestCount > 0
      ? t('splitTable.guests_joined', { count: split.guestCount })
      : t('splitTable.waiting_guests');

  return (
    <BottomSheet open={open} onClose={onClose} title={t('splitResume.title')}>
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-xs text-on-surface-dim leading-relaxed">{t('splitResume.subtitle')}</p>

        {split && (
          <button
            onClick={() => go('/split/scan')}
            className="w-full p-4 rounded-2xl flex items-center gap-3.5 btn-press text-left"
            style={{ background: '#6366F11A', border: '1px solid #6366F140' }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative"
              style={{ background: '#6366F126' }}
            >
              <Icon name="splitscreen" size={24} filled className="text-[#818CF8]" />
              <span className="absolute top-0 right-0 flex h-2.5 w-2.5">
                <span
                  className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
                  style={{ background: '#6366F1' }}
                />
                <span
                  className="relative inline-flex h-2.5 w-2.5 rounded-full"
                  style={{ background: '#6366F1' }}
                />
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-extrabold text-on-surface truncate">
                {split.name || t('split.default_name')}
              </p>
              <p className="text-[11px] font-semibold text-on-surface-dim">
                {formatMoney(split.totalCents, split.currency)} · {peopleLine}
              </p>
            </div>
            <span
              className="px-3 py-2 rounded-xl text-xs font-bold shrink-0"
              style={{ background: '#6366F1', color: '#ffffff' }}
            >
              {t('splitResume.resume')}
            </span>
          </button>
        )}

        <button
          onClick={() => go('/split/scan?new=1')}
          className="w-full p-4 rounded-2xl flex items-center gap-3.5 btn-press text-left"
          style={{ background: 'var(--surface-high)' }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--surface-container)' }}
          >
            <Icon name="add" size={24} className="text-on-surface-dim" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-extrabold text-on-surface">{t('splitResume.new_title')}</p>
            <p className="text-[11px] font-semibold text-on-surface-dim">{t('splitResume.new_desc')}</p>
          </div>
          <Icon name="arrow_forward" size={18} className="text-on-surface-faint shrink-0" />
        </button>
      </div>
    </BottomSheet>
  );
}
