import { useState, useEffect, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { Icon } from '@/components/Icon';
import { formatMoney } from '@/domain/money';
import { localDateString, localDayOf, localClockTime, formatShortDate } from '@/domain/dates';
import { getCategoryIcon } from '@/utils/category-icons';
import { buildEventGuide, eventOutingSessionIds, type LiveEventExpense } from '@/domain/budget';
import { calculateSessionTotal } from '@/domain/outing';
import { startEvent, endEvent } from '@/domain/orchestrators';
import { showToast } from '@/components/Toast';
import { formatElapsed } from '@/features/dashboard/dashboard-format';
import { sessionRepository } from '@/data/repositories';
import type { Session } from '@/domain/types/session';

// DEC-401 (G2): the per-expense mini-map reuses the lazy, code-split Leaflet
// field (DEC-398) — the preview is static (never traps the page scroll) and taps
// to expand full-screen. It mounts only when the traveler opens a spend's map, so
// a guide with many spends never spins up dozens of map instances at once.
const ExpenseLocationMapField = lazy(() =>
  import('@/features/location/ExpenseLocationMap').then((m) => ({
    default: m.ExpenseLocationMapField,
  })),
);

interface GuideOuting {
  session: Session;
  totalCents: number;
}

/**
 * DEC-401 (G2): the event GUIDE — a dedicated `/event/:id` screen to follow,
 * understand and remember an event. Header (consumed/reserve/remaining/per-day +
 * a FACTUAL rhythm line with a light cue), the active outing embedded (DEC-409),
 * every outing of the event, all spends grouped by day with their place, and the
 * lifecycle actions (log a direct expense, start an outing, edit via the existing
 * sheet, end the event). Pure view over `buildEventGuide` — no money math here.
 */
export function EventGuidePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { trip, transactions, occurrences, loading, reload } = useAppData();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);

  useEffect(() => {
    if (!trip) return;
    let cancelled = false;
    (async () => {
      const [active, completed] = await Promise.all([
        sessionRepository.getActive(trip.id),
        sessionRepository.getCompleted(trip.id),
      ]);
      if (cancelled) return;
      setSessions(active ? [active, ...completed] : completed);
      setSessionsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [trip, transactions]);

  const occ = occurrences.find((o) => o.id === id && o.deletedAt === null) ?? null;

  if (loading || !sessionsLoaded) {
    return <p className="text-on-surface-dim py-8 text-center">{t('common.loading')}</p>;
  }

  if (!trip || !occ) {
    return (
      <div className="flex flex-col gap-4 pb-4 pt-2">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
            <Icon name="arrow_back" size={24} className="text-on-surface" />
          </button>
          <h1 className="text-heading font-bold text-on-surface">{t('event_guide.title')}</h1>
        </div>
        <p className="text-sm text-on-surface-dim text-center py-8">{t('event_guide.not_found')}</p>
      </div>
    );
  }

  const todayIso = localDateString(new Date());
  const guide = buildEventGuide(occ, transactions, todayIso, sessions);
  const sessionIds = eventOutingSessionIds(occ, sessions);
  const eventOutings: GuideOuting[] = sessions
    .filter((s) => sessionIds.has(s.id) && s.deletedAt === null)
    .map((s) => ({
      session: s,
      totalCents: calculateSessionTotal(transactions.filter((tx) => tx.sessionId === s.id)),
    }))
    .sort((a, b) => b.session.startedAt.localeCompare(a.session.startedAt));
  const activeOuting = eventOutings.find((o) => o.session.id === guide.activeSessionId) ?? null;

  // All spends grouped by local day, newest day first (the guide.expenses are
  // already newest-first, so each day's bucket keeps that order).
  const expensesByDay: { day: string; items: LiveEventExpense[] }[] = [];
  const dayIndex = new Map<string, number>();
  for (const expense of guide.expenses) {
    const day = localDayOf(expense.date);
    const at = dayIndex.get(day);
    if (at === undefined) {
      dayIndex.set(day, expensesByDay.length);
      expensesByDay.push({ day, items: [expense] });
    } else {
      expensesByDay[at]!.items.push(expense);
    }
  }

  const isStarted = occ.startedAt != null;
  const hasReserve = guide.reservedCents !== null;
  const pct =
    hasReserve && guide.reservedCents! > 0
      ? Math.min(100, Math.round((guide.consumedCents / guide.reservedCents!) * 100))
      : 0;

  const handleStart = async () => {
    await startEvent(occ.id);
    showToast(t('dashboard.event_started', { name: occ.name }), 'success');
    await reload();
  };

  const handleEnd = async () => {
    await endEvent(occ.id);
    showToast(t('dashboard.event_ended', { name: occ.name }), 'success');
    navigate('/dashboard');
  };

  const dayLabel = (day: string): string =>
    day === localDateString()
      ? t('expenses.day_today')
      : day === localDateString(new Date(Date.now() - 86_400_000))
        ? t('expenses.day_yesterday')
        : formatShortDate(day);

  return (
    <div className="flex flex-col gap-4 pb-4 pt-2">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface flex-1 truncate">{occ.name}</h1>
        {/* DEC-401: editing reuses the EXISTING event edit sheet — not a new
            editor inside the guide. */}
        <button
          onClick={() => navigate(`/trip/edit?occurrence=${occ.id}`)}
          className="btn-press p-1"
          aria-label={t('event_guide.edit')}
        >
          <Icon name="edit" size={22} className="text-on-surface-dim" />
        </button>
      </div>

      {/* Header — the big number is the event's CONSUMED (real), with the reserve
          context below it and the factual rhythm line. */}
      <div
        className="p-5 rounded-2xl"
        style={{ background: 'var(--surface-deep)', border: '1px solid #C75B3925' }}
      >
        <div className="flex items-center gap-2">
          <Icon name="celebration" size={16} filled className="text-primary" />
          <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-primary">
            {isStarted ? t('dashboard.live_event_title') : t('event_guide.title')}
          </p>
        </div>
        <p className="text-[40px] font-extrabold tracking-tight leading-none mt-2 tabular text-on-surface">
          {formatMoney(guide.consumedCents, trip.baseCurrency)}
        </p>
        <p className="text-xs font-semibold text-on-surface-dim mt-1.5">
          {hasReserve
            ? t('event_guide.consumed_of', {
                reserved: formatMoney(guide.reservedCents!, trip.baseCurrency),
              })
            : t('event_guide.consumed_track_only')}
        </p>

        {hasReserve && guide.reservedCents! > 0 && (
          <div
            className="w-full h-2 rounded-full overflow-hidden mt-3"
            style={{ background: 'var(--surface-container-high)' }}
          >
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--primary)' }} />
          </div>
        )}

        {hasReserve && (
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-2.5 text-[11px] font-semibold text-on-surface-dim">
            <span className="text-success font-bold">
              {t('event_guide.remaining', { amount: formatMoney(guide.remainingCents, trip.baseCurrency) })}
            </span>
            {guide.perDayCents > 0 && (
              <span>{t('event_guide.per_day', { amount: formatMoney(guide.perDayCents, trip.baseCurrency) })}</span>
            )}
            <span>{t('event_guide.days_left', { count: guide.daysLeftInclusive })}</span>
          </div>
        )}

        {/* DEC-401: the rhythm is FACTUAL (numbers) with only a LIGHT verdict cue. */}
        {guide.pace !== 'none' && (
          <div
            className="mt-3 p-3 rounded-xl flex items-start gap-2.5"
            style={{ background: 'var(--surface-container)' }}
          >
            <Icon
              name={guide.pace === 'ease_up' ? 'speed' : 'check_circle'}
              size={16}
              className={guide.pace === 'ease_up' ? 'text-warning shrink-0 mt-px' : 'text-success shrink-0 mt-px'}
            />
            <div className="min-w-0">
              <p className="text-[12px] font-semibold leading-snug text-on-surface">
                {t('event_guide.rhythm_factual', {
                  remaining: formatMoney(guide.remainingCents, trip.baseCurrency),
                  count: guide.daysLeftInclusive,
                  perDay: formatMoney(guide.perDayCents, trip.baseCurrency),
                })}
              </p>
              <p className="text-[11px] font-medium leading-snug text-on-surface-dim mt-0.5">
                {t('event_guide.rhythm_today', {
                  today: formatMoney(guide.spentTodayCents, trip.baseCurrency),
                })}{' '}
                <span className={guide.pace === 'ease_up' ? 'text-warning font-bold' : 'text-success font-bold'}>
                  {guide.pace === 'ease_up' ? t('event_guide.pace_ease_up') : t('event_guide.pace_on_pace')}
                </span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Lifecycle actions — start (not yet), or log a direct expense + start an
          outing once live, plus end the event. */}
      {!isStarted ? (
        <button
          onClick={handleStart}
          className="w-full py-3 rounded-xl bg-primary text-on-surface text-sm font-bold btn-press"
        >
          {t('dashboard.event_start')}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/quick-add?occurrence=${occ.id}`)}
              className="flex-1 py-3 rounded-xl bg-primary text-on-surface text-sm font-bold btn-press"
            >
              {t('dashboard.live_event_log_expense')}
            </button>
            <button
              onClick={() => navigate(`/outings/new?occurrence=${occ.id}`)}
              className="flex-1 py-3 rounded-xl bg-surface-high text-on-surface-dim text-sm font-semibold btn-press"
            >
              {t('dashboard.live_event_start_outing')}
            </button>
          </div>
        </div>
      )}

      {/* DEC-409: the active outing lives INSIDE the event — embedded here, not a
          separate card. Tapping opens its focus mode. */}
      {activeOuting && (
        <button
          onClick={() => navigate('/outings/active')}
          className="w-full px-4 py-3 rounded-2xl flex items-center gap-3 btn-press text-left"
          style={{ background: 'var(--surface-deep)', border: '1px solid #C75B3925' }}
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-primary">
              {t('dashboard.live_event_active_outing')} · {formatElapsed(activeOuting.session.startedAt)}
            </p>
            <p className="text-sm font-bold text-on-surface truncate mt-0.5">{activeOuting.session.name}</p>
            <p className="text-[11px] font-semibold text-on-surface-dim mt-0.5">
              {t('event_guide.outing_total', {
                amount: formatMoney(activeOuting.totalCents, trip.baseCurrency),
              })}
            </p>
          </div>
          <span
            className="px-3 py-2 rounded-xl text-xs font-bold shrink-0"
            style={{ background: 'var(--primary)', color: 'var(--surface)' }}
          >
            {t('dashboard.live_event_open_outing')}
          </span>
        </button>
      )}

      {/* Outings — every outing the event owns over time (the active one above is
          listed here too, marked live). */}
      {eventOutings.length > 0 && (
        <div>
          <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
            {t('event_guide.outings_title', { count: eventOutings.length })}
          </p>
          <div className="bg-surface-container rounded-2xl divide-y divide-on-surface-mute">
            {eventOutings.map(({ session, totalCents }) => {
              const isActive = session.id === guide.activeSessionId;
              return (
                <button
                  key={session.id}
                  onClick={() => navigate(isActive ? '/outings/active' : `/outings/${session.id}/review`)}
                  className="w-full flex items-center gap-3 px-4 py-3 btn-press text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-surface-high flex items-center justify-center shrink-0">
                    <Icon name="local_bar" size={18} className="text-on-surface-dim" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-on-surface truncate">{session.name}</p>
                    <p className="text-[11px] text-on-surface-faint truncate">
                      {isActive ? t('event_guide.outing_active') : formatShortDate(localDayOf(session.startedAt))}
                    </p>
                  </div>
                  <p className="text-sm font-bold tabular text-on-surface shrink-0">
                    {formatMoney(totalCents, trip.baseCurrency)}
                  </p>
                  <Icon name="chevron_right" size={16} className="text-on-surface-faint shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* All spends, grouped by day, each with its place (mini-map on demand). */}
      <div>
        <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider mb-2 px-1">
          {t('event_guide.expenses_title', { count: guide.expenses.length })}
        </p>
        {guide.expenses.length === 0 ? (
          <div className="bg-surface-container rounded-2xl p-6 text-center">
            <Icon name="receipt_long" size={30} className="text-on-surface-mute mx-auto mb-2" />
            <p className="text-sm text-on-surface-dim">{t('event_guide.no_expenses')}</p>
            <p className="text-xs text-on-surface-faint mt-1">{t('event_guide.no_expenses_hint')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {expensesByDay.map(({ day, items }) => (
              <div key={day}>
                <p className="text-[11px] font-bold text-on-surface-faint px-1 mb-1">{dayLabel(day)}</p>
                <div className="bg-surface-container rounded-2xl divide-y divide-on-surface-mute">
                  {items.map((expense) => (
                    <GuideExpenseRow
                      key={expense.id}
                      expense={expense}
                      baseCurrency={trip.baseCurrency}
                      onOpen={() => navigate(`/expenses/${expense.id}`)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* End the event — only an explicit "encerrar evento" ends it (a started
          event never disappears on its own, Â-EVENT-LIFECYCLE). */}
      {isStarted && (
        <button
          onClick={handleEnd}
          className="w-full py-2.5 mt-1 text-sm font-bold text-on-surface-faint btn-press"
        >
          {t('dashboard.event_end')}
        </button>
      )}
    </div>
  );
}

/**
 * DEC-401 (G2): one spend row in the guide — what/when/how-much, plus its place.
 * The Leaflet mini-map is mounted ONLY when the traveler taps "ver no mapa", so a
 * guide with many spends stays light (no eager map per row). Tapping the row body
 * opens the full expense detail.
 */
function GuideExpenseRow({
  expense,
  baseCurrency,
  onOpen,
}: {
  expense: LiveEventExpense;
  baseCurrency: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const [mapOpen, setMapOpen] = useState(false);
  const hasMap = expense.latitude !== null && expense.longitude !== null;
  const placeText = expense.placeLabel ?? null;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <button onClick={onOpen} className="flex items-center gap-3 flex-1 min-w-0 btn-press text-left">
          <div className="w-8 h-8 rounded-full bg-surface-high flex items-center justify-center shrink-0">
            <Icon name={getCategoryIcon(expense.category)} size={16} className="text-on-surface-dim" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-on-surface truncate">
              {expense.description || t(`categories.${expense.category ?? 'other'}` as never)}
            </p>
            <p className="text-[11px] text-on-surface-faint truncate">
              {localClockTime(expense.date)}
              {placeText ? ` · ${placeText}` : ''}
            </p>
          </div>
        </button>
        <p className="text-sm font-bold tabular text-on-surface shrink-0">
          {formatMoney(expense.baseCostCents, baseCurrency)}
        </p>
      </div>

      {hasMap && (
        <>
          <button
            onClick={() => setMapOpen((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary btn-press"
          >
            <Icon name={mapOpen ? 'expand_less' : 'place'} size={13} className="text-primary" />
            {mapOpen ? t('event_guide.hide_map') : t('event_guide.show_map')}
          </button>
          {mapOpen && (
            <div className="mt-2 h-44">
              <Suspense
                fallback={<div className="w-full h-44 rounded-xl bg-surface-container animate-pulse" />}
              >
                <ExpenseLocationMapField
                  lat={expense.latitude as number}
                  lng={expense.longitude as number}
                  label={placeText ?? t('expenses.location_label')}
                />
              </Suspense>
            </div>
          )}
        </>
      )}
    </div>
  );
}
