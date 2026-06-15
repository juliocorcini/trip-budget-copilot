import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/Icon';

interface ToolItem {
  icon: string;
  label: string;
  desc: string;
  path: string;
}

/**
 * Redesign (G1): "Copiloto" is the intelligence tab. This first version exposes
 * the analysis tools that used to be buried in "Mais" (impact, simulator,
 * rescue). G3 turns this page into the narrative the council designed
 * (verdict → where it's heading → what to do → where it came from → month map →
 * pace), reusing the dashboard derivations. See
 * brain/documents/copilot-intelligence-2026-06-15.md.
 */
export function CopilotPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const tools: ToolItem[] = [
    {
      icon: 'analytics',
      label: t('copilot.impact'),
      desc: t('copilot.impact_desc'),
      path: '/impact',
    },
    {
      icon: 'calculate',
      label: t('copilot.simulate'),
      desc: t('copilot.simulate_desc'),
      path: '/simulator',
    },
    {
      icon: 'sos',
      label: t('copilot.rescue'),
      desc: t('copilot.rescue_desc'),
      path: '/rescue',
    },
  ];

  return (
    <div className="flex flex-col gap-5 pb-4 pt-2">
      <div>
        <h1 className="text-heading font-bold text-on-surface">{t('copilot.title')}</h1>
        <p className="text-sm text-on-surface-dim mt-0.5">{t('copilot.subtitle')}</p>
      </div>

      <div>
        <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
          {t('copilot.tools')}
        </p>
        <div className="bg-surface-container rounded-xl overflow-hidden">
          {tools.map((tool, i) => (
            <button
              key={tool.path}
              onClick={() => navigate(tool.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 btn-press text-left ${
                i < tools.length - 1 ? 'border-b border-on-surface-mute' : ''
              }`}
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-surface-high">
                <Icon name={tool.icon} size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-on-surface">{tool.label}</p>
                <p className="text-[11px] text-on-surface-faint mt-0.5">{tool.desc}</p>
              </div>
              <Icon name="chevron_right" size={18} className="text-on-surface-faint ml-auto shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
