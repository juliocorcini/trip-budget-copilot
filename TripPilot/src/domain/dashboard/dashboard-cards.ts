/**
 * DEC-119 (R-10): configurable home screen — data-driven card catalog.
 *
 * Every dashboard card is declared here with its identity, whether it is an
 * anchor (hero / active outing — never hideable or movable) and its
 * contextual quick action for the long-press sheet (Core Rule 8: catalogs
 * live in the domain, the UI only renders them).
 */

export type DashboardCardId =
  | 'today_events'
  | 'daily_checkin'
  | 'savings_goal'
  | 'piggy_bank'
  | 'active_outing'
  | 'hero'
  | 'yesterday_recap'
  | 'occasion_counters'
  | 'insights'
  | 'phase_burndown'
  | 'spend_heatmap'
  | 'amigo_sincero'
  | 'pending_shares'
  | 'funds_summary'
  | 'recent_expenses';

export interface DashboardQuickAction {
  /** Route the quick action navigates to. */
  route: string;
  labelKey: string;
  icon: string;
}

export interface DashboardCardDescriptor {
  id: DashboardCardId;
  labelKey: string;
  /** Anchors of the app — rendered in place, never hidden nor reordered. */
  fixed: boolean;
  quickAction: DashboardQuickAction | null;
}

export const DASHBOARD_CARD_CATALOG: DashboardCardDescriptor[] = [
  {
    id: 'today_events',
    labelKey: 'dashboard.card_today_events',
    fixed: false,
    quickAction: {
      route: '/trip/edit',
      labelKey: 'dashboard.card_action_create_event',
      icon: 'celebration',
    },
  },
  { id: 'active_outing', labelKey: 'dashboard.card_active_outing', fixed: true, quickAction: null },
  { id: 'hero', labelKey: 'dashboard.card_hero', fixed: true, quickAction: null },
  {
    // M7: one-tap intent for the day — sits right below the hero.
    id: 'daily_checkin',
    labelKey: 'dashboard.card_daily_checkin',
    fixed: false,
    quickAction: null,
  },
  {
    // M14: savings goal progress — positive target next to the budget.
    id: 'savings_goal',
    labelKey: 'dashboard.card_savings_goal',
    fixed: false,
    quickAction: {
      route: '/settings',
      labelKey: 'dashboard.card_action_edit_goal',
      icon: 'flag',
    },
  },
  {
    // M15: piggy bank — accumulated under-spend (read-only).
    id: 'piggy_bank',
    labelKey: 'dashboard.card_piggy_bank',
    fixed: false,
    quickAction: null,
  },
  {
    id: 'yesterday_recap',
    labelKey: 'dashboard.card_yesterday_recap',
    fixed: false,
    quickAction: {
      route: '/expenses',
      labelKey: 'dashboard.card_action_see_expenses',
      icon: 'receipt_long',
    },
  },
  {
    id: 'occasion_counters',
    labelKey: 'dashboard.card_occasion_counters',
    fixed: false,
    quickAction: {
      route: '/outings/new',
      labelKey: 'dashboard.card_action_start_outing',
      icon: 'local_bar',
    },
  },
  {
    id: 'insights',
    labelKey: 'dashboard.card_insights',
    fixed: false,
    quickAction: {
      route: '/impact',
      labelKey: 'dashboard.card_action_see_impact',
      icon: 'insights',
    },
  },
  {
    id: 'phase_burndown',
    labelKey: 'dashboard.card_phase_burndown',
    fixed: false,
    quickAction: {
      route: '/impact',
      labelKey: 'dashboard.card_action_see_impact',
      icon: 'monitoring',
    },
  },
  {
    id: 'spend_heatmap',
    labelKey: 'dashboard.card_spend_heatmap',
    fixed: false,
    quickAction: {
      route: '/expenses',
      labelKey: 'dashboard.card_action_see_expenses',
      icon: 'calendar_month',
    },
  },
  {
    id: 'amigo_sincero',
    labelKey: 'dashboard.card_amigo_sincero',
    fixed: false,
    quickAction: {
      route: '/impact',
      labelKey: 'dashboard.card_action_see_impact',
      icon: 'chat_bubble',
    },
  },
  {
    id: 'pending_shares',
    labelKey: 'dashboard.card_pending_shares',
    fixed: false,
    quickAction: {
      route: '/shared',
      labelKey: 'dashboard.card_action_open_shared',
      icon: 'group',
    },
  },
  {
    id: 'funds_summary',
    labelKey: 'dashboard.card_funds_summary',
    fixed: false,
    quickAction: {
      route: '/funds',
      labelKey: 'dashboard.card_action_open_funds',
      icon: 'account_balance',
    },
  },
  {
    id: 'recent_expenses',
    labelKey: 'dashboard.card_recent_expenses',
    fixed: false,
    quickAction: {
      route: '/quick-add',
      labelKey: 'dashboard.card_action_register_expense',
      icon: 'add',
    },
  },
];

const CATALOG_IDS = new Set(DASHBOARD_CARD_CATALOG.map((c) => c.id));

export function getDashboardCard(id: DashboardCardId): DashboardCardDescriptor {
  return DASHBOARD_CARD_CATALOG.find((c) => c.id === id)!;
}

/**
 * Full render sequence: fixed cards keep their catalog slots; movable cards
 * fill the remaining slots following the user's saved order (unknown ids are
 * dropped, missing ids are appended in catalog order). Hidden cards are NOT
 * removed here — rendering filters them, so the config screen can still show
 * everything in place.
 */
export function resolveDashboardCardSequence(
  savedOrder: string[] | undefined,
): DashboardCardId[] {
  const movableCatalog = DASHBOARD_CARD_CATALOG.filter((c) => !c.fixed).map((c) => c.id);
  const saved = (savedOrder ?? []).filter(
    (id): id is DashboardCardId => CATALOG_IDS.has(id as DashboardCardId),
  );
  const orderedMovable = [
    ...saved.filter((id) => movableCatalog.includes(id)),
    ...movableCatalog.filter((id) => !saved.includes(id)),
  ];

  let cursor = 0;
  return DASHBOARD_CARD_CATALOG.map((card) => {
    if (card.fixed) return card.id;
    return orderedMovable[cursor++]!;
  });
}

export function isDashboardCardHidden(
  id: DashboardCardId,
  hidden: string[] | undefined,
): boolean {
  if (getDashboardCard(id).fixed) return false;
  return (hidden ?? []).includes(id);
}

export function toggleDashboardCardHidden(
  id: DashboardCardId,
  hidden: string[] | undefined,
): string[] {
  if (getDashboardCard(id).fixed) return hidden ?? [];
  const current = hidden ?? [];
  return current.includes(id) ? current.filter((h) => h !== id) : [...current, id];
}

/** Moves a movable card one position among the MOVABLE cards (↑/↓ in V1). */
export function moveDashboardCard(
  savedOrder: string[] | undefined,
  id: DashboardCardId,
  direction: 'up' | 'down',
): string[] {
  const movable = resolveDashboardCardSequence(savedOrder).filter(
    (cardId) => !getDashboardCard(cardId).fixed,
  );
  const index = movable.indexOf(id);
  if (index === -1) return movable;
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= movable.length) return movable;
  const next = [...movable];
  next[index] = next[targetIndex]!;
  next[targetIndex] = id;
  return next;
}
