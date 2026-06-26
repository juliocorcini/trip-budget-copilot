import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { QrCodeDisplay } from '@/components/QrCodeDisplay';
import { QrScanner } from '@/components/QrScanner';
import { decodeQrPayload, extractQrEnvelope } from '@/domain/sync';
import type { SyncPurpose, SyncPayloadKind, HelloMessage, StatementQrPayload } from '@/domain/sync';
import { getInstallationId } from '@/utils/entity-factory';
import { APP_VERSION } from '@/utils/app-version';
import {
  hostSyncSession,
  joinSyncSession,
  createManualOffer,
  acceptManualOffer,
  SyncSession,
  sendHello,
  sendPayload,
  receivePayload,
  ManualSignalingError,
} from '@/data/sync';
import type { SyncChannel, HostedSession, ManualOfferSide } from '@/data/sync';

export interface SyncFlowResult {
  kind: SyncPayloadKind;
  payload: unknown;
  peerHello: HelloMessage | null;
  session: SyncSession;
}

interface SyncTransferFlowProps {
  mode: 'send' | 'receive';
  purpose: SyncPurpose;
  /** Display name announced to the peer (owner participant or device name). */
  actorName: string;
  /** Sender: builds the payload once the channel is up. */
  buildPayload?: () => Promise<{ kind: SyncPayloadKind; payload: unknown }>;
  /** Receiver: handles the assembled payload. Throw to surface an error state. */
  onPayloadReceived?: (result: SyncFlowResult) => Promise<void>;
  /** Sender: runs after the peer acked (same live session — e.g. wait for responses). */
  onSent?: (session: SyncSession) => Promise<void>;
  /** Receiver: handles a single-QR offline statement scan (DEC-103 level 1). */
  onStatementQr?: (payload: StatementQrPayload) => Promise<void>;
  onDone: () => void;
  onCancel: () => void;
}

type FlowStep =
  | { step: 'starting' }
  | { step: 'waiting-peer'; qrText: string }
  | { step: 'scanning' }
  | { step: 'manual-show-offer'; qrText: string }
  | { step: 'manual-scan-answer' }
  | { step: 'manual-show-answer'; qrText: string }
  | { step: 'connecting' }
  | { step: 'transferring'; done: number; total: number }
  | { step: 'finalizing' }
  | { step: 'done' }
  | { step: 'error'; messageKey: string };

/**
 * Reusable transfer flow (DEC-103/104): online session QR (worker signaling,
 * WebRTC with relay fallback) plus the offline two-QR stepper. Pure UI state
 * machine — all transport logic lives in src/data/sync.
 */
