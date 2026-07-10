import { getSyncWorkerUrl, aiRequestHeaders } from '@/data/sync/config';
import { logger } from '@/utils/logger';
import { readCooldown } from '@/utils/ai-rate-limit';
import type { AiCooldown } from '@/domain/assistant';

export type PlanCopilotError =
  | 'not_configured'
  | 'rate_limited'
  | 'offline'
  | 'timeout'
  | 'failed';

export interface CurrentSpending {
  profile_id: string;
  category: string;
  occasions_done: number;
  avg_cost_cents: number;
  total_spent_cents: number;
}

export interface AnalyzeInput {
  destination: string;
  duration_days: number;
  budget_cents: number;
  reserve_cents: number;
  currency: string;
  language: string;
  selected_activities?: string[];
  current_spending?: CurrentSpending[];
  spending_style?: string;
}

export interface AnalyzeQuestion {
  id: string;
  text: string;
  why: string;
  type?: 'single_choice' | 'multi_choice';
  options: Array<{ id: string; label: string; emoji?: string }>;
  allow_other?: boolean;
}

export interface AnalyzeResult {
  questions: AnalyzeQuestion[];
  context_summary: string;
}

export interface GenerateInput extends AnalyzeInput {
  answers: Record<string, string>;
  current_spending?: CurrentSpending[];
}

export interface GenerateActivity {
  type: string;
  spending_level: string;
  suggested_quantity: number;
  typical_cost_cents: number;
  reasoning: string;
}

export interface GenerateResult {
  plan: {
    activities: GenerateActivity[];
    free_budget_cents: number;
  };
  computed: {
    total_planned_cents: number;
    margin_cents: number;
    margin_percent: number;
  };
  context_used: Record<string, unknown>;
  insights: string[];
  confidence: string;
}

export type AnalyzeOutcome =
  | { ok: true; data: AnalyzeResult }
  | { ok: false; error: PlanCopilotError; cooldown?: AiCooldown };

export type GenerateOutcome =
  | { ok: true; data: GenerateResult }
  | { ok: false; error: PlanCopilotError; cooldown?: AiCooldown };

const TIMEOUT_MS = 12_000;

async function post<T>(path: string, body: unknown): Promise<
  | { ok: true; data: T }
  | { ok: false; error: PlanCopilotError; cooldown?: AiCooldown }
> {
  const url = `${getSyncWorkerUrl()}${path}`;
  const headers = aiRequestHeaders();
  const requestId = headers['X-Request-Id'];

  let response: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === 'AbortError') {
      logger.warn('plan_copilot_timeout', { path, requestId });
      return { ok: false, error: 'timeout' };
    }
    logger.warn('plan_copilot_offline', { path, requestId });
    return { ok: false, error: 'offline' };
  }
  clearTimeout(timer);

  if (response.status === 429) {
    const cooldown = await readCooldown(response);
    return { ok: false, error: 'rate_limited', cooldown };
  }
  if (response.status === 503) {
    return { ok: false, error: 'not_configured' };
  }
  if (!response.ok) {
    logger.warn('plan_copilot_failed', { path, status: response.status, requestId });
    return { ok: false, error: 'failed' };
  }

  try {
    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch {
    logger.warn('plan_copilot_parse', { path, requestId });
    return { ok: false, error: 'failed' };
  }
}

export function analyzeTrip(input: AnalyzeInput): Promise<AnalyzeOutcome> {
  return post<AnalyzeResult>('/plan-copilot/analyze', input);
}

export function generatePlan(input: GenerateInput): Promise<GenerateOutcome> {
  return post<GenerateResult>('/plan-copilot/generate', input);
}
