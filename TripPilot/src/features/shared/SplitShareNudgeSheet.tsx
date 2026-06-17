import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import type { Participant } from '@/domain/types/participant';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';

interface SplitShareNudgeSheetProps {
  open: boolean;
  /** Non-owner participants who just got a slice — the people to notify. */
  participants: Participant[];
  /** Dismiss without sharing (caller decides where to go next). */
  onClose: () => void;
}

/**
 * B5 — after a split, nudge the owner to send each person their shared `/s`
 * link so the slice lands on the other phone (sideload-first, no FCM). Tapping a
 * person routes to the Shared screen with that participant pre-selected, where
 * the existing ShareLinkSheet generates and shares the link with a ready-made
 * message. Reuses the whole `/s` infrastructure — this is only the prompt.
 */
export function SplitShareNudgeSheet({ open, participants, onClose }: SplitShareNudgeSheetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const shareWith = (participant: Participant) => {
    navigate('/shared', { state: { shareWithParticipantId: participant.id } });
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={t('shareLink.nudge_title')}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-on-surface-dim">{t('shareLink.nudge_body')}</p>
        <div className="flex flex-col gap-2">
          {participants.map((participant) => (
            <button
              key={participant.id}
              onClick={() => shareWith(participant)}
              className="w-full py-3 rounded-xl bg-primary text-on-surface font-semibold text-sm flex items-center justify-center gap-2 btn-press"
            >
              <Icon name="ios_share" size={18} />
              {t('shareLink.nudge_share_with', {
                name: participant.nickname ?? participant.name,
              })}
            </button>
          ))}
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
