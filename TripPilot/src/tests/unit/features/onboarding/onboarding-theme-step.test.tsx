import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import '@/i18n';
import { OnboardingPage } from '@/features/onboarding/OnboardingPage';

/**
 * DEC-449 (D05) — the onboarding asks for the theme in ONE tap: 3 cards
 * (Claro / Escuro / Sistema), System pre-selected, never blocking Próximo.
 * These pin that (1) a tapped choice is persisted in the SAME finishing write
 * as appMode, and (2) skipping the step persists the default 'system'.
 */

const updateSpy = vi.hoisted(() => vi.fn(async (patch: unknown) => patch));
const createTripSpy = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@/hooks/useAppData', () => ({
  useAppData: () => ({ settings: { tripTemplates: [] }, reload: vi.fn(async () => undefined) }),
}));

vi.mock('@/data/repositories', () => ({
  appSettingsRepository: { update: updateSpy },
}));

vi.mock('@/domain/orchestrators', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    createTripFromOnboarding: createTripSpy,
    createTripFromTemplate: createTripSpy,
  };
});

// jsdom has no scrollIntoView; the Field's keyboard-visibility helper calls it
// on focus (async, 250ms) — stub it so the timer never throws after teardown.
Element.prototype.scrollIntoView = vi.fn();

function renderOnboarding() {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <OnboardingPage />
    </MemoryRouter>,
  );
}

/** Walk identity + quick steps, land on the theme step. */
function advanceToThemeStep(container: HTMLElement) {
  // Identity: the name gates Próximo.
  const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
  fireEvent.change(nameInput, { target: { value: 'Julio' } });
  fireEvent.click(screen.getByText('Próximo'));

  // Quick step: amount + end date gate Próximo.
  const amount = container.querySelector('input[type="number"]') as HTMLInputElement;
  const endDate = container.querySelector('input[type="date"]') as HTMLInputElement;
  fireEvent.change(amount, { target: { value: '1000' } });
  fireEvent.change(endDate, { target: { value: '2026-08-01' } });
  fireEvent.click(screen.getByText('Próximo'));

  // G2: activity chips step — skip it.
  fireEvent.click(screen.getByText('Próximo'));

  // Now on the theme step.
  expect(screen.getByText('Claro ou escuro?')).toBeInTheDocument();
}

async function finishFromThemeStep() {
  fireEvent.click(screen.getByText('Próximo'));
  fireEvent.click(screen.getByText('Começar simples'));
  await waitFor(() => expect(updateSpy).toHaveBeenCalled());
}

describe('Onboarding theme step (DEC-449 / D05)', () => {
  beforeEach(() => {
    cleanup();
    updateSpy.mockClear();
    createTripSpy.mockClear();
  });

  it('persists a tapped theme in the same finishing write as appMode', async () => {
    const { container } = renderOnboarding();
    advanceToThemeStep(container);

    fireEvent.click(screen.getByText('Claro'));
    await finishFromThemeStep();

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        themePreference: 'light',
        appMode: 'simple',
        onboardingCompleted: true,
      }),
    );
  });

  it('skipping the step (no tap) persists the default System', async () => {
    const { container } = renderOnboarding();
    advanceToThemeStep(container);

    // No interaction with the cards — Próximo is enabled (skippable step).
    await finishFromThemeStep();

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ themePreference: 'system' }),
    );
  });
});
