import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/Icon';
import { APP_VERSION } from '@/utils/app-version';
import { findReleaseNote, getPreviousReleaseNotes, getReleaseNoteItems } from '@/utils/release-notes';

// DEC-059 (GAP-023, decision D-D): dedicated About entry — no Reports in D1/D2.
export function AboutPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [showPrevious, setShowPrevious] = useState(false);

  const currentNote = findReleaseNote(APP_VERSION);
  const previousNotes = getPreviousReleaseNotes(APP_VERSION);

  return (
    <div className="flex flex-col gap-4 pb-4 pt-2">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('about.title')}</h1>
      </div>

      <div className="bg-surface-container rounded-2xl p-6 text-center">
        <div
          className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3"
          style={{ background: '#C75B3918' }}
        >
          <Icon name="flight_takeoff" size={28} className="text-primary" />
        </div>
        <p className="text-lg font-extrabold text-on-surface">TripPilot</p>
        <p className="text-xs text-on-surface-dim mt-1">{t('about.version', { version: APP_VERSION })}</p>
        <p className="text-xs text-on-surface-faint mt-3">{t('about.description')}</p>
      </div>

      {currentNote && (
        <div className="bg-surface-container rounded-2xl p-5">
          <p className="text-sm font-bold text-on-surface mb-3">{t('about.whats_new')}</p>
          <ul className="flex flex-col gap-2">
            {getReleaseNoteItems(currentNote, i18n.language).map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <Icon name="check_circle" size={16} className="text-primary mt-0.5 shrink-0" />
                <span className="text-sm text-on-surface-dim">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {previousNotes.length > 0 && (
        <div className="bg-surface-container rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowPrevious((prev) => !prev)}
            className="w-full px-5 py-4 flex items-center justify-between btn-press text-left"
            aria-expanded={showPrevious}
          >
            <span className="text-sm font-semibold text-on-surface">{t('about.previous_versions')}</span>
            <Icon
              name={showPrevious ? 'expand_less' : 'expand_more'}
              size={20}
              className="text-on-surface-faint"
            />
          </button>
          {showPrevious && (
            <div className="px-5 pb-5 flex flex-col gap-4">
              {previousNotes.map((note) => (
                <div key={note.version}>
                  <p className="text-xs font-bold text-on-surface-dim mb-2">
                    {t('about.version', { version: note.version })}
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {getReleaseNoteItems(note, i18n.language).map((item, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-on-surface-faint mt-0.5">·</span>
                        <span className="text-xs text-on-surface-faint">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => navigate('/settings/backup')}
        className="bg-surface-container rounded-xl px-4 py-3 flex items-center gap-3 btn-press text-left"
      >
        <Icon name="cloud_upload" size={20} className="text-on-surface-dim" />
        <span className="text-sm text-on-surface flex-1">{t('about.backup_link')}</span>
        <Icon name="chevron_right" size={18} className="text-on-surface-faint" />
      </button>

      <p className="text-[10px] text-on-surface-faint text-center px-6">{t('about.local_first')}</p>
    </div>
  );
}
