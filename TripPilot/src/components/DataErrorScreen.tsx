import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';

interface DataErrorScreenProps {
  onRetry: () => Promise<void>;
}

/**
 * DEC-109: shown when the local database failed to load. Makes it explicit
 * that the data was NOT deleted and offers a safe retry — never the
 * onboarding/welcome flow, which would invite destructive re-imports.
 */
export function DataErrorScreen({ onRetry }: DataErrorScreenProps) {
  const { t } = useTranslation();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-8 text-center gap-4">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'var(--surface-container)' }}
      >
        <Icon name="database" size={32} className="text-warning" />
      </div>
      <h1 className="text-lg font-bold text-on-surface">{t('data_error.title')}</h1>
      <p className="text-sm text-on-surface-dim leading-relaxed">
        {t('data_error.body')}
      </p>
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="btn-press mt-2 px-6 py-3 rounded-xl bg-primary text-on-surface font-semibold disabled:opacity-40"
      >
        {retrying ? t('common.loading') : t('data_error.retry')}
      </button>
    </div>
  );
}
