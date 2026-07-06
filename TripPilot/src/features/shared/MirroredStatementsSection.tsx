import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MirroredStatement, MirroredLine } from '@/domain/types/mirrored-statement';
import { mirroredStatementRepository } from '@/data/repositories';
import { connectShareSignal, type ShareSignalHandle } from '@/data/sync';
import {
  answerMirroredStatementLine,
  answerAndPushShareLine,
  proposeSettlement,
  refreshSharedLink,
  purgeSelfMirroredStatements,
} from '@/domain/orchestrators';
import { getInstallationId } from '@/utils/entity-factory';
import { formatMoney } from '@/domain/money';
import { formatShortDate } from '@/domain/dates';
import { findSubcategory } from '@/domain/outing';
import {
  sharedPaymentMethodsForCurrencies,
  PAYMENT_METHOD_ICONS,
  type SharedPaymentMethod,
} from '@/domain/payment';
import { GroupImage, ImageLightbox } from '@/features/group-split/GroupImage';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { showToast } from '@/components/Toast';

// DEC-402 (G3): the per-item place reuses the lazy, code-split Leaflet field
// (DEC-398). It mounts only when the guest taps "ver local", so a statement with
// many items never spins up dozens of maps.
const ExpenseLocationMapField = lazy(() =>
  import('@/features/location/ExpenseLocationMap').then((m) => ({
    default: m.ExpenseLocationMapField,
  })),
);

/**
 * DEC-106 mirror side (P2P-13): read-only statements received from paired
 * owner devices. Pending lines can be confirmed/rejected — answers queue in
 * pendingResponses and flush on the next session with that peer. The
 * received-at timestamp is ALWAYS visible (council HIGH risk).
 */
