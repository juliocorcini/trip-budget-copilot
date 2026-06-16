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
  | 'occasion_counters'
  | 'insights'
  | 'amigo_sincero'
  | 'pending_shares'
  | 'funds_summary'
  | 'planned_purchases'
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
  /** UX polish (D3): card can be collapsed to a single header row, with the
   * open/closed state persisted in settings (sibling of `hidden`). */
  collapsible?: boolean;
  /** FIELD item 16: compact single-number card that the traveler can opt into
   * rendering at half width, so two of them share a row (curated 2-up grid).
   * Rich cards (hero, check-in, carousels, recents) stay full width. */
  pairable?: boolean;
  quickAction: DashboardQuickAction | null;
}

// UX polish (D2): default order favours hierarchy — urgent/contextual and the
// beloved carousels (occasion counters + insights — ÂNCORA 10) stay high; the
// expense list sits at the bottom. U6 (DEC-180): the read-only analytics drawer
// (recap/burn-down/heatmap) moved to the Copiloto intelligence tab. Users can
// still reorder/hide everything (DEC-119).
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
    pairable: true,
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
    pairable: true,
    quickAction: null,
  },
  {
    // ÂNCORA 10: beloved horizontal-scroll carousel — kept prominent.
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
    // ÂNCORA 10: beloved insights carousel — kept prominent.
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
    pairable: true,
    quickAction: {
      route: '/funds',
      labelKey: 'dashboard.card_action_open_funds',
      icon: 'account_balance',
    },
  },
  {
    // DEC-175: earmarked future buys — what's already set aside from free-to-spend.
    id: 'planned_purchases',
    labelKey: 'dashboard.card_planned_purchases',
    fixed: false,
    pairable: true,
    quickAction: {
      route: '/planned',
      labelKey: 'dashboard.card_action_open_planned',
      icon: 'shopping_bag',
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

/**
 * D3: cards collapsed by default (closed drawer). U6 (DEC-180) removed the only
 * collapsible card (the analytics drawer moved to the Copiloto), so the default
 * is now empty — the collapse machinery stays as dormant, generic infra.
 */
export const DEFAULT_COLLAPSED_CARDS: DashboardCardId[] = [];

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

/** D3: a collapsed card shows only its header row; the body is revealed on tap. */
export function isDashboardCardCollapsed(
  id: DashboardCardId,
  collapsed: string[] | undefined,
): boolean {
  if (!getDashboardCard(id).collapsible) return false;
  return (collapsed ?? DEFAULT_COLLAPSED_CARDS).includes(id);
}

export function toggleDashboardCardCollapsed(
  id: DashboardCardId,
  collapsed: string[] | undefined,
): string[] {
  if (!getDashboardCard(id).collapsible) return collapsed ?? [...DEFAULT_COLLAPSED_CARDS];
  const current = collapsed ?? DEFAULT_COLLAPSED_CARDS;
  return current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
}

/** FIELD item 16: only compact single-number cards may share a row. */
export function isDashboardCardPairable(id: DashboardCardId): boolean {
  return getDashboardCard(id).pairable === true;
}

/** FIELD item 16: did the traveler opt this (pairable) card into the 2-up grid? */
export function isDashboardCardPaired(
  id: DashboardCardId,
  paired: string[] | undefined,
): boolean {
  if (!isDashboardCardPairable(id)) return false;
  return (paired ?? []).includes(id);
}

/** FIELD item 16: toggle a pairable card's opt-in (no-op for non-pairable). */
export function toggleDashboardCardPaired(
  id: DashboardCardId,
  paired: string[] | undefined,
): string[] {
  const current = paired ?? [];
  if (!isDashboardCardPairable(id)) return current;
  return current.includes(id) ? current.filter((p) => p !== id) : [...current, id];
}

/**
 * FIELD item 16: a render row is either a full-width card or a side-by-side
 * pair of two compact cards.
 */
export type DashboardRow =
  | { kind: 'full'; id: DashboardCardId }
  | { kind: 'pair'; ids: [DashboardCardId, DashboardCardId] };

/**
 * FIELD item 16: fold a visible card sequence into rows. A card is paired only
 * when it is in `pairableNow` (pairable + opted-in + actually has content), and
 * two of them pair up only when ADJACENT in the visible order — a full-width
 * card between them keeps each on its own row. Pure (data-driven, no UI), so the
 * "curated 2-up grid" is fully unit-testable. ÂNCORA 9: nothing is added or
 * removed, only the row geometry changes.
 */
export function groupDashboardRows(
  sequence: DashboardCardId[],
  pairableNow: ReadonlySet<DashboardCardId>,
): DashboardRow[] {
  const rows: DashboardRow[] = [];
  let pending: DashboardCardId | null = null;
  for (const id of sequence) {
    if (pairableNow.has(id)) {
      if (pending !== null) {
        rows.push({ kind: 'pair', ids: [pending, id] });
        pending = null;
      } else {
        pending = id;
      }
      continue;
    }
    if (pending !== null) {
      rows.push({ kind: 'full', id: pending });
      pending = null;
    }
    rows.push({ kind: 'full', id });
  }
  if (pending !== null) rows.push({ kind: 'full', id: pending });
  return rows;
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
