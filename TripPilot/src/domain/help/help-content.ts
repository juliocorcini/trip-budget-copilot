/**
 * DEC-121 (R-12): data-driven contextual help registry.
 *
 * Each complex screen declares its help topics; the overlay walks them
 * sequentially, highlighting the REAL element via `data-help-anchor`
 * attributes when present. All copy lives in i18n under
 * `help.<screen>.<topic>_title` / `help.<screen>.<topic>_body` — every
 * body must carry a CONCRETE travel example, not an abstract definition.
 */

export type HelpScreenId =
  | 'funds'
  | 'planner'
  | 'planned'
  | 'wallets'
  | 'phase_edit'
  | 'outing'
  | 'backup';

export interface HelpTopic {
  /** Key fragment: `help.<screen>.<id>_title` / `_body`. */
  id: string;
  /** Matches a `data-help-anchor` attribute on the live screen (or null). */
  anchorId: string | null;
}

const topic = (id: string, anchorId: string | null = null): HelpTopic => ({ id, anchorId });

export const HELP_CONTENT: Record<HelpScreenId, HelpTopic[]> = {
  funds: [
    topic('what'),
    topic('pool_card', 'funds-pool-list'),
    topic('scope', 'funds-pool-list'),
    topic('future_floors', 'funds-pool-list'),
    topic('envelopes', 'funds-pool-list'),
    topic('add', 'funds-add'),
  ],
  planner: [
    topic('what'),
    topic('free_margin', 'planner-free-margin'),
    topic('categories', 'planner-categories'),
    topic('quantities', 'planner-categories'),
    topic('recommendation'),
  ],
  planned: [
    topic('what'),
    topic('reserve', 'planned-list'),
    topic('tracking', 'planned-add'),
    topic('bought', 'planned-buy'),
    topic('multi_store', 'planned-list'),
  ],
  wallets: [
    topic('what'),
    topic('balance', 'wallets-list'),
    topic('default', 'wallets-list'),
    topic('reconcile', 'wallets-list'),
    topic('vs_funds'),
  ],
  phase_edit: [
    topic('what'),
    topic('dates', 'phase-edit-list'),
    topic('activities', 'phase-edit-list'),
    topic('events', 'phase-edit-list'),
  ],
  outing: [
    topic('what'),
    topic('gauge', 'outing-gauge'),
    topic('limits', 'outing-gauge'),
    topic('quick_add', 'outing-quick-add'),
    topic('items', 'outing-items'),
    topic('end', 'outing-end'),
  ],
  backup: [
    topic('what'),
    topic('export', 'backup-export'),
    topic('save', 'backup-save'),
    topic('csv', 'backup-csv'),
    topic('import', 'backup-import'),
  ],
};

export function getHelpTopics(screenId: HelpScreenId): HelpTopic[] {
  return HELP_CONTENT[screenId];
}

export function getHelpTopicTitleKey(screenId: HelpScreenId, topicId: string): string {
  return `help.${screenId}.${topicId}_title`;
}

export function getHelpTopicBodyKey(screenId: HelpScreenId, topicId: string): string {
  return `help.${screenId}.${topicId}_body`;
}
