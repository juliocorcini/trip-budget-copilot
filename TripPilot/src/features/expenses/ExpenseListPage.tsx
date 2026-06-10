import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { activityProfileRepository } from '@/data/repositories/activity-profile-repository';
import { sessionRepository } from '@/data/repositories/session-repository';
import { formatMoney, sumCents } from '@/domain/money';
import { formatShortDate } from '@/domain/dates';
import { getUnassignedTransactionCount } from '@/domain/wallets';
import { calculateSessionTotal, formatSessionDuration } from '@/domain/outing';
import { Icon } from '@/components/Icon';
import { getCategoryIcon } from '@/utils/category-icons';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { Session } from '@/domain/types/session';
import type { Transaction } from '@/domain/types/transaction';

type FilterCategory = string | null;
type ListTab = 'expenses' | 'outings';

export function ExpenseListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trip, transactions, pools, wallets, loading } = useAppData();
  // FIELD-14: the list can arrive pre-filtered by URL (?profile=<id> / ?category=<cat>).
  const [filterCategory, setFilterCategory] = useState<FilterCategory>(searchParams.get('category'));
  const [filterProfileId, setFilterProfileId] = useState<string | null>(searchParams.get('profile'));
  const [filterWalletNull, setFilterWalletNull] = useState(false);
  const [profiles, setProfiles] = useState<ActivityProfile[]>([]);
  // DEC-079 (FIELD-09): outings ARE grouped expenses — they live in this screen.
  const [tab, setTab] = useState<ListTab>(searchParams.get('tab') === 'outings' ? 'outings' : 'expenses');
  const [completedSessions, setCompletedSessions] = useState<Session[]>([]);

  useEffect(() => {
    if (!trip) return;
    activityProfileRepository.getByTripId(trip.id).then(setProfiles);
    sessionRepository.getCompleted(trip.id).then(setCompletedSessions);
  }, [trip]);

  if (loading || !trip) return <p className="p-4 text-on-surface-dim">{t('common.loading')}</p>;

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

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between pt-2">
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

      {tab === 'outings' ? (
        <OutingHistoryList
          sessions={completedSessions}
          transactions={transactions}
          profiles={profiles}
          currency={trip.baseCurrency}
          onOpen={(id) => navigate(`/outings/${id}/review`)}
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
              onClick={() => navigate(`/expenses/${tx.id}`)}
              className="bg-surface-container rounded-xl px-4 py-3 flex items-center justify-between btn-press text-left w-full"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-on-surface truncate">{tx.description}</p>
                <div className="flex gap-2 text-xs text-on-surface-faint mt-0.5">
                  <span>{tx.category ? t(`categories.${tx.category}` as never) : ''}</span>
                  <span>·</span>
                  <span>{formatShortDate(tx.date.slice(0, 10))}</span>
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
                <Icon name="chevron_right" size={16} className="text-on-surface-faint" />
              </div>
            </button>
          ))}
        </div>
      )}
        </>
      )}
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
}

function OutingHistoryList({ sessions, transactions, profiles, currency, onOpen }: OutingHistoryListProps) {
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
            onClick={() => onOpen(session.id)}
            className="bg-surface-container rounded-xl px-4 py-3 flex items-center justify-between btn-press text-left w-full"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-surface-high flex items-center justify-center shrink-0">
                <Icon name={icon} size={18} className="text-on-surface-dim" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-on-surface truncate">{session.name}</p>
                <div className="flex gap-2 text-xs text-on-surface-faint mt-0.5">
                  <span>{formatShortDate((session.endedAt ?? session.startedAt).slice(0, 10))}</span>
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
              <Icon name="chevron_right" size={16} className="text-on-surface-faint" />
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
