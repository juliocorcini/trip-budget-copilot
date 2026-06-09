import { useTranslation } from 'react-i18next';
import { useAppData } from '@/hooks/useAppData';
import { appSettingsRepository } from '@/data/repositories';
import type { AlertTone, ThemePreference } from '@/domain/types/common';

export function SettingsPage() {
  const { t } = useTranslation();
  const { settings, reload } = useAppData();

  if (!settings) return null;

  const updateSetting = async (partial: Record<string, unknown>) => {
    await appSettingsRepository.update(partial);
    await reload();
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

  return (
    <div className="flex flex-col gap-4 pb-4 pt-2">
      <h1 className="text-heading font-bold text-on-surface">{t('settings.title')}</h1>

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

      <Section title={t('settings.vibration')}>
        <ToggleRow
          label={t('settings.vibration')}
          enabled={settings.vibrationEnabled}
          onChange={() => updateSetting({ vibrationEnabled: !settings.vibrationEnabled })}
        />
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
              {[1, 2, 3, 5, 7].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        )}
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
