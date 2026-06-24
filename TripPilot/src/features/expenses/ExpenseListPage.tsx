import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { useAppData, notifyAppDataChanged } from '@/hooks/useAppData';
import { useScrolled } from '@/hooks/useScrolled';
import { useMultiSelect, type MultiSelect } from '@/hooks/useMultiSelect';
import { useHorizontalSwipe } from '@/hooks/useHorizontalSwipe';
import { useTabPaging } from '@/hooks/useTabPaging';
import { activityProfileRepository } from '@/data/repositories/activity-profile-repository';
import { sessionRepository } from '@/data/repositories/session-repository';
import { formatMoney, sumCents } from '@/domain/money';
import { formatShortDate, localDayOf, localClockTime, localDateString } from '@/domain/dates';
import { aggregateByPlace } from '@/domain/location';
import { getUnassignedTransactionCount } from '@/domain/wallets';
import { calculateSessionTotal, formatSessionDuration } from '@/domain/outing';
import {
  softDeleteTransactionsBatch,
  restoreTransactionsBatch,
  moveTransactionsToPoolBatch,
  changeTransactionsCategoryBatch,
  softDeleteOutingSessionsBatch,
  restoreOutingSessionsBatch,
} from '@/domain/orchestrators';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { EmptyState } from '@/components/EmptyState';
import { FastScroller } from '@/features/expenses/FastScroller';
import { SelectionBar, type SelectionAction } from '@/components/SelectionBar';
import { showToast } from '@/components/Toast';
import { getCategoryIcon } from '@/utils/category-icons';
import { isSplitCommitTransaction } from '@/domain/split';
import { buildSessionFeed, groupFeedByDay } from './expense-feed';
import { countActiveFilters, hasActiveFilter, type ExpenseFilterState } from './expense-filters';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { Session } from '@/domain/types/session';
import type { Transaction } from '@/domain/types/transaction';

type FilterCategory = string | null;
type ListTab = 'expenses' | 'outings';
// DEC-197 (N3): tab order — index drives swipe/slide direction (left = forward).
const TAB_ORDER: readonly ListTab[] = ['expenses', 'outings'];
type BatchSheet = 'deleteExpenses' | 'movePool' | 'changeCategory' | 'deleteOutings' | null;

const CATEGORY_KEYS = [
  'bar',
  'restaurant',
  'market',
  'transport',
  'outing',
  'entertainment',
  'health',
  'accommodation',
  'other',
] as const;

