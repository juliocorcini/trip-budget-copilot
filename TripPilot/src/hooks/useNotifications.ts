import { useEffect, useState } from 'react';
import { useAppData } from '@/hooks/useAppData';
import { sessionRepository } from '@/data/repositories/session-repository';
import { participantShareRepository, groupSplitRepository } from '@/data/repositories';
import { resolveActivePhase, localDateString } from '@/domain/dates';
import { calculateFreeToSpend, selectActivePhasePool } from '@/domain/budget';
import { filterTransactionsByPool } from '@/domain/transactions';
import { findPendingConfirmationShares } from '@/domain/splitting';
import { isOccurrenceActiveToday } from '@/domain/planning';
import { isBackupReminderDue } from '@/domain/backup';
import { buildNotifications, type AppNotification } from '@/domain/insights';
import { getInboundP2pItems } from '@/domain/orchestrators';
import { MAILBOX_DRAINED_EVENT } from '@/utils/mailbox-boot';

/**
 * DEC-090 (R-08): derived notifications shared by the bell badge (Dashboard)
 * and the notifications center — single source, pure domain builder.
 */
export function useNotifications(): { notifications: AppNotification[]; ready: boolean } {
  const { trip, phases, pools, links, envelopes, transactions, participants, occurrences, plannedPurchases, settings } =
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

      const [activeSession, shares, inboundP2p, groupSplits] = await Promise.all([
        sessionRepository.getActive(trip.id),
        owner ? participantShareRepository.getAllForTrip(sharedTxIds) : Promise.resolve([]),
        getInboundP2pItems(),
        groupSplitRepository.listEvents(trip.id),
      ]);
      if (cancelled) return;

      const pendingShares = owner
        ? findPendingConfirmationShares(transactions, shares, owner.id)
        : [];
      // DEC-450 (D06): a share is only born pending for a CONNECTED peer, so
      // the waiting names are the pending shares' participants (deduped).
      const participantNameById = new Map(participants.map((p) => [p.id, p.name]));
      const pendingSharePeerNames = [
        ...new Set(
          pendingShares
            .map((entry) => participantNameById.get(entry.share.participantId))
            .filter((name): name is string => Boolean(name)),
        ),
      ];

      const todayIso = localDateString(new Date());
      const activePhase = resolveActivePhase(phases);
      const todayEvents = activePhase
        ? occurrences.filter(
            (o) => o.phaseId === activePhase.id && isOccurrenceActiveToday(o, todayIso),
          )
        : [];

      // DEC-462: the ACTIVE phase's own fund (was the trip's first fund).
      const primaryPool = selectActivePhasePool(pools, links, activePhase?.id ?? null);
      const fts =
        primaryPool && activePhase
          ? calculateFreeToSpend(
              primaryPool,
              envelopes.filter((e) => e.budgetPoolId === primaryPool.id),
              filterTransactionsByPool(transactions, primaryPool.id),
              links.filter((l) => l.budgetPoolId === primaryPool.id),
              activePhase.id,
              occurrences,
              plannedPurchases,
            )
          : null;
      const phaseBudgetCents = fts
        ? fts.totalBudgetCents -
          fts.protectedReserveCents -
          fts.futureFloorCents -
          fts.eventReservesCents
        : 0;

      const pendingGroupPayments: Array<{ groupName: string; participantName: string; groupId: string }> = [];
      for (const gs of groupSplits) {
        if (gs.status === 'settled') continue;
        for (const p of gs.event.participants) {
          if (p.paymentStatus === 'marked') {
            pendingGroupPayments.push({
              groupName: gs.event.name,
              participantName: p.name,
              groupId: gs.event.id,
            });
          }
        }
      }

      setNotifications(
        buildNotifications({
          inboundP2pCount: inboundP2p.length,
          pendingShareCount: pendingShares.length,
          pendingShareImpactCents: pendingShares.reduce(
            (sum, entry) => sum + entry.share.shareAmountCents,
            0,
          ),
          pendingSharePeerNames,
          todayEvents,
          backupDue: isBackupReminderDue(settings, Date.now()) && transactions.length > 0,
          activeSession: activeSession ?? null,
          nowMs: Date.now(),
          phaseSpentCents: fts?.totalSpentCents ?? 0,
          phaseBudgetCents,
          pendingGroupPayments,
        }),
      );
      setReady(true);
    };
    load();

    // DEC-352 (G6): a real-time drain can add an inbound P2P item without any
    // appData change — re-derive so the bell badge + center update immediately.
    const onDrained = () => void load();
    window.addEventListener(MAILBOX_DRAINED_EVENT, onDrained);

    return () => {
      cancelled = true;
      window.removeEventListener(MAILBOX_DRAINED_EVENT, onDrained);
    };
  }, [trip, phases, pools, links, envelopes, transactions, participants, occurrences, plannedPurchases, settings]);

  return { notifications, ready };
}
