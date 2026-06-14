import type { ReactNode } from 'react';
import { Icon } from '@/components/Icon';

interface EmptyStateProps {
  /** Material icon name shown in the rounded badge. */
  icon: string;
  /** Short, warm headline ("Nenhum gasto ainda"). */
  title: string;
  /** One-line explanation of what this screen will hold once it has data. */
  body?: string;
  /** Optional primary call-to-action (label + handler) to start the flow. */
  cta?: { label: string; icon?: string; onClick: () => void };
  /** Optional extra content (e.g. a secondary hint) rendered under the CTA. */
  children?: ReactNode;
}

/**
 * DEC-171: one consistent first-use empty state across the app. Before this each
 * screen rolled its own (some had a CTA, some were a bare line of text), so the
 * first-run experience felt unfinished and inconsistent. A single component makes
 * every empty screen reassuring and actionable: a calm icon, a warm title, a
 * one-line "what goes here", and — when there is an obvious next step — a CTA that
 * starts it. Purely presentational; callers own the action and the copy keys.
 */
export function EmptyState({ icon, title, body, cta, children }: EmptyStateProps) {
  return (
    <div className="bg-surface-container rounded-2xl px-6 py-8 text-center flex flex-col items-center gap-2">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-1"
        style={{ background: 'var(--surface-container-high)' }}
      >
        <Icon name={icon} size={28} className="text-on-surface-mute" />
      </div>
      <p className="text-sm font-bold text-on-surface">{title}</p>
      {body && <p className="text-xs text-on-surface-dim leading-relaxed max-w-[34ch]">{body}</p>}
      {cta && (
        <button
          type="button"
          onClick={cta.onClick}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-on-surface btn-press"
        >
          {cta.icon && <Icon name={cta.icon} size={16} />}
          {cta.label}
        </button>
      )}
      {children}
    </div>
  );
}
