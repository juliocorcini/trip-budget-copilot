import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useLocation } from 'react-router';
import { parseShareKeyFromHash } from '@/domain/sync';
import {
  buildGroupClaimResponse,
  computeGroupBalances,
  computeGroupTransfers,
  type GroupSharePayload,
  type GroupSplitEvent,
} from '@/domain/group-split';
import { connectShareSignal, type ShareSignalHandle } from '@/data/sync/share-signal';
import { formatMoney } from '@/domain/money';
import { Icon } from '@/components/Icon';
import {
  fetchGroupSplit,
  postGroupClaim,
  type FetchGroupStatus,
} from './group-link';
import { getGuestActorId, getGuestName, setGuestName } from '@/features/split/live-link';

const POLL_FLOOR_MS = 6000;
const POST_DEBOUNCE_MS = 500;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; status: FetchGroupStatus }
  | { kind: 'live'; payload: GroupSharePayload };

/**
 * C23 / DEC-297 — the guest claim board (`/g/:id#k=<key>`). Lives OUTSIDE BootGate
 * so a guest with no trip is never bounced to onboarding. The guest picks which
 * name is them, sees what they owe (or get back) and the exact transfer, and can
 * mark their debt paid; the owner's device stays the single source of truth and
 * confirms receipt. The guest's pick + paid flag are encrypted and posted to the
 * owner; the owner's edits/confirmations flow back here via the poll floor.
 */
export function GroupClaimPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const location = useLocation();

  const id = params.id ?? null;
  const key = useMemo(() => parseShareKeyFromHash(location.hash), [location.hash]);
  const actorId = useMemo(() => getGuestActorId(), []);

  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [claimedId, setClaimedId] = useState<string | null>(null);
  const [markedPaid, setMarkedPaid] = useState(false);
  const seededRef = useRef(false);
  const hasPayloadRef = useRef(false);
  const signalRef = useRef<ShareSignalHandle | null>(null);

  const refetch = useCallback(async () => {
    if (!id || !key) {
      setLoad({ kind: 'error', status: 'bad_key' });
      return;
    }
    const res = await fetchGroupSplit(id, key);
    if (res.status === 'ok') {
      // Seed my pick + paid flag from the owner's view of my slot (my last posted
      // state), so a returning guest keeps their choice.
      if (!seededRef.current) {
        const mine = res.payload.event.participants.find((p) => p.claimedByActorId === actorId);
        if (mine) {
          setClaimedId(mine.id);
          setMarkedPaid(mine.paymentStatus !== 'unpaid');
        }
        seededRef.current = true;
      }
      hasPayloadRef.current = true;
      setLoad({ kind: 'live', payload: res.payload });
      return;
    }
    if (res.status === 'error' && hasPayloadRef.current) return;
    setLoad({ kind: 'error', status: res.status });
  }, [id, key, actorId]);

  useEffect(() => {
    setLoad({ kind: 'loading' });
    hasPayloadRef.current = false;
    seededRef.current = false;
    void refetch();
  }, [refetch]);

  const isLive = load.kind === 'live';

  // Live channel + poll floor so the owner's confirmations show here promptly.
  useEffect(() => {
    if (!id || !isLive) return;
    const handle = connectShareSignal(id, () => void refetch());
    signalRef.current = handle;
    const interval = setInterval(() => void refetch(), POLL_FLOOR_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refetch();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      handle.close();
      if (signalRef.current === handle) signalRef.current = null;
    };
  }, [id, isLive, refetch]);

  // Post my claim snapshot (debounced) once I have picked a name.
  useEffect(() => {
    if (!isLive || !id || !key || !claimedId) return;
    const timer = setTimeout(() => {
      const response = buildGroupClaimResponse({
        fromActorId: actorId,
        fromName: getGuestName() ?? '',
        claimedParticipantId: claimedId,
        markedPaid,
      });
      void postGroupClaim(id, key, response)
        .then(() => signalRef.current?.send({ t: 'resp' }))
        .catch(() => {});
    }, POST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [claimedId, markedPaid, isLive, id, key, actorId]);

  if (load.kind === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-base">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (load.kind === 'error') {
    const msg =
      load.status === 'revoked'
        ? t('group_claim.revoked')
        : load.status === 'not_found'
          ? t('group_claim.not_found')
          : load.status === 'bad_key'
            ? t('group_claim.bad_key')
            : t('group_claim.error');
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-surface-base px-8 text-center gap-3">
        <Icon name="link_off" size={32} className="text-on-surface-faint" />
        <p className="text-sm text-on-surface-dim leading-relaxed">{msg}</p>
      </div>
    );
  }

  return (
    <ClaimBoard
      event={load.payload.event}
      actorId={actorId}
      claimedId={claimedId}
      markedPaid={markedPaid}
      onPick={(pid) => {
        setClaimedId(pid);
        setMarkedPaid(false);
      }}
      onChangeName={() => setClaimedId(null)}
      onTogglePaid={() => setMarkedPaid((v) => !v)}
      onSaveName={(name) => setGuestName(name)}
    />
  );
}

