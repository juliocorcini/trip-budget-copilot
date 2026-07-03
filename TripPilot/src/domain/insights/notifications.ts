import type { PlannedOccurrence } from '@/domain/types/planned-occurrence';

/**
 * DEC-090 (R-08): notifications center. Every notification is DERIVED from
 * existing data — no new table. Each entry carries the values the UI needs
 * for i18n plus a destination the tap navigates to.
 */

export type AppNotificationKind =
  | 'pending_p2p'
  | 'pending_share'
  | 'event_today'
  | 'backup_due'
  | 'long_outing'
  | 'phase_over_budget';

export type AppNotificationTone = 'neutral' | 'warning' | 'error';

export interface AppNotification {
  /** Stable id for list rendering (kind + discriminator). */
  id: string;
  kind: AppNotificationKind;
  tone: AppNotificationTone;
  values: Record<string, string | number>;
  /** Route the tap navigates to. */
  destination: string;
}

/** An outing running longer than this is worth a nudge. */
export const LONG_OUTING_THRESHOLD_MS = 8 * 60 * 60 * 1000;

export interface BuildNotificationsInput {
  /** DEC-352 (G6) — inbound P2P charges/payments awaiting accept/confirm. */
  inboundP2pCount: number;
  /**
   * DEC-450 (D06): shares awaiting the CONNECTED counterparty's acceptance.
   * Only a connected peer is ever born `pending` (DEC-345 accept-first), so
   * these are always "waiting on THEM", never on the owner who registered.
   */
  pendingShareCount: number;
  pendingShareImpactCents: number;
  /** Names of the connected peers whose acceptance is pending (deduped). */
  pendingSharePeerNames: string[];
  /** Today's planned events of the active phase without a session. */
  todayEvents: Array<Pick<PlannedOccurrence, 'id' | 'name'>>;
  /** Backup reminder already due (domain rule isBackupReminderDue). */
  backupDue: boolean;
  /** Active session, if any. */
  activeSession: { id: string; name: string; startedAt: string } | null;
  nowMs: number;
  /** Active-phase spending vs its budget. */
  phaseSpentCents: number;
  phaseBudgetCents: number;
}

export function buildNotifications(input: BuildNotificationsInput): AppNotification[] {
  const notifications: AppNotification[] = [];

  // DEC-352 (G6): a peer is waiting on me — the most time-sensitive item, first.
  if (input.inboundP2pCount > 0) {
    notifications.push({
      id: 'pending_p2p',
      kind: 'pending_p2p',
      tone: 'warning',
      values: { count: input.inboundP2pCount },
      destination: '/shared',
    });
  }

  // DEC-450 (D06): whoever REGISTERS a split is never nagged to confirm it.
  // The copy is directional ("aguardando aceite de {nomes}") and the tap lands
  // on /shared (remind/charge), never on the owner's confirmation sheet.
  if (input.pendingShareCount > 0) {
    notifications.push({
      id: 'pending_share',
      kind: 'pending_share',
      tone: 'neutral',
      values: {
        count: input.pendingShareCount,
        impactCents: input.pendingShareImpactCents,
        names: input.pendingSharePeerNames.join(', '),
      },
      destination: '/shared',
    });
  }

  for (const event of input.todayEvents) {
    notifications.push({
      id: `event_today:${event.id}`,
      kind: 'event_today',
      tone: 'neutral',
      values: { name: event.name },
      destination: `/outings/new?occurrence=${event.id}`,
    });
  }

  if (input.backupDue) {
    notifications.push({
      id: 'backup_due',
      kind: 'backup_due',
      tone: 'neutral',
      values: {},
      destination: '/settings/backup',
    });
  }

  if (input.activeSession) {
    const elapsedMs = input.nowMs - new Date(input.activeSession.startedAt).getTime();
    if (elapsedMs >= LONG_OUTING_THRESHOLD_MS) {
      notifications.push({
        id: `long_outing:${input.activeSession.id}`,
        kind: 'long_outing',
        tone: 'warning',
        values: {
          name: input.activeSession.name,
          hours: Math.floor(elapsedMs / 3_600_000),
        },
        destination: '/outings/active',
      });
    }
  }

  if (input.phaseBudgetCents > 0 && input.phaseSpentCents > input.phaseBudgetCents) {
    notifications.push({
      id: 'phase_over_budget',
      kind: 'phase_over_budget',
      tone: 'error',
      values: { overCents: input.phaseSpentCents - input.phaseBudgetCents },
      destination: '/planner',
    });
  }

  return notifications;
}
