import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { groupSplitRepository } from '@/data/repositories';
import { persistGroupSplit, deleteGroupSplit } from '@/domain/orchestrators';
import {
  addExpense,
  addParticipant,
  canRemoveParticipant,
  computeGroupBalances,
  computeGroupTransfers,
  createGroupParticipant,
  groupExpensesByDay,
  groupTotalCents,
  reduceGroupClaims,
  removeExpense,
  removeParticipant,
  setGroupStatus,
  setParticipantPayment,
  updateExpense,
} from '@/domain/group-split';
import { formatMoney } from '@/domain/money';
import { getActiveIntlLocale } from '@/domain/locale';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';
import { QrCodeDisplay } from '@/components/QrCodeDisplay';
import { shareOrCopyLink } from '@/utils/native/link-share';
import { GroupExpenseEditor } from './GroupExpenseEditor';
import {
  publishGroupSplit,
  republishGroupSplit,
  revokeGroupSplit,
  pullGroupClaims,
  buildGroupSplitLink,
  saveGroupLive,
  loadGroupLive,
  clearGroupLive,
  type GroupLiveCreds,
} from './group-link';
import type { GroupExpense, GroupSplitEvent, GroupPaymentStatus } from '@/domain/group-split';

const POLL_FLOOR_MS = 6000;

