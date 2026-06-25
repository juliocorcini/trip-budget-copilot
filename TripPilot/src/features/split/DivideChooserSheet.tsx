import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';

/**
 * D03 · DEC-309/310 — the single "Dividir" door. Tapping "Dividir" in the FAB
 * opens this chooser so the user picks the RIGHT kind of split BEFORE landing on
 * a screen (the two were easy to confuse): one bill at the table (by items) vs a
 * whole group/event with many expenses (Tricount). It only unifies the ENTRY —
 * each option routes to its own intact flow (`/split/scan` × `/groups`). Owned by
 * the BottomNav (a sibling of the FAB overlay) so it survives the FAB closing.
 */
export function DivideChooserSheet({
  open,
  onClose,
  onChooseBill,
  onChooseGroup,
}: {
  open: boolean;
  onClose: () => void;
  onChooseBill: () => void;
  onChooseGroup: () => void;
}) {
  const { t } = useTranslation();

  return (
    <BottomSheet open={open} onClose={onClose} title={t('divideChooser.title')}>
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-xs text-on-surface-dim leading-relaxed">{t('divideChooser.subtitle')}</p>

        <button
          onClick={onChooseBill}
          className="w-full p-4 rounded-2xl flex items-center gap-3.5 btn-press text-left"
          style={{ background: 'var(--ai-bg-soft)', border: '1px solid var(--ai-border)' }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--ai-bg)' }}
          >
            <Icon name="splitscreen" size={24} className="text-[var(--ai-2)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-extrabold text-on-surface">{t('divideChooser.bill_title')}</p>
            <p className="text-[11px] font-semibold text-on-surface-dim leading-snug mt-0.5">
              {t('divideChooser.bill_desc')}
            </p>
          </div>
          <Icon name="arrow_forward" size={18} className="text-[var(--ai-2)] shrink-0" />
        </button>

        <button
          onClick={onChooseGroup}
          className="w-full p-4 rounded-2xl flex items-center gap-3.5 btn-press text-left"
          style={{ background: 'var(--surface-high)' }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--surface-container)' }}
          >
            <Icon name="groups" size={24} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-extrabold text-on-surface">{t('divideChooser.group_title')}</p>
            <p className="text-[11px] font-semibold text-on-surface-dim leading-snug mt-0.5">
              {t('divideChooser.group_desc')}
            </p>
          </div>
          <Icon name="arrow_forward" size={18} className="text-on-surface-faint shrink-0" />
        </button>
      </div>
    </BottomSheet>
  );
}
