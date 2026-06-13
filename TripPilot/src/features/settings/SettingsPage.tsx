import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { appSettingsRepository, walletRepository } from '@/data/repositories';
import { fromCents, toCents, formatAnchorHint, formatMoney } from '@/domain/money';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';
import { isIosDevice, isStandaloneDisplayMode } from '@/utils/platform';
import {
  getOutingNotificationPermission,
  requestOutingNotificationPermission,
  syncActiveOutingNotification,
  closeOutingNotifications,
} from '@/utils/outing-notification';
import { checkForAppUpdate } from '@/utils/pwa';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { APP_VERSION } from '@/utils/app-version';
import type { AlertTone, AppMode, ThemePreference } from '@/domain/types/common';

const LANGUAGE_OPTIONS = [
  { key: 'pt-BR', label: 'Português (BR)' },
  { key: 'en', label: 'English' },
  { key: 'es', label: 'Español' },
];

const CURRENCY_OPTIONS = ['EUR', 'USD', 'BRL', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY'];

/** DEC-128: currencies offered as mental anchor (the traveler's "home" money). */
const ANCHOR_CURRENCY_OPTIONS = ['BRL', 'USD', 'EUR', 'GBP'];

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { settings, wallets, trip, reload } = useAppData();
  const [quickAddInput, setQuickAddInput] = useState('');
  // DEC-124: permission is browser state — track it so the section re-renders.
  const [notifPermission, setNotifPermission] = useState(getOutingNotificationPermission());
  // DEC-128: rate is typed locally and persisted on save (quick-add pattern).
  const [anchorRateInput, setAnchorRateInput] = useState('');
  // M14: savings goal typed locally, persisted on save (same quick-add pattern).
  const [goalInput, setGoalInput] = useState('');
  // DEC-135: in-app install + manual "look for a new version" button.
  const { available: installAvailable, install } = useInstallPrompt();
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  if (!settings) return null;

  const updateSetting = async (partial: Record<string, unknown>) => {
    await appSettingsRepository.update(partial);
    await reload();
  };

  // DEC-124 (R-11 v2): the toggle owns the preference; turning it on also
  // requests browser permission and immediately syncs an active outing.
  const outingNotifActive =
    settings.outingNotificationEnabled && notifPermission === 'granted';

  const handleToggleOutingNotification = async () => {
    if (outingNotifActive) {
      await updateSetting({ outingNotificationEnabled: false });
      await closeOutingNotifications();
      return;
    }
    if (!settings.outingNotificationEnabled) {
      await updateSetting({ outingNotificationEnabled: true });
    }
    if (notifPermission !== 'granted') {
      const permission = await requestOutingNotificationPermission();
      setNotifPermission(permission);
      if (permission !== 'granted') return;
    }
    await syncActiveOutingNotification();
  };

  const handleLanguageChange = async (lang: string) => {
    await i18n.changeLanguage(lang);
    await updateSetting({ language: lang });
  };

  // DEC-135: force the SW to look for a new version right now. Covers the
  // "Chrome has the new version but the installed app is stale" case.
  const handleCheckUpdate = async () => {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    try {
      const result = await checkForAppUpdate();
      if (result === 'updating') {
        // SKIP_WAITING was sent; controllerchange reloads the app in a moment.
        showToast(t('pwa.update_found'), 'success');
      } else if (result === 'up_to_date') {
        showToast(t('pwa.up_to_date'), 'info');
      } else {
        showToast(t('pwa.update_check_failed'), 'danger');
      }
    } catch {
      showToast(t('pwa.update_check_failed'), 'danger');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleInstallApp = async () => {
    await install();
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

  // DEC-128: live preview of the anchor ("€100 ≈ R$ 620") with the saved rate.
  const baseCurrency = trip?.baseCurrency ?? settings.defaultCurrency;
  const anchorPreview = formatAnchorHint(
    10000,
    { anchorCurrency: settings.anchorCurrency, anchorRatePer1: settings.anchorRatePer1 },
    baseCurrency,
  );

  return (
    <div className="flex flex-col gap-4 pb-4 pt-2">
      {/* R5-08: same back-button header pattern as the other "More" subpages. */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('settings.title')}</h1>
      </div>

      {/* M21: app mode — simple hides advanced surfaces; complete shows all */}
      <Section title={t('settings.mode_title')}>
        <div className="flex gap-2">
          {(['simple', 'complete'] as AppMode[]).map((m) => (
            <button
              key={m}
              onClick={() => updateSetting({ appMode: m })}
              className={`flex-1 py-2 rounded-xl text-xs font-medium btn-press ${
                settings.appMode === m ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
              }`}
            >
              {t(`settings.mode_${m}`)}
            </button>
          ))}
        </div>
        <p className="text-xs text-on-surface-faint mt-2">
          {t(settings.appMode === 'simple' ? 'settings.mode_simple_hint' : 'settings.mode_complete_hint')}
        </p>
      </Section>

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

      {/* DEC-124 (R-11 v2): outing notification — discoverable + reactivatable */}
      <Section title={t('settings.notifications')}>
        {notifPermission === 'unsupported' ? (
          <p className="text-sm text-on-surface-dim">
            {t('settings.outing_notification_unsupported')}
          </p>
        ) : (
          <>
            <ToggleRow
              label={t('settings.outing_notification')}
              enabled={outingNotifActive}
              onChange={handleToggleOutingNotification}
            />
            <p className="text-xs text-on-surface-faint mt-2">
              {t('settings.outing_notification_hint')}
            </p>
            {notifPermission === 'denied' && (
              <p className="text-xs mt-2" style={{ color: 'var(--error)' }}>
                {t('settings.outing_notification_blocked')}
              </p>
            )}
          </>
        )}
      </Section>

      {/* DEC-128: mental currency anchor — manual offline rate, no network */}
      <Section title={t('settings.anchor_title')}>
        <p className="text-xs text-on-surface-faint mb-3">{t('settings.anchor_hint')}</p>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => updateSetting({ anchorCurrency: null })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
              settings.anchorCurrency === null
                ? 'bg-primary text-on-surface'
                : 'bg-surface-high text-on-surface-dim'
            }`}
          >
            {t('settings.anchor_off')}
          </button>
          {ANCHOR_CURRENCY_OPTIONS.filter((c) => c !== baseCurrency).map((c) => (
            <button
              key={c}
              onClick={() => updateSetting({ anchorCurrency: c })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                settings.anchorCurrency === c
                  ? 'bg-primary text-on-surface'
                  : 'bg-surface-high text-on-surface-dim'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        {settings.anchorCurrency !== null && (
          <>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs font-semibold text-on-surface-dim whitespace-nowrap">
                {t('settings.anchor_rate_prefix', { base: baseCurrency })}
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={anchorRateInput}
                onChange={(e) => setAnchorRateInput(e.target.value)}
                placeholder={settings.anchorRatePer1 !== null ? String(settings.anchorRatePer1) : '6.20'}
                className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none flex-1 min-w-0"
              />
              <span className="text-xs font-semibold text-on-surface-dim">{settings.anchorCurrency}</span>
              <button
                onClick={() => {
                  const rate = parseFloat(anchorRateInput.replace(',', '.'));
                  if (Number.isFinite(rate) && rate > 0) {
                    updateSetting({ anchorRatePer1: rate });
                    setAnchorRateInput('');
                  }
                }}
                className="px-3 py-2 rounded-lg bg-primary text-on-surface text-xs font-medium btn-press"
              >
                {t('common.save')}
              </button>
            </div>
            {anchorPreview && (
              <p className="text-xs text-on-surface-faint mt-2">
                {formatMoney(10000, baseCurrency)} {anchorPreview}
              </p>
            )}
          </>
        )}
      </Section>

      {/* M14 (E6): savings goal — money to bring home. Read-only motivation,
          never affects the budget (ÂNCORA 11 / DEC-088). */}
      <Section title={t('settings.goal_title')}>
        <p className="text-xs text-on-surface-faint mb-3">{t('settings.goal_hint')}</p>
        {settings.savingsGoalCents != null && (
          <p className="text-sm font-bold text-on-surface mb-2 tabular">
            {t('settings.goal_current', { amount: formatMoney(settings.savingsGoalCents, baseCurrency) })}
          </p>
        )}
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            placeholder={settings.savingsGoalCents != null ? String(fromCents(settings.savingsGoalCents)) : '200'}
            className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none flex-1 min-w-0"
          />
          <span className="text-xs font-semibold text-on-surface-dim">{baseCurrency}</span>
          <button
            onClick={() => {
              const value = toCents(parseFloat(goalInput.replace(',', '.')));
              if (Number.isFinite(value) && value > 0) {
                updateSetting({ savingsGoalCents: value });
                setGoalInput('');
              }
            }}
            className="px-3 py-2 rounded-lg bg-primary text-on-surface text-xs font-medium btn-press"
          >
            {t('common.save')}
          </button>
        </div>
        {settings.savingsGoalCents != null && (
          <button
            onClick={() => updateSetting({ savingsGoalCents: null })}
            className="text-xs text-on-surface-faint mt-3 btn-press"
          >
            {t('settings.goal_remove')}
          </button>
        )}
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

      {/* DEC-135: install + update controls */}
      <Section title={t('settings.app_section')}>
        {installAvailable && (
          <button
            onClick={handleInstallApp}
            className="w-full flex items-center gap-3 p-3 rounded-xl btn-press text-left mb-3"
            style={{ background: 'var(--highlight-subtle)' }}
          >
            <Icon name="install_mobile" size={20} className="text-primary" />
            <div className="flex-1">
              <p className="text-sm font-bold text-on-surface">{t('settings.install_app')}</p>
              <p className="text-xs text-on-surface-dim mt-0.5">{t('settings.install_app_hint')}</p>
            </div>
          </button>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-on-surface">
            {t('settings.version_label', { version: APP_VERSION })}
          </span>
          <button
            onClick={handleCheckUpdate}
            disabled={checkingUpdate}
            className="px-3 py-1.5 rounded-lg bg-primary text-on-surface text-xs font-medium btn-press disabled:opacity-50"
          >
            {checkingUpdate ? t('settings.checking_update') : t('settings.check_update')}
          </button>
        </div>
      </Section>

      <Section title={t('settings.about')}>
        <p className="text-sm text-on-surface">TripPilot v{APP_VERSION}</p>
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
