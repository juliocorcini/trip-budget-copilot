import { Component, type ReactNode } from 'react';
import i18n from '@/i18n';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// GAP-R2-004: root error boundary — a render exception in a local-first PWA
// must never leave the user on a blank white screen.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

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
        <h1 className="text-lg font-extrabold">{i18n.t('errors.boundary_title')}</h1>
        <p className="text-sm font-semibold mt-2" style={{ color: 'var(--on-surface-dim)' }}>
          {i18n.t('errors.boundary_message')}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="btn-press mt-6 px-6 py-3 rounded-xl text-sm font-bold"
          style={{ background: 'var(--primary)', color: 'var(--surface)' }}
        >
          {i18n.t('errors.boundary_reload')}
        </button>
      </div>
    );
  }
}
