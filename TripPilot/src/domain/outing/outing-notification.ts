import { formatMoney } from '@/domain/money';
import { getSubcategories, sortSubcategoriesByProximity } from './expense-taxonomy';
import type { Session } from '@/domain/types/session';

/**
 * DEC-120 (R-11): active-outing notification with quick-add actions.
 *
 * Everything the service worker needs (labels, amounts, follow-up
 * subcategories) is computed HERE — in app context, with i18n — and
 * embedded in the notification `data`. The SW has no i18n and no domain
 * imports; it only replays this payload.
 */

export const OUTING_NOTIFICATION_TAG = 'trippilot-active-outing';
export const OUTING_FOLLOWUP_TAG = 'trippilot-outing-followup';

/** Android shows at most 2-3 action buttons — 2 amounts + "open app". */
const MAX_QUICK_ACTIONS = 2;
const MAX_FOLLOWUP_SUBCATEGORIES = 2;

export interface OutingNotificationStrings {
  /** e.g. "Saída ativa: {{name}}" already interpolated. */
  title: string;
  /** e.g. "Total até agora: {{total}}" already interpolated. */
  body: string;
  /** Same text with the {{total}} placeholder kept — SW re-renders totals. */
  bodyTemplate: string;
  openAction: string;
  followupTitle: string;
  /** e.g. "{{amount}} adicionado — o que foi?" with placeholder kept; SW interpolates. */
  followupBodyTemplate: string;
}

export interface OutingNotificationAction {
  action: string;
  title: string;
}

export interface OutingFollowupAction {
  /** Subcategory id stored on the transaction when tapped. */
  subcategoryId: string;
  label: string;
}

export interface OutingNotificationPayload {
  tag: string;
  title: string;
  body: string;
  actions: OutingNotificationAction[];
  data: {
    kind: 'outing';
    sessionId: string;
    /** action id → amount in cents (for SW-side direct registration). */
    amounts: Record<string, number>;
    /** amount → most likely subcategories, precomputed with i18n labels. */
    followups: Record<string, OutingFollowupAction[]>;
    strings: OutingNotificationStrings;
    deviceId: string;
  };
}

/** First distinct positive quick-add values, capped at the action limit. */
export function pickNotificationQuickValues(quickAddValuesCents: number[]): number[] {
  const distinct: number[] = [];
  for (const value of quickAddValuesCents) {
    if (value > 0 && !distinct.includes(value)) distinct.push(value);
    if (distinct.length === MAX_QUICK_ACTIONS) break;
  }
  return distinct;
}

/** Most likely subcategories for a quick-added amount (DEC-095 proximity). */
export function pickFollowupSubcategoryIds(
  profileCategory: string | null,
  amountCents: number,
): string[] {
  return sortSubcategoriesByProximity(getSubcategories(profileCategory), amountCents)
    .slice(0, MAX_FOLLOWUP_SUBCATEGORIES)
    .map((s) => s.id);
}

export interface BuildOutingNotificationInput {
  session: Session;
  totalCents: number;
  currency: string;
  profileCategory: string | null;
  strings: OutingNotificationStrings;
  /** i18n resolver for subcategory labels (`taxonomy.<id>`). */
  resolveSubcategoryLabel: (subcategoryId: string) => string;
  deviceId: string;
  locale: string;
}

export function buildOutingNotificationPayload(
  input: BuildOutingNotificationInput,
): OutingNotificationPayload {
  const quickValues = pickNotificationQuickValues(input.session.quickAddValuesCents);
  const amounts: Record<string, number> = {};
  const followups: Record<string, OutingFollowupAction[]> = {};
  const actions: OutingNotificationAction[] = quickValues.map((value, index) => {
    const actionId = `quick_add_${index}`;
    amounts[actionId] = value;
    followups[String(value)] = pickFollowupSubcategoryIds(input.profileCategory, value).map(
      (subcategoryId) => ({
        subcategoryId,
        label: input.resolveSubcategoryLabel(subcategoryId),
      }),
    );
    return {
      action: actionId,
      title: `+${formatMoney(value, input.currency, input.locale)}`,
    };
  });
  actions.push({ action: 'open', title: input.strings.openAction });

  return {
    tag: OUTING_NOTIFICATION_TAG,
    title: input.strings.title,
    body: input.strings.body,
    actions,
    data: {
      kind: 'outing',
      sessionId: input.session.id,
      amounts,
      followups,
      strings: input.strings,
      deviceId: input.deviceId,
    },
  };
}
