import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@/i18n';
import { InstallComparison } from '@/features/install/InstallComparison';

/**
 * DEC-364 (wave 2026-06-27) — the install comparison table must be PLATFORM
 * AWARE. The field bug: an iPhone saw an "App (APK)" column it can never use,
 * and every audience saw an OTA "updates" row that undercut the "APK is the most
 * complete install" message. These prove the column set comes from the audience
 * and that the updates row is gone for everyone.
 */
describe('InstallComparison — platform-aware columns (DEC-364 A2/A3/A4)', () => {
  afterEach(cleanup);

  it('shows the App (APK) column on Android', () => {
    render(<InstallComparison audience="android" />);
    expect(screen.getByText('App (APK)')).toBeInTheDocument();
    expect(screen.getByText('Atalho')).toBeInTheDocument();
    expect(screen.getByText('Navegador')).toBeInTheDocument();
  });

  it('hides the App (APK) column on iOS (an iPhone cannot install an APK)', () => {
    render(<InstallComparison audience="ios" />);
    expect(screen.queryByText('App (APK)')).not.toBeInTheDocument();
    expect(screen.getByText('Atalho')).toBeInTheDocument();
    expect(screen.getByText('Navegador')).toBeInTheDocument();
  });

  it('hides the App (APK) column on desktop too', () => {
    render(<InstallComparison audience="desktop" />);
    expect(screen.queryByText('App (APK)')).not.toBeInTheDocument();
  });

  it('never renders the OTA "updates" row for any audience (A4)', () => {
    render(<InstallComparison audience="android" />);
    expect(screen.queryByText('Atualização automática')).not.toBeInTheDocument();
    // The five kept capabilities still render.
    expect(screen.getByText('Notificações')).toBeInTheDocument();
    expect(screen.getByText('Widgets na tela inicial')).toBeInTheDocument();
    expect(screen.getByText('Dados protegidos')).toBeInTheDocument();
  });
});
