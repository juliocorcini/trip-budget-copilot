import { useEffect, useState } from 'react';
import { useAppData } from '@/hooks/useAppData';
import { sessionRepository } from '@/data/repositories/session-repository';
import { participantShareRepository } from '@/data/repositories';
import { resolveActivePhase, localDateString } from '@/domain/dates';
import { calculateFreeToSpend } from '@/domain/budget';
import { filterTransactionsByPool } from '@/domain/transactions';
import { findPendingConfirmationShares } from '@/domain/splitting';
import { isOccurrenceActiveToday } from '@/domain/planning';
import { isBackupReminderDue } from '@/domain/backup';
import { buildNotifications, type AppNotification } from '@/domain/insights';

/**
 * DEC-090 (R-08): derived notifications shared by the bell badge (Dashboard)
 * and the notifications center — single source, pure domain builder.
 */
export function useNotifications(): { notifications: AppNotification[]; ready: boolean } {
  const { trip, phases, pools, links, envelopes, transactions, participants, occurrences, settings } =
    useAppData();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!trip || !settings) return;
    let cancelled = false;

    const load = async () => {
      const owner = participants.find((p) => p.isOwner) ?? null;
      const sharedTxIds = transactions
        .filter((tx) => tx.isShared && tx.deletedAt === null)
        .map((tx) => tx.id);

      const [activeSession, shares] = await Promise.all([
        sessionRepository.getActive(trip.id),
        owner ? participantShareRepository.getAllForTrip(sharedTxIds) : Promise.resolve([]),
      ]);
      if (cancelled) return;

      const pendingShares = owner
        ? findPendingConfirmationShares(transactions, shares, owner.id)
        : [];

      const todayIso = localDateString(new Date());
      const activePhase = resolveActivePhase(phases);
      const todayEvents = activePhase
        ? occurrences.filter(
            (o) => o.phaseId === activePhase.id && isOccurrenceActiveToday(o, todayIso),
          )
        : [];

      const primaryPool = pools.find((p) => p.scope === 'linked_phases');
      const fts =
        primaryPool && activePhase
          ? calculateFreeToSpend(
              primaryPool,
              envelopes.filter((e) => e.budgetPoolId === primaryPool.id),
              filterTransactionsByPool(transactions, primaryPool.id),
              links.filter((l) => l.budgetPoolId === primaryPool.id),
              activePhase.id,
              occurrences,
            )
          : null;
      const phaseBudgetCents = fts
        ? fts.totalBudgetCents -
          fts.protectedReserveCents -
          fts.futureFloorCents -
          fts.eventReservesCents
        : 0;

      setNotifications(
        buildNotifications({
          pendingShareCount: pendingShares.length,
          pendingShareImpactCents: pendingShares.reduce(
            (sum, entry) => sum + entry.share.shareAmountCents,
            0,
          ),
          todayEvents,
          backupDue: isBackupReminderDue(settings, Date.now()) && transactions.length > 0,
          activeSession: activeSession ?? null,
          nowMs: Date.now(),
          phaseSpentCents: fts?.totalSpentCents ?? 0,
          phaseBudgetCents,
        }),
      );
      setReady(true);
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [trip, phases, pools, links, envelopes, transactions, participants, occurrences, settings]);

  return { notifications, ready };
}
