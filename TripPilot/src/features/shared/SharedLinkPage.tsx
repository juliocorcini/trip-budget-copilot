import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useLocation, useNavigate } from 'react-router';
import { ingestSharedLink, type IngestShareResult } from '@/domain/orchestrators';
import { parseShareKeyFromHash } from '@/domain/sync';
import { Icon } from '@/components/Icon';

type State = { kind: 'loading' } | { kind: 'error'; result: Exclude<IngestShareResult['status'], 'ok'> };

/**
 * DEC-207 — the link landing route `/s/:id#k=<key>`. Lives OUTSIDE BootGate so a
 * guest with no trip is never bounced to onboarding. It decrypts the statement
 * (key from the URL fragment, never sent to the server), stores it, then drops
 * the guest on their "Compartilhadas comigo" home. Errors are explained in
 * plain language with a retry.
 */
export function SharedLinkPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const location = useLocation();
  const [state, setState] = useState<State>({ kind: 'loading' });

  const run = async () => {
    setState({ kind: 'loading' });
    const id = params.id;
    const key = parseShareKeyFromHash(location.hash);
    if (!id || !key) {
      setState({ kind: 'error', result: 'bad_key' });
      return;
    }
    const result = await ingestSharedLink(id, key);
    if (result.status === 'ok') {
      navigate('/shared-with-me', { replace: true });
      return;
    }
    setState({ kind: 'error', result: result.status });
  };

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, location.hash]);

  if (state.kind === 'loading') {
    return (
      <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center gap-4 px-8">
        <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-on-surface-dim">{t('shareLink.opening')}</p>
      </div>
    );
  }

  const message: Record<typeof state.result, string> = {
    revoked: t('shareLink.err_revoked'),
    not_found: t('shareLink.err_not_found'),
    bad_key: t('shareLink.err_bad_key'),
    error: t('shareLink.err_network'),
  };
  const canRetry = state.result === 'error';

  return (
    <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center gap-4 px-8 text-center">
      <Icon name="link_off" size={40} className="text-on-surface-faint" />
      <p className="text-sm text-on-surface-dim leading-relaxed">{message[state.result]}</p>
      {canRetry && (
        <button
          onClick={() => void run()}
          className="px-6 py-3 rounded-xl bg-primary text-on-surface font-semibold text-sm btn-press"
        >
          {t('shareLink.retry')}
        </button>
      )}
      <button
        onClick={() => navigate('/')}
        className="text-xs text-primary btn-press"
      >
        {t('shareLink.go_home')}
      </button>
    </div>
  );
}
