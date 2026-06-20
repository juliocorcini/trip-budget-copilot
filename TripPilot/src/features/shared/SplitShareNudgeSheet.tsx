import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import type { Participant } from '@/domain/types/participant';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';
import { formatMoney } from '@/domain/money';
import { shareOrCopyText } from '@/utils/native/link-share';
import { useRemindMessage } from '@/features/shared/useRemindMessage';

interface SplitShareNudgeSheetProps {
  open: boolean;
  /** Non-owner participants who just got a slice — the people to notify. */
  participants: Participant[];
  /** DL-5: per-participant owed amount (cents), enabling the "Lembrar" message. */
  amountByParticipantId?: Map<string, number>;
  /** Trip base currency — required for the reminder amount. */
  currency?: string;
  /** Trip name woven into the reminder message. */
  tripName?: string;
  /** Dismiss without sharing (caller decides where to go next). */
  onClose: () => void;
}

/**
 * B5 — after a split, nudge the owner to send each person their shared `/s`
 * link so the slice lands on the other phone (sideload-first, no FCM). Tapping
 * "Enviar link" routes to the Shared screen with that participant pre-selected,
 * where the existing ShareLinkSheet generates and shares the link.
 *
 * DL-5 (G3): the same moment is the natural "cobrar" point — for each debtor we
 * also offer **Lembrar**, a ready-to-send "você me deve {amount}" message via
 * the OS share sheet (clipboard fallback). Reuses the `shared.remind_*` copy so
 * the wording matches the settle-up hub.
 */
export function SplitShareNudgeSheet({
  open,
  participants,
  amountByParticipantId,
  currency,
  tripName,
  onClose,
}: SplitShareNudgeSheetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const buildRemindMessage = useRemindMessage();

  const shareWith = (participant: Participant) => {
    navigate('/shared', { state: { shareWithParticipantId: participant.id } });
  };

  const remind = async (participant: Participant) => {
    const cents = amountByParticipantId?.get(participant.id);
    if (cents === undefined || cents <= 0 || !currency) return;
    const name = participant.nickname ?? participant.name;
    const amount = formatMoney(cents, currency);
    const message = buildRemindMessage({ name, amount, tripName });
    const outcome = await shareOrCopyText(message, t('shared.remind_share_title'));
    if (outcome === 'copied') showToast(t('shared.remind_copied'), 'success');
    else if (outcome === 'copy_failed') showToast(t('sync.link_copy_failed'), 'danger');
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={t('shareLink.nudge_title')}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-on-surface-dim">{t('shareLink.nudge_body')}</p>
        <div className="flex flex-col gap-2">
          {participants.map((participant) => {
            const cents = amountByParticipantId?.get(participant.id);
            const canRemind = cents !== undefined && cents > 0 && !!currency;
            return (
              <div
                key={participant.id}
                className="flex items-center gap-2 bg-surface-container rounded-xl p-3"
              >
                <Icon name="person" size={18} className="text-on-surface-faint shrink-0" />
                <p className="text-sm font-semibold text-on-surface flex-1 truncate">
                  {participant.nickname ?? participant.name}
                </p>
                <button
                  onClick={() => shareWith(participant)}
                  className="px-2.5 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-medium flex items-center gap-1 btn-press shrink-0"
                >
                  <Icon name="ios_share" size={14} />
                  {t('shareLink.nudge_send_link')}
                </button>
                {canRemind && (
                  <button
                    onClick={() => remind(participant)}
                    className="px-2.5 py-1.5 rounded-lg bg-surface-high text-on-surface text-xs font-medium flex items-center gap-1 btn-press shrink-0"
                  >
                    <Icon name="notifications" size={14} />
                    {t('shared.remind')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <button
          onClick={onClose}
          className="text-xs text-on-surface-dim btn-press mx-auto mt-1"
        >
          {t('shareLink.nudge_later')}
        </button>
      </div>
    </BottomSheet>
  );
}