/** DEC-336 — a short, locale-aware header for a `YYYY-MM-DD` expense day. */
function formatDayLabel(dayKey: string): string {
  const d = new Date(`${dayKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dayKey;
  return d.toLocaleDateString(getActiveIntlLocale(), { weekday: 'short', day: '2-digit', month: 'short' });
}

/**
 * C23 / DEC-297 — one Tricount event: people, expenses (manual now; AI/receipt in
 * m3), the live total, per-person balances and the minimum transfers to settle.
 * Mutations go through the pure `group-split` domain; {@link persistGroupSplit}
 * writes each new state.
 */
export function GroupSplitDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { settings, trip, participants } = useAppData();
  const photoEnabled = settings?.cloudReceiptOcrEnabled ?? false;
  const aiTextEnabled = settings?.aiQuickEntryEnabled ?? false;

  const [event, setEvent] = useState<GroupSplitEvent | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [newPerson, setNewPerson] = useState('');
  const [editing, setEditing] = useState<GroupExpense | 'new' | null>(null);
  const [creds, setCreds] = useState<GroupLiveCreds | null>(null);
  const [publishing, setPublishing] = useState(false);
  // A04/DEC-335: balances ("Pagamentos") and transfers ("Quem paga quem") live
  // behind buttons — expenses are the primary surface, not the math.
  const [showBalances, setShowBalances] = useState(false);
  const [showTransfers, setShowTransfers] = useState(false);
  // A02/DEC-338: keep focus on the add-person field after each add.
  const newPersonRef = useRef<HTMLInputElement>(null);

  // Refs keep the poller and the save seam reading the latest state without
  // re-subscribing the interval on every keystroke/edit.
  const eventRef = useRef<GroupSplitEvent | null>(null);
  eventRef.current = event;
  const credsRef = useRef<GroupLiveCreds | null>(null);

  const applyCreds = useCallback((next: GroupLiveCreds | null) => {
    credsRef.current = next;
    setCreds(next);
  }, []);

  useEffect(() => {
    if (!id) return;
    void groupSplitRepository.getEvent(id).then((e) => {
      setEvent(e ?? null);
      setLoaded(true);
    });
    applyCreds(loadGroupLive(id));
  }, [id, applyCreds]);

  /**
   * The single write seam: persist the pure-mutated event and, when the event is
   * being shared, re-publish the encrypted mirror (bumping the revision) so every
   * guest's `/g/` board reflects the owner's latest edits and confirmations.
   */
  const save = useCallback(async (next: GroupSplitEvent) => {
    setEvent(next);
    await persistGroupSplit(next);
    const c = credsRef.current;
    if (!c) return;
    const bumped: GroupLiveCreds = { ...c, revision: c.revision + 1 };
    applyCreds(bumped);
    saveGroupLive(next.id, bumped);
    try {
      await republishGroupSplit(bumped, next, bumped.revision);
    } catch {
      // A transient network failure leaves the link live at the prior revision;
      // the next edit re-publishes. Never block the local edit on the network.
    }
  }, [applyCreds]);

  // Owner poll — fold every guest's claim snapshot (pick name + marked paid) into
  // the live event while it is open and shared. Deterministic + idempotent: only
  // a real change persists/re-publishes, so this converges and never loops.
  useEffect(() => {
    if (!creds || !event || event.status !== 'open') return;
    let cancelled = false;
    const tick = async () => {
      try {
        const claims = await pullGroupClaims(creds);
        const current = eventRef.current;
        if (!current || cancelled) return;
        const next = reduceGroupClaims(current, claims);
        if (JSON.stringify(next.participants) !== JSON.stringify(current.participants)) {
          await save(next);
        }
      } catch {
        // ignore — the next tick retries.
      }
    };
    void tick();
    const interval = setInterval(tick, POLL_FLOOR_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [creds, event?.id, event?.status, save]);

  const balances = useMemo(() => (event ? computeGroupBalances(event) : []), [event]);
  const transfers = useMemo(() => (event ? computeGroupTransfers(event) : []), [event]);
  // DEC-336 — expenses bucketed by the day they happened (newest fields fall back to createdAt).
  const expenseDays = useMemo(() => (event ? groupExpensesByDay(event.expenses) : []), [event]);
  const total = event ? groupTotalCents(event) : 0;
  const netByPid = useMemo(() => new Map(balances.map((b) => [b.participantId, b.netCents])), [balances]);
  const link = creds ? buildGroupSplitLink(creds) : null;
  const isTripLinked = !!event && !!trip && event.tripId === trip.id;
  // Trip teammates not yet in this event (offered as quick linked-add chips).
  const tripPeopleToAdd = useMemo(() => {
    if (!isTripLinked || !event) return [];
    const linkedIds = new Set(event.participants.map((p) => p.linkedParticipantId).filter(Boolean));
    return participants.filter((p) => !p.isOwner && p.deletedAt === null && !linkedIds.has(p.id));
  }, [isTripLinked, event, participants]);

  if (loaded && event === null) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <Icon name="group_off" size={32} className="text-on-surface-faint" />
        <p className="text-sm text-on-surface-dim">{t('group_split.not_found')}</p>
        <button onClick={() => navigate('/groups', { replace: true })} className="text-sm text-primary font-semibold btn-press">
          {t('group_split.back_to_list')}
        </button>
      </div>
    );
  }
  if (event === null) return null;

  const nameById = new Map(event.participants.map((p) => [p.id, p.name]));

  const handleAddPerson = () => {
    const trimmed = newPerson.trim();
    if (trimmed.length === 0) return;
    void save(addParticipant(event, createGroupParticipant({ name: trimmed })));
    setNewPerson('');
    // DEC-338: a button tap blurs the input — restore focus so the keyboard
    // stays open and the next name can be typed straight away.
    newPersonRef.current?.focus();
  };

  const handleRemovePerson = (participantId: string) => {
    if (!canRemoveParticipant(event, participantId)) {
      showToast(t('group_split.person_in_use'), 'danger');
      return;
    }
    void save(removeParticipant(event, participantId));
  };

  // C23/DEC-306: add a trip teammate as a LINKED participant so their group net
  // can flow into the trip settle-up. Only offered for a trip-scoped event.
  const handleAddTripPerson = (tripParticipantId: string, name: string) => {
    void save(
      addParticipant(event, createGroupParticipant({ name, kind: 'connected', linkedParticipantId: tripParticipantId })),
    );
  };

  const handleSaveExpense = (expense: GroupExpense) => {
    const exists = event.expenses.some((e) => e.id === expense.id);
    void save(exists ? updateExpense(event, expense) : addExpense(event, expense));
    setEditing(null);
  };

  const handleDeleteExpense = (expenseId: string) => {
    void save(removeExpense(event, expenseId));
    setEditing(null);
  };

  const handleToggleSettled = () => {
    void save(setGroupStatus(event, event.status === 'settled' ? 'open' : 'settled'));
  };

  const shareLink = async (url: string) => {
    const outcome = await shareOrCopyLink({ url, text: t('group_split.invite_text', { name: event.name }) });
    if (outcome === 'copied') showToast(t('group_split.link_copied'), 'success');
    else if (outcome === 'copy_failed') showToast(t('group_split.link_error'), 'danger');
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const c = await publishGroupSplit(event, 1);
      applyCreds(c);
      saveGroupLive(event.id, c);
      await shareLink(buildGroupSplitLink(c));
    } catch {
      showToast(t('group_split.link_error'), 'danger');
    } finally {
      setPublishing(false);
    }
  };

  const handleRevoke = async () => {
    const c = credsRef.current;
    if (!c) return;
    try {
      await revokeGroupSplit(c);
    } catch {
      // Already gone server-side — fall through and clear locally regardless.
    }
    clearGroupLive(event.id);
    applyCreds(null);
    showToast(t('group_split.link_revoked'), 'info');
  };

  const handleSetPayment = (participantId: string, status: GroupPaymentStatus) => {
    void save(setParticipantPayment(event, participantId, status));
  };

  const handleDeleteEvent = async () => {
    await deleteGroupSplit(event.id);
    showToast(t('group_split.deleted'), 'success');
    navigate('/groups', { replace: true });
  };

  return (
    <div className="flex flex-col gap-4 py-6">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface truncate flex-1">{event.name}</h1>
        {event.status === 'settled' && (
          <span className="text-[11px] font-semibold text-success px-2 py-1 rounded-lg bg-success/15">
            {t('group_split.status_settled')}
          </span>
        )}
      </div>

      <div className="bg-surface-container rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] text-on-surface-faint">{t('group_split.total_label')}</p>
          <p className="text-2xl font-extrabold tabular text-on-surface">{formatMoney(total, event.currency)}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-on-surface-faint">{t('group_split.people_label')}</p>
          <p className="text-lg font-bold text-on-surface">{event.participants.length}</p>
        </div>
      </div>

      {/* Share — invite the group through the public `/g/` link (C23/DEC-297). */}
      <section className="flex flex-col gap-2">
        {creds ? (
          <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Icon name="link" size={18} className="text-success" />
              <span className="text-sm font-semibold text-on-surface">{t('group_split.sharing_on')}</span>
            </div>
            {link && (
              <div className="flex flex-col items-center gap-1.5 pt-1">
                <QrCodeDisplay value={link} size={176} />
                <p className="text-[11px] text-on-surface-faint">{t('group_split.scan_to_join')}</p>
              </div>
            )}
            <p className="text-[11px] text-on-surface-faint break-all">{link}</p>
            <div className="flex gap-2">
              <button
                onClick={() => link && void shareLink(link)}
                className="flex-1 py-2.5 rounded-lg bg-primary text-on-surface font-semibold btn-press flex items-center justify-center gap-1.5"
              >
                <Icon name="share" size={16} className="text-on-surface" />
                {t('group_split.share_again')}
              </button>
              <button
                onClick={handleRevoke}
                className="py-2.5 px-3 rounded-lg bg-surface-high text-on-surface-dim text-sm btn-press"
              >
                {t('group_split.stop_sharing')}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="bg-surface-container rounded-xl p-4 flex items-center gap-3 text-left btn-press disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Icon name="group_add" size={20} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-on-surface">{t('group_split.invite_cta')}</p>
              <p className="text-[11px] text-on-surface-faint">{t('group_split.invite_hint')}</p>
            </div>
            {publishing && (
              <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
            )}
          </button>
        )}
      </section>

      {/* Expenses — the primary surface (A03/DEC-335), even when empty. */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-on-surface">{t('group_split.expenses_title')}</h2>
          <button
            onClick={() => setEditing('new')}
            className="text-sm text-primary font-semibold btn-press flex items-center gap-1"
          >
            <Icon name="add" size={18} className="text-primary" />
            {t('group_split.add_expense')}
          </button>
        </div>
        {event.expenses.length === 0 ? (
          <div className="bg-surface-container rounded-xl p-5 text-center">
            <p className="text-sm text-on-surface-dim">{t('group_split.no_expenses')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {expenseDays.map((day) => (
              <div key={day.day} className="flex flex-col gap-2">
                {/* DEC-336 — day headers only when the group spans more than one day. */}
                {expenseDays.length > 1 && (
                  <p className="text-[11px] font-semibold text-on-surface-faint px-1 capitalize">
                    {formatDayLabel(day.day)}
                  </p>
                )}
                {day.expenses.map((exp) => {
                  const registrant = exp.createdByParticipantId;
                  const showRegistrant = !!registrant && registrant !== exp.paidByParticipantId;
                  return (
                    <button
                      key={exp.id}
                      onClick={() => setEditing(exp)}
                      className="bg-surface-container rounded-xl p-3.5 flex items-center gap-3 text-left btn-press"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-on-surface truncate flex items-center gap-1.5">
                          <span className="truncate">{exp.description}</span>
                          {!!exp.items && exp.items.length > 0 && (
                            <Icon name="checklist" size={15} className="text-on-surface-faint shrink-0" />
                          )}
                        </p>
                        <p className="text-[11px] text-on-surface-faint">
                          {t('group_split.paid_by', { name: nameById.get(exp.paidByParticipantId) ?? '?' })}
                          {' · '}
                          {exp.splitMode === 'equal'
                            ? t('group_split.split_equal_n', { count: exp.participantIds.length })
                            : t('group_split.split_custom_n', { count: exp.participantIds.length })}
                        </p>
                        {showRegistrant && (
                          <p className="text-[11px] text-on-surface-faint">
                            {t('group_split.registered_by', { name: nameById.get(registrant) ?? '?' })}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-bold tabular text-on-surface shrink-0">
                        {formatMoney(exp.amountCents, event.currency)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* People */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-on-surface px-1">{t('group_split.people_title')}</h2>
        <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-2.5">
          {event.participants.map((p) => {
            const isOwner = p.id === event.ownerParticipantId;
            const isDebtor = (netByPid.get(p.id) ?? 0) < 0 && event.expenses.length > 0;
            return (
              <div key={p.id} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-surface-high flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-on-surface-dim">{p.name.slice(0, 1).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-base text-on-surface truncate block">{p.name}</span>
                  {p.claimedByActorId !== null && !isOwner && (
                    <span className="text-[10px] text-success">{t('group_split.joined_via_link')}</span>
                  )}
                </div>
                {isOwner ? (
                  <span className="text-[10px] text-on-surface-faint shrink-0">{t('group_split.owner_tag')}</span>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isDebtor && <PaymentControl status={p.paymentStatus} onSet={(s) => handleSetPayment(p.id, s)} t={t} />}
                    <button
                      onClick={() => handleRemovePerson(p.id)}
                      className="btn-press p-1"
                      aria-label={t('group_split.remove_person')}
                    >
                      <Icon name="close" size={16} className="text-on-surface-faint" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex items-center gap-2 pt-1">
            <input
              ref={newPersonRef}
              value={newPerson}
              onChange={(e) => setNewPerson(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddPerson()}
              placeholder={t('group_split.add_person_ph')}
              className="bg-surface-high rounded-lg px-3 py-2 text-sm text-on-surface outline-none flex-1"
            />
            <button
              onClick={handleAddPerson}
              disabled={newPerson.trim().length === 0}
              className="btn-press px-3 py-2 rounded-lg bg-primary text-on-surface text-sm font-semibold disabled:opacity-40"
            >
              {t('common.add')}
            </button>
          </div>

          {/* C23/DEC-306: quick-add trip teammates as LINKED people so their net
              flows into the trip settle-up. Only for a trip-scoped event. */}
          {tripPeopleToAdd.length > 0 && (
            <div className="flex flex-col gap-1.5 pt-1">
              <p className="text-[11px] text-on-surface-faint">{t('group_split.add_from_trip')}</p>
              <div className="flex flex-wrap gap-1.5">
                {tripPeopleToAdd.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleAddTripPerson(p.id, p.name)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-high text-on-surface-dim text-xs font-medium btn-press"
                  >
                    <Icon name="add" size={14} className="text-on-surface-faint" />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {isTripLinked && (
          <p className="text-[11px] text-on-surface-faint px-1 leading-relaxed">{t('group_split.trip_settle_note')}</p>
        )}
      </section>

      {/* Pagamentos (balances) + Quem paga quem (transfers) behind buttons
          (A04/DEC-335) — only meaningful once there is money in. */}
      {event.expenses.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => setShowBalances((v) => !v)}
              aria-expanded={showBalances}
              className="flex-1 py-2.5 px-3 rounded-xl bg-surface-container text-on-surface font-semibold text-sm btn-press flex items-center justify-center gap-1.5"
            >
              <Icon name="account_balance_wallet" size={16} className="text-on-surface-dim" />
              {t('group_split.balances_title')}
              <Icon name={showBalances ? 'expand_less' : 'expand_more'} size={16} className="text-on-surface-faint" />
            </button>
            {transfers.length > 0 && (
              <button
                onClick={() => setShowTransfers((v) => !v)}
                aria-expanded={showTransfers}
                className="flex-1 py-2.5 px-3 rounded-xl bg-surface-container text-on-surface font-semibold text-sm btn-press flex items-center justify-center gap-1.5"
              >
                <Icon name="swap_horiz" size={16} className="text-on-surface-dim" />
                {t('group_split.transfers_title')}
                <Icon name={showTransfers ? 'expand_less' : 'expand_more'} size={16} className="text-on-surface-faint" />
              </button>
            )}
          </div>

          {showBalances && (
            <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-2.5">
              {balances.map((b) => (
                <div key={b.participantId} className="flex items-center justify-between">
                  <span className="text-sm text-on-surface truncate">{b.name}</span>
                  <span
                    className={`text-sm font-semibold tabular ${
                      b.netCents > 0 ? 'text-success' : b.netCents < 0 ? 'text-on-surface' : 'text-on-surface-faint'
                    }`}
                  >
                    {b.netCents > 0
                      ? t('group_split.gets_back', { amount: formatMoney(b.netCents, event.currency) })
                      : b.netCents < 0
                        ? t('group_split.owes', { amount: formatMoney(-b.netCents, event.currency) })
                        : t('group_split.even')}
                  </span>
                </div>
              ))}
            </div>
          )}

          {showTransfers && transfers.length > 0 && (
            <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-2">
              {transfers.map((tr, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-on-surface">
                  <span className="font-medium truncate">{tr.fromName}</span>
                  <Icon name="arrow_forward" size={16} className="text-on-surface-faint shrink-0" />
                  <span className="font-medium truncate">{tr.toName}</span>
                  <span className="ml-auto font-bold tabular shrink-0">{formatMoney(tr.amountCents, event.currency)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Lifecycle actions */}
      <div className="flex flex-col gap-2 pt-2">
        {event.expenses.length > 0 && (
          <button
            onClick={handleToggleSettled}
            className="py-2.5 rounded-xl bg-surface-high text-on-surface font-semibold btn-press"
          >
            {event.status === 'settled' ? t('group_split.reopen') : t('group_split.mark_settled')}
          </button>
        )}
        <button
          onClick={handleDeleteEvent}
          className="py-2.5 rounded-xl text-on-surface-faint text-sm btn-press"
        >
          {t('group_split.delete')}
        </button>
      </div>

      {editing !== null && (
        <GroupExpenseEditor
          event={event}
          expense={editing === 'new' ? null : editing}
          photoEnabled={photoEnabled}
          aiTextEnabled={aiTextEnabled}
          onClose={() => setEditing(null)}
          onSave={handleSaveExpense}
          onDelete={handleDeleteExpense}
        />
      )}
    </div>
  );
}

/**
 * The owner's settle control for one debtor: confirm a guest's self-reported
 * payment, or mark a cash/in-person settlement directly. Tapping a confirmed row
 * reverts it (Â9: nothing is destructive/irreversible). Worded, never colour-only.
 */
function PaymentControl({
  status,
  onSet,
  t,
}: {
  status: GroupPaymentStatus;
  onSet: (status: GroupPaymentStatus) => void;
  t: (key: string) => string;
}) {
  if (status === 'confirmed') {
    return (
      <button
        onClick={() => onSet('unpaid')}
        className="flex items-center gap-1 text-[11px] font-semibold text-success px-2 py-1 rounded-lg bg-success/15 btn-press"
      >
        <Icon name="check_circle" size={14} className="text-success" />
        {t('group_split.received')}
      </button>
    );
  }
  if (status === 'marked') {
    return (
      <button
        onClick={() => onSet('confirmed')}
        className="text-[11px] font-semibold text-warning px-2 py-1 rounded-lg bg-warning/15 btn-press"
      >
        {t('group_split.confirm_receipt')}
      </button>
    );
  }
  return (
    <button
      onClick={() => onSet('confirmed')}
      className="text-[11px] font-medium text-on-surface-dim px-2 py-1 rounded-lg bg-surface-high btn-press"
    >
      {t('group_split.mark_received')}
    </button>
  );
}
