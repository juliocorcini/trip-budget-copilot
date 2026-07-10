import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';

interface Props {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function PlanCopilotDisclosure({ open, onAccept, onDecline }: Props) {
  const { t } = useTranslation();

  const checks = [
    { icon: 'person_off', key: 'copilot_disclosure.check_no_personal' },
    { icon: 'delete_sweep', key: 'copilot_disclosure.check_no_storage' },
    { icon: 'model_training', key: 'copilot_disclosure.check_no_training' },
    { icon: 'receipt_long', key: 'copilot_disclosure.check_same_receipt' },
  ] as const;

  return (
    <BottomSheet open={open} onClose={onDecline} title={t('copilot_disclosure.title')}>
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-sm text-on-surface-dim leading-relaxed">
          {t('copilot_disclosure.body')}
        </p>

        <div className="flex flex-col gap-2.5">
          {checks.map((c) => (
            <div key={c.key} className="flex items-center gap-2.5">
              <Icon name="check_circle" size={16} className="text-success shrink-0" />
              <p className="text-xs text-on-surface-dim">{t(c.key as never)}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-on-surface-faint leading-relaxed">
          {t('copilot_disclosure.manual_note')}
        </p>

        <div className="flex gap-2 mt-1">
          <button
            onClick={onAccept}
            className="btn-press flex-1 py-3 rounded-xl text-sm font-bold"
            style={{ background: 'var(--primary)', color: 'var(--surface)' }}
          >
            {t('copilot_disclosure.accept')}
          </button>
          <button
            onClick={onDecline}
            className="btn-press py-3 px-4 rounded-xl text-sm font-bold bg-surface-high text-on-surface-dim"
          >
            {t('copilot_disclosure.decline')}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
