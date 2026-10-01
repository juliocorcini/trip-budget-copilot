import type { ReactNode } from 'react';

export type TimelineNodeStatus = 'past' | 'active' | 'future';

export interface TimelineItem {
  id: string;
  status: TimelineNodeStatus;
  time: string | null;
  badge: string | null;
  content: ReactNode;
}

interface TimelineViewProps {
  items: TimelineItem[];
  className?: string;
}

export function TimelineView({ items, className = '' }: TimelineViewProps) {
  if (items.length === 0) return null;

  const activeIdx = items.findIndex((it) => it.status === 'active');
  const activePercent =
    activeIdx >= 0 && items.length > 1
      ? Math.round(((activeIdx + 0.5) / items.length) * 100)
      : 0;

  return (
    <div className={`relative ml-3 flex flex-col ${className}`} role="list">
      {/* Background line */}
      <div
        className="absolute left-0 top-3 bottom-3 w-[2px]"
        style={{ background: 'var(--surface-container-high)' }}
      />
      {/* Active path overlay */}
      {activeIdx >= 0 && (
        <div
          className="absolute left-0 top-3 w-[2px]"
          style={{
            height: `${activePercent}%`,
            background: 'var(--primary)',
            boxShadow: '0 0 8px color-mix(in srgb, var(--primary) 60%, transparent)',
          }}
        />
      )}

      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <div
            key={item.id}
            className={`relative pl-8 ${isLast ? '' : 'mb-6'} ${
              item.status === 'past' ? 'opacity-50' : ''
            }`}
            role="listitem"
          >
            <TimelineNode status={item.status} />

            <div className="flex flex-col gap-1">
              {item.badge && <TimelineBadge label={item.badge} status={item.status} />}

              {item.time && (
                <span
                  className="font-mono text-xs tracking-wide"
                  style={{ color: 'var(--on-surface-dim)' }}
                >
                  {item.time}
                </span>
              )}

              {item.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimelineNode({ status }: { status: TimelineNodeStatus }) {
  const base = 'absolute rounded-full flex items-center justify-center z-10';

  if (status === 'active') {
    return (
      <div
        className={`${base} -left-[11px] top-1 w-[22px] h-[22px] border-[3px]`}
        style={{
          borderColor: 'var(--primary)',
          background: 'var(--surface)',
          boxShadow: '0 0 12px color-mix(in srgb, var(--primary) 40%, transparent)',
        }}
      >
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: 'var(--primary)' }}
        />
      </div>
    );
  }

  if (status === 'past') {
    return (
      <div
        className={`${base} -left-[9px] top-1.5 w-[18px] h-[18px] border-2`}
        style={{ borderColor: 'var(--primary)', background: 'var(--surface)' }}
      >
        <div className="w-2 h-2 rounded-full" style={{ background: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div
      className={`${base} -left-[9px] top-1.5 w-[18px] h-[18px] border-2`}
      style={{
        borderColor: 'var(--surface-container-high)',
        background: 'var(--surface)',
      }}
    />
  );
}

function TimelineBadge({ label, status }: { label: string; status: TimelineNodeStatus }) {
  const isActive = status === 'active';

  return (
    <span
      className="inline-flex self-start px-2.5 py-0.5 rounded-full font-mono text-[10px] uppercase tracking-wider font-semibold"
      style={{
        background: isActive
          ? 'color-mix(in srgb, var(--primary) 12%, transparent)'
          : 'var(--surface-container-high)',
        color: isActive ? 'var(--primary)' : 'var(--on-surface-dim)',
        border: isActive
          ? '1px solid color-mix(in srgb, var(--primary) 25%, transparent)'
          : '1px solid var(--border-subtle)',
      }}
    >
      {label}
    </span>
  );
}