export function SyncTransferFlow({
  mode,
  purpose,
  actorName,
  buildPayload,
  onPayloadReceived,
  onSent,
  onStatementQr,
  onDone,
  onCancel,
}: SyncTransferFlowProps) {
  const { t } = useTranslation();
  const [flow, setFlow] = useState<FlowStep>(
    mode === 'send' ? { step: 'starting' } : { step: 'scanning' },
  );
  const [offline, setOffline] = useState(false);

  const hostedRef = useRef<HostedSession | null>(null);
  const manualOfferRef = useRef<ManualOfferSide | null>(null);
  const sessionRef = useRef<SyncSession | null>(null);
  const startedRef = useRef(false);
  const scanLockRef = useRef(false);

  const cleanup = useCallback(() => {
    hostedRef.current?.cancel();
    hostedRef.current = null;
    manualOfferRef.current?.destroy();
    manualOfferRef.current = null;
    sessionRef.current?.close();
    sessionRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const fail = useCallback(
    (messageKey: string) => {
      cleanup();
      setFlow({ step: 'error', messageKey });
    },
    [cleanup],
  );

  const runSender = useCallback(
    async (channel: SyncChannel) => {
      if (!buildPayload) return;
      try {
        const session = new SyncSession(channel);
        sessionRef.current = session;
        setFlow({ step: 'connecting' });
        await sendHello(session, {
          actorId: getInstallationId(),
          name: actorName,
          purpose,
          appVersion: APP_VERSION,
        });
        // R6-06: consume the receiver's hello symmetrically. Without this the
        // orphan hello stayed queued and sendPayload's expect('ack') pulled it
        // first → protocol_error → error screen on EVERY successful send.
        try {
          await session.expect('hello', 15_000);
        } catch {
          // Older peers may skip hello — the transfer still proceeds.
        }
        const { kind, payload } = await buildPayload();
        await sendPayload(session, kind, payload, (done, total) =>
          setFlow({ step: 'transferring', done, total }),
        );
        if (onSent) {
          setFlow({ step: 'finalizing' });
          await onSent(session);
        }
        session.send({ t: 'bye' });
        session.close();
        sessionRef.current = null;
        setFlow({ step: 'done' });
      } catch {
        fail('sync.error_transfer');
      }
    },
    [actorName, buildPayload, fail, onSent, purpose],
  );

  const runReceiver = useCallback(
    async (channel: SyncChannel) => {
      try {
        const session = new SyncSession(channel);
        sessionRef.current = session;
        setFlow({ step: 'connecting' });
        await sendHello(session, {
          actorId: getInstallationId(),
          name: actorName,
          purpose,
          appVersion: APP_VERSION,
        });
        let peerHello: HelloMessage | null = null;
        try {
          peerHello = await session.expect('hello', 15_000);
        } catch {
          // Older peers may skip hello — the manifest still drives the flow.
        }
        const { kind, payload } = await receivePayload(session, (done, total) =>
          setFlow({ step: 'transferring', done, total }),
        );
        setFlow({ step: 'finalizing' });
        await onPayloadReceived?.({ kind, payload, peerHello, session });
        session.close();
        sessionRef.current = null;
        setFlow({ step: 'done' });
      } catch {
        fail('sync.error_transfer');
      }
    },
    [actorName, fail, onPayloadReceived, purpose],
  );

  // Online sender: create the room and show the session QR.
  useEffect(() => {
    if (mode !== 'send' || offline || startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      try {
        const hosted = await hostSyncSession(purpose);
        hostedRef.current = hosted;
        setFlow({ step: 'waiting-peer', qrText: hosted.qrText });
        const channel = await hosted.channel;
        await runSender(channel);
      } catch {
        fail('sync.error_connection');
      }
    })();
  }, [mode, offline, purpose, runSender, fail]);

  const startOfflineSender = async () => {
    cleanup();
    setOffline(true);
    setFlow({ step: 'starting' });
    try {
      const offer = await createManualOffer();
      manualOfferRef.current = offer;
      setFlow({ step: 'manual-show-offer', qrText: offer.offerQrText });
      void offer.channelOpen.then((channel) => runSender(channel));
    } catch (err) {
      fail(
        err instanceof ManualSignalingError && err.code === 'qr_too_large'
          ? 'sync.error_qr_too_large'
          : 'sync.error_connection',
      );
    }
  };

  const handleScan = (text: string) => {
    if (scanLockRef.current) return;
    // DEC-351: a scanned statement QR is now a `/sync#…` URL; live signaling QRs
    // stay raw (no `#`) and pass through unchanged.
    const decoded = decodeQrPayload(extractQrEnvelope(text) ?? text);
    if (!decoded) return;
    scanLockRef.current = true;

    if (flow.step === 'manual-scan-answer') {
      const offer = manualOfferRef.current;
      if (decoded.kind !== 'answer' || !offer) {
        scanLockRef.current = false;
        return;
      }
      setFlow({ step: 'connecting' });
      offer.acceptAnswerQr(text).catch(() => fail('sync.error_connection'));
      return;
    }

    if (mode === 'receive' && decoded.kind === 'session') {
      setFlow({ step: 'connecting' });
      void (async () => {
        try {
          const joined = await joinSyncSession(decoded);
          const channel = await joined.channel;
          await runReceiver(channel);
        } catch {
          fail('sync.error_connection');
        }
      })();
      return;
    }

    if (mode === 'receive' && decoded.kind === 'statement' && onStatementQr) {
      setFlow({ step: 'finalizing' });
      onStatementQr(decoded)
        .then(() => setFlow({ step: 'done' }))
        .catch(() => fail('sync.error_transfer'));
      return;
    }

    if (mode === 'receive' && decoded.kind === 'offer') {
      setFlow({ step: 'connecting' });
      void (async () => {
        try {
          const answer = await acceptManualOffer(text);
          setFlow({ step: 'manual-show-answer', qrText: answer.answerQrText });
          const channel = await answer.channelOpen;
          await runReceiver(channel);
        } catch (err) {
          fail(
            err instanceof ManualSignalingError && err.code === 'qr_too_large'
              ? 'sync.error_qr_too_large'
              : 'sync.error_connection',
          );
        }
      })();
      return;
    }

    scanLockRef.current = false;
  };

  const retry = () => {
    cleanup();
    startedRef.current = false;
    scanLockRef.current = false;
    setOffline(false);
    setFlow(mode === 'send' ? { step: 'starting' } : { step: 'scanning' });
  };

  return (
    <div className="flex flex-col gap-4">
      {flow.step === 'starting' && <Spinner label={t('sync.preparing')} />}

      {flow.step === 'waiting-peer' && (
        <>
          <p className="text-sm text-on-surface-dim text-center">{t('sync.show_qr_hint')}</p>
          <QrCodeDisplay value={flow.qrText} />
          <Spinner label={t('sync.waiting_peer')} />
          <button onClick={startOfflineSender} className="text-xs text-primary btn-press mx-auto">
            {t('sync.offline_mode')}
          </button>
        </>
      )}

      {flow.step === 'scanning' && (
        <>
          <p className="text-sm text-on-surface-dim text-center">{t('sync.scan_hint')}</p>
          <QrScanner onScan={handleScan} />
        </>
      )}

      {flow.step === 'manual-show-offer' && (
        <>
          <StepBadge current={1} total={2} label={t('sync.manual_step1')} />
          <QrCodeDisplay value={flow.qrText} />
          <button
            onClick={() => setFlow({ step: 'manual-scan-answer' })}
            className="w-full py-3 rounded-xl bg-primary text-on-surface text-sm font-medium btn-press"
          >
            {t('sync.manual_scan_answer')}
          </button>
        </>
      )}

      {flow.step === 'manual-scan-answer' && (
        <>
          <StepBadge current={2} total={2} label={t('sync.manual_step2')} />
          <QrScanner onScan={handleScan} />
        </>
      )}

      {flow.step === 'manual-show-answer' && (
        <>
          <p className="text-sm text-on-surface-dim text-center">{t('sync.manual_show_answer')}</p>
          <QrCodeDisplay value={flow.qrText} />
          <Spinner label={t('sync.connecting')} />
        </>
      )}

      {flow.step === 'connecting' && <Spinner label={t('sync.connecting')} />}

      {flow.step === 'transferring' && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-on-surface-dim text-center">
            {mode === 'send' ? t('sync.sending') : t('sync.receiving')}
          </p>
          <div className="h-2 rounded-full bg-surface-high overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${Math.round((flow.done / Math.max(flow.total, 1)) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-on-surface-faint text-center tabular">
            {flow.done}/{flow.total}
          </p>
        </div>
      )}

      {flow.step === 'finalizing' && <Spinner label={t('sync.finalizing')} />}

      {flow.step === 'done' && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Icon name="check_circle" size={40} className="text-success" />
          <p className="text-sm font-medium text-on-surface">{t('sync.done')}</p>
          <button
            onClick={onDone}
            className="w-full py-3 rounded-xl bg-primary text-on-surface text-sm font-medium btn-press"
          >
            {t('common.close')}
          </button>
        </div>
      )}

      {flow.step === 'error' && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Icon name="error" size={40} className="text-error" />
          <p className="text-sm text-on-surface-dim text-center">{t(flow.messageKey)}</p>
          <button
            onClick={retry}
            className="w-full py-3 rounded-xl bg-primary text-on-surface text-sm font-medium btn-press"
          >
            {t('sync.retry')}
          </button>
          <button onClick={onCancel} className="text-xs text-on-surface-dim btn-press">
            {t('common.cancel')}
          </button>
        </div>
      )}

      {flow.step !== 'done' && flow.step !== 'error' && (
        <button onClick={onCancel} className="text-xs text-on-surface-dim btn-press mx-auto">
          {t('common.cancel')}
        </button>
      )}
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      <p className="text-xs text-on-surface-dim">{label}</p>
    </div>
  );
}

function StepBadge({ current, total, label }: { current: number; total: number; label: string }) {
  return (
    <div className="flex items-center gap-2 justify-center">
      <span className="text-xs font-bold text-primary tabular">
        {current}/{total}
      </span>
      <p className="text-sm text-on-surface-dim">{label}</p>
    </div>
  );
}
