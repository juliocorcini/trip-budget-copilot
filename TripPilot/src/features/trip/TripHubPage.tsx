import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/Icon';

interface HubItem {
  icon: string;
  label: string;
  desc?: string;
  path: string;
}

/**
 * Redesign (G1): "Viagem" is the plan/structure hub that replaces the trip
 * section of the old "Mais" tab. It groups planning (scenarios + planned
 * purchases) and structure (phases, funds, wallets, profiles, people, outing
 * history) so nothing from the old menu is lost — only reorganized.
 *
 * G2 enriches this page with a cross-phase selector and inline planning/fund
 * previews. The links here keep every destination reachable in the meantime.
 */
export function TripHubPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const sections: { title: string; items: HubItem[] }[] = [
    {
      title: t('trip_hub.section_planning'),
      items: [
        { icon: 'tune', label: t('trip_hub.planner'), desc: t('trip_hub.planner_desc'), path: '/planner' },
        { icon: 'shopping_bag', label: t('more.planned'), desc: t('trip_hub.planned_desc'), path: '/planned' },
      ],
    },
    {
      title: t('trip_hub.section_structure'),
      items: [
        { icon: 'map', label: t('more.overview'), path: '/trip' },
        { icon: 'timeline', label: t('more.edit_phases'), path: '/trip/edit' },
        { icon: 'account_balance_wallet', label: t('more.funds'), path: '/funds' },
        { icon: 'credit_card', label: t('more.wallets'), path: '/wallets' },
        { icon: 'category', label: t('more.profiles'), path: '/profiles' },
        { icon: 'groups', label: t('more.participants'), path: '/shared' },
        { icon: 'history', label: t('more.outing_history'), path: '/expenses?tab=outings' },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-5 pb-4 pt-2">
      <div>
        <h1 className="text-heading font-bold text-on-surface">{t('trip_hub.title')}</h1>
        <p className="text-sm text-on-surface-dim mt-0.5">{t('trip_hub.subtitle')}</p>
      </div>

      {sections.map((section) => (
        <div key={section.title}>
          <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
            {section.title}
          </p>
          <div className="bg-surface-container rounded-xl overflow-hidden">
            {section.items.map((item, i) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 btn-press text-left ${
                  i < section.items.length - 1 ? 'border-b border-on-surface-mute' : ''
                }`}
              >
                <Icon name={item.icon} size={20} className="text-on-surface-dim shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-on-surface">{item.label}</p>
                  {item.desc && (
                    <p className="text-[11px] text-on-surface-faint mt-0.5">{item.desc}</p>
                  )}
                </div>
                <Icon name="chevron_right" size={18} className="text-on-surface-faint ml-auto shrink-0" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