export function MirroredStatementsSection() {
  const { t } = useTranslation();
  const [statements, setStatements] = useState<MirroredStatement[]>([]);
  const [target, setTarget] = useState<MirroredStatement | null>(null);
  const [busy, setBusy] = useState(false);
  // DEC-476 — full-screen viewer for an item's photo (resolved URL).
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  // DEC-207 S7 — one live signal per share-origin statement (keyed by shareId).
  const signalsRef = useRef<Map<string, ShareSignalHandle>>(new Map());

  const load = async () => {
    // G2 guard — drop any self-mirror residue (owner once opened his own link)
    // before rendering, so "you owe yourself" can never show up here.
    await purgeSelfMirroredStatements(getInstallationId());
    const all = await mirroredStatementRepository.getAll();
    setStatements(all.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)));
  };

  useEffect(() => {
    void load();
  }, []);

  // DEC-207 S7 — owner re-published this statement: re-pull it live and notify
  // ("Fulano atualizou os gastos com você"). Best-effort over the async floor.
  const onLiveUpdate = async (shareId: string) => {
    const all = await mirroredStatementRepository.getAll();
    const statement = all.find((s) => s.share?.shareId === shareId);
    if (!statement) return;
    const result = await refreshSharedLink(statement);
    if (result.status === 'ok') {
      showToast(t('shareLink.live_update', { name: statement.peerName }), 'info');
      await load();
      setTarget((cur) => (cur && cur.id === result.statement.id ? result.statement : cur));
    } else if (result.status === 'revoked') {
      showToast(t('shareLink.revoked_guest'), 'info');
      await load();
    }
  };

  // Keep exactly one live socket per share-origin statement; open new ones,
  // drop sockets whose statement is gone, and tear everything down on unmount.
  useEffect(() => {
    const sockets = signalsRef.current;
    const shareStatements = statements.filter((s) => s.share?.shareId);
    const wanted = new Set(shareStatements.map((s) => s.share!.shareId));
    for (const [shareId, handle] of sockets) {
      if (!wanted.has(shareId)) {
        handle.close();
        sockets.delete(shareId);
      }
    }
    for (const statement of shareStatements) {
      const shareId = statement.share!.shareId;
      if (sockets.has(shareId)) continue;
      sockets.set(
        shareId,
        connectShareSignal(shareId, (msg) => {
          if (msg.t === 'upd') void onLiveUpdate(shareId);
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statements]);

  useEffect(
    () => () => {
      for (const handle of signalsRef.current.values()) handle.close();
      signalsRef.current.clear();
    },
    [],
  );

  // EPIC B — resilience: mobile drops the live socket while backgrounded, so a
  // peer can miss an owner 'upd'. On returning to the foreground, silently
  // re-pull every share-origin statement so what the owner sent is current the
  // instant the app is reopened (mirrors the live-table foreground re-sync).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void (async () => {
        const all = await mirroredStatementRepository.getAll();
        const shareStatements = all.filter((s) => s.share?.shareId);
        if (shareStatements.length === 0) return;
        let changed = false;
        for (const statement of shareStatements) {
          const result = await refreshSharedLink(statement);
          if (result.status === 'ok') {
            changed = true;
            setTarget((cur) => (cur && cur.id === result.statement.id ? result.statement : cur));
          }
        }
        if (changed) await load();
      })();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAnswer = async (shareId: string, status: 'confirmed' | 'rejected') => {
    if (!target) return;
    // DEC-207 — a link-origin statement pushes the answer to the share channel
    // now; a QR/mailbox one queues it for the next pairing session.
    if (target.share) {
      const result = await answerAndPushShareLine(target.id, shareId, status);
      if (result) {
        setTarget(result.statement);
        showToast(result.pushed ? t('shareLink.response_sent') : t('sync.responses_queued'), 'success');
        // DEC-207 S7 — nudge the owner to pull live (best-effort).
        if (result.pushed) signalsRef.current.get(target.share.shareId)?.send({ t: 'resp' });
        await load();
      }
      return;
    }
    const updated = await answerMirroredStatementLine(target.id, shareId, status);
    if (updated) {
      setTarget(updated);
      showToast(t('sync.responses_queued'), 'success');
      await load();
    }
  };

  // DEC-207 — guest declares "I paid the whole net"; the owner confirms it.
  const handleSettle = async () => {
    if (!target || busy) return;
    setBusy(true);
    try {
      const result = await proposeSettlement(target.id);
      if (result) {
        showToast(result.pushed ? t('shareLink.paid_sent') : t('shareLink.paid_offline'),
          result.pushed ? 'success' : 'info');
        // DEC-207 S7 — nudge the owner to pull the settle proposal live.
        if (result.pushed && target.share) signalsRef.current.get(target.share.shareId)?.send({ t: 'resp' });
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  // DEC-207 — re-pull the latest statement for a link the owner may have updated.
  const handleRefresh = async () => {
    if (!target?.share || busy) return;
    setBusy(true);
    try {
      const result = await refreshSharedLink(target);
      if (result.status === 'ok') {
        setTarget(result.statement);
        showToast(t('shareLink.updated'), 'success');
        await load();
      } else if (result.status === 'revoked') {
        showToast(t('shareLink.revoked_guest'), 'info');
      } else {
        showToast(t('shareLink.error'), 'danger');
      }
    } finally {
      setBusy(false);
    }
  };

  if (statements.length === 0) return null;

  const netText = (netCents: number, currency: string): { text: string; tone: string } => {
    if (netCents < 0) {
      return {
        text: t('sync.net_you_owe', { amount: formatMoney(Math.abs(netCents), currency) }),
        tone: 'text-error',
      };
    }
    if (netCents > 0) {
      return {
        text: t('sync.net_owes_you', { amount: formatMoney(netCents, currency) }),
        tone: 'text-success',
      };
    }
    return { text: t('sync.net_settled'), tone: 'text-on-surface-faint' };
  };

  // DEC-474 — when per-currency nets ride the payload they are the display
  // truth: one part per currency, never converted ("você deve R$ 380,00 ·
  // te deve € 12,00"). Older statements fall back to the scalar headline.
  const netBuckets = (
    nets: { currency: string; amountCents: number }[] | null | undefined,
  ): { text: string; tone: string } | null => {
    const open = (nets ?? []).filter((b) => b.amountCents !== 0);
    if (open.length === 0) return null;
    return {
      text: open
        .map((b) =>
          b.amountCents < 0
            ? t('sync.net_you_owe', { amount: formatMoney(Math.abs(b.amountCents), b.currency) })
            : t('sync.net_owes_you', { amount: formatMoney(b.amountCents, b.currency) }),
        )
        .join(' · '),
      tone: open.every((b) => b.amountCents < 0)
        ? 'text-error'
        : open.every((b) => b.amountCents > 0)
          ? 'text-success'
          : 'text-warning',
    };
  };

  const netLabel = (statement: MirroredStatement): { text: string; tone: string } =>
    netBuckets(statement.nets) ?? netText(statement.netCents, statement.currency);

  // DEC-476 — the currencies the guest still OWES (negative buckets; scalar
  // fallback for older statements). Drives which payment methods are shown.
  const owedCurrencies = (statement: MirroredStatement): string[] => {
    if (statement.nets && statement.nets.length > 0) {
      return statement.nets.filter((b) => b.amountCents < 0).map((b) => b.currency);
    }
    return statement.netCents < 0 ? [statement.currency] : [];
  };

  // DEC-476 — "how to pay {owner}": only when the guest owes something, only
  // the methods that can receive an owed currency.
  const payMethods = (statement: MirroredStatement): SharedPaymentMethod[] => {
    const methods = statement.paymentMethods ?? [];
    if (methods.length === 0) return [];
    const owed = owedCurrencies(statement);
    if (owed.length === 0) return [];
    return sharedPaymentMethodsForCurrencies(methods, owed);
  };

  const copyMethodValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast(t('payment.value_copied'), 'success');
    } catch {
      showToast(t('sync.link_copy_failed'), 'danger');
    }
  };

  const lineLabel = (line: MirroredStatement['lines'][number]): string => {
    const sub = findSubcategory(line.subcategoryId);
    if (sub) return t(sub.labelKey as never);
    if (line.description) return line.description;
    if (line.category) return t(`categories.${line.category}` as never);
    return t('shared.statement_unnamed');
  };

  const statusStyle: Record<string, string> = {
    pending: 'bg-warning/15 text-warning',
    confirmed: 'bg-success/20 text-success',
    rejected: 'bg-error/15 text-error',
  };

  return (
    <div>
      <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
        {t('sync.received_statements')}
      </p>
      {statements.map((statement) => {
        const net = netLabel(statement);
        return (
          <button
            key={statement.id}
            onClick={() => setTarget(statement)}
            className="bg-surface-container rounded-xl px-4 py-3 mb-1 flex items-center gap-3 w-full text-left btn-press"
          >
            <Icon name="sync_alt" size={20} className="text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-on-surface truncate">{statement.peerName}</p>
              <p className="text-[10px] text-on-surface-faint">
                {t('sync.received_at', { date: formatShortDate(statement.receivedAt) })}
              </p>
            </div>
            <p className={`text-xs font-semibold tabular shrink-0 ${net.tone}`}>{net.text}</p>
            <Icon name="chevron_right" size={16} className="text-on-surface-faint shrink-0" />
          </button>
        );
      })}

      <BottomSheet
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target?.peerName ?? ''}
      >
        {target && (
          <div className="flex flex-col gap-3">
            <p className={`text-lg font-extrabold tabular ${netLabel(target).tone}`}>
              {netLabel(target).text}
            </p>
            {/* Timestamp always visible — a mirrored statement without a date breeds distrust */}
            <p className="text-[10px] text-on-surface-faint -mt-2">
              {t('sync.received_at', { date: formatShortDate(target.receivedAt) })}
            </p>

            {target.lines.length === 0 && (
              <p className="text-sm text-on-surface-dim">{t('shared.statement_empty')}</p>
            )}

            <div className="flex flex-col gap-1.5 max-h-[45vh] overflow-y-auto no-scrollbar">
              {target.lines.map((line) => (
                <div key={line.shareId} className="bg-surface-high rounded-xl px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-on-surface truncate">{lineLabel(line)}</p>
                    <p
                      className={`text-xs font-bold tabular shrink-0 ${
                        line.kind === 'owes' ? 'text-error' : 'text-success'
                      }`}
                    >
                      {line.kind === 'owes' ? '−' : '+'}
                      {/* DEC-474 — the line's ORIGINAL currency wins. */}
                      {formatMoney(line.amountCents, line.currency ?? target.currency)}
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
                  {/* DEC-476 — the item's photo (tap to zoom/download). */}
                  {line.image && (
                    <GroupImage
                      imageRef={line.image}
                      alt={lineLabel(line)}
                      className="mt-1.5 h-16 w-16 rounded-lg"
                      onOpen={(url) => setLightboxUrl(url)}
                    />
                  )}
                  {/* DEC-402 — each item's place/detail (map on demand). */}
                  <MirroredLinePlace line={line} />
                  {line.confirmationStatus === 'pending' && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleAnswer(line.shareId, 'confirmed')}
                        className="flex-1 py-1.5 rounded-lg bg-success/20 text-success text-xs font-medium btn-press"
                      >
                        {t('common.confirm')}
                      </button>
                      <button
                        onClick={() => handleAnswer(line.shareId, 'rejected')}
                        className="flex-1 py-1.5 rounded-lg bg-error/15 text-error text-xs font-medium btn-press"
                      >
                        {t('sync.reject')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* DEC-402 — payments mirrored as lines so items + payments reconcile
                to the headline net (the €20 paid is no longer invisible). */}
            {target.settlements && target.settlements.length > 0 && (
              <div>
                <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-on-surface-faint mb-1.5">
                  {t('shared.settlements_done')}
                </p>
                <div className="flex flex-col gap-1.5">
                  {target.settlements.map((s) => (
                    <div
                      key={s.settlementId}
                      className="bg-surface-high rounded-xl px-3 py-2 flex items-center justify-between gap-2"
                    >
                      <p className="text-[10px] text-on-surface-faint truncate">
                        {formatShortDate(s.settledAt)} ·{' '}
                        {s.kind === 'paid'
                          ? t('shared.statement_you_paid')
                          : t('shared.statement_paid_you', { name: target.peerName })}
                      </p>
                      <p
                        className={`text-xs font-bold tabular shrink-0 ${
                          s.kind === 'paid' ? 'text-success' : 'text-error'
                        }`}
                      >
                        {s.kind === 'paid' ? '+' : '−'}
                        {formatMoney(s.amountCents, s.currency ?? target.currency)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {target.pendingResponses.length > 0 && (
              <p className="text-[10px] text-on-surface-faint">{t('sync.responses_queued')}</p>
            )}

            {/* DEC-476 — how to pay the owner, filtered to the currencies the
                guest owes (a BRL debt shows the Pix key, not a EUR-only IBAN). */}
            {payMethods(target).length > 0 && (
              <div className="bg-surface-high rounded-xl p-3">
                <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-on-surface-faint mb-1.5">
                  {t('shareLink.pay_methods_title', { name: target.peerName })}
                </p>
                <div className="flex flex-col gap-1.5">
                  {payMethods(target).map((method, index) => (
                    <div key={`${method.kind}-${index}`} className="flex items-center gap-2">
                      <Icon
                        name={PAYMENT_METHOD_ICONS[method.kind]}
                        size={16}
                        className="text-primary shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-on-surface-faint truncate">
                          {method.label.trim() !== ''
                            ? method.label
                            : t(`payment.kind_${method.kind}` as never)}
                          {(method.currencies ?? []).length > 0 &&
                            ` · ${(method.currencies ?? []).join(', ')}`}
                        </p>
                        <p className="text-xs text-on-surface break-all leading-snug">
                          {method.value}
                        </p>
                      </div>
                      <button
                        onClick={() => void copyMethodValue(method.value)}
                        className="btn-press w-8 h-8 rounded-lg flex items-center justify-center bg-surface-container shrink-0"
                        aria-label={t('payment.copy_value')}
                      >
                        <Icon name="content_copy" size={14} className="text-on-surface-dim" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DEC-399 — debts the owner recorded with OTHER people: display-only,
                collapsed, and explicitly out of the settle-up between us. */}
            {target.thirdParty && target.thirdParty.length > 0 && (
              <details className="rounded-xl border border-outline/30">
                <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-on-surface-dim flex items-center gap-1.5">
                  <Icon name="group" size={14} className="text-on-surface-faint" />
                  {t('sync.third_party_toggle', {
                    name: target.peerName,
                    count: target.thirdParty.length,
                  })}
                </summary>
                <div className="flex flex-col gap-2 px-3 pb-3 pt-0">
                  <p className="text-[10px] text-on-surface-faint leading-snug">
                    {t('sync.third_party_hint', { name: target.peerName })}
                  </p>
                  {target.thirdParty.map((group) => {
                    const groupNet =
                      netBuckets(group.nets) ?? netText(group.netCents, target.currency);
                    return (
                      <div key={group.counterpartyId} className="bg-surface-high rounded-xl px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-on-surface truncate">
                            {group.counterpartyName}
                          </p>
                          <p className={`text-xs font-bold tabular shrink-0 ${groupNet.tone}`}>
                            {groupNet.text}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 mt-1.5">
                          {group.lines.map((line) => (
                            <div
                              key={line.shareId}
                              className="flex items-center justify-between gap-2"
                            >
                              <p className="text-[10px] text-on-surface-faint truncate">
                                {formatShortDate(line.occurredAt)} · {lineLabel(line)}
                              </p>
                              <p
                                className={`text-[10px] font-semibold tabular shrink-0 ${
                                  line.kind === 'owes' ? 'text-error' : 'text-success'
                                }`}
                              >
                                {line.kind === 'owes' ? '−' : '+'}
                                {formatMoney(line.amountCents, line.currency ?? target.currency)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}

            {/* DEC-207 — link-origin actions: declare "I paid" + re-pull updates */}
            {target.share && (
              <div className="flex flex-col gap-2 pt-1">
                {/* DEC-474 — owed when ANY currency bucket is negative. */}
                {(target.nets
                  ? target.nets.some((b) => b.amountCents < 0)
                  : target.netCents < 0) && (
                  <button
                    onClick={handleSettle}
                    disabled={busy}
                    className="w-full py-3 rounded-xl bg-success/20 text-success font-bold text-sm flex items-center justify-center gap-2 btn-press disabled:opacity-50"
                  >
                    <Icon name="check_circle" size={18} />
                    {t('shareLink.mark_paid')}
                  </button>
                )}
                <button
                  onClick={handleRefresh}
                  disabled={busy}
                  className="w-full py-2.5 rounded-xl bg-surface-high text-on-surface text-xs font-semibold flex items-center justify-center gap-1.5 btn-press disabled:opacity-50"
                >
                  <Icon name="sync" size={16} className="text-primary" />
                  {t('shareLink.refresh_guest')}
                </button>
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      {/* DEC-476 — item photo viewer (zoom + download). */}
      {lightboxUrl && <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  );
}

/**
 * DEC-402 (G3): one item's place inside a received statement — the label, and (when
 * the owner shared coordinates) a "ver local" toggle that lazy-mounts the Leaflet
 * mini-map only on demand. Renders nothing when the item has no place at all.
 */
function MirroredLinePlace({ line }: { line: MirroredLine }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const hasCoords = line.latitude != null && line.longitude != null;
  const label = line.placeLabel ?? null;
  if (!hasCoords && !label) return null;

  return (
    <div className="mt-1.5">
      {hasCoords ? (
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary btn-press"
        >
          <Icon name={open ? 'expand_less' : 'place'} size={12} className="text-primary" />
          {label ?? t('shared.statement_view_place')}
        </button>
      ) : (
        <span className="inline-flex items-center gap-1 text-[10px] text-on-surface-faint">
          <Icon name="place" size={12} className="text-on-surface-faint" />
          {label}
        </span>
      )}
      {hasCoords && open && (
        <div className="mt-1.5 h-40">
          <Suspense
            fallback={<div className="w-full h-40 rounded-xl bg-surface-container animate-pulse" />}
          >
            <ExpenseLocationMapField
              lat={line.latitude as number}
              lng={line.longitude as number}
              label={label ?? t('expenses.location_label')}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
