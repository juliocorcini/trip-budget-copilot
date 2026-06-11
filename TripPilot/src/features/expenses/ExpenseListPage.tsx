import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { useScrolled } from '@/hooks/useScrolled';
import { useMultiSelect, type MultiSelect } from '@/hooks/useMultiSelect';
import { activityProfileRepository } from '@/data/repositories/activity-profile-repository';
import { sessionRepository } from '@/data/repositories/session-repository';
import { formatMoney, sumCents } from '@/domain/money';
import { formatShortDate, localDayOf } from '@/domain/dates';
import { getUnassignedTransactionCount } from '@/domain/wallets';
import { calculateSessionTotal, formatSessionDuration } from '@/domain/outing';
import {
  softDeleteTransactionsBatch,
  moveTransactionsToPoolBatch,
  changeTransactionsCategoryBatch,
  softDeleteOutingSessionsBatch,
} from '@/domain/orchestrators';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { SelectionBar, type SelectionAction } from '@/components/SelectionBar';
import { showToast } from '@/components/Toast';
import { getCategoryIcon } from '@/utils/category-icons';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { Session } from '@/domain/types/session';
import type { Transaction } from '@/domain/types/transaction';

type FilterCategory = string | null;
type ListTab = 'expenses' | 'outings';
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
  // FIELD-14: the list can arrive pre-filtered by URL (?profile=<id> / ?category=<cat>).
  const [filterCategory, setFilterCategory] = useState<FilterCategory>(searchParams.get('category'));
  const [filterProfileId, setFilterProfileId] = useState<string | null>(searchParams.get('profile'));
  const [filterWalletNull, setFilterWalletNull] = useState(false);
  const [profiles, setProfiles] = useState<ActivityProfile[]>([]);
  // DEC-079 (FIELD-09): outings ARE grouped expenses — they live in this screen.
  const [tab, setTabState] = useState<ListTab>(searchParams.get('tab') === 'outings' ? 'outings' : 'expenses');
  const [completedSessions, setCompletedSessions] = useState<Session[]>([]);
  const [batchSheet, setBatchSheet] = useState<BatchSheet>(null);
  const scrolled = useScrolled();
  // DEC-118 (R-09): hold to select, tap to add, batch action bar.
  const selection = useMultiSelect();

  useEffect(() => {
    if (!trip) return;
    activityProfileRepository.getByTripId(trip.id).then(setProfiles);
    sessionRepository.getCompleted(trip.id).then(setCompletedSessions);
  }, [trip, transactions]);

  if (loading || !trip) return <p className="p-4 text-on-surface-dim">{t('common.loading')}</p>;

  const setTab = (next: ListTab) => {
    selection.clear();
    setTabState(next);
  };

  const filterProfile = filterProfileId
    ? profiles.find((p) => p.id === filterProfileId) ?? null
    : null;

  const expenses = transactions
    .filter((tx) => tx.type === 'expense' && tx.deletedAt === null)
    .filter((tx) => !filterCategory || tx.category === filterCategory)
    .filter((tx) => !filterProfileId || tx.activityProfileId === filterProfileId)
    .filter((tx) => !filterWalletNull || tx.walletId === null)
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalCents = sumCents(expenses.map((tx) => tx.amountCents));
  const unassigned = getUnassignedTransactionCount(transactions);

  const poolMap = new Map(pools.map((p) => [p.id, p.name]));
  const walletMap = new Map(wallets.map((w) => [w.id, w.name]));

  const categories = [...new Set(transactions.filter((tx) => tx.category).map((tx) => tx.category!))];

  const finishBatch = async (messageKey: string) => {
    setBatchSheet(null);
    selection.clear();
    await reload();
    showToast(t(messageKey as never), 'success');
  };

  const handleDeleteExpenses = async () => {
    await softDeleteTransactionsBatch(selection.selectedIds);
    await finishBatch('selection.deleted_toast');
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
    await softDeleteOutingSessionsBatch(selection.selectedIds);
    await finishBatch('selection.deleted_toast');
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
    <div className={`flex flex-col gap-4 ${selection.active ? 'pb-24' : 'pb-4'}`}>
      {/* DEC-084 (R-01): header + tabs + filter bar fixed — only the list scrolls */}
      <div className={`page-sticky-header ${scrolled ? 'is-scrolled' : ''} pt-2 pb-2 flex flex-col gap-4`}>
        <div className="flex items-center justify-between">
          <h1 className="text-heading font-bold text-on-surface">{t('expenses.title')}</h1>
          {tab === 'expenses' && (
            <p className="text-sm font-semibold tabular text-on-surface">
              {formatMoney(totalCents, trip.baseCurrency)}
            </p>
          )}
        </div>

        {/* DEC-079: segmented control Expenses | Outings */}
        <div className="flex bg-surface-container rounded-xl p-1">
          <button
            onClick={() => setTab('expenses')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold btn-press transition-colors ${
              tab === 'expenses' ? 'bg-primary text-on-surface' : 'text-on-surface-dim'
            }`}
          >
            {t('expenses.tab_expenses')}
          </button>
          <button
            onClick={() => setTab('outings')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold btn-press transition-colors ${
              tab === 'outings' ? 'bg-primary text-on-surface' : 'text-on-surface-dim'
            }`}
          >
            {t('expenses.tab_outings')}
          </button>
        </div>

        {tab === 'expenses' && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <FilterChip
              label={t('expenses.title')}
              active={!filterCategory && !filterProfileId && !filterWalletNull}
              onClick={() => { setFilterCategory(null); setFilterProfileId(null); setFilterWalletNull(false); }}
            />
            {filterProfile && (
              <FilterChip
                label={filterProfile.name}
                active
                onClick={() => setFilterProfileId(null)}
              />
            )}
            {filterWalletNull && (
              <FilterChip
                label={t('expenses.filter_no_wallet')}
                active
                onClick={() => setFilterWalletNull(false)}
              />
            )}
            {categories.map((cat) => (
              <FilterChip
                key={cat}
                label={t(`categories.${cat}` as never)}
                active={filterCategory === cat}
                onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
              />
            ))}
          </div>
        )}
      </div>

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

      {expenses.length === 0 ? (
        <div className="bg-surface-container rounded-xl p-6 text-center">
          <Icon name="receipt_long" size={32} className="text-on-surface-mute mx-auto mb-2" />
          <p className="text-sm text-on-surface-dim">{t('dashboard.no_expenses')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {expenses.map((tx) => (
            <button
              key={tx.id}
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
                  <span>{formatShortDate(localDayOf(tx.date))}</span>
                  {tx.budgetPoolId && (
                    <>
                      <span>·</span>
                      <span>{poolMap.get(tx.budgetPoolId) ?? ''}</span>
                    </>
                  )}
                </div>
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
          ))}
        </div>
      )}
        </>
      )}

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

  if (sessions.length === 0) {
    return (
      <div className="bg-surface-container rounded-xl p-6 text-center">
        <Icon name="celebration" size={32} className="text-on-surface-mute mx-auto mb-2" />
        <p className="text-sm text-on-surface-dim">{t('expenses.no_outings')}</p>
      </div>
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

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium btn-press transition-colors ${
        active
          ? 'bg-primary text-on-surface'
          : 'bg-surface-high text-on-surface-dim'
      }`}
    >
      {label}
    </button>
  );
}
