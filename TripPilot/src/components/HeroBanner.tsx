import type { ReactNode } from 'react';
import type { DayType } from '@/domain/types/itinerary-leg';

const GRADIENTS: Record<DayType, string> = {
  full: 'linear-gradient(135deg, #2d6a4f 0%, #40916c 50%, #52b788 100%)',
  transit: 'linear-gradient(135deg, #2b4162 0%, #3d5a80 50%, #5c7a99 100%)',
  festival: 'linear-gradient(135deg, #5a189a 0%, #7b2cbf 50%, #9d4edd 100%)',
  rest: 'linear-gradient(135deg, #374151 0%, #4b5563 50%, #6b7280 100%)',
  day_trip: 'linear-gradient(135deg, #b45309 0%, #d97706 50%, #f59e0b 100%)',
};

interface HeroBannerProps {
  cityName: string;
  countryCode: string | null;
  dayType: DayType;
  dayLabel: string | null;
  children?: ReactNode;
  className?: string;
}

export function HeroBanner({
  cityName,
  countryCode,
  dayType,
  dayLabel,
  children,
  className = '',
}: HeroBannerProps) {
  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden ${className}`}
      style={{
        background: GRADIENTS[dayType] ?? GRADIENTS.full,
      }}
    >
      {/* Gradient overlay for text readability */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.05) 100%)',
        }}
      />

      <div className="relative z-10 p-5 flex flex-col gap-2">
        {dayLabel && (
          <span
            className="font-mono text-[10px] uppercase tracking-[0.15em] font-semibold drop-shadow-sm"
            style={{ color: 'var(--on-surface)' }}
          >
            {dayLabel}
          </span>
        )}

        <h2
          className="text-2xl font-extrabold leading-tight drop-shadow-md"
          style={{ color: '#ffffff' }}
        >
          {cityName}
          {countryCode && (
            <span className="text-base font-normal opacity-70 ml-1.5">
              {countryCode}
            </span>
          )}
        </h2>

        {children}
      </div>
    </div>
  );
}
