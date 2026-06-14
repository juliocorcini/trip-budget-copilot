import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { verifyPin } from '@/utils/app-lock';

interface LockScreenProps {
  saltHex: string;
  hashHex: string;
  onUnlock: () => void;
}

/**
 * E6 (M20): full-screen PIN gate shown at boot when the app lock is on. It only
 * verifies the PIN — it can never export or read the data behind it, so a
 * forgotten PIN is recovered by importing a backup into a fresh install
 * (ÂNCORA 12: an evicted/empty DB has no lock, so recovery is never trapped).
 */
export function LockScreen({ saltHex, hashHex, onUnlock }: LockScreenProps) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (checking || pin === '') return;
    setChecking(true);
    const ok = await verifyPin(pin, saltHex, hashHex);
    if (ok) {
      onUnlock();
      return;
    }
    setError(true);
    setPin('');
    setChecking(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-surface-base px-6">
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center">
          <Icon name="lock" size={32} className="text-primary" />
        </div>
        <h1 className="text-heading font-bold text-on-surface">{t('lock.title')}</h1>
        <p className="text-sm text-on-surface-dim text-center">{t('lock.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-[320px] flex flex-col gap-4">
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, '').slice(0, 8));
            setError(false);
          }}
          placeholder={t('lock.pin_placeholder')}
          aria-label={t('lock.pin_placeholder')}
          className="bg-surface-container text-on-surface text-center text-2xl tracking-[0.5em] font-bold rounded-xl px-4 py-4 outline-none w-full"
        />
        {error && (
          <p className="text-sm font-semibold text-center" style={{ color: 'var(--error)' }}>
            {t('lock.wrong_pin')}
          </p>
        )}
        <button
          type="submit"
          disabled={checking || pin === ''}
          className="w-full py-3 rounded-xl bg-primary text-on-surface font-semibold btn-press disabled:opacity-40"
        >
          {checking ? t('common.loading') : t('lock.unlock')}
        </button>
      </form>

      <p className="text-xs text-on-surface-faint text-center mt-8 max-w-[320px]">
        {t('lock.recovery_hint')}
      </p>
    </div>
  );
}