interface ClaimBoardProps {
  event: GroupSplitEvent;
  actorId: string;
  claimedId: string | null;
  markedPaid: boolean;
  onPick: (participantId: string) => void;
  onChangeName: () => void;
  onTogglePaid: () => void;
  onSaveName: (name: string) => void;
}

function ClaimBoard({
  event,
  claimedId,
  markedPaid,
  onPick,
  onChangeName,
  onTogglePaid,
  onSaveName,
}: ClaimBoardProps) {
  const { t } = useTranslation();
  const balances = useMemo(() => computeGroupBalances(event), [event]);
  const transfers = useMemo(() => computeGroupTransfers(event), [event]);
  const total = useMemo(() => balances.reduce((s, b) => s + b.paidCents, 0), [balances]);
  const nameById = new Map(event.participants.map((p) => [p.id, p.name]));

  const claimed = event.participants.find((p) => p.id === claimedId) ?? null;
  const myBalance = balances.find((b) => b.participantId === claimedId) ?? null;
  const myTransfers = transfers.filter(
    (tr) => tr.fromParticipantId === claimedId || tr.toParticipantId === claimedId,
  );

  // Optimistic: my own mark shows instantly even before the owner re-publishes.
  const myStatus =
    claimed?.paymentStatus === 'confirmed'
      ? 'confirmed'
      : markedPaid
        ? 'marked'
        : (claimed?.paymentStatus ?? 'unpaid');

  const iOwe = (myBalance?.netCents ?? 0) < 0;

  return (
    <div className="min-h-screen bg-surface-base px-5 py-8 flex flex-col gap-5 max-w-md mx-auto">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-on-surface-faint">
          <Icon name="group" size={16} className="text-on-surface-faint" />
          <span className="text-[11px] font-semibold uppercase tracking-wide">{t('group_claim.kicker')}</span>
        </div>
        <h1 className="text-heading font-bold text-on-surface">{event.name}</h1>
      </header>

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

      {claimed === null ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-on-surface px-1">{t('group_claim.who_are_you')}</h2>
          <div className="bg-surface-container rounded-xl p-2 flex flex-col gap-1">
            {event.participants.map((p) => {
              const isOwner = p.id === event.ownerParticipantId;
              const takenByOther = p.claimedByActorId !== null;
              return (
                <button
                  key={p.id}
                  disabled={isOwner}
                  onClick={() => onPick(p.id)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left btn-press disabled:opacity-40 hover:bg-surface-high"
                >
                  <div className="w-8 h-8 rounded-full bg-surface-high flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-on-surface-dim">{p.name.slice(0, 1).toUpperCase()}</span>
                  </div>
                  <span className="text-sm text-on-surface flex-1 truncate">{p.name}</span>
                  {isOwner ? (
                    <span className="text-[10px] text-on-surface-faint">{t('group_split.owner_tag')}</span>
                  ) : takenByOther ? (
                    <span className="text-[10px] text-on-surface-faint">{t('group_claim.taken')}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-on-surface-faint px-1 leading-relaxed">{t('group_claim.pick_hint')}</p>
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-sm text-on-surface-dim">
                {t('group_claim.you_are', { name: claimed.name })}
              </span>
              <button onClick={onChangeName} className="text-[11px] text-primary font-semibold btn-press">
                {t('group_claim.change')}
              </button>
            </div>

            <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-1">
              {myBalance && myBalance.netCents < 0 ? (
                <p className="text-base font-bold text-on-surface">
                  {t('group_split.owes', { amount: formatMoney(-myBalance.netCents, event.currency) })}
                </p>
              ) : myBalance && myBalance.netCents > 0 ? (
                <p className="text-base font-bold text-success">
                  {t('group_split.gets_back', { amount: formatMoney(myBalance.netCents, event.currency) })}
                </p>
              ) : (
                <p className="text-base font-bold text-on-surface-dim">{t('group_split.even')}</p>
              )}
              {myBalance && (
                <p className="text-[11px] text-on-surface-faint">
                  {t('group_claim.paid_share', {
                    paid: formatMoney(myBalance.paidCents, event.currency),
                    share: formatMoney(myBalance.shareCents, event.currency),
                  })}
                </p>
              )}
            </div>

            {myTransfers.length > 0 && (
              <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-2">
                {myTransfers.map((tr, i) => {
                  const iAmPayer = tr.fromParticipantId === claimedId;
                  return (
                    <div key={i} className="flex items-center gap-2 text-sm text-on-surface">
                      <Icon
                        name={iAmPayer ? 'arrow_upward' : 'arrow_downward'}
                        size={16}
                        className={iAmPayer ? 'text-on-surface-faint shrink-0' : 'text-success shrink-0'}
                      />
                      <span className="truncate">
                        {iAmPayer
                          ? t('group_claim.pay_to', { name: nameById.get(tr.toParticipantId) ?? '?' })
                          : t('group_claim.receive_from', { name: nameById.get(tr.fromParticipantId) ?? '?' })}
                      </span>
                      <span className="ml-auto font-bold tabular shrink-0">
                        {formatMoney(tr.amountCents, event.currency)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Mark-as-paid lifecycle — only meaningful when I owe money. */}
            {iOwe && (
              <div className="flex flex-col gap-1.5">
                {myStatus === 'confirmed' ? (
                  <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-success/15 text-success font-semibold">
                    <Icon name="check_circle" size={18} className="text-success" />
                    {t('group_claim.confirmed')}
                  </div>
                ) : myStatus === 'marked' ? (
                  <>
                    <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-surface-high text-on-surface font-semibold">
                      <Icon name="schedule" size={18} className="text-on-surface-dim" />
                      {t('group_claim.awaiting')}
                    </div>
                    <button onClick={onTogglePaid} className="text-[11px] text-on-surface-faint btn-press py-1">
                      {t('group_claim.undo_paid')}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={onTogglePaid}
                    className="py-3 rounded-xl bg-primary text-on-surface font-semibold btn-press"
                  >
                    {t('group_claim.mark_paid')}
                  </button>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {/* Expenses (read-only) */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-on-surface px-1">{t('group_split.expenses_title')}</h2>
        {event.expenses.length === 0 ? (
          <div className="bg-surface-container rounded-xl p-5 text-center">
            <p className="text-sm text-on-surface-dim">{t('group_split.no_expenses')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {event.expenses.map((exp) => (
              <div key={exp.id} className="bg-surface-container rounded-xl p-3.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-on-surface truncate">{exp.description}</p>
                  <p className="text-[11px] text-on-surface-faint">
                    {t('group_split.paid_by', { name: nameById.get(exp.paidByParticipantId) ?? '?' })}
                  </p>
                </div>
                <span className="text-sm font-bold tabular text-on-surface shrink-0">
                  {formatMoney(exp.amountCents, event.currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="text-center pt-2">
        <span className="text-[11px] text-on-surface-faint">{t('group_claim.made_with')}</span>
      </footer>
      <HiddenNameSync claimedName={claimed?.name ?? null} onSaveName={onSaveName} />
    </div>
  );
}

/**
 * Keep the device's guest name in step with the slot the guest picked, so a later
 * bill-split or re-open reuses the same identity. Side-effect only; renders null.
 */
function HiddenNameSync({ claimedName, onSaveName }: { claimedName: string | null; onSaveName: (n: string) => void }) {
  useEffect(() => {
    if (claimedName && claimedName.trim()) onSaveName(claimedName.trim());
  }, [claimedName, onSaveName]);
  return null;
}
