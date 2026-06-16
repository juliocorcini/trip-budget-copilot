import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import {
  calculateDebts,
  createSettlement,
  createParticipant,
  calculateParticipantBalances,
  suggestSimplifiedSettlements,
  buildParticipantStatement,
} from '@/domain/splitting';
import type { DebtSummary, DebtEntry } from '@/domain/splitting';
import { findSubcategory } from '@/domain/outing';
import type { Participant } from '@/domain/types/participant';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { Settlement } from '@/domain/types/settlement';
import { formatMoney, toCents } from '@/domain/money';
import { formatShortDate } from '@/domain/dates';
import { participantShareRepository } from '@/data/repositories/participant-share-repository';
import { settlementRepository } from '@/data/repositories/settlement-repository';
import { participantRepository, peerLinkRepository } from '@/data/repositories';
import type { PeerLink } from '@/domain/types/peer-link';
import { Icon } from '@/components/Icon';
import { DataErrorScreen } from '@/components/DataErrorScreen';
import { LoadingScreen } from '@/components/LoadingScreen';
import { BottomSheet } from '@/components/BottomSheet';
import { showToast } from '@/components/Toast';
import { QrCodeDisplay } from '@/components/QrCodeDisplay';
import { QrScanner } from '@/components/QrScanner';
import {
  buildIdentityQrPayload,
  encodeQrPayload,
  decodeQrPayload,
  fitsInSingleQr,
  buildStatementPayload,
} from '@/domain/sync';
import { getInstallationId } from '@/utils/entity-factory';
import {
  pairParticipantFromIdentity,
  linkParticipantToIdentity,
  applyPeerResponses,
  sendPayloadToPeerMailbox,
} from '@/domain/orchestrators';
import { waitForResponses, getDevicePublicKeyB64 } from '@/data/sync';
import { SyncTransferFlow } from '@/features/sync/SyncTransferFlow';
import { MirroredStatementsSection } from './MirroredStatementsSection';

