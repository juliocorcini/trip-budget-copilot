import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { ToastHost, showToast } from '@/components/Toast';

/**
 * Julio device test 2026-06-18 — undo toasts misfired on any tap, and could not
 * be cleared by hand. Contract now: the action (e.g. "Desfazer") fires ONLY from
 * its chip; a stray tap on the body does nothing; an action-bearing prompt
 * WITHOUT a chip (the persistent "tap to update" toast) keeps tap-anywhere.
 * (Swipe-to-dismiss is a pointer gesture, covered by Playwright.)
 */
describe('Toast — undo is chip-only (device test 2026-06-18)', () => {
  beforeEach(() => cleanup());

  it('does NOT fire the action when the toast body is tapped (undo toast)', () => {
    const onTap = vi.fn();
    render(<ToastHost />);
    act(() => {
      showToast('Gasto excluído', 'success', { actionLabel: 'Desfazer', onTap, persistent: true });
    });
    fireEvent.click(screen.getByText('Gasto excluído'));
    expect(onTap).not.toHaveBeenCalled();
    // A stray tap must not remove it either — the undo window stays open.
    expect(screen.getByText('Gasto excluído')).toBeInTheDocument();
  });

  it('fires the action ONLY from the chip, then dismisses', () => {
    const onTap = vi.fn();
    render(<ToastHost />);
    act(() => {
      showToast('Gasto excluído', 'success', { actionLabel: 'Desfazer', onTap, persistent: true });
    });
    fireEvent.click(screen.getByRole('button', { name: /desfazer/i }));
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Gasto excluído')).not.toBeInTheDocument();
  });

  it('keeps tap-anywhere for an action prompt WITHOUT a chip (update prompt)', () => {
    const onTap = vi.fn();
    render(<ToastHost />);
    act(() => {
      showToast('Atualização disponível', 'info', { onTap, persistent: true });
    });
    fireEvent.click(screen.getByText('Atualização disponível'));
    expect(onTap).toHaveBeenCalledTimes(1);
  });
});
