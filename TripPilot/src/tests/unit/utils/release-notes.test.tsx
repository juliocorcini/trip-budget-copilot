import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import '@/i18n';
import i18n from '@/i18n';
import {
  RELEASE_NOTES,
  resolveReleaseNoteLang,
  getReleaseNoteItems,
  findReleaseNote,
  getPreviousReleaseNotes,
} from '@/utils/release-notes';
import { APP_VERSION } from '@/utils/app-version';
import { AboutPage } from '@/features/more/AboutPage';

function compareVersionsDesc(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

describe('release notes data integrity', () => {
  it('keeps versions sorted newest first', () => {
    const versions = RELEASE_NOTES.map((n) => n.version);
    const expected = [...versions].sort(compareVersionsDesc);
    expect(versions).toEqual(expected);
  });

  it('registers an entry for the current app version', () => {
    const note = findReleaseNote(APP_VERSION);
    expect(note).not.toBeNull();
  });

  it('every entry has non-empty items in all three languages', () => {
    for (const note of RELEASE_NOTES) {
      expect(note.items['pt-BR'].length).toBeGreaterThan(0);
      expect(note.items.en.length).toBeGreaterThan(0);
      expect(note.items.es.length).toBeGreaterThan(0);
    }
  });
});

describe('resolveReleaseNoteLang', () => {
  it('maps i18n codes to a supported note language with pt-BR fallback', () => {
    expect(resolveReleaseNoteLang('pt-BR')).toBe('pt-BR');
    expect(resolveReleaseNoteLang('pt')).toBe('pt-BR');
    expect(resolveReleaseNoteLang('en')).toBe('en');
    expect(resolveReleaseNoteLang('en-US')).toBe('en');
    expect(resolveReleaseNoteLang('es')).toBe('es');
    expect(resolveReleaseNoteLang('es-419')).toBe('es');
    expect(resolveReleaseNoteLang('fr')).toBe('pt-BR');
  });
});

describe('getReleaseNoteItems', () => {
  it('returns the items array for the active language', () => {
    const note = findReleaseNote(APP_VERSION)!;
    expect(getReleaseNoteItems(note, 'en')).toBe(note.items.en);
    expect(getReleaseNoteItems(note, 'es')).toBe(note.items.es);
    expect(getReleaseNoteItems(note, 'pt-BR')).toBe(note.items['pt-BR']);
  });
});

describe('getPreviousReleaseNotes', () => {
  it('excludes the current version', () => {
    const previous = getPreviousReleaseNotes(APP_VERSION);
    expect(previous.some((n) => n.version === APP_VERSION)).toBe(false);
  });
});

describe('AboutPage what is new section', () => {
  it('renders the current version and its release items', async () => {
    await i18n.changeLanguage('pt-BR');
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(`Versão ${APP_VERSION}`)).toBeInTheDocument();
    expect(screen.getByText('Novidades desta versão')).toBeInTheDocument();

    const note = findReleaseNote(APP_VERSION)!;
    for (const item of note.items['pt-BR']) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });
});
