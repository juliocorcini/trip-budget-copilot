import { describe, it, expect } from 'vitest';
import { fallbackExpenseDescription } from '@/features/assistant/useAssistant';
import type { ExecOp } from '@/domain/assistant';

/**
 * DEC-403 (G4): when the AI leaves an expense without a description, the device
 * falls back FACTUALLY — the resolved place name, then a neutral label — and
 * NEVER the category (which used to surface "Outros"/"Restaurant" as the text).
 */

type ExpenseOp = Extract<ExecOp, { kind: 'expense' }>;

// The fallback reads only `op.place`; a minimal cast keeps the fixture honest
// without rebuilding the whole 20-field expense op.
function expenseOp(place: { label: string } | null): ExpenseOp {
  return { kind: 'expense', category: 'other', description: '', place } as unknown as ExpenseOp;
}

const t = (key: string): string => key;

describe('fallbackExpenseDescription (DEC-403 · G4)', () => {
  it('uses the resolved place name when there is no description', () => {
    expect(fallbackExpenseDescription(expenseOp({ label: 'Bar do Zé' }), t)).toBe('Bar do Zé');
  });

  it('falls back to a neutral label — never the category — when there is no place', () => {
    const result = fallbackExpenseDescription(expenseOp(null), t);
    expect(result).toBe('assistant.expense_fallback');
    // The bug being fixed: the category must NEVER be the description.
    expect(result).not.toBe('categories.other');
  });

  it('treats a blank place name as no place and still avoids the category', () => {
    expect(fallbackExpenseDescription(expenseOp({ label: '   ' }), t)).toBe(
      'assistant.expense_fallback',
    );
  });
});
