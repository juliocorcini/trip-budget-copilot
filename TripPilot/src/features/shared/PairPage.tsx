import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { parsePairIdentityFromHash } from '@/domain/sync';
import { pairParticipantFromIdentity } from '@/domain/orchestrators';
import { Icon } from '@/components/Icon';
import { LoadingScreen } from '@/components/LoadingScreen';
import { DataErrorScreen } from '@/components/DataErrorScreen';
import { showToast } from '@/components/Toast';

/**
 * F19 — `/pair#<identity>` landing. The link carries the sender's identity
 * envelope in the fragment; the recipient (an owner with a trip) confirms before
 * we pair the device into their trip. Mirrors the QR pairing flow exactly, just
 * reachable through any share channel (and, on a native build, App Links).
 */
export function PairPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { trip, participants, loading, error, retry, reload } = useAppData();
  const [pairing, setPairing] = useState(false);

  const identity = parsePairIdentityFromHash(location.hash);

  if (loading) return <LoadingScreen />;
  if (error && !trip) return <DataErrorScreen onRetry={retry} />;

  // Broken / missing payload — explain instead of silently failing.
  if (!identity) {
    return (
      <PairMessage
        icon="link_off"
        title={t('pair.invalid_title')}
        body={t('pair.invalid_body')}
        actionLabel={t('pair.go_home')}
        onAction={() => navigate('/dashboard', { replace: true })}
      />
    );
  }

  // The recipient needs a trip to pair into (the sender becomes a participant).
  if (!trip) {
    return (
      <PairMessage
        icon="luggage"
        title={t('pair.no_trip_title')}
        body={t('pair.no_trip_body')}
        actionLabel={t('pair.go_home')}
        onAction={() => navigate('/', { replace: true })}
      />
    );
  }

  const alreadyPaired = participants.some((p) => p.linkedActorId === identity.actorId);

  const handleConfirm = async () => {
    if (pairing) return;
    setPairing(true);
    try {
      const result = await pairParticipantFromIdentity(identity, trip.id);
      await reload();
      showToast(
        result.status === 'already_paired'
          ? t('sync.already_connected')
          : t('sync.pairing_done', { name: result.participant.name }),
        result.status === 'already_paired' ? 'info' : 'success',
      );
      navigate('/shared', { replace: true });
    } catch {
      showToast(t('pair.failed'), 'danger');
      setPairing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-4 pt-2">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/shared', { replace: true })}
          className="btn-press p-1"
          aria-label={t('common.back')}
        >
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('pair.title')}</h1>
      </div>

      <div className="bg-surface-container rounded-2xl p-6 flex flex-col items-center text-center gap-3">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: '#C75B3920' }}
        >
          <Icon name="link" size={28} className="text-primary" />
        </div>
        <p className="text-base font-bold text-on-surface">
          {t('pair.confirm_title', { name: identity.name })}
        </p>
        <p className="text-sm text-on-surface-dim leading-relaxed">{t('pair.confirm_body')}</p>
        {alreadyPaired && <p className="text-xs text-on-surface-faint">{t('pair.already_note')}</p>}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => navigate('/shared', { replace: true })}
          className="flex-1 py-3 rounded-xl bg-surface-high text-on-surface-dim font-semibold text-sm btn-press"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleConfirm}
          disabled={pairing}
          className="flex-1 py-3 rounded-xl bg-primary text-on-surface font-semibold text-sm btn-press disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {pairing ? (
            t('common.loading')
          ) : (
            <>
              <Icon name="link" size={18} />
              {t('pair.confirm_action')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function PairMessage({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: string;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <Icon name={icon} size={40} className="text-on-surface-faint" />
      <p className="text-base font-bold text-on-surface">{title}</p>
      <p className="text-sm text-on-surface-dim leading-relaxed max-w-xs">{body}</p>
      <button
        onClick={onAction}
        className="px-6 py-3 rounded-xl bg-primary text-on-surface font-semibold text-sm btn-press"
      >
        {actionLabel}
      </button>
    </div>
  );
}
