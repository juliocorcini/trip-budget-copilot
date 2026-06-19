import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createShareLink,
  refreshShareLink,
  revokeShareLink,
  pullShareResponses,
} from '@/domain/orchestrators';
import { connectShareSignal, type ShareSignalHandle } from '@/data/sync';
import { shareLinkRepository, settlementRepository } from '@/data/repositories';
import { createSettlement } from '@/domain/splitting';
import type { StatementPayload } from '@/domain/sync';
import type { ShareLink } from '@/domain/types/share-link';
import type { ShareSettleProposal } from '@/domain/sync';
import { formatMoney } from '@/domain/money';
import { getShareOrigin } from '@/utils/native/public-origin';
import { shareOrCopyLink } from '@/utils/native/link-share';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';

interface ShareLinkSheetProps {
  participantId: string;
  participantName: string;
  buildStatement: () => StatementPayload | null;
  tripId: string;
  ownerId: string;
  onReconciled: () => void;
}

/**
 * DEC-207 — owner control surface for a participant's shared link. No pairing
 * required (that is the whole point): generate a link, copy/share it, push
 * fresh data, pull the guest's confirm/reject + "I paid" proposals, or revoke.
 * A settle proposal is shown for explicit owner confirmation — never applied
 * automatically.
 */
export function ShareLinkSheet({
  participantId,
  participantName,
  buildStatement,
  tripId,
  ownerId,
  onReconciled,
}: ShareLinkSheetProps) {
  const { t } = useTranslation();
  const [link, setLink] = useState<ShareLink | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState<ShareSettleProposal | null>(null);
  const [proposalFrom, setProposalFrom] = useState<string | null>(null);
  // DEC-207 S7 — live signal for this link (transport only).
  const signalRef = useRef<ShareSignalHandle | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const existing = await shareLinkRepository.getActiveByParticipantId(participantId);
      if (!active) return;
      setLink(existing ?? null);
      if (existing) {
        const { buildShareUrl } = await import('@/domain/sync');
        setUrl(buildShareUrl(getShareOrigin(), existing.id, existing.key));
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [participantId]);

  // DEC-207 S7 — when the guest posts a response, the relay nudges us to pull
  // it live. A short delay absorbs KV read-after-write; the pull stays silent
  // on "nothing new" (it is a background nudge, not a user action).
  useEffect(() => {
    const id = link?.id;
    if (!id) return;
    const handle = connectShareSignal(id, (msg) => {
      if (msg.t === 'resp') {
        showToast(t('shareLink.live_response'), 'info');
        window.setTimeout(() => void doPull(false), 800);
      }
    });
    signalRef.current = handle;
    return () => {
      handle.close();
      signalRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link?.id]);

  const handleGenerate = async () => {
    const statement = buildStatement();
    if (!statement || busy) return;
    setBusy(true);
    try {
      const { url: newUrl, shareLink } = await createShareLink(
        participantId,
        statement,
        getShareOrigin(),
      );
      setLink(shareLink);
      setUrl(newUrl);
      showToast(t('shareLink.created'), 'success');
    } catch {
      showToast(t('shareLink.error'), 'danger');
    } finally {
      setBusy(false);
    }
  };

  // D-IMP-04: open the OS share sheet with a ready message + the correct link
  // (post D-BUG-01), falling back to the clipboard. A user cancel stays silent.
  const handleShareOrCopy = async () => {
    if (!url) return;
    const text = t('shareLink.message', { name: participantName, url });
    const outcome = await shareOrCopyLink({ text, url });
    if (outcome === 'copied') showToast(t('shareLink.copied'), 'success');
    else if (outcome === 'copy_failed') showToast(t('shareLink.copy_failed'), 'danger');
  };

  // Publishes the current statement to the link and nudges a connected guest to
  // re-pull it live. `announce` is false for the silent auto-push on open.
  const publishLatest = async (announce: boolean): Promise<boolean> => {
    if (!link) return false;
    const statement = buildStatement();
    if (!statement) return false;
    setBusy(true);
    try {
      const updated = await refreshShareLink(link, statement);
      setLink(updated);
      // DEC-207 S7 — tell a connected guest to re-pull the new revision live.
      signalRef.current?.send({ t: 'upd', rev: updated.statementRevision });
      if (announce) showToast(t('shareLink.refreshed'), 'success');
      return true;
    } catch {
      if (announce) showToast(t('shareLink.error'), 'danger');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = () => {
    if (busy) return;
    void publishLatest(true);
  };

  // EPIC B — "split with a connected user → it just sends". Opening a
  // participant's sheet that already has a link (e.g. arriving from the
  // post-split "compartilhar com {name}" nudge) silently re-publishes the
  // latest statement and signals the peer, so the new split reaches their
  // device with no manual "Atualizar" tap. Once per mount; the sheet remounts
  // per participant. No link yet → nothing to push (owner generates first).
  const autoPushedRef = useRef(false);
  useEffect(() => {
    if (!link || autoPushedRef.current) return;
    autoPushedRef.current = true;
    void publishLatest(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link?.id]);

  // `announceEmpty` is false for live (signal-triggered) pulls — a background
  // nudge should never toast "nothing new" or an error; only an explicit tap on
  // "Ver respostas" does.
  const doPull = async (announceEmpty: boolean) => {
    if (!link) return;
    setBusy(true);
    try {
      const result = await pullShareResponses(link);
      if (result.settle) {
        setProposal(result.settle);
        setProposalFrom(result.fromName);
      }
      if (result.appliedLines > 0) {
        showToast(t('shareLink.responses_applied', { count: result.appliedLines }), 'success');
        onReconciled();
      } else if (!result.settle && announceEmpty) {
        showToast(t('shareLink.no_responses'), 'info');
      }
    } catch {
      if (announceEmpty) showToast(t('shareLink.error'), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const handlePull = () => {
    if (busy) return;
    void doPull(true);
  };

  const handleConfirmSettle = async () => {
    if (!proposal) return;
    const settlement = createSettlement(
      tripId,
      participantId,
      ownerId,
      proposal.amountCents,
      proposal.currency,
    );
    await settlementRepository.create(settlement);
    setProposal(null);
    showToast(t('shareLink.settle_confirmed'), 'success');
    onReconciled();
  };

  const handleRevoke = async () => {
    if (!link || busy) return;
    setBusy(true);
    try {
      await revokeShareLink(link);
      setLink(null);
      setUrl(null);
      showToast(t('shareLink.revoked'), 'info');
    } catch {
      showToast(t('shareLink.error'), 'danger');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-on-surface-dim py-4 text-center">{t('common.loading')}</p>;
  }

  if (!link || !url) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-on-surface-dim">{t('shareLink.intro', { name: participantName })}</p>
        <button
          onClick={handleGenerate}
          disabled={busy}
          className="w-full py-3 rounded-xl bg-primary text-on-surface font-semibold text-sm flex items-center justify-center gap-2 btn-press disabled:opacity-50"
        >
          <Icon name="link" size={18} />
          {busy ? t('common.loading') : t('shareLink.generate')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {proposal && (
        <div className="bg-success/10 border border-success/30 rounded-xl p-3 flex flex-col gap-2">
          <p className="text-sm font-semibold text-on-surface">
            {t('shareLink.settle_proposal', {
              name: proposalFrom ?? participantName,
              amount: formatMoney(proposal.amountCents, proposal.currency),
            })}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setProposal(null)}
              className="flex-1 py-2 rounded-lg bg-surface-high text-on-surface-dim text-xs font-medium btn-press"
            >
              {t('common.dismiss')}
            </button>
            <button
              onClick={handleConfirmSettle}
              className="flex-1 py-2 rounded-lg bg-success/20 text-success text-xs font-bold btn-press"
            >
              {t('shareLink.settle_confirm')}
            </button>
          </div>
        </div>
      )}

      <div className="bg-surface-high rounded-xl px-3 py-2.5">
        <p className="text-[10px] text-on-surface-faint mb-1">{t('shareLink.url_label')}</p>
        <p className="text-xs text-on-surface break-all leading-snug">{url}</p>
      </div>

      <button
        onClick={handleShareOrCopy}
        className="w-full py-3 rounded-xl bg-primary text-on-surface font-semibold text-sm flex items-center justify-center gap-2 btn-press"
      >
        <Icon name="ios_share" size={18} />
        {t('shareLink.share')}
      </button>

      <div className="flex gap-2">
        <button
          onClick={handleRefresh}
          disabled={busy}
          className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface text-xs font-semibold btn-press flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <Icon name="sync" size={16} className="text-primary" />
          {t('shareLink.refresh')}
        </button>
        <button
          onClick={handlePull}
          disabled={busy}
          className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface text-xs font-semibold btn-press flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <Icon name="download" size={16} className="text-primary" />
          {t('shareLink.pull')}
        </button>
      </div>

      <button
        onClick={handleRevoke}
        disabled={busy}
        className="text-xs text-error btn-press mx-auto mt-1 disabled:opacity-50"
      >
        {t('shareLink.revoke')}
      </button>
    </div>
  );
}
