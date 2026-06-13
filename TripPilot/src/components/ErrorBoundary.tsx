import { Component, type ErrorInfo, type ReactNode } from 'react';
import i18n from '@/i18n';
import { recordCrash, isCrashLooping, clearCrashLog, describeError } from '@/utils/crash-log';
import { downloadEmergencyBackup } from '@/utils/emergency-backup';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  looping: boolean;
}

// GAP-R2-004 + BUG-017: root error boundary — a render exception in a
// local-first PWA must never leave the user on a blank white screen, and a
// deterministic crash must not loop forever on "reload". Crashes are logged to
// a rotating buffer; once a loop is detected we stop offering a plain reload
// and surface real recovery (clear cache, emergency export).
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, looping: false };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    const { message, stack } = describeError(error);
    recordCrash({ message, stack, componentStack: info.componentStack ?? undefined });
    console.error('[ErrorBoundary]', error);
    this.setState({ looping: isCrashLooping() });
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleClearCacheAndReload = async (): Promise<void> => {
    clearCrashLog();
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch {
      // Cache API unavailable/blocked — reloading still clears the loop counter.
    }
    window.location.reload();
  };

  private handleExport = async (): Promise<void> => {
    await downloadEmergencyBackup();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { looping } = this.state;

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
            {looping ? 'warning' : 'error'}
          </span>
        </div>
        <h1 className="text-lg font-extrabold">
          {i18n.t(looping ? 'errors.boundary_persistent_title' : 'errors.boundary_title')}
        </h1>
        <p className="text-sm font-semibold mt-2" style={{ color: 'var(--on-surface-dim)' }}>
          {i18n.t(looping ? 'errors.boundary_persistent_message' : 'errors.boundary_message')}
        </p>

        {looping ? (
          <div className="mt-6 flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={this.handleClearCacheAndReload}
              className="btn-press px-6 py-3 rounded-xl text-sm font-bold"
              style={{ background: 'var(--primary)', color: 'var(--surface)' }}
            >
              {i18n.t('errors.boundary_clear_cache')}
            </button>
            <button
              onClick={this.handleExport}
              className="btn-press px-6 py-3 rounded-xl text-sm font-bold"
              style={{ background: 'var(--surface-container)', color: 'var(--on-surface)' }}
            >
              {i18n.t('errors.boundary_export')}
            </button>
          </div>
        ) : (
          <button
            onClick={this.handleReload}
            className="btn-press mt-6 px-6 py-3 rounded-xl text-sm font-bold"
            style={{ background: 'var(--primary)', color: 'var(--surface)' }}
          >
            {i18n.t('errors.boundary_reload')}
          </button>
        )}
      </div>
    );
  }
}
