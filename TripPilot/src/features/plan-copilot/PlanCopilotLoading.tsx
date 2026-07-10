import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/BottomSheet';

interface Props {
  open: boolean;
  stage: 'analyze' | 'generate';
}

export function PlanCopilotLoading({ open, stage }: Props) {
  const { t } = useTranslation();

  return (
    <BottomSheet open={open} onClose={() => {}} title="">
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-12 h-12 rounded-full border-3 border-primary border-t-transparent animate-spin" />
        <p className="text-sm font-bold text-on-surface">
          {t(stage === 'analyze' ? 'copilot_loading.analyzing' : 'copilot_loading.generating')}
        </p>
        <p className="text-xs text-on-surface-faint text-center px-4 leading-relaxed">
          {t('copilot_loading.hint')}
        </p>
      </div>
    </BottomSheet>
  );
}
