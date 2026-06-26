import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@/i18n';
import { GroupExpenseEditor } from '@/features/group-split/GroupExpenseEditor';
import { createGroupSplitEvent, createGroupParticipant, addParticipant } from '@/domain/group-split';
import type { GroupSplitEvent } from '@/domain/group-split';

/**
 * G1 / F05 — a manual line item can be typed by hand (description + amount) and
 * feeds the same `items` list a scan produces; the saved amount is the running
 * sum of the kept lines. Verifies the LOGIC with concrete cents (30 + 60 = 90).
 */
function buildEvent(): GroupSplitEvent {
  const base = createGroupSplitEvent({ name: 'Bar', currency: 'EUR', ownerName: 'Ana' });
  return addParticipant(base, createGroupParticipant({ name: 'Bruno' }));
}

describe('GroupExpenseEditor — manual line items (F05)', () => {
  it('sums hand-typed items into the expense amount (€30 + €60 = €90)', () => {
    const event = buildEvent();
    const onSave = vi.fn();
    render(
      <GroupExpenseEditor
        event={event}
        expense={null}
        photoEnabled={false}
        aiTextEnabled={false}
        isShared={false}
        onClose={() => {}}
        onSave={onSave}
        onDelete={() => {}}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Ex.: Churrasco'), { target: { value: 'Bar' } });

    // Enter item mode via the manual "Adicionar item" affordance (icon + label →
    // accessible name contains the ligature, so match loosely).
    fireEvent.click(screen.getByRole('button', { name: /adicionar item/i }));

    // First line: Cerveja 30.00
    fireEvent.change(screen.getByPlaceholderText('Item (ex.: Cerveja)'), { target: { value: 'Cerveja' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: /adicionar item/i }));

    // Second line: Carne 60.00 (inputs cleared after each add)
    fireEvent.change(screen.getByPlaceholderText('Item (ex.: Cerveja)'), { target: { value: 'Carne' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: /adicionar item/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0]![0] as { amountCents: number; items?: { description: string; amountCents: number }[] };
    expect(saved.amountCents).toBe(9000);
    expect(saved.items).toHaveLength(2);
    expect(saved.items!.map((i) => i.amountCents).sort((a, b) => a - b)).toEqual([3000, 6000]);
    expect(saved.items!.map((i) => i.description)).toContain('Cerveja');
    expect(saved.items!.map((i) => i.description)).toContain('Carne');
    cleanup();
  });

  it('ignores an item with a non-positive amount (Add stays disabled)', () => {
    const event = buildEvent();
    const onSave = vi.fn();
    render(
      <GroupExpenseEditor
        event={event}
        expense={null}
        photoEnabled={false}
        aiTextEnabled={false}
        isShared={false}
        onClose={() => {}}
        onSave={onSave}
        onDelete={() => {}}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Ex.: Churrasco'), { target: { value: 'Bar' } });
    fireEvent.click(screen.getByRole('button', { name: /adicionar item/i }));
    // Type a description but leave the amount empty → the add button is disabled.
    fireEvent.change(screen.getByPlaceholderText('Item (ex.: Cerveja)'), { target: { value: 'Água' } });
    const addBtn = screen.getByRole('button', { name: /adicionar item/i }) as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
    cleanup();
  });
});