export function SharedExpensesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip, transactions, participants, settings, loading, error, retry, reload } = useAppData();
  const [shares, setShares] = useState<ParticipantShare[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [debtSummary, setDebtSummary] = useState<DebtSummary | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!trip) return;
    const load = async () => {
      const txIds = transactions.filter((tx) => tx.isShared).map((tx) => tx.id);
      const [sh, se] = await Promise.all([
        participantShareRepository.getAllForTrip(txIds),
        settlementRepository.getByTripId(trip.id),
      ]);
      setShares(sh);
      setSettlements(se);

      const owner = participants.find((p) => p.isOwner);
      if (owner) {
        const summary = calculateDebts(transactions, sh, participants, se, owner.id);
        setDebtSummary(summary);
      }
    };
    load();
  }, [trip, transactions, participants]);

  // GAP-032: settle goes through a confirmation sheet with optional partial amount.
  const [settleTarget, setSettleTarget] = useState<DebtEntry | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [showSimplified, setShowSimplified] = useState(false);
  // DEC-102 (R-25): tap on a participant opens their itemized statement.
  const [statementTarget, setStatementTarget] = useState<Participant | null>(null);
  // R4 P2P (DEC-105/106): pairing + statement sending sheets.
  const [showMyQr, setShowMyQr] = useState(false);
  const [showQrAdd, setShowQrAdd] = useState(false);
  const [linkTarget, setLinkTarget] = useState<Participant | null>(null);
  const [sendTarget, setSendTarget] = useState<Participant | null>(null);
  const [statementQrText, setStatementQrText] = useState<string | null>(null);
  // FIELD item 8: peer links keyed by participant — drives the "send via the
  // mailbox" action (only available when the peer's public key is on file).
  const [peerLinks, setPeerLinks] = useState<PeerLink[]>([]);
  const [mailboxSending, setMailboxSending] = useState(false);

  const ownerParticipant = participants.find((p) => p.isOwner);
  // FIELD item 8: the identity QR now carries the device public key so a scan
  // captures it for sealing async messages. Built async (key load), so it lives
  // in state instead of being computed inline.
  const [myIdentityQr, setMyIdentityQr] = useState('');
  useEffect(() => {
    let active = true;
    void (async () => {
      const pk = await getDevicePublicKeyB64().catch(() => null);
      if (!active) return;
      setMyIdentityQr(
        encodeQrPayload(
          buildIdentityQrPayload(
            {
              actorId: getInstallationId(),
              displayName: ownerParticipant?.name ?? settings?.deviceName ?? 'TripPilot',
            },
            pk,
          ),
        ),
      );
    })();
    return () => {
      active = false;
    };
  }, [ownerParticipant?.name, settings?.deviceName]);

  useEffect(() => {
    void peerLinkRepository.getAll().then(setPeerLinks);
  }, [participants]);

  const peerLinkFor = (participantId: string): PeerLink | undefined =>
    peerLinks.find((link) => link.participantId === participantId && link.deletedAt === null);

  // FIELD item 8: deliver the statement to the peer's mailbox — no need to be
  // side by side. Reuses the exact payload the live transfer builds.
  const handleSendViaMailbox = async (participant: Participant) => {
    const link = peerLinkFor(participant.id);
    if (!link?.publicKey || mailboxSending) return;
    const payload = buildStatementForParticipant(participant);
    if (!payload) return;
    setMailboxSending(true);
    try {
      const { delivered } = await sendPayloadToPeerMailbox(link, 'statement', payload);
      setSendTarget(null);
      showToast(
        delivered ? t('mailbox.sent') : t('mailbox.queued'),
        delivered ? 'success' : 'info',
      );
    } catch {
      showToast(t('mailbox.send_failed'), 'danger');
    } finally {
      setMailboxSending(false);
    }
  };

  const handlePairScan = async (text: string) => {
    if (!trip) return;
    const decoded = decodeQrPayload(text);
    if (!decoded || decoded.kind !== 'identity') return;
    setShowQrAdd(false);
    const result = await pairParticipantFromIdentity(decoded, trip.id);
    if (result.status === 'already_paired') {
      showToast(t('sync.already_connected'), 'info');
    } else {
      showToast(t('sync.pairing_done', { name: result.participant.name }), 'success');
    }
    await reload();
  };

  const handleLinkScan = async (text: string) => {
    if (!trip || !linkTarget) return;
    const decoded = decodeQrPayload(text);
    if (!decoded || decoded.kind !== 'identity') return;
    const target = linkTarget;
    setLinkTarget(null);
    const result = await linkParticipantToIdentity(target.id, decoded, trip.id);
    if (!result) return;
    if (result.status === 'already_paired' && result.participant.id !== target.id) {
      showToast(t('sync.already_connected'), 'info');
    } else {
      showToast(t('sync.linked_done', { name: result.participant.name }), 'success');
    }
    await reload();
  };

  const buildStatementForParticipant = (participant: Participant) => {
    const owner = participants.find((p) => p.isOwner);
    if (!owner || !trip) return null;
    const statement = buildParticipantStatement(
      participant.id,
      transactions,
      shares,
      participants,
      settlements,
      owner.id,
    );
    return buildStatementPayload({
      owner: { actorId: getInstallationId(), displayName: owner.name },
      participant,
      statement,
      shares,
      currency: trip.baseCurrency,
    });
  };

  const openSettleSheet = (debt: DebtEntry) => {
    setSettleTarget(debt);
    setSettleAmount((debt.amountCents / 100).toFixed(2));
  };

  const settleAmountCents = (() => {
    const parsed = Number(settleAmount.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return toCents(parsed);
  })();

  const handleConfirmSettle = async () => {
    if (!trip || !settleTarget || settleAmountCents === null) return;
    const amountCents = Math.min(settleAmountCents, settleTarget.amountCents);
    const settlement = createSettlement(
      trip.id,
      settleTarget.debtorId,
      settleTarget.creditorId,
      amountCents,
      trip.baseCurrency,
    );
    await settlementRepository.create(settlement);
    setSettleTarget(null);
    await reload();
  };

  const handleAddParticipant = async () => {
    if (!trip || !newName.trim()) return;
    setSaving(true);
    try {
      const participant = createParticipant(
        trip.id,
        newName.trim(),
        newNickname.trim() || null,
      );
      await participantRepository.create(participant);
      await reload();
      setNewName('');
      setNewNickname('');
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  // BUG-014: recovery on DB error instead of a blank page.
  if (!trip) {
    if (error) return <DataErrorScreen onRetry={retry} />;
    if (loading) return <LoadingScreen />;
    return <Navigate to="/welcome" replace />;
  }

  const balances = debtSummary ? calculateParticipantBalances(debtSummary.debts) : new Map<string, number>();

  return (
    <div className="flex flex-col gap-4 pb-4 pt-2">
      <div className="flex items-center justify-between">
        {/* R5-08: same back-button header pattern as the other "More" subpages. */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
            <Icon name="arrow_back" size={24} className="text-on-surface" />
          </button>
          <h1 className="text-heading font-bold text-on-surface">
            {t('more.participants')}
          </h1>
        </div>
        {/* DEC-105: my identity QR — the other person scans it to pair */}
        <button
          onClick={() => setShowMyQr(true)}
          className="px-3 py-1.5 rounded-xl bg-surface-container flex items-center gap-1.5 btn-press"
        >
          <Icon name="qr_code_2" size={16} className="text-primary" />
          <span className="text-xs font-medium text-on-surface">{t('sync.my_qr')}</span>
        </button>
      </div>

      <div>
        <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
          {t('more.participants')}
        </p>
        {participants.map((p) => {
          const balance = balances.get(p.id) ?? 0;
          return (
            // DEC-102 (R-25): tap opens the itemized statement for this person.
            <button
              key={p.id}
              onClick={() => setStatementTarget(p)}
              className="bg-surface-container rounded-xl px-4 py-3 mb-1 flex items-center gap-3 w-full text-left btn-press"
            >
              <Icon name="person" size={20} className="text-on-surface-dim" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-on-surface truncate flex items-center gap-1.5">
                  {p.name}
                  {p.nickname && (
                    <span className="text-on-surface-faint"> · {p.nickname}</span>
                  )}
                  {/* DEC-105: paired badge */}
                  {p.linkedActorId && (
                    <Icon name="link" size={14} className="text-primary shrink-0" />
                  )}
                </p>
                {p.isOwner && <p className="text-xs text-primary">{t('shared.owner_tag')}</p>}
              </div>
              <p
                className={`text-xs font-semibold tabular shrink-0 ${
                  balance < 0 ? 'text-error' : balance > 0 ? 'text-success' : 'text-on-surface-faint'
                }`}
              >
                {balance < 0
                  ? t('shared.balance_owes', { amount: formatMoney(Math.abs(balance), trip.baseCurrency) })
                  : balance > 0
                    ? t('shared.balance_owed', { amount: formatMoney(balance, trip.baseCurrency) })
                    : t('shared.balance_zero')}
              </p>
              <Icon name="chevron_right" size={16} className="text-on-surface-faint shrink-0" />
            </button>
          );
        })}

        {showForm ? (
          <div className="bg-surface-container rounded-xl p-4 mt-2 flex flex-col gap-3">
            <div>
              <label className="text-xs text-on-surface-faint mb-1 block">
                {t('shared.participant_name')}
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-on-surface-faint mb-1 block">
                {t('shared.participant_nickname')}
              </label>
              <input
                type="text"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAddParticipant}
                disabled={!newName.trim() || saving}
                className="flex-1 py-2.5 rounded-xl bg-primary text-on-surface font-medium text-sm btn-press disabled:opacity-40"
              >
                {saving ? t('common.loading') : t('common.add')}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setShowForm(true)}
              className="flex-1 py-3 rounded-xl flex items-center justify-center gap-2 btn-press font-semibold text-sm"
              style={{ background: '#C75B3918', color: 'var(--primary)', border: '1px dashed #C75B3940' }}
            >
              <Icon name="person_add" size={18} className="text-primary" />
              {t('shared.add_participant')}
            </button>
            {/* DEC-105: pairing is an optional upgrade — typing a name stays default */}
            <button
              onClick={() => setShowQrAdd(true)}
              className="py-3 px-4 rounded-xl flex items-center justify-center gap-2 btn-press font-semibold text-sm"
              style={{ background: '#C75B3918', color: 'var(--primary)', border: '1px dashed #C75B3940' }}
            >
              <Icon name="qr_code_scanner" size={18} className="text-primary" />
              {t('sync.add_by_qr')}
            </button>
          </div>
        )}
      </div>

      {/* DEC-106 (P2P-13): statements received from paired owner devices */}
      <MirroredStatementsSection />

      {/* DEC-071 (FIELD-03): shared expenses with per-share confirmation status */}
      {(() => {
        const sharedTxs = transactions.filter(
          (tx) => tx.isShared && tx.type === 'expense' && tx.deletedAt === null,
        );
        if (sharedTxs.length === 0) return null;
        const nameById = new Map(participants.map((p) => [p.id, p.nickname ?? p.name]));
        const statusStyle: Record<string, string> = {
          pending: 'bg-warning/15 text-warning',
          confirmed: 'bg-success/20 text-success',
          rejected: 'bg-error/15 text-error',
        };
        return (
          <div>
            <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-1 px-1">
              {t('shared.shared_expenses_title')}
            </p>
            {/* M1: spell out what the status pills mean — "Pendente/Confirmado"
                alone left people guessing what action (if any) was expected. */}
            <p className="text-[11px] text-on-surface-faint leading-snug mb-2 px-1">
              {t('shared.status_hint')}
            </p>
            {sharedTxs.map((tx) => {
              const txShares = shares.filter(
                (s) => s.transactionId === tx.id && s.deletedAt === null,
              );
              return (
                // R-26: the shared expense card leads to the expense detail.
                <button
                  key={tx.id}
                  onClick={() => navigate(`/expenses/${tx.id}`)}
                  className="bg-surface-container rounded-xl p-4 mb-2 w-full text-left btn-press"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-on-surface truncate">{tx.description}</p>
                    <p className="text-sm font-semibold tabular text-on-surface shrink-0">
                      {formatMoney(tx.amountCents, tx.currency)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 mt-2">
                    {txShares.map((share) => (
                      <div key={share.id} className="flex items-center justify-between">
                        <p className="text-xs text-on-surface-dim truncate">
                          {nameById.get(share.participantId) ?? '—'} ·{' '}
                          <span className="tabular">{formatMoney(share.shareAmountCents, tx.currency)}</span>
                        </p>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${statusStyle[share.confirmationStatus]}`}
                        >
                          {t(`shared.status_${share.confirmationStatus}` as never)}
                        </span>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        );
      })()}

      {debtSummary && debtSummary.debts.length > 0 && (() => {
        const simplified = suggestSimplifiedSettlements(debtSummary.debts);
        const involvedIds = new Set(
          debtSummary.debts.flatMap((d) => [d.debtorId, d.creditorId]),
        );
        const canSimplify = involvedIds.size >= 3 && simplified.length < debtSummary.debts.length;
        const visibleDebts = showSimplified && canSimplify ? simplified : debtSummary.debts;

        return (
          <div>
            <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
              {t('shared.pending_debts')}
            </p>

            {canSimplify && (
              <button
                onClick={() => setShowSimplified((v) => !v)}
                className="w-full mb-2 p-3 rounded-xl flex items-center gap-2.5 btn-press text-left"
                style={{ background: '#C75B3918', border: '1px dashed #C75B3940' }}
              >
                <Icon name="merge" size={16} className="text-primary" />
                <p className="text-xs font-semibold text-primary flex-1">
                  {showSimplified
                    ? t('shared.show_original_debts')
                    : t('shared.simplify_debts', { count: simplified.length })}
                </p>
              </button>
            )}

            {visibleDebts.map((debt, i) => (
              <div key={i} className="bg-surface-container rounded-xl p-4 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm text-on-surface">
                      {debt.debtorName} → {debt.creditorName}
                    </p>
                    <p className="text-xs text-on-surface-faint">
                      {formatMoney(debt.amountCents, trip.baseCurrency)}
                    </p>
                  </div>
                  <button
                    onClick={() => openSettleSheet(debt)}
                    className="px-3 py-1.5 rounded-lg bg-success/20 text-success text-xs font-medium btn-press"
                  >
                    {t('shared.settle')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* GAP-032: settle confirmation with partial amount */}
      <BottomSheet
        open={settleTarget !== null}
        onClose={() => setSettleTarget(null)}
        title={t('shared.settle_confirm_title')}
      >
        {settleTarget && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-on-surface-dim">
              {t('shared.settle_confirm_body', {
                debtor: settleTarget.debtorName,
                creditor: settleTarget.creditorName,
                amount: formatMoney(settleTarget.amountCents, trip.baseCurrency),
              })}
            </p>
            <div>
              <label className="text-xs text-on-surface-faint mb-1 block">
                {t('shared.settle_amount_label')}
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full tabular"
              />
              {settleAmountCents !== null && settleAmountCents < settleTarget.amountCents && (
                <p className="text-[10px] text-on-surface-faint mt-1">
                  {t('shared.settle_partial_hint', {
                    remaining: formatMoney(settleTarget.amountCents - settleAmountCents, trip.baseCurrency),
                  })}
                </p>
              )}
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setSettleTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleConfirmSettle}
                disabled={settleAmountCents === null}
                className="flex-1 py-2.5 rounded-xl bg-success/20 text-success font-medium text-sm btn-press disabled:opacity-40"
              >
                {t('shared.settle')}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* DEC-102 (R-25): itemized statement — where each cent came from */}
      <BottomSheet
        open={statementTarget !== null}
        onClose={() => setStatementTarget(null)}
        title={statementTarget?.nickname ?? statementTarget?.name ?? ''}
      >
        {statementTarget && (() => {
          const owner = participants.find((p) => p.isOwner);
          if (!owner) return null;
          const statement = buildParticipantStatement(
            statementTarget.id,
            transactions,
            shares,
            participants,
            settlements,
            owner.id,
          );
          const statusStyle: Record<string, string> = {
            pending: 'bg-warning/15 text-warning',
            confirmed: 'bg-success/20 text-success',
            rejected: 'bg-error/15 text-error',
          };
          const lineLabel = (line: (typeof statement.lines)[number]): string => {
            const sub = findSubcategory(line.subcategoryId);
            if (sub) return t(sub.labelKey as never);
            if (line.description) return line.description;
            if (line.category) return t(`categories.${line.category}` as never);
            return t('shared.statement_unnamed');
          };
          return (
            <div className="flex flex-col gap-3">
              <p
                className={`text-lg font-extrabold tabular ${
                  statement.netCents < 0
                    ? 'text-error'
                    : statement.netCents > 0
                      ? 'text-success'
                      : 'text-on-surface-dim'
                }`}
              >
                {statement.netCents < 0
                  ? t('shared.balance_owes', {
                      amount: formatMoney(Math.abs(statement.netCents), trip.baseCurrency),
                    })
                  : statement.netCents > 0
                    ? t('shared.balance_owed', {
                        amount: formatMoney(statement.netCents, trip.baseCurrency),
                      })
                    : t('shared.balance_zero')}
              </p>

              {statement.lines.length === 0 && statement.settlements.length === 0 && (
                <p className="text-sm text-on-surface-dim">{t('shared.statement_empty')}</p>
              )}

              {statement.lines.length > 0 && (
                <div className="flex flex-col gap-1.5 max-h-[40vh] overflow-y-auto no-scrollbar">
                  {statement.lines.map((line, i) => (
                    <div key={i} className="bg-surface-high rounded-xl px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-on-surface truncate">
                          {lineLabel(line)}
                        </p>
                        <p
                          className={`text-xs font-bold tabular shrink-0 ${
                            line.kind === 'owes' ? 'text-error' : 'text-success'
                          }`}
                        >
                          {line.kind === 'owes' ? '−' : '+'}
                          {formatMoney(line.amountCents, trip.baseCurrency)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <p className="text-[10px] text-on-surface-faint truncate">
                          {formatShortDate(line.occurredAt)} ·{' '}
                          {line.kind === 'owes'
                            ? t('shared.statement_paid_by', { name: line.counterpartyName })
                            : t('shared.statement_owes_you', { name: line.counterpartyName })}
                        </p>
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${statusStyle[line.confirmationStatus]}`}
                        >
                          {t(`shared.status_${line.confirmationStatus}` as never)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {statement.settlements.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-on-surface-faint mb-1.5">
                    {t('shared.settlements_done')}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {statement.settlements.map((s) => (
                      <div
                        key={s.id}
                        className="bg-surface-high rounded-xl px-3 py-2 flex items-center justify-between"
                      >
                        <p className="text-[10px] text-on-surface-faint">
                          {formatShortDate(s.settledAt)} ·{' '}
                          {s.debtorParticipantId === statementTarget.id
                            ? t('shared.statement_settled_out')
                            : t('shared.statement_settled_in')}
                        </p>
                        <p className="text-xs font-bold tabular text-success">
                          {formatMoney(s.amountCents, s.currency)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* R4 P2P: retroactive pairing + statement push (DEC-105/106) */}
              {!statementTarget.isOwner && statementTarget.linkedActorId === null && (
                <button
                  onClick={() => {
                    setLinkTarget(statementTarget);
                    setStatementTarget(null);
                  }}
                  className="w-full py-3 rounded-xl flex items-center justify-center gap-2 btn-press font-semibold text-sm"
                  style={{ background: '#C75B3918', color: 'var(--primary)', border: '1px dashed #C75B3940' }}
                >
                  <Icon name="link" size={18} className="text-primary" />
                  {t('sync.connect_by_qr')}
                </button>
              )}
              {!statementTarget.isOwner && statementTarget.linkedActorId !== null && (
                <button
                  onClick={() => {
                    setSendTarget(statementTarget);
                    setStatementTarget(null);
                    setStatementQrText(null);
                  }}
                  className="w-full py-3 rounded-xl bg-primary text-on-surface font-semibold text-sm flex items-center justify-center gap-2 btn-press"
                >
                  <Icon name="send" size={18} />
                  {t('sync.send_statement', {
                    name: statementTarget.nickname ?? statementTarget.name,
                  })}
                </button>
              )}
            </div>
          );
        })()}
      </BottomSheet>

      {/* DEC-105: my identity QR */}
      <BottomSheet open={showMyQr} onClose={() => setShowMyQr(false)} title={t('sync.my_qr')}>
        <div className="flex flex-col gap-3">
          <QrCodeDisplay value={myIdentityQr} />
          <p className="text-xs text-on-surface-dim text-center">{t('sync.my_qr_hint')}</p>
        </div>
      </BottomSheet>

      {/* DEC-105: add participant by scanning their identity QR */}
      <BottomSheet open={showQrAdd} onClose={() => setShowQrAdd(false)} title={t('sync.add_by_qr')}>
        {showQrAdd && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-on-surface-dim">{t('sync.scan_hint')}</p>
            <QrScanner onScan={handlePairScan} />
          </div>
        )}
      </BottomSheet>

      {/* DEC-105: retroactive link of an existing participant */}
      <BottomSheet
        open={linkTarget !== null}
        onClose={() => setLinkTarget(null)}
        title={t('sync.connect_by_qr')}
      >
        {linkTarget && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-on-surface-dim">{t('sync.scan_hint')}</p>
            <QrScanner onScan={handleLinkScan} />
          </div>
        )}
      </BottomSheet>

      {/* DEC-106 (P2P-12): send statement to the paired device */}
      <BottomSheet
        open={sendTarget !== null}
        onClose={() => {
          setSendTarget(null);
          setStatementQrText(null);
        }}
        title={
          sendTarget
            ? t('sync.send_statement', { name: sendTarget.nickname ?? sendTarget.name })
            : ''
        }
      >
        {sendTarget && statementQrText && (
          <div className="flex flex-col gap-3">
            <QrCodeDisplay value={statementQrText} />
            <p className="text-xs text-on-surface-dim text-center">{t('sync.scan_hint')}</p>
            <button
              onClick={() => {
                setSendTarget(null);
                setStatementQrText(null);
              }}
              className="w-full py-3 rounded-xl bg-primary text-on-surface text-sm font-medium btn-press"
            >
              {t('common.close')}
            </button>
          </div>
        )}
        {sendTarget && !statementQrText && (
          <div className="flex flex-col gap-3">
            {/* FIELD item 8: async delivery — drop the statement in the peer's
                encrypted mailbox so they get it whenever they next open the app. */}
            {peerLinkFor(sendTarget.id)?.publicKey && (
              <button
                onClick={() => handleSendViaMailbox(sendTarget)}
                disabled={mailboxSending}
                className="w-full py-3 rounded-xl bg-surface-high text-on-surface text-sm font-semibold btn-press flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Icon name="mail" size={18} className="text-primary" />
                {t('mailbox.send_statement')}
              </button>
            )}
            <SyncTransferFlow
              mode="send"
              purpose="statement"
              actorName={ownerParticipant?.name ?? settings?.deviceName ?? 'TripPilot'}
              buildPayload={async () => {
                const payload = buildStatementForParticipant(sendTarget);
                if (!payload) throw new Error('statement_unavailable');
                return { kind: 'statement', payload };
              }}
              onSent={async (session) => {
                // The mirror flushes its queued answers on this same session.
                try {
                  const items = await waitForResponses(session, 30_000);
                  session.send({ t: 'ack', ok: true, error: null });
                  if (items.length > 0) {
                    const applied = await applyPeerResponses(sendTarget.id, items);
                    if (applied > 0) {
                      showToast(
                        t('sync.responses_applied', {
                          count: applied,
                          name: sendTarget.nickname ?? sendTarget.name,
                        }),
                        'success',
                      );
                    }
                  }
                } catch {
                  // Peer sent no responses — statement still delivered.
                }
                await reload();
              }}
              onDone={() => {
                setSendTarget(null);
                showToast(t('sync.statement_sent'), 'success');
              }}
              onCancel={() => setSendTarget(null)}
            />
            {(() => {
              const payload = buildStatementForParticipant(sendTarget);
              if (!payload) return null;
              const encoded = encodeQrPayload({ v: 1, kind: 'statement', data: payload });
              if (!fitsInSingleQr(encoded)) return null;
              return (
                <button
                  onClick={() => setStatementQrText(encoded)}
                  className="text-xs text-primary btn-press mx-auto"
                >
                  {t('sync.show_as_qr')}
                </button>
              );
            })()}
          </div>
        )}
      </BottomSheet>

      {debtSummary && debtSummary.debts.length === 0 && (
        <div className="bg-surface-container rounded-xl p-6 text-center">
          <Icon name="handshake" size={32} className="text-success mx-auto mb-2" />
          <p className="text-sm text-on-surface-dim">{t('shared.all_settled')}</p>
        </div>
      )}

      {settlements.length > 0 && (
        <div>
          <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
            {t('shared.settlements_done')}
          </p>
          {settlements.map((s) => (
            <div key={s.id} className="bg-surface-container rounded-xl px-4 py-3 mb-1 flex items-center justify-between">
              <p className="text-sm text-on-surface">
                {participants.find((p) => p.id === s.debtorParticipantId)?.name} → {participants.find((p) => p.id === s.creditorParticipantId)?.name}
              </p>
              <p className="text-sm font-semibold tabular text-success">
                {formatMoney(s.amountCents, s.currency)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
