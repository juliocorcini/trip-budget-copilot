import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/Icon';
import {
  groupHelpArticlesBySection,
  searchHelp,
  relatedHelpArticles,
  helpQuestionKey,
  helpAnswerKey,
  helpStepsKey,
  helpSectionTitleKey,
  type HelpArticle,
} from '@/domain/help';

/**
 * FB-28 V1 (DEC-278) — the in-app help center, 100% local (0 token). Pure
 * presentation over the domain catalog: browse by theme or search by a word,
 * each answer carries concrete steps and a one-tap deep-link to the screen that
 * does it. The AI fallback is explicitly a V2 concern and lives nowhere here.
 */
export function HelpPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const trimmed = query.trim();
  const isSearching = trimmed.length > 0;
  const results = useMemo(() => (isSearching ? searchHelp(trimmed) : []), [trimmed, isSearching]);
  const groups = useMemo(() => groupHelpArticlesBySection(), []);

  const toggle = (id: string) => setOpenId((current) => (current === id ? null : id));

  // A related chip jumps to a sibling answer; clearing the query guarantees the
  // target is visible in the browse view (it may not be in the current results).
  const openRelated = (id: string) => {
    setQuery('');
    setOpenId(id);
  };

  const renderArticle = (article: HelpArticle, index: number) => {
    const open = openId === article.id;
    const rawSteps = t(helpStepsKey(article.id) as never, { returnObjects: true }) as unknown;
    const steps = Array.isArray(rawSteps) ? (rawSteps as string[]) : [];
    const related = open ? relatedHelpArticles(article.id) : [];

    return (
      <div
        key={article.id}
        style={index > 0 ? { borderTop: '1px solid var(--border-faint)' } : undefined}
      >
        <button
          onClick={() => toggle(article.id)}
          className="w-full flex items-center gap-3 px-4 py-3 btn-press text-left"
          aria-expanded={open}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#C75B3914' }}
          >
            <Icon name={article.icon} size={18} className="text-primary" />
          </div>
          <p className="flex-1 min-w-0 text-sm font-bold text-on-surface">
            {t(helpQuestionKey(article.id) as never)}
          </p>
          <Icon
            name={open ? 'expand_less' : 'expand_more'}
            size={20}
            className="text-on-surface-faint shrink-0"
          />
        </button>

        {open && (
          <div className="px-4 pb-4 pl-16">
            <p className="text-sm text-on-surface-dim leading-relaxed">
              {t(helpAnswerKey(article.id) as never)}
            </p>

            {steps.length > 0 && (
              <ol className="mt-3 flex flex-col gap-2">
                {steps.map((step, stepIndex) => (
                  <li key={stepIndex} className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {stepIndex + 1}
                    </span>
                    <span className="text-sm text-on-surface leading-snug">{step}</span>
                  </li>
                ))}
              </ol>
            )}

            <button
              onClick={() => navigate(article.route)}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-on-surface text-xs font-bold btn-press"
            >
              <Icon name="open_in_new" size={16} />
              {t('help_center.open')}
            </button>

            {related.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] text-on-surface-faint font-semibold uppercase tracking-wider mb-2">
                  {t('help_center.related')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {related.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => openRelated(item.id)}
                      className="px-3 py-1.5 rounded-full bg-surface-high text-on-surface-dim text-xs font-medium btn-press"
                    >
                      {t(helpQuestionKey(item.id) as never)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 pb-6 pt-2">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('help_center.title')}</h1>
      </div>

      <p className="text-sm text-on-surface-dim leading-relaxed px-1">{t('help_center.intro')}</p>

      <div className="relative">
        <Icon
          name="search"
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-faint pointer-events-none"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpenId(null);
          }}
          placeholder={t('help_center.search_placeholder')}
          aria-label={t('help_center.search_placeholder')}
          className="w-full bg-surface-container rounded-2xl pl-10 pr-4 py-3 text-sm text-on-surface placeholder:text-on-surface-faint outline-none"
        />
      </div>

      {isSearching ? (
        results.length > 0 ? (
          <div className="bg-surface-container rounded-2xl overflow-hidden">
            {results.map((article, index) => renderArticle(article, index))}
          </div>
        ) : (
          <p className="text-sm text-on-surface-dim leading-relaxed px-1 py-6 text-center">
            {t('help_center.no_results')}
          </p>
        )
      ) : (
        groups.map((group) => (
          <div key={group.id}>
            <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider px-1 mb-2">
              {t(helpSectionTitleKey(group.id) as never)}
            </p>
            <div className="bg-surface-container rounded-2xl overflow-hidden">
              {group.articles.map((article, index) => renderArticle(article, index))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
