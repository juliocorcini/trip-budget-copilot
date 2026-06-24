export {
  HELP_CONTENT,
  getHelpTopics,
  getHelpTopicTitleKey,
  getHelpTopicBodyKey,
} from './help-content';
export type { HelpScreenId, HelpTopic } from './help-content';

// FB-28 V1 (DEC-278): the local help center / concierge knowledge base.
export {
  HELP_ARTICLES,
  HELP_SECTION_IDS,
  groupHelpArticlesBySection,
  searchHelp,
  relatedHelpArticles,
  normalizeHelpText,
  helpQuestionKey,
  helpAnswerKey,
  helpStepsKey,
  helpSectionTitleKey,
} from './help-catalog';
export type { HelpArticle, HelpSectionId, HelpSectionGroup } from './help-catalog';

// DEC-289 (M05): the tap glossary registry (term → gloss → help article).
export {
  GLOSSARY,
  GLOSSARY_ENTRIES,
  getGlossaryEntry,
  glossaryTermKey,
  glossaryGlossKey,
  glossaryHelpRoute,
} from './glossary';
export type { GlossaryEntry, GlossaryTermId } from './glossary';
