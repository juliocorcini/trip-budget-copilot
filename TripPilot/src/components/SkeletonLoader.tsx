interface SkeletonLoaderProps {
  lines?: number;
  widths?: string[];
  height?: string;
  className?: string;
}

export function SkeletonLoader({
  lines = 3,
  widths,
  height = '16px',
  className = '',
}: SkeletonLoaderProps) {
  const defaultWidths = ['100%', '75%', '60%'];

  return (
    <div className={`flex flex-col gap-2.5 ${className}`} aria-busy="true" aria-label="Loading...">
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="rounded skeleton-shimmer"
          style={{
            width: widths?.[i] ?? defaultWidths[i % defaultWidths.length],
            height,
            background: 'var(--surface-container-high)',
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}
