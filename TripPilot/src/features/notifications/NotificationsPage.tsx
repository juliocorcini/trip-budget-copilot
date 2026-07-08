import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useNotifications } from '@/hooks/useNotifications';
import { useScrolled } from '@/hooks/useScrolled';
import { useAppData } from '@/hooks/useAppData';
import { formatMoney } from '@/domain/money';
import { Icon } from '@/components/Icon';
import type { AppNotification, AppNotificationKind } from '@/domain/insights';

/** DEC-090 (R-08): icon + tone per notification kind — data-driven. */
const NOTIFICATION_ICONS: Record<AppNotificationKind, string> = {
  pending_p2p: 'payments',
  pending_share: 'group',
  pending_group_payment: 'check_circle',
  event_today: 'celebration',
  backup_due: 'cloud_upload',
  long_outing: 'schedule',
  phase_over_budget: 'error',
};

const TONE_CLASS: Record<AppNotification['tone'], string> = {
  neutral: 'text-primary',
  warning: 'text-warning',
  error: 'text-error',
};

// U1 (DEC-090): the center used to be one long flat list. Group the derived
// notifications into a few labeled sections so it reads as "what needs me /
// what's today / reminders" instead of an undifferentiated wall.
type NotificationGroup = 'action' | 'today' | 'reminders';

const NOTIFICATION_GROUP: Record<AppNotificationKind, NotificationGroup> = {
  pending_p2p: 'action',
  pending_group_payment: 'action',
  // DEC-450 (D06): waiting on a PEER's acceptance is informative, not "needs
  // you" — the owner has nothing to confirm on what they registered themselves.
  pending_share: 'reminders',
  phase_over_budget: 'action',
  event_today: 'today',
  long_outing: 'today',
  backup_due: 'reminders',
};

const GROUP_ORDER: NotificationGroup[] = ['action', 'today', 'reminders'];

const GROUP_LABEL_KEY: Record<NotificationGroup, string> = {
  action: 'notifications.group_action',
  today: 'notifications.group_today',
  reminders: 'notifications.group_reminders',
};

function notificationText(
  notification: AppNotification,
  t: (key: string, options?: Record<string, string | number>) => string,
  currency: string,
): string {
  const v = notification.values;
  switch (notification.kind) {
    case 'pending_p2p':
      return t('notifications.pending_p2p', { count: v.count as number });
    case 'pending_share':
      // DEC-450 (D06): directional copy — who we are waiting ON, never "you".
      return t('notifications.pending_share', {
        names: v.names as string,
        count: v.count as number,
        amount: formatMoney(v.impactCents as number, currency),
      });
    case 'event_today':
      return t('notifications.event_today', { name: v.name as string });
    case 'backup_due':
      return t('notifications.backup_due');
    case 'long_outing':
      return t('notifications.long_outing', {
        name: v.name as string,
        hours: v.hours as number,
      });
    case 'pending_group_payment':
      return t('notifications.pending_group_payment', {
        participantName: v.participantName as string,
        groupName: v.groupName as string,
      });
    case 'phase_over_budget':
      return t('notifications.phase_over_budget', {
        amount: formatMoney(v.overCents as number, currency),
      });
  }
}

export function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scrolled = useScrolled();
  const { trip } = useAppData();
  const { notifications, ready } = useNotifications();

  const currency = trip?.baseCurrency ?? 'EUR';

  // Group + keep only the sections that actually have something to show.
  const groups = GROUP_ORDER.map((group) => ({
    group,
    items: notifications.filter((n) => NOTIFICATION_GROUP[n.kind] === group),
  })).filter((section) => section.items.length > 0);

  return (
    <div className="flex flex-col pb-6">
      <div
        className={`page-sticky-header ${scrolled ? 'is-scrolled' : ''} pt-4 pb-3 flex items-center gap-3`}
      >
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">
          {t('notifications.title')}
        </h1>
      </div>

      {ready && notifications.length === 0 && (
        <div className="mt-16 flex flex-col items-center text-center px-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ background: 'var(--surface-container)' }}
          >
            <Icon name="notifications_off" size={28} className="text-on-surface-mute" />
          </div>
          <p className="text-sm font-bold text-on-surface">{t('notifications.empty')}</p>
          <p className="text-xs text-on-surface-faint mt-1">{t('notifications.empty_desc')}</p>
        </div>
      )}

      {/* U1: grouped sections — each part is a labeled block of cards. */}
      <div className="mt-3 flex flex-col gap-5">
        {groups.map((section) => (
          <div key={section.group} className="flex flex-col gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-faint px-1">
              {t(GROUP_LABEL_KEY[section.group])} · {section.items.length}
            </p>
            {section.items.map((notification) => (
              <button
                key={notification.id}
                onClick={() => navigate(notification.destination)}
                className="bg-surface-container rounded-2xl p-4 flex items-center gap-3 btn-press text-left w-full"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'var(--surface-container-high)' }}
                >
                  <Icon
                    name={NOTIFICATION_ICONS[notification.kind]}
                    size={20}
                    className={TONE_CLASS[notification.tone]}
                  />
                </div>
                <p className="text-[13px] font-semibold leading-snug text-on-surface flex-1">
                  {notificationText(notification, t, currency)}
                </p>
                <Icon name="chevron_right" size={16} className="text-on-surface-faint" />
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
