import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { appSettingsRepository, walletRepository } from '@/data/repositories';
import { fromCents, toCents } from '@/domain/money';
import { Icon } from '@/components/Icon';
import { isIosDevice, isStandaloneDisplayMode } from '@/utils/platform';
import type { AlertTone, ThemePreference } from '@/domain/types/common';

const LANGUAGE_OPTIONS = [
  { key: 'pt-BR', label: 'Português (BR)' },
  { key: 'en', label: 'English' },
  { key: 'es', label: 'Español' },
];

const CURRENCY_OPTIONS = ['EUR', 'USD', 'BRL', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY'];

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { settings, wallets, trip, reload } = useAppData();
  const [quickAddInput, setQuickAddInput] = useState('');

  if (!settings) return null;

  const updateSetting = async (partial: Record<string, unknown>) => {
    await appSettingsRepository.update(partial);
    await reload();
  };

  const handleLanguageChange = async (lang: string) => {
    await i18n.changeLanguage(lang);
    await updateSetting({ language: lang });
  };

  const handlePersistentStorage = async () => {
    if (navigator.storage?.persist) {
      const granted = await navigator.storage.persist();
      await updateSetting({ persistentStorageGranted: granted });
    }
  };

  const toneOptions: { key: AlertTone; labelKey: string }[] = [
    { key: 'amigo_sincero', labelKey: 'settings.alert_tone_sincero' },
    { key: 'calmo', labelKey: 'settings.alert_tone_calmo' },
    { key: 'direto', labelKey: 'settings.alert_tone_direto' },
  ];

  const themeOptions: { key: ThemePreference; labelKey: string }[] = [
    { key: 'dark', labelKey: 'settings.theme_dark' },
    { key: 'light', labelKey: 'settings.theme_light' },
    { key: 'system', labelKey: 'settings.theme_system' },
  ];

  const quickAddDisplay = settings.quickAddDefaultValuesCents
    .map((c) => fromCents(c).toFixed(2))
    .join(', ');

  return (
    <div className="flex flex-col gap-4 pb-4 pt-2">
      {/* R5-08: same back-button header pattern as the other "More" subpages. */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('settings.title')}</h1>
      </div>

      <Section title={t('settings.alert_tone')}>
        <div className="flex gap-2">
          {toneOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => updateSetting({ alertTone: opt.key })}
              className={`flex-1 py-2 rounded-xl text-xs font-medium btn-press ${
                settings.alertTone === opt.key ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </Section>

      <Section title={t('settings.theme')}>
        <div className="flex gap-2">
          {themeOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => updateSetting({ themePreference: opt.key })}
              className={`flex-1 py-2 rounded-xl text-xs font-medium btn-press ${
                settings.themePreference === opt.key ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </Section>

      <Section title={t('settings.language')}>
        <div className="flex gap-2">
          {LANGUAGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleLanguageChange(opt.key)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium btn-press ${
                settings.language === opt.key ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Section>

      {/* DEC-057 (GAP-022): default currency */}
      <Section title={t('settings.currency')}>
        <div className="flex gap-2 flex-wrap">
          {CURRENCY_OPTIONS.map((c) => (
            <button
              key={c}
              onClick={() => updateSetting({ defaultCurrency: c })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                settings.defaultCurrency === c ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </Section>

      <Section title={t('settings.vibration')}>
        <ToggleRow
          label={t('settings.vibration')}
          enabled={settings.vibrationEnabled}
          onChange={() => updateSetting({ vibrationEnabled: !settings.vibrationEnabled })}
        />
      </Section>

      {/* DEC-119 (R-10): home screen card order + visibility */}
      <Section title={t('dashboard.configure_home')}>
        <button
          onClick={() => navigate('/settings/dashboard')}
          className="w-full flex items-center justify-between btn-press"
        >
          <span className="text-sm text-on-surface">{t('dashboard.configure_home_entry')}</span>
          <Icon name="chevron_right" size={16} className="text-on-surface-faint" />
        </button>
      </Section>

      <Section title={t('settings.backup_reminder')}>
        <ToggleRow
          label={t('settings.backup_reminder')}
          enabled={settings.backupReminderEnabled}
          onChange={() => updateSetting({ backupReminderEnabled: !settings.backupReminderEnabled })}
        />
        {settings.backupReminderEnabled && (
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-on-surface-dim">{t('settings.backup_days')}</span>
            <select
              value={settings.backupReminderDays}
              onChange={(e) => updateSetting({ backupReminderDays: Number(e.target.value) })}
              className="bg-surface-high text-on-surface text-xs rounded-lg px-2 py-1 outline-none"
            >
              {[1, 2, 3, 5, 7, 14].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        )}
      </Section>

      <Section title={t('settings.device_name')}>
        <input
          type="text"
          value={settings.deviceName}
          onChange={(e) => updateSetting({ deviceName: e.target.value })}
          className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
        />
      </Section>

      <Section title={t('settings.default_wallet')}>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={async () => {
              if (!trip) return;
              await walletRepository.clearDefaults(trip.id);
              await reload();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
              !wallets.some((w) => w.isDefault) ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
            }`}
          >
            {t('settings.no_default_wallet')}
          </button>
          {wallets.map((w) => (
            <button
              key={w.id}
              onClick={async () => {
                if (!trip) return;
                await walletRepository.clearDefaults(trip.id);
                await walletRepository.update({ ...w, isDefault: true });
                await reload();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                w.isDefault ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
              }`}
            >
              {w.name}
            </button>
          ))}
        </div>
      </Section>

      <Section title={t('settings.quick_add_defaults')}>
        <p className="text-xs text-on-surface-faint mb-2">{quickAddDisplay}</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={quickAddInput}
            onChange={(e) => setQuickAddInput(e.target.value)}
            placeholder="3, 5, 7, 10, 15"
            className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none flex-1"
          />
          <button
            onClick={() => {
              const values = quickAddInput
                .split(',')
                .map((v) => toCents(parseFloat(v.trim())))
                .filter((v) => v > 0);
              if (values.length > 0) {
                updateSetting({ quickAddDefaultValuesCents: values });
                setQuickAddInput('');
              }
            }}
            className="px-3 py-2 rounded-lg bg-primary text-on-surface text-xs font-medium btn-press"
          >
            {t('common.save')}
          </button>
        </div>
      </Section>

      <Section title={t('settings.persistent_storage')}>
        {/* R6-13 (R5-03): on iOS the "activate" button can never work —
            navigator.storage.persist() silently returns false. Show honest
            guidance instead: install to home screen (Safari) or reassure
            (already installed). */}
        {isIosDevice() && !settings.persistentStorageGranted ? (
          <p className="text-sm text-on-surface-dim">
            {isStandaloneDisplayMode()
              ? t('settings.storage_ios_installed')
              : t('settings.storage_ios_hint')}
          </p>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-on-surface">
              {settings.persistentStorageGranted
                ? t('settings.storage_granted')
                : t('settings.storage_not_granted')}
            </span>
            {!settings.persistentStorageGranted && (
              <button
                onClick={handlePersistentStorage}
                className="px-3 py-1.5 rounded-lg bg-primary text-on-surface text-xs font-medium btn-press"
              >
                {t('settings.request_storage')}
              </button>
            )}
          </div>
        )}
      </Section>

      <Section title={t('settings.about')}>
        <p className="text-sm text-on-surface">TripPilot v1.0</p>
        <p className="text-xs text-on-surface-faint mt-1">{t('settings.about_desc')}</p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-container rounded-xl p-4">
      <p className="text-xs text-on-surface-faint font-semibold mb-3">{title}</p>
      {children}
    </div>
  );
}

function ToggleRow({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="w-full flex items-center justify-between btn-press">
      <span className="text-sm text-on-surface">{label}</span>
      <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${enabled ? 'bg-primary' : 'bg-surface-high'}`}>
        <div className={`w-5 h-5 rounded-full bg-on-surface transition-transform ${enabled ? 'translate-x-4' : ''}`} />
      </div>
    </button>
  );
}
