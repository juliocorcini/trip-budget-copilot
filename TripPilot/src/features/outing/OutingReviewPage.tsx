import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { sessionRepository } from '@/data/repositories/session-repository';
import { activityProfileRepository } from '@/data/repositories/activity-profile-repository';
import { transactionRepository, splitRepository } from '@/data/repositories';
import { useAppData } from '@/hooks/useAppData';
import {
  calculateSessionTotal,
  formatSessionDuration,
  findSubcategory,
  resolveOutingPayerId,
} from '@/domain/outing';
import { formatMoney } from '@/domain/money';
import { formatShortDate, localDayOf, moveToLocalDay } from '@/domain/dates';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';
import { AttachmentSection } from '@/features/attachments/AttachmentSection';
import { SplitHistorySheet } from '@/features/split/SplitHistorySheet';
import { getCategoryIcon } from '@/utils/category-icons';
import type { SplitSession } from '@/domain/split';
import type { Session } from '@/domain/types/session';
import type { Transaction } from '@/domain/types/transaction';
import type { ActivityProfile } from '@/domain/types/activity-profile';

function formatTime(isoDate: string): string {
  const d = new Date(isoDate);
  return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Outing detail (DEC-079 / FIELD-09 → C02/DEC-302): reuses the end-of-session
 * review layout (GAP-002) and is now ACTIONABLE — the name/date are editable,
 * every item opens its own expense detail (edit without hunting item-by-item),
 * and a committed division is one tap away (who paid + who got what). Nothing
 * is removed (Â9); a one-off outing with no split just hides the split row.
 */
export function OutingReviewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { trip, wallets, participants, loading, reload } = useAppData();

  const [session, setSession] = useState<Session | null>(null);
  const [sessionTxs, setSessionTxs] = useState<Transaction[]>([]);
  const [profile, setProfile] = useState<ActivityProfile | null>(null);
  const [splitSession, setSplitSession] = useState<SplitSession | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // C02 — inline edit of the outing's name and day (no new entity; reuses the
  // same date helpers as the expense detail). The amounts never change here, so
  // Σ(items) == outing total stays intact (Â11).
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const stored = await sessionRepository.getById(id);
      if (!stored || stored.deletedAt !== null) {
        setNotFound(true);
        return;
      }
      const [txs, prof, splitRecord] = await Promise.all([
        transactionRepository.getBySessionId(stored.id),
        stored.activityProfileId
          ? activityProfileRepository.getById(stored.activityProfileId)
          : Promise.resolve(undefined),
        splitRepository.getBySessionId(stored.id),
      ]);
      setSession(stored);
      setSessionTxs(txs.filter((tx) => tx.deletedAt === null));
      setProfile(prof ?? null);
      setSplitSession(splitRecord?.splitMeta ?? null);
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

  // C02 — surface the payer when the whole outing was paid by one person
  // (committed splits and "quem pagou" enrichment set it on every tx).
  const payerId = resolveOutingPayerId(sessionTxs);
  const payer = payerId ? participants.find((p) => p.id === payerId) : undefined;
  const payerName = payer ? (payer.isOwner ? t('shared.owner_tag') : (payer.nickname ?? payer.name)) : null;
  const ownerName = participants.find((p) => p.isOwner)?.name;

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

  const startEdit = () => {
    setEditName(session.name);
    setEditDate(localDayOf(session.endedAt ?? session.startedAt));
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Move the whole outing to the chosen day, keeping each timestamp's local
      // wall-clock (the session bounds AND its items) so the list, summaries and
      // detail all read the same date. Amounts are untouched (Â11).
      const movedTxs = sessionTxs.map((tx) => ({ ...tx, date: moveToLocalDay(tx.date, editDate) }));
      await Promise.all(movedTxs.map((tx) => transactionRepository.update(tx)));
      const updated = await sessionRepository.update({
        ...session,
        name: editName.trim() || session.name,
        startedAt: moveToLocalDay(session.startedAt, editDate),
        endedAt: session.endedAt ? moveToLocalDay(session.endedAt, editDate) : session.endedAt,
      });
      setSession(updated);
      setSessionTxs(movedTxs);
      setEditing(false);
      showToast(t('outing.edited_toast'), 'success');
      await reload();
    } finally {
      setSaving(false);
    }
  };

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
        <h1 className="text-heading font-bold text-on-surface flex-1">{t('outing.history_title')}</h1>
        {!editing && (
          <button onClick={startEdit} aria-label={t('common.edit')} className="btn-press p-1">
            <Icon name="edit" size={20} className="text-on-surface-dim" />
          </button>
        )}
      </div>

      {/* C02 — inline name + date edit. */}
      {editing && (
        <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-3">
          <div>
            <label className="text-xs text-on-surface-faint mb-1 block">{t('outing.edit_name_label')}</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-on-surface-faint mb-1 block">{t('expenses.date')}</label>
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setEditing(false)}
              className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-primary text-on-surface font-medium text-sm btn-press disabled:opacity-40"
            >
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      )}

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
        <div className="flex justify-center flex-wrap gap-1.5 mt-2">
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-surface-high text-on-surface-dim">
            {badge}
          </span>
          {/* C02 — who paid, when the outing has a single payer. */}
          {payerName && (
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-success/15 text-success">
              {t('expenses.paid_by', { name: payerName })}
            </span>
          )}
        </div>
      </div>

      {/* C02 — committed division: who got what is one tap away (reused sheet). */}
      {splitSession && (
        <button
          onClick={() => setSplitOpen(true)}
          className="w-full bg-surface-container rounded-xl px-4 py-3 flex items-center gap-3 btn-press text-left"
        >
          <div className="w-9 h-9 rounded-full bg-surface-high flex items-center justify-center shrink-0">
            <Icon name="splitscreen" size={18} className="text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-on-surface-faint">{t('splitHistory.title')}</p>
            <p className="text-sm font-semibold text-on-surface truncate">
              {t('splitHistory.see_committed')}
            </p>
          </div>
          <Icon name="chevron_right" size={18} className="text-on-surface-faint shrink-0" />
        </button>
      )}

      {/* Items — each opens its own expense detail (C02: edit without hunting). */}
      <div className="bg-surface-container rounded-xl p-4">
        <p className="text-xs text-on-surface-faint mb-1">
          {t('outing.review_items')} ({sessionTxs.length})
        </p>
        {sessionTxs.length > 0 && (
          <p className="text-[10px] text-on-surface-faint mb-3">{t('outing.item_tap_hint')}</p>
        )}
        {/* DEC-097 (R-18): each item shows WHAT was bought (icon + subcategory;
            context + subcategory for events) — never the session name. */}
        <div className="flex flex-col gap-1">
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
            <button
              key={tx.id}
              onClick={() => navigate(`/expenses/${tx.id}`)}
              className="flex items-center gap-2.5 py-1.5 btn-press text-left -mx-1 px-1 rounded-lg"
            >
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
              <Icon name="chevron_right" size={16} className="text-on-surface-faint shrink-0" />
            </button>
            );
          })}
          {sessionTxs.length === 0 && (
            <p className="text-xs text-on-surface-faint">{t('outing.review_no_items')}</p>
          )}
        </div>
      </div>

      {/* D-BUG-05: receipts/photos attached to the outing are read/added here too
          (they live on the session, so a finished outing must surface them). */}
      <div className="bg-surface-container rounded-xl p-4">
        <AttachmentSection sessionId={session.id} />
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

      {/* C02 — the full who-got-what division behind this outing. */}
      <SplitHistorySheet
        open={splitOpen}
        onClose={() => setSplitOpen(false)}
        session={splitSession}
        ownerName={ownerName}
      />
    </div>
  );
}
