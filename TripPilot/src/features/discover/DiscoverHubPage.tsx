import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/Icon';
import { GUIDE_SECTIONS } from '@/domain/guide';
import { searchHelp, helpQuestionKey, helpSectionTitleKey } from '@/domain/help';

/**
 * D02 · DEC-307/308 — the discovery hub. One screen that answers "what can I do
 * here?" and "where is the thing that solves my problem?" WITHOUT digging through
 * Settings and WITHOUT knowing the technical name. It reuses the existing domain:
 *  - search = `searchHelp` (local, 0 token) over the multilingual keyword index,
 *    so an intent phrase ("quero dividir um valor", "ver câmbio") lands on the
 *    right function and opens it in one tap;
 *  - browse = `GUIDE_SECTIONS` ("Tudo que dá para fazer"), grouped by intent.
 * The full Help Center (steps/answers) stays one tap away at the bottom.
 */
export function DiscoverHubPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const trimmed = query.trim();
  const isSearching = trimmed.length > 0;
  const results = useMemo(() => (isSearching ? searchHelp(trimmed) : []), [trimmed, isSearching]);

  return (
    <div className="flex flex-col gap-4 pb-6 pt-2">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('discover.title')}</h1>
      </div>

      <p className="text-sm text-on-surface-dim leading-relaxed px-1">{t('discover.intro')}</p>

      <div className="relative">
        <Icon
          name="search"
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-faint pointer-events-none"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('discover.search_placeholder')}
          aria-label={t('discover.search_placeholder')}
          className="w-full bg-surface-container rounded-2xl pl-10 pr-4 py-3 text-sm text-on-surface placeholder:text-on-surface-faint outline-none"
        />
      </div>

      {isSearching ? (
        results.length > 0 ? (
          <div className="bg-surface-container rounded-2xl overflow-hidden">
            {results.map((article, index) => (
              <button
                key={article.id}
                onClick={() => navigate(article.route)}
                className="w-full flex items-center gap-3 px-4 py-3 btn-press text-left"
                style={index > 0 ? { borderTop: '1px solid var(--border-faint)' } : undefined}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: '#C75B3914' }}
                >
                  <Icon name={article.icon} size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-on-surface">{t(helpQuestionKey(article.id) as never)}</p>
                  <p className="text-[11px] text-on-surface-faint mt-0.5">
                    {t(helpSectionTitleKey(article.section) as never)}
                  </p>
                </div>
                <Icon name="arrow_forward" size={18} className="text-on-surface-faint shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-on-surface-dim leading-relaxed px-1 py-6 text-center">
            {t('discover.no_results')}
          </p>
        )
      ) : (
        <>
          <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider px-1 -mb-1">
            {t('discover.everything')}
          </p>
          {GUIDE_SECTIONS.map((section) => (
            <div key={section.id}>
              <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider px-1 mb-2">
                {t(section.titleKey as never)}
              </p>
              <div className="bg-surface-container rounded-2xl overflow-hidden">
                {section.entries.map((entry, index) => (
                  <button
                    key={entry.id}
                    onClick={() => navigate(entry.route)}
                    className="w-full flex items-center gap-3 px-4 py-3 btn-press text-left"
                    style={index > 0 ? { borderTop: '1px solid var(--border-faint)' } : undefined}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: '#C75B3914' }}
                    >
                      <Icon name={entry.icon} size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-on-surface">{t(entry.titleKey as never)}</p>
                      <p className="text-xs text-on-surface-dim leading-snug mt-0.5">
                        {t(entry.descKey as never)}
                      </p>
                    </div>
                    <Icon name="chevron_right" size={18} className="text-on-surface-faint shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* The full Q&A / step-by-step stays one tap away (the hub is for finding
              and going; the Help Center is for reading how). */}
          <button
            onClick={() => navigate('/help')}
            className="bg-surface-container rounded-2xl p-4 flex items-center gap-3 text-left btn-press mt-1"
          >
            <div className="w-10 h-10 rounded-full bg-surface-high flex items-center justify-center shrink-0">
              <Icon name="help" size={22} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-on-surface">{t('discover.help_cta_title')}</p>
              <p className="text-[11px] text-on-surface-faint">{t('discover.help_cta_desc')}</p>
            </div>
            <Icon name="chevron_right" size={20} className="text-on-surface-faint shrink-0" />
          </button>
        </>
      )}
    </div>
  );
}
