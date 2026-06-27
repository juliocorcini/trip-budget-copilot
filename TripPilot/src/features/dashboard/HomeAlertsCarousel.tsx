import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { HomeAlertId } from './home-alerts';

export interface HomeAlertSlide {
  id: HomeAlertId;
  node: ReactNode;
}

const AUTO_ADVANCE_MS = 7000;

/**
 * DEC-293 (M03/M10): the single rotating slot for top-of-home alerts. One alert
 * shows at a time; the rest are one swipe (or dot) away — nothing is removed
 * (Â9), the first glance is just no longer a stack of banners. Each alert node
 * keeps its own top margin, so a single active alert renders exactly as before.
 * Auto-advance honors reduced-motion and pauses briefly after any interaction.
 */
export function HomeAlertsCarousel({ slides }: { slides: HomeAlertSlide[] }) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [boxHeight, setBoxHeight] = useState<number | null>(null);
  const pausedUntilRef = useRef(0);
  const count = slides.length;

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    if (count <= 1 || reducedMotion) return;
    const timer = window.setInterval(() => {
      if (Date.now() < pausedUntilRef.current) return;
      const el = scrollRef.current;
      if (!el || el.clientWidth === 0) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % count;
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [count, reducedMotion]);

  // DEC-379: track the ACTIVE slide's natural height so the row collapses to it
  // instead of reserving the tallest slide's height (the "empty gap" Julio saw
  // under short cards). A ResizeObserver keeps it correct as content reflows.
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || count === 0) return;
    const el = slideRefs.current[Math.min(activeIndex, count - 1)];
    if (!el) return;
    const measure = () => setBoxHeight(el.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeIndex, count]);

  if (count === 0) return null;
  // A single alert renders inline — identical to the pre-carousel layout.
  if (count === 1) return <>{slides[0]!.node}</>;

  const safeIndex = Math.min(activeIndex, count - 1);
  const pause = () => {
    pausedUntilRef.current = Date.now() + 6000;
  };
  const goTo = (i: number) => {
    pause();
    scrollRef.current?.scrollTo({ left: i * scrollRef.current.clientWidth, behavior: 'smooth' });
  };

  return (
    <div>
      <div
        ref={scrollRef}
        className="flex items-start overflow-x-auto overflow-y-hidden no-scrollbar snap-x snap-mandatory transition-[height] duration-300 ease-out"
        style={{ height: boxHeight ?? undefined }}
        onPointerDown={pause}
        onWheel={pause}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.clientWidth === 0) return;
          const idx = Math.round(el.scrollLeft / el.clientWidth);
          if (idx !== activeIndex) setActiveIndex(idx);
        }}
      >
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
            className="w-full shrink-0 snap-center snap-always"
          >
            {slide.node}
          </div>
        ))}
      </div>
      <div
        className="flex items-center justify-center gap-1.5 mt-2"
        role="tablist"
        aria-label={t('dashboard.alerts_carousel')}
      >
        {slides.map((slide, i) => (
          <button
            key={slide.id}
            onClick={() => goTo(i)}
            aria-label={`${i + 1}/${count}`}
            aria-selected={i === safeIndex}
            role="tab"
            className="btn-press rounded-full transition-[width,transform]"
            style={{
              width: i === safeIndex ? 16 : 6,
              height: 6,
              background: i === safeIndex ? 'var(--primary)' : 'var(--border-subtle)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
