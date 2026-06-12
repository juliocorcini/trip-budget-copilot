import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/Icon';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

interface MenuItem {
  icon: string;
  labelKey: string;
  path: string;
}

const SECTIONS: { titleKey: string; items: MenuItem[] }[] = [
  {
    titleKey: 'more.section_trip',
    items: [
      { icon: 'map', labelKey: 'more.overview', path: '/trip' },
      { icon: 'timeline', labelKey: 'more.edit_phases', path: '/trip/edit' },
      { icon: 'account_balance_wallet', labelKey: 'more.funds', path: '/funds' },
      { icon: 'tune', labelKey: 'more.profiles', path: '/profiles' },
      { icon: 'groups', labelKey: 'more.participants', path: '/shared' },
      { icon: 'credit_card', labelKey: 'more.wallets', path: '/wallets' },
      // DEC-079: secondary shortcut — same route as the Expenses tab.
      { icon: 'history', labelKey: 'more.outing_history', path: '/expenses?tab=outings' },
      // DEC-132: rescue calculator ("I need to save €X by the phase end").
      { icon: 'sos', labelKey: 'more.rescue', path: '/rescue' },
    ],
  },
  {
    titleKey: 'more.section_data',
    items: [
      { icon: 'cloud_upload', labelKey: 'more.backup', path: '/settings/backup' },
      { icon: 'download', labelKey: 'more.export_csv', path: '/settings/backup?csv=true' },
    ],
  },
  {
    titleKey: 'more.section_app',
    items: [
      { icon: 'settings', labelKey: 'more.settings', path: '/settings' },
      // DEC-059 (decision D-D): About entry; Reports stays out of D1/D2 scope.
      { icon: 'info', labelKey: 'more.about', path: '/about' },
    ],
  },
];

export function MorePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // DEC-135: visible only when the browser offered the install prompt.
  const { available: installAvailable, install } = useInstallPrompt();

  return (
    <div className="flex flex-col gap-5 pb-4 pt-2">
      <h1 className="text-heading font-bold text-on-surface">{t('more.title')}</h1>

      {installAvailable && (
        <button
          onClick={() => install()}
          className="w-full flex items-center gap-3 p-4 rounded-xl btn-press text-left"
          style={{ background: 'var(--highlight-subtle)' }}
        >
          <Icon name="install_mobile" size={22} className="text-primary" />
          <div className="flex-1">
            <p className="text-sm font-bold text-on-surface">{t('more.install_app')}</p>
            <p className="text-xs text-on-surface-dim mt-0.5">{t('more.install_app_hint')}</p>
          </div>
          <Icon name="chevron_right" size={18} className="text-on-surface-faint" />
        </button>
      )}

      {SECTIONS.map((section) => (
        <div key={section.titleKey}>
          <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
            {t(section.titleKey)}
          </p>
          <div className="bg-surface-container rounded-xl overflow-hidden">
            {section.items.map((item, i) => (
              <button
                key={`${item.path}-${item.labelKey}`}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 btn-press text-left ${
                  i < section.items.length - 1 ? 'border-b border-on-surface-mute' : ''
                }`}
              >
                <Icon name={item.icon} size={20} className="text-on-surface-dim" />
                <span className="text-sm text-on-surface">{t(item.labelKey)}</span>
                <Icon name="chevron_right" size={18} className="text-on-surface-faint ml-auto" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
