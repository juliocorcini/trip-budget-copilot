import { useState } from 'react';
import { useRouteError, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { describeError } from '@/utils/crash-log';
import { logger } from '@/utils/logger';

export function RouteErrorPage() {
  const error = useRouteError();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const { message, stack } = describeError(error);
  const fullTrace = stack || message || String(error);

  logger.warn('route_error_caught', { module: 'RouteErrorPage', message });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullTrace);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — fallback: select the text.
    }
  };

  return (
    <div
      className="max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center px-8 text-center"
      style={{ background: 'var(--surface)', color: 'var(--on-surface)' }}
    >
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
        style={{ background: 'var(--primary-subtle)' }}
      >
        <span className="material-symbols-outlined text-3xl" style={{ color: 'var(--primary)' }}>
          error
        </span>
      </div>

      <h1 className="text-lg font-extrabold">
        {t('errors.route_error_title')}
      </h1>
      <p className="text-sm font-semibold mt-2" style={{ color: 'var(--on-surface-dim)' }}>
        {t('errors.route_error_message')}
      </p>

      <div className="mt-6 flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => window.location.reload()}
          className="btn-press px-6 py-3 rounded-xl text-sm font-bold"
          style={{ background: 'var(--primary)', color: 'var(--surface)' }}
        >
          {t('errors.boundary_reload')}
        </button>
        <button
          onClick={() => navigate('/')}
          className="btn-press px-6 py-3 rounded-xl text-sm font-bold"
          style={{ background: 'var(--surface-container)', color: 'var(--on-surface)' }}
        >
          {t('errors.route_go_home')}
        </button>
      </div>

      <button
        onClick={() => setShowDetails((prev) => !prev)}
        className="mt-6 text-xs font-medium btn-press py-1 px-1"
        style={{ color: 'var(--on-surface-dim)' }}
      >
        {showDetails ? t('errors.route_hide_details') : t('errors.route_show_details')}
      </button>

      {showDetails && (
        <div className="mt-3 w-full max-w-xs text-left">
          <pre
            className="text-[10px] leading-snug p-3 rounded-xl overflow-auto max-h-48"
            style={{ background: 'var(--surface-container)', color: 'var(--on-surface-dim)' }}
          >
            {fullTrace}
          </pre>
          <button
            onClick={handleCopy}
            className="mt-2 text-xs font-medium btn-press py-1 px-2 rounded-lg"
            style={{ background: 'var(--surface-container)', color: 'var(--primary)' }}
          >
            {copied ? t('errors.route_copied') : t('errors.route_copy_error')}
          </button>
        </div>
      )}
    </div>
  );
}
