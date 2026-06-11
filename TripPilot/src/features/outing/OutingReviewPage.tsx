import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { sessionRepository } from '@/data/repositories/session-repository';
import { activityProfileRepository } from '@/data/repositories/activity-profile-repository';
import { transactionRepository } from '@/data/repositories';
import { useAppData } from '@/hooks/useAppData';
import { calculateSessionTotal, formatSessionDuration, findSubcategory } from '@/domain/outing';
import { formatMoney } from '@/domain/money';
import { formatShortDate, localDayOf } from '@/domain/dates';
import { Icon } from '@/components/Icon';
import { getCategoryIcon } from '@/utils/category-icons';
import type { Session } from '@/domain/types/session';
import type { Transaction } from '@/domain/types/transaction';
import type { ActivityProfile } from '@/domain/types/activity-profile';

function formatTime(isoDate: string): string {
  const d = new Date(isoDate);
  return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Read-only outing detail (DEC-079 / FIELD-09): reuses the end-of-session
 * review layout (GAP-002) without any editing affordances.
 */
export function OutingReviewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { trip, wallets, loading } = useAppData();

  const [session, setSession] = useState<Session | null>(null);
  const [sessionTxs, setSessionTxs] = useState<Transaction[]>([]);
  const [profile, setProfile] = useState<ActivityProfile | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const stored = await sessionRepository.getById(id);
      if (!stored || stored.deletedAt !== null) {
        setNotFound(true);
        return;
      }
      const [txs, prof] = await Promise.all([
        transactionRepository.getBySessionId(stored.id),
        stored.activityProfileId
          ? activityProfileRepository.getById(stored.activityProfileId)
          : Promise.resolve(undefined),
      ]);
      setSession(stored);
      setSessionTxs(txs.filter((tx) => tx.deletedAt === null));
      setProfile(prof ?? null);
    };
    load();
  }, [id]);

  if (loading || !trip) return <p className="p-4 text-on-surface-dim">{t('common.loading')}</p>;
  if (notFound) return <p className="p-4 text-on-surface-dim">{t('expenses.not_found')}</p>;
  if (!session) return <p className="p-4 text-on-surface-dim">{t('common.loading')}</p>;

  const currency = trip.baseCurrency;
  const totalCents = calculateSessionTotal(sessionTxs);
  const badge = profile?.name ?? t('expenses.outing_one_off');
  const icon = profile?.iconName ?? getCategoryIcon(profile?.category ?? null);

  const usedWalletNames = [
    ...new Set(
      sessionTxs
        .map((tx) => tx.walletId)
        .filter((wid): wid is string => wid !== null)
        .map((wid) => wallets.find((w) => w.id === wid)?.name)
        .filter((name): name is string => name !== undefined),
    ),
  ];

  const limits = [
    { labelKey: 'outing.limit_target', cents: session.targetCents },
    { labelKey: 'outing.limit_ceiling', cents: session.ceilingCents },
    { labelKey: 'outing.limit_max', cents: session.maxCents },
  ].filter((l) => l.cents !== null && l.cents > 0);

  return (
    <div className="flex flex-col gap-4 pb-6 pt-2">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          aria-label={t('common.back')}
          className="btn-press p-1"
        >
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('outing.history_title')}</h1>
      </div>

      {/* Total summary (same hierarchy as the review screen) */}
      <div className="bg-surface-container rounded-2xl p-5 text-center">
        <div className="w-10 h-10 rounded-xl bg-surface-high flex items-center justify-center mx-auto mb-2">
          <Icon name={icon} size={20} className="text-on-surface-dim" />
        </div>
        <p className="text-xs text-on-surface-faint">{t('outing.review_total')}</p>
        <p className="text-display font-extrabold tabular text-on-surface mt-1">
          {formatMoney(totalCents, currency)}
        </p>
        <p className="text-xs text-on-surface-faint mt-1">{session.name}</p>
        <div className="flex justify-center gap-2 text-xs text-on-surface-faint mt-2">
          <span>{formatShortDate(localDayOf(session.endedAt ?? session.startedAt))}</span>
          <span>·</span>
          <span>{formatSessionDuration(session.startedAt, session.endedAt)}</span>
          <span>·</span>
          <span>{t('expenses.outing_items', { count: sessionTxs.length })}</span>
        </div>
        <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-surface-high text-on-surface-dim">
          {badge}
        </span>
      </div>

      {/* Items (read-only) */}
      <div className="bg-surface-container rounded-xl p-4">
        <p className="text-xs text-on-surface-faint mb-3">
          {t('outing.review_items')} ({sessionTxs.length})
        </p>
        {/* DEC-097 (R-18): each item shows WHAT was bought (icon + subcategory;
            context + subcategory for events) — never the session name. */}
        <div className="flex flex-col gap-2.5">
          {sessionTxs.map((tx) => {
            const subcategory = findSubcategory(tx.subcategoryId);
            const hasOwnLabel = tx.description !== '' && tx.description !== session.name;
            const label = subcategory
              ? t(subcategory.labelKey as never)
              : hasOwnLabel
                ? tx.description
                : t(`categories.${tx.category ?? 'other'}` as never);
            // Events (no profile) keep the context as the secondary line.
            const contextLabel =
              subcategory && profile === null && tx.category
                ? t(`categories.${tx.category}` as never)
                : null;
            return (
            <div key={tx.id} className="flex items-center gap-2.5">
              <Icon
                name={subcategory?.icon ?? getCategoryIcon(tx.category)}
                size={16}
                className="text-on-surface-faint shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-on-surface-dim truncate">
                  {label}
                  {tx.isShared && (
                    <Icon name="group" size={12} className="text-on-surface-faint ml-1 align-middle" />
                  )}
                </p>
                {contextLabel && (
                  <p className="text-[10px] text-on-surface-faint">{contextLabel}</p>
                )}
              </div>
              <span className="text-[10px] text-on-surface-faint tabular">{formatTime(tx.date)}</span>
              <span className="text-xs font-bold tabular text-on-surface">
                {formatMoney(tx.personalCostCents ?? tx.amountCents, tx.currency)}
              </span>
            </div>
            );
          })}
          {sessionTxs.length === 0 && (
            <p className="text-xs text-on-surface-faint">{t('outing.review_no_items')}</p>
          )}
        </div>
      </div>

      {/* Limits vs final total */}
      {limits.length > 0 && (
        <div className="bg-surface-container rounded-xl p-4">
          <p className="text-xs text-on-surface-faint mb-3">{t('outing.history_limits')}</p>
          <div className="flex justify-between">
            {limits.map((limit) => (
              <div key={limit.labelKey}>
                <p className="text-[10px] text-on-surface-faint">{t(limit.labelKey as never)}</p>
                <p className="text-xs font-bold tabular text-on-surface">
                  {formatMoney(limit.cents!, currency)}
                </p>
              </div>
            ))}
            <div className="text-right">
              <p className="text-[10px] text-on-surface-faint">{t('outing.history_final')}</p>
              <p className="text-xs font-extrabold tabular text-primary">
                {formatMoney(totalCents, currency)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Wallets used */}
      {usedWalletNames.length > 0 && (
        <div className="bg-surface-container rounded-xl p-4">
          <p className="text-xs text-on-surface-faint mb-2">{t('outing.history_wallets')}</p>
          <div className="flex gap-2 flex-wrap">
            {usedWalletNames.map((name) => (
              <span
                key={name}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-high text-on-surface-dim"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
