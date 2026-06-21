import type { AiAction, AiIntent } from './intent';
import {
  buildActionPlan,
  matchPerson,
  toCandidate,
  PRONOUN_TERMS,
  type AssistantPreview,
  type ClarifyCandidate,
  type ExecOp,
  type PlanContext,
} from './plan';
import { normalizeText, SELF_TERMS } from './resolve';

/**
 * AI Quick Entry (DEC-246 · multi-action) — the PURE batch planner. A single
 * spoken/typed message can narrate SEVERAL money events ("o Bruno me pagou um
 * sorvete de 2 euros, a Débora uma água de 1, dividi um bolo de 10 com ela,
 * paguei 4 de estacionamento e dividimos uma pizza de 10 nós 3"). The cloud
 * router now returns ONE `AiIntent` per event; this module plans them as a group:
 *
 *  - aggregates every UNKNOWN/ambiguous person across ALL events into ONE
 *    consolidated clarification (so the user adds new companions in a single tap
 *    instead of being asked per line);
 *  - once people are resolved, turns each event into a ready `ExecOp` (reusing
 *    the SAME `buildActionPlan` the single-intent flow uses — no parallel money
 *    logic), or a "blocked" row when it can't run unattended (missing amount,
 *    foreign currency that needs a rate, an open/navigate intent, or unsupported).
 *
 * It performs NO i/o: the hook creates the participants and re-plans. Keeping the
 * grouping deterministic + pure is what lets us unit-test the canonical 5-event
 * story end to end (who paid, who owes whom, in order).
 */

/** Actions whose entities reference real people (the only ones that can need an
 *  "add/choose person" step). The rest (log_expense, income, transfer…) don't. */
const PEOPLE_ACTIONS: ReadonlySet<AiAction> = new Set<AiAction>([
  'someone_paid',
  'i_paid_for',
  'split_expense',
  'settle_debt',
]);

/** A ready-to-run event: a resolved op + the preview line the sheet renders. */
export interface BatchReady {
  intent: AiIntent;
  op: ExecOp;
  preview: AssistantPreview;
}

/** An event we won't auto-run, with a stable reason key the UI explains. */
export interface BatchBlocked {
  intent: AiIntent;
  /** Best-effort preview (present for foreign/navigate; null for missing data). */
  preview: AssistantPreview | null;
  /** 'amount' | 'foreign' | 'navigate' | an `unsupported` messageKey. */
  reasonKey: string;
}

export interface AssistantBatchPlan {
  ready: BatchReady[];
  blocked: BatchBlocked[];
  /** Unique display names to CREATE (resolve to nobody), across all events. */
  pendingAdd: string[];
  /** Ambiguous names needing a "which one?" choice, across all events. */
  pendingChoose: { name: string; candidates: ClarifyCandidate[] }[];
}

function namesFromIntent(intent: AiIntent): string[] {
  if (!PEOPLE_ACTIONS.has(intent.action)) return [];
  const names: string[] = [];
  if (intent.person) names.push(intent.person);
  for (const p of intent.participants) names.push(p);
  return names;
}

/**
 * Scans every event for the people it names and resolves each against the trip
 * (honoring clarification overrides via `matchPerson`). Skips the user themself
 * and bare pronouns. Returns the de-duplicated set of names that must be ADDED
 * and the ones that are AMBIGUOUS — the single consolidated clarification.
 */
export function collectAssistantPeople(
  intents: AiIntent[],
  ctx: PlanContext,
): { add: string[]; choose: { name: string; candidates: ClarifyCandidate[] }[] } {
  const addSeen = new Set<string>();
  const chooseSeen = new Set<string>();
  const add: string[] = [];
  const choose: { name: string; candidates: ClarifyCandidate[] }[] = [];

  for (const intent of intents) {
    for (const raw of namesFromIntent(intent)) {
      const key = normalizeText(raw);
      if (key === '' || SELF_TERMS.includes(key) || PRONOUN_TERMS.has(key)) continue;
      const match = matchPerson(raw, ctx);
      if (match.status === 'matched') continue;
      if (match.status === 'none') {
        if (!addSeen.has(key)) {
          addSeen.add(key);
          add.push(raw.trim());
        }
      } else {
        if (!chooseSeen.has(key)) {
          chooseSeen.add(key);
          choose.push({ name: raw.trim(), candidates: match.candidates.map(toCandidate) });
        }
      }
    }
  }

  return { add, choose };
}

/**
 * Plans a whole message's events. When people are still pending, `ready`/`blocked`
 * are partial (the hook shows the clarification first, then re-plans); once
 * everyone is known, `ready` holds exactly the ops to commit and `blocked` the
 * ones needing manual attention.
 */
export function planAssistantBatch(intents: AiIntent[], ctx: PlanContext): AssistantBatchPlan {
  const people = collectAssistantPeople(intents, ctx);
  const ready: BatchReady[] = [];
  const blocked: BatchBlocked[] = [];

  for (const intent of intents) {
    const result = buildActionPlan(intent, ctx);

    if (result.status === 'ready') {
      if (result.plan.type === 'execute') {
        const op = result.plan.op;
        // A foreign-currency expense needs a conversion rate the batch can't
        // carry — booking it at face value would corrupt the budget. Block it so
        // the user adds that one manually (parity with the single-flow guard).
        if (op.kind === 'expense' && op.currency !== ctx.baseCurrency) {
          blocked.push({ intent, preview: result.plan.preview, reasonKey: 'foreign' });
        } else {
          ready.push({ intent, op, preview: result.plan.preview });
        }
      } else {
        // A navigate/"open a screen" intent has no place in a multi-event commit.
        blocked.push({ intent, preview: result.plan.preview, reasonKey: 'navigate' });
      }
      continue;
    }

    if (result.status === 'needs') {
      // Person clarifications are aggregated in `people` (resolved before commit);
      // a missing amount is the only `needs` that can't be auto-filled here.
      if (result.clarifications.some((c) => c.type === 'amount')) {
        blocked.push({ intent, preview: null, reasonKey: 'amount' });
      }
      continue;
    }

    blocked.push({ intent, preview: null, reasonKey: result.messageKey });
  }

  return { ready, blocked, pendingAdd: people.add, pendingChoose: people.choose };
}
