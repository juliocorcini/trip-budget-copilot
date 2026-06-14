import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { appSettingsRepository, walletRepository, localSnapshotRepository } from '@/data/repositories';
import { activityProfileRepository } from '@/data/repositories/activity-profile-repository';
import { buildTripTemplate, summarizeTemplate } from '@/domain/templates';
import { saveTripTemplate, deleteTripTemplate } from '@/domain/orchestrators';
import { fromCents, toCents, formatAnchorHint, formatMoney } from '@/domain/money';
import { formatDate } from '@/domain/dates';
import { restoreLocalSnapshot } from '@/utils/local-snapshot';
import { hashPin, isValidPin } from '@/utils/app-lock';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { showToast } from '@/components/Toast';
import type { LocalSnapshot } from '@/domain/types/local-snapshot';
import { isIosDevice, isStandaloneDisplayMode } from '@/utils/platform';
import {
  getOutingNotificationPermission,
  requestOutingNotificationPermission,
  syncActiveOutingNotification,
  closeOutingNotifications,
} from '@/utils/outing-notification';
import { checkForAppUpdate } from '@/utils/pwa';
import { getCurrentCoords } from '@/utils/geolocation';
import { fetchExchangeRates } from '@/utils/exchange-rates';
import { coordsLabel } from '@/domain/location';
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
  const { settings, wallets, trip, phases, reload } = useAppData();
  const [quickAddInput, setQuickAddInput] = useState('');
  // M22: saving a template loads the trip's profiles on demand (not in useAppData).
  const [savingTemplate, setSavingTemplate] = useState(false);
  // DEC-124: permission is browser state — track it so the section re-renders.
  const [notifPermission, setNotifPermission] = useState(getOutingNotificationPermission());
  // DEC-128: rate is typed locally and persisted on save (quick-add pattern).
  const [anchorRateInput, setAnchorRateInput] = useState('');
  // M14: savings goal typed locally, persisted on save (same quick-add pattern).
  const [goalInput, setGoalInput] = useState('');
  // DEC-135: in-app install + manual "look for a new version" button.
  const { available: installAvailable, install } = useInstallPrompt();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  // E9 (M11): pulling the FX snapshot is opt-in and online-only.
  const [fetchingRates, setFetchingRates] = useState(false);
  // E6 (M15): local daily restore points + the confirm-before-restore sheet.
  const [snapshots, setSnapshots] = useState<LocalSnapshot[]>([]);
  const [restoreTarget, setRestoreTarget] = useState<LocalSnapshot | null>(null);
  const [restoring, setRestoring] = useState(false);
  // E6 (M20): app lock — the set-PIN sheet collects a new PIN twice before it is
  // hashed (the PIN itself never touches storage).
  const [pinSheetOpen, setPinSheetOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [savingPin, setSavingPin] = useState(false);

  useEffect(() => {
    void localSnapshotRepository.getAll().then(setSnapshots);
  }, []);

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

  // M22: save the current trip (phases + learned profiles) as a reusable
  // template. Profiles are loaded here since useAppData does not carry them.
  const handleSaveTemplate = async () => {
    if (!trip || savingTemplate) return;
    setSavingTemplate(true);
    try {
      const profiles = await activityProfileRepository.getByTripId(trip.id);
      await saveTripTemplate(
        buildTripTemplate({
          id: crypto.randomUUID(),
          name: trip.name,
          createdAt: new Date().toISOString(),
          baseCurrency: trip.baseCurrency,
          phases,
          profiles,
        }),
      );
      showToast(t('settings.template_saved'), 'success');
      await reload();
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    await deleteTripTemplate(templateId);
    await reload();
  };

  // E8 (M2): turning location on prompts for permission and, if granted,
  // seeds the first place. Denial/timeout leaves capture on but place empty —
  // expenses simply carry no location (ÂNCORA 8). Never blocks.
  const handleToggleLocation = async () => {
    const next = !settings.locationCaptureEnabled;
    await updateSetting({ locationCaptureEnabled: next });
    if (!next) return;
    const coords = await getCurrentCoords();
    if (coords) {
      await updateSetting({
        currentPlace: { label: coordsLabel(coords), lat: coords.lat, lng: coords.lng, placeId: null },
      });
    }
  };

  // E9 (M11): pull today's rates once while online and freeze them for offline
  // use. Opt-in, never blocks — failures (offline/timeout) just toast and keep
  // the manual-rate fallback (ÂNCORA 10).
  const handleFetchRates = async () => {
    if (fetchingRates) return;
    setFetchingRates(true);
    try {
      const rates = await fetchExchangeRates(baseCurrency);
      if (rates) {
        await updateSetting({ frozenRates: rates });
        showToast(t('settings.fx_updated'), 'success');
      } else {
        showToast(t('settings.fx_failed'), 'danger');
      }
    } finally {
      setFetchingRates(false);
    }
  };

  // M15: restore the DB to a chosen daily point, reusing the atomic backup
  // import (replace). Confirmed via the sheet; never silently drops data.
  const handleConfirmRestore = async () => {
    if (!restoreTarget || restoring) return;
    setRestoring(true);
    try {
      const ok = await restoreLocalSnapshot(restoreTarget);
      if (!ok) {
        showToast(t('settings.restore_failed'), 'danger');
        return;
      }
      setRestoreTarget(null);
      await reload();
      showToast(t('settings.restore_done'), 'success');
      navigate('/dashboard');
    } catch {
      showToast(t('settings.restore_failed'), 'danger');
    } finally {
      setRestoring(false);
    }
  };

  // E6 (M20): toggle the app lock. Turning it on opens the set-PIN sheet; turning
  // it off clears the stored hash/salt (Settings is already behind the lock, so
  // the traveler proved they know the PIN by getting here).
  const handleToggleLock = () => {
    if (settings.appLockEnabled) {
      void updateSetting({ appLockEnabled: false, appLockPinHash: null, appLockPinSalt: null });
      showToast(t('settings.lock_disabled'), 'info');
      return;
    }
    setNewPin('');
    setConfirmPin('');
    setPinError(null);
    setPinSheetOpen(true);
  };

  // E6 (M20): validate the PIN pair, hash it via Web Crypto, then persist.
  const handleSavePin = async () => {
    if (savingPin) return;
    if (!isValidPin(newPin)) {
      setPinError(t('settings.lock_pin_invalid'));
      return;
    }
    if (newPin !== confirmPin) {
      setPinError(t('settings.lock_pin_mismatch'));
      return;
    }
    setSavingPin(true);
    try {
      const { saltHex, hashHex } = await hashPin(newPin);
      await updateSetting({
        appLockEnabled: true,
        appLockPinHash: hashHex,
        appLockPinSalt: saltHex,
      });
      setPinSheetOpen(false);
      showToast(t('settings.lock_saved'), 'success');
    } finally {
      setSavingPin(false);
    }
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

      {/* E8 (M2): opt-in location capture — privacy first, 100% on-device */}
      <Section title={t('settings.location_title')}>
        <ToggleRow
          label={t('settings.location_capture')}
          enabled={settings.locationCaptureEnabled}
          onChange={handleToggleLocation}
        />
        <p className="text-xs text-on-surface-faint mt-2">{t('settings.location_hint')}</p>
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

      {/* E9 (M11): opt-in FX snapshot — pulled once online, frozen for offline
          use as the default rate when logging a foreign-currency expense */}
      <Section title={t('settings.fx_title')}>
        <p className="text-xs text-on-surface-faint mb-3">
          {t('settings.fx_hint', { base: baseCurrency })}
        </p>
        {settings.frozenRates && settings.frozenRates.baseCurrency === baseCurrency ? (
          <p className="text-xs text-on-surface-dim mb-3">
            {t('settings.fx_last_updated', {
              date: new Date(settings.frozenRates.fetchedAt).toLocaleDateString(i18n.language),
              count: Object.keys(settings.frozenRates.ratesToBase).length,
            })}
          </p>
        ) : (
          <p className="text-xs text-on-surface-faint mb-3">{t('settings.fx_none')}</p>
        )}
        <button
          onClick={handleFetchRates}
          disabled={fetchingRates}
          className="px-4 py-2 rounded-lg bg-primary text-on-surface text-sm font-semibold btn-press disabled:opacity-50"
        >
          {fetchingRates ? t('settings.fx_updating') : t('settings.fx_update')}
        </button>
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

      {/* M22 (E7): save this trip's structure (phases + learned typicals) as a
          reusable template, applied on the next trip's onboarding. */}
      <Section title={t('settings.templates_title')}>
        <p className="text-xs text-on-surface-faint mb-3">{t('settings.templates_hint')}</p>
        <button
          onClick={handleSaveTemplate}
          disabled={!trip || savingTemplate}
          className="w-full px-3 py-2 rounded-lg bg-primary text-on-surface text-xs font-medium btn-press disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Icon name="bookmark_add" size={16} className="text-on-surface" />
          {t('settings.template_save_current')}
        </button>
        {(settings.tripTemplates ?? []).length > 0 && (
          <div className="flex flex-col gap-2 mt-3">
            {(settings.tripTemplates ?? []).map((template) => {
              const summary = summarizeTemplate(template);
              return (
                <div
                  key={template.id}
                  className="flex items-center gap-2 bg-surface-high rounded-lg px-3 py-2"
                >
                  <Icon name="luggage" size={16} className="text-on-surface-dim shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{template.name}</p>
                    <p className="text-[11px] text-on-surface-faint">
                      {t('settings.template_summary', {
                        phases: summary.phaseCount,
                        profiles: summary.profileCount,
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="btn-press p-1 shrink-0"
                    aria-label={t('common.delete')}
                  >
                    <Icon name="delete" size={16} className="text-on-surface-faint" />
                  </button>
                </div>
              );
            })}
          </div>
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

      {/* E6 (M20): opt-in app lock — a PIN asked at boot. Off by default; the
          PIN is stored only as a hash. Recovery is never trapped (ÂNCORA 12). */}
      <Section title={t('settings.lock_title')}>
        <ToggleRow
          label={t('settings.lock_enable')}
          enabled={settings.appLockEnabled}
          onChange={handleToggleLock}
        />
        <p className="text-xs text-on-surface-faint mt-2">{t('settings.lock_hint')}</p>
        {settings.appLockEnabled && (
          <button
            onClick={() => {
              setNewPin('');
              setConfirmPin('');
              setPinError(null);
              setPinSheetOpen(true);
            }}
            className="mt-3 px-3 py-2 rounded-lg bg-surface-high text-on-surface text-xs font-medium btn-press"
          >
            {t('settings.lock_change_pin')}
          </button>
        )}
      </Section>

      {/* E6 (M15): local daily restore points — "restore to yesterday". Each
          point is a full local backup; restoring reuses the atomic import. */}
      <Section title={t('settings.advanced_title')}>
        <p className="text-xs text-on-surface-faint mb-3">{t('settings.restore_hint')}</p>
        {snapshots.length === 0 ? (
          <p className="text-sm text-on-surface-dim">{t('settings.restore_empty')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {snapshots.map((snap) => (
              <button
                key={snap.id}
                onClick={() => setRestoreTarget(snap)}
                className="w-full flex items-center gap-3 bg-surface-high rounded-lg px-3 py-2 btn-press text-left"
              >
                <Icon name="history" size={16} className="text-on-surface-dim shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface">{formatDate(snap.id)}</p>
                  <p className="text-[11px] text-on-surface-faint">
                    {t('settings.restore_point_meta', {
                      time: new Date(snap.createdAt).toLocaleTimeString(i18n.language, {
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                      count: snap.expenseCount,
                    })}
                  </p>
                </div>
                <Icon name="restore" size={16} className="text-on-surface-faint shrink-0" />
              </button>
            ))}
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

      {/* M15: confirm before replacing the current data with a restore point. */}
      <BottomSheet
        open={restoreTarget !== null}
        onClose={() => {
          if (!restoring) setRestoreTarget(null);
        }}
        title={t('settings.restore_confirm_title')}
      >
        {restoreTarget && (
          <>
            <p className="text-sm text-on-surface-dim mb-2">
              {t('settings.restore_confirm_body', {
                date: formatDate(restoreTarget.id),
                count: restoreTarget.expenseCount,
              })}
            </p>
            <p className="text-xs mb-5" style={{ color: 'var(--error)' }}>
              {t('settings.restore_confirm_warning')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setRestoreTarget(null)}
                disabled={restoring}
                className="flex-1 py-3 rounded-xl bg-surface-high text-on-surface-dim text-sm font-medium btn-press disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleConfirmRestore}
                disabled={restoring}
                className="flex-1 py-3 rounded-xl bg-primary text-on-surface text-sm font-semibold btn-press disabled:opacity-50"
              >
                {restoring ? t('common.loading') : t('settings.restore_confirm_cta')}
              </button>
            </div>
          </>
        )}
      </BottomSheet>

      {/* E6 (M20): set / change the PIN. Collected twice; only the hash is saved. */}
      <BottomSheet
        open={pinSheetOpen}
        onClose={() => {
          if (!savingPin) setPinSheetOpen(false);
        }}
        title={t('settings.lock_set_title')}
      >
        <div className="flex flex-col gap-3">
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={newPin}
            onChange={(e) => {
              setNewPin(e.target.value.replace(/\D/g, '').slice(0, 8));
              setPinError(null);
            }}
            placeholder={t('settings.lock_new_pin')}
            aria-label={t('settings.lock_new_pin')}
            className="bg-surface-high text-on-surface text-center text-lg tracking-[0.4em] font-bold rounded-lg px-3 py-3 outline-none"
          />
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={confirmPin}
            onChange={(e) => {
              setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8));
              setPinError(null);
            }}
            placeholder={t('settings.lock_confirm_pin')}
            aria-label={t('settings.lock_confirm_pin')}
            className="bg-surface-high text-on-surface text-center text-lg tracking-[0.4em] font-bold rounded-lg px-3 py-3 outline-none"
          />
          {pinError && (
            <p className="text-xs font-semibold" style={{ color: 'var(--error)' }}>
              {pinError}
            </p>
          )}
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => setPinSheetOpen(false)}
              disabled={savingPin}
              className="flex-1 py-3 rounded-xl bg-surface-high text-on-surface-dim text-sm font-medium btn-press disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSavePin}
              disabled={savingPin}
              className="flex-1 py-3 rounded-xl bg-primary text-on-surface text-sm font-semibold btn-press disabled:opacity-50"
            >
              {savingPin ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      </BottomSheet>
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