export function ExpenseListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trip, transactions, pools, wallets, loading, reload } = useAppData();
  // FIELD-14: the list can arrive pre-filtered by URL (?profile=<id> / ?category=<cat> / ?place=<label>).
  const [filterCategory, setFilterCategory] = useState<FilterCategory>(searchParams.get('category'));
  const [filterProfileId, setFilterProfileId] = useState<string | null>(searchParams.get('profile'));
  const [filterWalletNull, setFilterWalletNull] = useState(false);
  // E8 (M7): filter the list by place ("gastos por lugar").
  const [filterPlace, setFilterPlace] = useState<string | null>(searchParams.get('place'));
  const [profiles, setProfiles] = useState<ActivityProfile[]>([]);
  // DEC-079 (FIELD-09): outings ARE grouped expenses — they live in this screen.
  const [tab, setTabState] = useState<ListTab>(searchParams.get('tab') === 'outings' ? 'outings' : 'expenses');
  // DEC-206 (rollup): all trip sessions, so the Expenses feed can collapse a
  // receipt/outing's N transactions into ONE row instead of flooding the list.
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [batchSheet, setBatchSheet] = useState<BatchSheet>(null);
  // G2: free-text search across the expense feed (description / place / category).
  const [query, setQuery] = useState('');
  // Audit 4.4 (P2): the filter chips mixed 3 natures (category/place/profile) in
  // one unlabelled row on an already-dense header. They now live behind a labelled,
  // collapsible "Filtros" panel; the active scopes stay visible as a summary row.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const scrolled = useScrolled();
  // DEC-118 (R-09): hold to select, tap to add, batch action bar.
  const selection = useMultiSelect();
  // DEC-197 (N3): one ordered list of tabs drives both the swipe direction and
  // the slide animation. Swiping left advances (→ rightmost tab), swiping right
  // goes back; `paneDirRef` records the last direction so the keyed pane below
  // can slide in from the matching side. The whole thing is bidirectional.
  const paneDirRef = useRef<'next' | 'prev'>('next');
  const changeTab = (next: ListTab) => {
    selection.clear();
    setTabState((cur) => {
      if (next === cur) return cur;
      paneDirRef.current = TAB_ORDER.indexOf(next) > TAB_ORDER.indexOf(cur) ? 'next' : 'prev';
      return next;
    });
  };
  // G1 + FIELD-02: swipe pages the inner tabs; at the edges it hands the gesture
  // off to the neighbouring app tab (expenses ⇠ Início · outings ⇢ Viagem) so
  // the whole bottom bar is reachable by swiping.
  const tabPaging = useTabPaging();
  const tabSwipe = useHorizontalSwipe({
    onSwipeLeft: () => {
      if (tab === 'expenses') changeTab('outings');
      else tabPaging.goNextTab();
    },
    onSwipeRight: () => {
      if (tab === 'outings') changeTab('expenses');
      else tabPaging.goPrevTab();
    },
  });

  useEffect(() => {
    if (!trip) return;
    activityProfileRepository.getByTripId(trip.id).then(setProfiles);
    sessionRepository.getByTripId(trip.id).then(setAllSessions);
  }, [trip, transactions]);

  if (loading || !trip) return <p className="p-4 text-on-surface-dim">{t('common.loading')}</p>;

  const filterProfile = filterProfileId
    ? profiles.find((p) => p.id === filterProfileId) ?? null
    : null;

  const searchQuery = query.trim().toLowerCase();
  // G2: match on description, place and the (translated) category label.
  const matchesQuery = (tx: Transaction): boolean => {
    if (!searchQuery) return true;
    const haystack = `${tx.description ?? ''} ${tx.placeLabel ?? ''} ${
      tx.category ? t(`categories.${tx.category}` as never) : ''
    }`.toLowerCase();
    return haystack.includes(searchQuery);
  };
  // The scope filters apply to every feed transaction. D-BUG-04: income carries
  // no category/profile/place, so an active chip naturally excludes it — income
  // only surfaces while browsing or in a description search, exactly as planned.
  const matchesScope = (tx: Transaction): boolean =>
    tx.deletedAt === null &&
    (!filterCategory || tx.category === filterCategory) &&
    (!filterProfileId || tx.activityProfileId === filterProfileId) &&
    (!filterWalletNull || tx.walletId === null) &&
    (!filterPlace || tx.placeLabel === filterPlace) &&
    matchesQuery(tx);

  const byDateDesc = (a: Transaction, b: Transaction) => b.date.localeCompare(a.date);
  const expenses = transactions.filter((tx) => tx.type === 'expense' && matchesScope(tx)).sort(byDateDesc);
  // D-BUG-04 (D-DEC-D): income shows in the feed as a distinct line, but NEVER in
  // the "total gasto" — the header total and the day subtotals stay expense-only
  // (ÂNCORA 11 invariance: with zero income everything is bit-identical).
  const incomes = transactions.filter((tx) => tx.type === 'income' && matchesScope(tx)).sort(byDateDesc);

  const totalCents = sumCents(expenses.map((tx) => tx.amountCents));
  const unassigned = getUnassignedTransactionCount(transactions);

  // DEC-206 (rollup): a receipt/outing is ONE session holding N transactions.
  // Derive the session lookup + the completed-history list from the single load.
  const sessionById = new Map(allSessions.map((s) => [s.id, s]));
  // F2: a committed bill split is also wrapped in a completed Session, but it is a
  // "gasto dividido", not a bar outing — it belongs in Gastos (where its detail
  // shows the division), never in the Saídas tab. Drop those sessions here so a
  // split lives in exactly one place instead of masquerading as an outing too.
  const splitSessionIds = new Set(
    transactions
      .filter((tx) => isSplitCommitTransaction(tx) && tx.sessionId)
      .map((tx) => tx.sessionId as string),
  );
  const completedSessions = allSessions
    .filter((s) => s.status === 'completed' && s.endedAt !== null && !splitSessionIds.has(s.id))
    .sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? ''));

  const poolMap = new Map(pools.map((p) => [p.id, p.name]));
  const walletMap = new Map(wallets.map((w) => [w.id, w.name]));

  const categories = [...new Set(transactions.filter((tx) => tx.category).map((tx) => tx.category!))];
  // E8 (M7): places ranked by spend — drive the "by place" filter chips.
  const placeTotals = aggregateByPlace(transactions);

  // L1: group the (already date-desc) list by local day with a per-day subtotal,
  // so the feed reads as "Today €X · Yesterday €Y" instead of one flat wall of
  // rows. Pure projection — order is preserved from the sorted `expenses`.
  const todayKey = localDateString();
  const yesterdayKey = localDateString(new Date(Date.now() - 86_400_000));
  const dayLabelOf = (day: string): string =>
    day === todayKey
      ? t('expenses.day_today')
      : day === yesterdayKey
        ? t('expenses.day_yesterday')
        : formatShortDate(day);
  // C01 / DEC-296 (rollup): an outing is ONE entity in every summary. Collapse a
  // session's transactions into ONE feed row whenever the user is NOT doing a
  // free-text search — even with a category/profile/place/wallet filter active
  // (the old `isBrowsing` disabled the rollup under any filter, so clicking a
  // category exploded the receipt into loose items). Under a scope filter the row
  // shows only the matching items — its `totalCents` is the filtered subtotal and
  // the count reads "N itens nesta categoria"; a tap still opens the FULL outing.
  // Only a TEXT SEARCH itemises, because then the user is hunting a specific line.
  const collapseSessions = !searchQuery;
  // D-BUG-04: merge income into the date-ordered feed (only re-sort when there
  // IS income, so a trip with none stays byte-identical to the expense-only feed).
  const feedTransactions =
    incomes.length === 0 ? expenses : [...expenses, ...incomes].sort(byDateDesc);
  const feed = buildSessionFeed(feedTransactions, sessionById, collapseSessions);
  const expenseGroups = groupFeedByDay(feed);

  const filterState: ExpenseFilterState = {
    category: filterCategory,
    profileId: filterProfileId,
    walletNull: filterWalletNull,
    place: filterPlace,
  };
  const activeFilterCount = countActiveFilters(filterState);
  const anyFilterActive = hasActiveFilter(filterState);

  const clearFilters = () => {
    setFilterCategory(null);
    setFilterProfileId(null);
    setFilterWalletNull(false);
    setFilterPlace(null);
  };

  const finishBatch = async (messageKey: string) => {
    setBatchSheet(null);
    selection.clear();
    await reload();
    showToast(t(messageKey as never), 'success');
  };

  // DEC-126: deletions get an undo toast — restore + refresh whatever page
  // is mounted by then (the global data-changed event handles navigation).
  const finishDeleteWithUndo = async (onUndo: () => Promise<void>) => {
    setBatchSheet(null);
    selection.clear();
    await reload();
    showToast(t('selection.deleted_toast'), 'success', {
      actionLabel: t('common.undo'),
      durationMs: 8000,
      onTap: () => {
        void onUndo().then(() => {
          notifyAppDataChanged();
          showToast(t('common.undo_done'), 'info');
        });
      },
    });
  };

  const handleDeleteExpenses = async () => {
    const ids = selection.selectedIds;
    await softDeleteTransactionsBatch(ids);
    await finishDeleteWithUndo(() => restoreTransactionsBatch(ids));
  };

  const handleMovePool = async (poolId: string) => {
    await moveTransactionsToPoolBatch(selection.selectedIds, poolId);
    await finishBatch('selection.moved_toast');
  };

  const handleChangeCategory = async (category: string) => {
    await changeTransactionsCategoryBatch(selection.selectedIds, category);
    await finishBatch('selection.category_toast');
  };

  const handleDeleteOutings = async () => {
    const ids = selection.selectedIds;
    await softDeleteOutingSessionsBatch(ids);
    await finishDeleteWithUndo(() => restoreOutingSessionsBatch(ids));
  };

  // DEC-118: batch actions per list (data-driven by tab).
  const selectionActions: SelectionAction[] =
    tab === 'expenses'
      ? [
          {
            id: 'category',
            icon: 'category',
            label: t('selection.action_category'),
            onAction: () => setBatchSheet('changeCategory'),
          },
          {
            id: 'move',
            icon: 'account_balance',
            label: t('selection.action_move_pool'),
            onAction: () => setBatchSheet('movePool'),
          },
          {
            id: 'delete',
            icon: 'delete',
            label: t('selection.action_delete'),
            tone: 'danger',
            onAction: () => setBatchSheet('deleteExpenses'),
          },
        ]
      : [
          {
            id: 'delete',
            icon: 'delete',
            label: t('selection.action_delete'),
            tone: 'danger',
            onAction: () => setBatchSheet('deleteOutings'),
          },
        ];

  return (
    <div
      // FIELD R2 item 9 (F9): the in-page swipe region must FILL the screen, not
      // just hug a short list. Otherwise a swipe on the empty area below a short
      // list lands on the AppShell's global pager (which ignores the sub-tab) and
      // jumps to Início instead of handing off Saídas ⇠ Gastos. The min-height
      // mirrors the AppShell content area (divided by --native-zoom for the
      // native WebView; defaults to 1 on web — DEC note G7/N4), so the whole
      // visible area belongs to this region's tab swipe.
      className={`flex flex-col gap-4 min-h-[calc(100dvh/var(--native-zoom,1)-var(--safe-top)-var(--safe-bottom)-7rem)] ${selection.active ? 'pb-32' : 'pb-4'}`}
      data-inpage-swipe
      {...tabSwipe}
    >
      {/* DEC-084 (R-01): header + tabs + filter bar fixed — only the list scrolls */}
      <div className={`page-sticky-header ${scrolled ? 'is-scrolled' : ''} pt-2 pb-2 flex flex-col gap-4`}>
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-heading font-bold text-on-surface truncate min-w-0">{t('expenses.title')}</h1>
          <div className="flex items-center gap-2 shrink-0">
            {tab === 'expenses' && (
              <p data-expense-total className="text-sm font-semibold tabular text-on-surface">
                {formatMoney(totalCents, trip.baseCurrency)}
              </p>
            )}
            {/* DEC-206: first AI feature — an accented, labelled entry (indigo
                "smart" accent), not a hidden grey glyph. */}
            <button
              onClick={() => navigate('/receipt/scan')}
              className="h-9 pl-2.5 pr-3 rounded-full flex items-center gap-1.5 btn-press shrink-0"
              style={{ background: 'var(--ai-bg-soft)', border: '1px solid var(--ai-border)' }}
              aria-label={t('receiptScan.entry')}
              title={t('receiptScan.entry')}
            >
              <Icon name="document_scanner" size={16} className="text-[var(--ai-2)]" />
              <span className="text-xs font-bold text-[var(--ai-2)]">{t('receiptScan.entry_short')}</span>
            </button>
            {/* FIELD-13: statement import was buried inside Wallets — surface it at
                the top of the expenses screen (still kept in Wallets too). */}
            <button
              onClick={() => navigate('/import/wise')}
              className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center btn-press shrink-0"
              aria-label={t('expenses.import_statement')}
              title={t('expenses.import_statement')}
            >
              <Icon name="upload_file" size={18} className="text-on-surface-dim" />
            </button>
          </div>
        </div>

        {/* DEC-079: segmented control Expenses | Outings */}
        <div className="flex bg-surface-container rounded-xl p-1">
          <button
            onClick={() => changeTab('expenses')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold btn-press transition-colors ${
              tab === 'expenses' ? 'bg-primary text-on-surface' : 'text-on-surface-dim'
            }`}
          >
            {t('expenses.tab_expenses')}
          </button>
          <button
            onClick={() => changeTab('outings')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold btn-press transition-colors ${
              tab === 'outings' ? 'bg-primary text-on-surface' : 'text-on-surface-dim'
            }`}
          >
            {t('expenses.tab_outings')}
          </button>
        </div>

        {tab === 'expenses' && (
          <div className="relative">
            <Icon
              name="search"
              size={18}
              className="text-on-surface-faint absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('expenses.search_placeholder')}
              className="w-full bg-surface-container rounded-xl pl-10 pr-9 py-2.5 text-sm text-on-surface placeholder:text-on-surface-faint outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 btn-press"
                aria-label={t('expenses.search_clear')}
              >
                <Icon name="close" size={16} className="text-on-surface-faint" />
              </button>
            )}
          </div>
        )}

        {tab === 'expenses' && (categories.length > 0 || placeTotals.length > 0 || anyFilterActive) && (
          <div
            className="flex flex-col gap-2"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {/* Audit 4.4: clear-all + a single "Filtros (N)" toggle keep the header
                short; the full, labelled palette is one tap away. */}
            <div className="flex items-center gap-2">
              <FilterChip
                label={t('expenses.filter_all')}
                active={!anyFilterActive}
                onClick={clearFilters}
              />
              {(categories.length > 0 || placeTotals.length > 0) && (
                <button
                  onClick={() => setFiltersOpen((o) => !o)}
                  className={`ml-auto shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold btn-press transition-colors ${
                    filtersOpen || activeFilterCount > 0
                      ? 'bg-surface-high text-on-surface'
                      : 'bg-surface-high text-on-surface-dim'
                  }`}
                  aria-expanded={filtersOpen}
                >
                  <Icon name="filter_list" size={14} className="text-on-surface-dim" />
                  {t('expenses.filters_label')}
                  {activeFilterCount > 0 && (
                    <span className="min-w-4 h-4 px-1 rounded-full bg-primary text-on-surface text-[10px] font-bold flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                  <Icon name={filtersOpen ? 'expand_less' : 'expand_more'} size={14} className="text-on-surface-faint" />
                </button>
              )}
            </div>

            {/* Collapsed: a compact, removable summary of what's narrowing the list. */}
            {!filtersOpen && anyFilterActive && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {filterCategory && (
                  <FilterChip label={t(`categories.${filterCategory}` as never)} active onClick={() => setFilterCategory(null)} />
                )}
                {filterPlace && (
                  <FilterChip label={filterPlace} icon="location_on" active onClick={() => setFilterPlace(null)} />
                )}
                {filterProfile && (
                  <FilterChip label={filterProfile.name} active onClick={() => setFilterProfileId(null)} />
                )}
                {filterWalletNull && (
                  <FilterChip label={t('expenses.filter_no_wallet')} active onClick={() => setFilterWalletNull(false)} />
                )}
              </div>
            )}

            {/* Expanded: the same chips, now grouped and labelled by nature. */}
            {filtersOpen && (
              <div className="flex flex-col gap-2">
                {categories.length > 0 && (
                  <FilterGroup label={t('expenses.filters_group_categories')}>
                    {categories.map((cat) => (
                      <FilterChip
                        key={cat}
                        label={t(`categories.${cat}` as never)}
                        active={filterCategory === cat}
                        onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                      />
                    ))}
                  </FilterGroup>
                )}
                {/* E8 (M7): one chip per place, ranked by spend. */}
                {placeTotals.length > 0 && (
                  <FilterGroup label={t('expenses.filters_group_places')}>
                    {placeTotals.map((p) => (
                      <FilterChip
                        key={p.placeId ?? p.label}
                        label={p.label}
                        icon="location_on"
                        active={filterPlace === p.label}
                        onClick={() => setFilterPlace(filterPlace === p.label ? null : p.label)}
                      />
                    ))}
                  </FilterGroup>
                )}
                {(filterProfile || filterWalletNull) && (
                  <FilterGroup label={t('expenses.filters_group_other')}>
                    {filterProfile && (
                      <FilterChip label={filterProfile.name} active onClick={() => setFilterProfileId(null)} />
                    )}
                    {filterWalletNull && (
                      <FilterChip
                        label={t('expenses.filter_no_wallet')}
                        active
                        onClick={() => setFilterWalletNull(false)}
                      />
                    )}
                  </FilterGroup>
                )}
              </div>
            )}
          </div>
        )}

        {/* Audit 4.4 (P2): name what a "Saída" is — the tab was an unannounced model. */}
        {tab === 'outings' && (
          <p className="text-xs text-on-surface-faint px-1 -mt-1">{t('expenses.outings_explainer')}</p>
        )}
      </div>

      {/* DEC-197 (N3): keyed pane — remounts on tab change and slides in from the
          side matching the swipe/tap direction (bidirectional). */}
      <div key={tab} className={paneDirRef.current === 'next' ? 'pane-next' : 'pane-prev'}>
      {tab === 'outings' ? (
        <OutingHistoryList
          sessions={completedSessions}
          transactions={transactions}
          profiles={profiles}
          currency={trip.baseCurrency}
          onOpen={(id) => navigate(`/outings/${id}/review`)}
          selection={selection}
        />
      ) : (
        <>
      {unassigned > 0 && !filterWalletNull && (
        <button
          onClick={() => setFilterWalletNull(true)}
          className="bg-warning/10 border border-warning/30 rounded-xl px-4 py-2 text-left btn-press"
        >
          <p className="text-sm text-warning">
            {t('expenses.unassigned_wallet_warning', { count: unassigned })}
          </p>
          <p className="text-xs text-warning/70 mt-0.5">{t('expenses.review_now')}</p>
        </button>
      )}

      {/* M7: header for the active place filter — reinforces "gastos por lugar". */}
      {filterPlace && (
        <div className="bg-surface-container rounded-xl px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon name="location_on" size={16} className="text-primary shrink-0" />
            <span className="text-sm text-on-surface truncate">{filterPlace}</span>
          </div>
          <span className="text-xs text-on-surface-dim shrink-0">
            {t('expenses.place_count', { count: expenses.length })}
          </span>
        </div>
      )}

      {feedTransactions.length === 0 ? (
        searchQuery ? (
          <EmptyState
            icon="search_off"
            title={t('expenses.search_empty_title')}
            body={t('expenses.search_empty_body', { query: query.trim() })}
          />
        ) : (
          <EmptyState
            icon="receipt_long"
            title={t('expenses.empty_title')}
            body={t('expenses.empty_body')}
            cta={{ label: t('expenses.empty_cta'), icon: 'add', onClick: () => navigate('/quick-add') }}
          />
        )
      ) : (
        <div className="flex flex-col gap-4">
          {expenseGroups.map((group) => (
            <div
              key={group.day}
              className="flex flex-col gap-1"
              data-expense-day={group.day}
              data-expense-label={dayLabelOf(group.day)}
            >
              {/* L1: day header — relative label + the day's subtotal, so each
                  block answers "what did I spend that day?" at a glance. */}
              <div className="flex items-baseline justify-between px-1 pb-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-faint">
                  {dayLabelOf(group.day)}
                </span>
                <span className="text-[11px] font-semibold tabular text-on-surface-dim">
                  {formatMoney(group.subtotalCents, trip.baseCurrency)}
                </span>
              </div>
              {group.entries.map((entry) => {
                if (entry.kind === 'session') {
                  return (
                    <SessionRollupRow
                      key={entry.session.id}
                      session={entry.session}
                      txs={entry.txs}
                      totalCents={entry.totalCents}
                      currency={trip.baseCurrency}
                      profiles={profiles}
                      filterCategory={filterCategory}
                      onOpen={() => navigate(`/outings/${entry.session.id}/review`)}
                    />
                  );
                }
                const tx = entry.tx;
                if (tx.type === 'income') {
                  return (
                    <IncomeRow
                      key={tx.id}
                      tx={tx}
                      walletName={tx.walletId ? walletMap.get(tx.walletId) : undefined}
                      onOpen={() => navigate(`/expenses/${tx.id}`)}
                    />
                  );
                }
                return (
            <button
              key={tx.id}
              data-expense-row={tx.id}
              onClick={() => selection.handleTap(tx.id, () => navigate(`/expenses/${tx.id}`))}
              {...selection.getLongPressHandlers(tx.id)}
              className={`bg-surface-container rounded-xl px-4 py-3 flex items-center justify-between btn-press text-left w-full ${
                selection.isSelected(tx.id) ? 'ring-1 ring-primary' : ''
              }`}
            >
              {selection.active && (
                <Icon
                  name={selection.isSelected(tx.id) ? 'check_circle' : 'radio_button_unchecked'}
                  size={18}
                  filled={selection.isSelected(tx.id)}
                  className={`mr-3 shrink-0 ${
                    selection.isSelected(tx.id) ? 'text-primary' : 'text-on-surface-faint'
                  }`}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-on-surface truncate">{tx.description}</p>
                <div className="flex gap-2 text-xs text-on-surface-faint mt-0.5">
                  <span>{tx.category ? t(`categories.${tx.category}` as never) : ''}</span>
                  <span>·</span>
                  {/* M5: date + local wall-clock time of the expense. */}
                  <span className="shrink-0">{formatShortDate(localDayOf(tx.date))} {localClockTime(tx.date)}</span>
                  {tx.budgetPoolId && (
                    <>
                      <span>·</span>
                      <span className="truncate">{poolMap.get(tx.budgetPoolId) ?? ''}</span>
                    </>
                  )}
                </div>
                {/* M5: place line — only rendered when the expense has a location. */}
                {tx.placeLabel && (
                  <div className="flex items-center gap-1 text-xs text-on-surface-faint mt-0.5 min-w-0">
                    <Icon name="location_on" size={12} className="text-on-surface-faint shrink-0" />
                    <span className="truncate">{tx.placeLabel}</span>
                  </div>
                )}
                {tx.walletId === null && (
                  <p className="text-xs text-warning mt-0.5">{t('expenses.wallet_not_set')}</p>
                )}
              </div>
              <div className="text-right ml-3 flex items-center gap-2">
                <div>
                  <p className="text-sm font-semibold tabular text-on-surface">
                    {formatMoney(tx.amountCents, tx.currency)}
                  </p>
                  {tx.walletId && (
                    <p className="text-xs text-on-surface-faint">{walletMap.get(tx.walletId) ?? ''}</p>
                  )}
                </div>
                {!selection.active && (
                  <Icon name="chevron_right" size={16} className="text-on-surface-faint" />
                )}
              </div>
            </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
      {/* G3: day scrubber — only mounts itself when the feed is long enough. */}
      <FastScroller dayCount={expenseGroups.length} />
        </>
      )}
      </div>

      {/* DEC-118 (R-09): batch action bar */}
      {selection.active && (
        <SelectionBar
          count={selection.selectedIds.length}
          actions={selectionActions}
          onCancel={selection.clear}
        />
      )}

      {/* Single confirmation for batch deletions (soft delete) */}
      <BottomSheet
        open={batchSheet === 'deleteExpenses' || batchSheet === 'deleteOutings'}
        onClose={() => setBatchSheet(null)}
        title={t('selection.delete_title')}
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-on-surface-dim">
            {batchSheet === 'deleteOutings'
              ? t('selection.delete_outings_body', { count: selection.selectedIds.length })
              : t('selection.delete_expenses_body', { count: selection.selectedIds.length })}
          </p>
          <button
            onClick={batchSheet === 'deleteOutings' ? handleDeleteOutings : handleDeleteExpenses}
            className="w-full py-3 rounded-xl text-sm font-bold btn-press"
            style={{ background: '#D9404015', color: 'var(--error)' }}
          >
            {t('selection.delete_confirm', { count: selection.selectedIds.length })}
          </button>
          <button
            onClick={() => setBatchSheet(null)}
            className="w-full py-3 rounded-xl bg-surface-high text-on-surface-dim text-sm font-semibold btn-press"
          >
            {t('common.cancel')}
          </button>
        </div>
      </BottomSheet>

      {/* Move selected expenses to another fund */}
      <BottomSheet
        open={batchSheet === 'movePool'}
        onClose={() => setBatchSheet(null)}
        title={t('selection.move_pool_title')}
      >
        <div className="flex flex-col gap-2">
          {pools.map((pool) => (
            <button
              key={pool.id}
              onClick={() => handleMovePool(pool.id)}
              className="w-full px-4 py-3 rounded-xl bg-surface-high text-left btn-press flex items-center gap-3"
            >
              <Icon name="account_balance" size={18} className="text-on-surface-dim" />
              <span className="text-sm font-semibold text-on-surface">{pool.name}</span>
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Change category of selected expenses */}
      <BottomSheet
        open={batchSheet === 'changeCategory'}
        onClose={() => setBatchSheet(null)}
        title={t('selection.category_title')}
      >
        <div className="grid grid-cols-3 gap-2">
          {CATEGORY_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => handleChangeCategory(key)}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface-high btn-press"
            >
              <Icon name={getCategoryIcon(key)} size={20} className="text-on-surface-dim" />
              <span className="w-full text-center text-[10px] leading-tight text-on-surface-faint break-words hyphens-auto line-clamp-2">
                {t(`categories.${key}` as never)}
              </span>
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}

/* ──────────────── OUTING HISTORY (DEC-079 / FIELD-09) ──────────────── */

interface OutingHistoryListProps {
  sessions: Session[];
  transactions: Transaction[];
  profiles: ActivityProfile[];
  currency: string;
  onOpen: (sessionId: string) => void;
  selection: MultiSelect;
}

function OutingHistoryList({ sessions, transactions, profiles, currency, onOpen, selection }: OutingHistoryListProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon="celebration"
        title={t('expenses.outings_empty_title')}
        body={t('expenses.outings_empty_body')}
        cta={{ label: t('expenses.outings_empty_cta'), icon: 'add', onClick: () => navigate('/outings/new') }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {sessions.map((session) => {
        const sessionTxs = transactions.filter(
          (tx) => tx.sessionId === session.id && tx.deletedAt === null,
        );
        const totalCents = calculateSessionTotal(sessionTxs);
        const profile = profiles.find((p) => p.id === session.activityProfileId) ?? null;
        const icon = profile?.iconName ?? getCategoryIcon(profile?.category ?? null);
        const badge = profile?.name ?? t('expenses.outing_one_off');

        return (
          <button
            key={session.id}
            onClick={() => selection.handleTap(session.id, () => onOpen(session.id))}
            {...selection.getLongPressHandlers(session.id)}
            className={`bg-surface-container rounded-xl px-4 py-3 flex items-center justify-between btn-press text-left w-full ${
              selection.isSelected(session.id) ? 'ring-1 ring-primary' : ''
            }`}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {selection.active ? (
                <Icon
                  name={selection.isSelected(session.id) ? 'check_circle' : 'radio_button_unchecked'}
                  size={18}
                  filled={selection.isSelected(session.id)}
                  className={`shrink-0 ${
                    selection.isSelected(session.id) ? 'text-primary' : 'text-on-surface-faint'
                  }`}
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-surface-high flex items-center justify-center shrink-0">
                  <Icon name={icon} size={18} className="text-on-surface-dim" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-on-surface truncate">{session.name}</p>
                <div className="flex gap-2 text-xs text-on-surface-faint mt-0.5">
                  <span>{formatShortDate(localDayOf(session.endedAt ?? session.startedAt))}</span>
                  <span>·</span>
                  <span>{formatSessionDuration(session.startedAt, session.endedAt)}</span>
                  <span>·</span>
                  <span>{t('expenses.outing_items', { count: sessionTxs.length })}</span>
                </div>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-high text-on-surface-dim">
                  {badge}
                </span>
              </div>
            </div>
            <div className="text-right ml-3 flex items-center gap-2 shrink-0">
              <p className="text-sm font-semibold tabular text-on-surface">
                {formatMoney(totalCents, currency)}
              </p>
              {!selection.active && (
                <Icon name="chevron_right" size={16} className="text-on-surface-faint" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* DEC-206 (rollup): a receipt/outing collapsed into one feed row. Mirrors the
   Outings-tab row so the two screens read consistently; taps open the same
   review page. A receipt carries a small AI mark (our first AI-made record). */
function SessionRollupRow({
  session,
  txs,
  totalCents,
  currency,
  profiles,
  filterCategory,
  onOpen,
}: {
  session: Session;
  txs: Transaction[];
  totalCents: number;
  currency: string;
  profiles: ActivityProfile[];
  // C01 / DEC-296: when a category filter is active the row is a PARTIAL view of
  // the outing (only the matching items); the count reads "N itens nesta
  // categoria" and `totalCents` is the filtered subtotal. Tap opens the full one.
  filterCategory?: string | null;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const isReceipt = txs.some((tx) => tx.externalRef?.startsWith('receipt:'));
  const profile = profiles.find((p) => p.id === session.activityProfileId) ?? null;
  const icon = isReceipt ? 'receipt_long' : (profile?.iconName ?? getCategoryIcon(profile?.category ?? null));
  const badge = isReceipt ? t('expenses.receipt_badge') : (profile?.name ?? t('expenses.outing_one_off'));
  const when = session.endedAt ?? session.startedAt ?? txs[0]?.date ?? '';

  return (
    <button
      onClick={onOpen}
      className="bg-surface-container rounded-xl px-4 py-3 flex items-center justify-between btn-press text-left w-full"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-surface-high flex items-center justify-center shrink-0 relative">
          <Icon name={icon} size={18} className="text-on-surface-dim" />
          {isReceipt && (
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
              <Icon name="auto_awesome" size={9} className="text-on-surface" />
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-on-surface truncate">{session.name}</p>
          <div className="flex gap-2 text-xs text-on-surface-faint mt-0.5">
            <span>
              {filterCategory
                ? t('expenses.outing_items_in_category', { count: txs.length })
                : t('expenses.outing_items', { count: txs.length })}
            </span>
            {when && (
              <>
                <span>·</span>
                <span className="shrink-0">{formatShortDate(localDayOf(when))}</span>
              </>
            )}
          </div>
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-high text-on-surface-dim">
            {badge}
          </span>
        </div>
      </div>
      <div className="text-right ml-3 flex items-center gap-2 shrink-0">
        <p className="text-sm font-semibold tabular text-on-surface">{formatMoney(totalCents, currency)}</p>
        <Icon name="chevron_right" size={16} className="text-on-surface-faint" />
      </div>
    </button>
  );
}

/* D-BUG-04 (D-DEC-D): income shows in the expenses feed as a distinct, green
   "+€X" line (savings icon) — it is money received, never a spend, so it has its
   own row treatment and is not part of multi-select batch actions. Tapping opens
   the same ExpenseDetailPage, which already views/edits/deletes income. */
function IncomeRow({
  tx,
  walletName,
  onOpen,
}: {
  tx: Transaction;
  walletName: string | undefined;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onOpen}
      data-income-row={tx.id}
      className="bg-surface-container rounded-xl px-4 py-3 flex items-center justify-between btn-press text-left w-full"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(107,143,113,.12)' }}
        >
          <Icon name="savings" size={18} style={{ color: 'var(--success)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-on-surface truncate">
            {tx.description || t('income.default_description')}
          </p>
          <div className="flex gap-2 text-xs text-on-surface-faint mt-0.5">
            <span style={{ color: 'var(--success)' }}>{t('income.default_description')}</span>
            <span>·</span>
            <span className="shrink-0">
              {formatShortDate(localDayOf(tx.date))} {localClockTime(tx.date)}
            </span>
          </div>
        </div>
      </div>
      <div className="text-right ml-3 flex items-center gap-2 shrink-0">
        <div>
          <p className="text-sm font-bold tabular" style={{ color: 'var(--success)' }}>
            +{formatMoney(tx.amountCents, tx.currency)}
          </p>
          {walletName && <p className="text-xs text-on-surface-faint">{walletName}</p>}
        </div>
        <Icon name="chevron_right" size={16} className="text-on-surface-faint" />
      </div>
    </button>
  );
}

/* Audit 4.4: a labelled, horizontally-scrollable row of chips of one nature
   (Categorias / Lugares / Outros), so the palette stops reading as a flat mix. */
function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-faint px-1">
        {label}
      </span>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">{children}</div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium btn-press transition-colors ${
        active
          ? 'bg-primary text-on-surface'
          : 'bg-surface-high text-on-surface-dim'
      }`}
    >
      {icon && <Icon name={icon} size={12} className={active ? 'text-on-surface' : 'text-on-surface-faint'} />}
      {label}
    </button>
  );
}
