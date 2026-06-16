import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { appSettingsRepository } from '@/data/repositories';
import {
  resolveDashboardCardSequence,
  getDashboardCard,
  toggleDashboardCardHidden,
  toggleDashboardCardPaired,
  isDashboardCardPairable,
  isDashboardCardPaired,
  moveDashboardCard,
  type DashboardCardId,
} from '@/domain/dashboard';
import { Icon } from '@/components/Icon';
import type { AppSettings } from '@/domain/types/app-settings';

/**
 * DEC-119 (R-10): home screen configuration — every card in its current
 * order, ↑/↓ to reorder (V1), eye toggle for visibility. Anchors (active
 * outing / hero) are shown locked.
 */
export function DashboardConfigPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    appSettingsRepository.get().then(setSettings);
  }, []);

  if (!settings) return null;

  const sequence = resolveDashboardCardSequence(settings.dashboardCardOrder);
  const hidden = settings.hiddenDashboardCards;
  const movable = sequence.filter((id) => !getDashboardCard(id).fixed);

  const persistOrder = async (order: string[]) => {
    setSettings(await appSettingsRepository.update({ dashboardCardOrder: order }));
  };

  const handleMove = (id: DashboardCardId, direction: 'up' | 'down') => {
    persistOrder(moveDashboardCard(settings.dashboardCardOrder, id, direction));
  };

  const handleToggleVisibility = async (id: DashboardCardId) => {
    setSettings(
      await appSettingsRepository.update({
        hiddenDashboardCards: toggleDashboardCardHidden(id, hidden),
      }),
    );
  };

  // FIELD item 16: opt a compact card in/out of the 2-up grid.
  const handleTogglePair = async (id: DashboardCardId) => {
    setSettings(
      await appSettingsRepository.update({
        dashboardPairedCards: toggleDashboardCardPaired(id, settings.dashboardPairedCards),
      }),
    );
  };

  return (
    <div className="flex flex-col gap-4 pb-6 pt-2">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('dashboard.configure_home')}</h1>
      </div>

      <p className="text-xs text-on-surface-faint">{t('dashboard.configure_home_hint')}</p>

      <div className="flex flex-col gap-1.5">
        {sequence.map((id) => {
          const card = getDashboardCard(id);
          const isHidden = hidden.includes(id);
          const movableIndex = movable.indexOf(id);
          return (
            <div
              key={id}
              className="bg-surface-container rounded-xl px-4 py-3 flex items-center gap-3"
              style={isHidden ? { opacity: 0.55 } : undefined}
            >
              <span className="text-sm font-semibold text-on-surface flex-1 min-w-0 truncate">
                {t(card.labelKey as never)}
              </span>
              {card.fixed ? (
                <span className="flex items-center gap-1 text-[10px] font-bold text-on-surface-faint">
                  <Icon name="lock" size={12} />
                  {t('dashboard.card_locked')}
                </span>
              ) : (
                <div className="flex items-center gap-1">
                  {/* FIELD item 16: compact cards can opt into the 2-up grid. */}
                  {isDashboardCardPairable(id) && (
                    <button
                      onClick={() => handleTogglePair(id)}
                      className="btn-press w-8 h-8 rounded-lg flex items-center justify-center bg-surface-high"
                      aria-label={
                        isDashboardCardPaired(id, settings.dashboardPairedCards)
                          ? t('dashboard.card_pair_off')
                          : t('dashboard.card_pair_on')
                      }
                    >
                      <Icon
                        name="view_column"
                        size={14}
                        className={
                          isDashboardCardPaired(id, settings.dashboardPairedCards)
                            ? 'text-primary'
                            : 'text-on-surface-faint'
                        }
                      />
                    </button>
                  )}
                  <button
                    onClick={() => handleMove(id, 'up')}
                    disabled={movableIndex <= 0}
                    className="btn-press w-8 h-8 rounded-lg flex items-center justify-center bg-surface-high disabled:opacity-30"
                    aria-label={t('dashboard.card_move_up')}
                  >
                    <Icon name="arrow_upward" size={14} className="text-on-surface-dim" />
                  </button>
                  <button
                    onClick={() => handleMove(id, 'down')}
                    disabled={movableIndex === movable.length - 1}
                    className="btn-press w-8 h-8 rounded-lg flex items-center justify-center bg-surface-high disabled:opacity-30"
                    aria-label={t('dashboard.card_move_down')}
                  >
                    <Icon name="arrow_downward" size={14} className="text-on-surface-dim" />
                  </button>
                  <button
                    onClick={() => handleToggleVisibility(id)}
                    className="btn-press w-8 h-8 rounded-lg flex items-center justify-center bg-surface-high"
                    aria-label={isHidden ? t('dashboard.card_show') : t('dashboard.hide_card')}
                  >
                    <Icon
                      name={isHidden ? 'visibility_off' : 'visibility'}
                      size={14}
                      className={isHidden ? 'text-on-surface-faint' : 'text-primary'}
                    />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
