import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { mirroredStatementRepository, tripRepository } from '@/data/repositories';
import { Icon } from '@/components/Icon';
import { MirroredStatementsSection } from './MirroredStatementsSection';

/**
 * DEC-207 — the guest's permanent, signup-less home. A person who only ever
 * opened a shared link (no trip of their own) lands here: "Compartilhadas
 * comigo" lists every statement shared with them, with confirm/reject + "I
 * paid". They can also start their own trip whenever they want — the link
 * never forced them to.
 */
export function SharedWithMePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [count, setCount] = useState<number | null>(null);
  const [hasTrip, setHasTrip] = useState(false);

  useEffect(() => {
    void (async () => {
      const [statements, tripCount] = await Promise.all([
        mirroredStatementRepository.getAll(),
        tripRepository.count(),
      ]);
      setCount(statements.length);
      setHasTrip(tripCount > 0);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-surface-base flex flex-col">
      <header className="flex items-center justify-between px-4 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <Icon name="folder_shared" size={24} className="text-primary" />
          <h1 className="text-heading font-bold text-on-surface">{t('shareLink.shared_with_me')}</h1>
        </div>
        {hasTrip && (
          <button
            onClick={() => navigate('/dashboard')}
            className="px-3 py-1.5 rounded-xl bg-surface-container flex items-center gap-1.5 btn-press"
          >
            <Icon name="luggage" size={16} className="text-primary" />
            <span className="text-xs font-medium text-on-surface">{t('shareLink.my_trips')}</span>
          </button>
        )}
      </header>

      <div className="flex-1 px-4 pb-8 flex flex-col gap-4">
        <p className="text-sm text-on-surface-dim leading-relaxed">
          {t('shareLink.shared_with_me_intro')}
        </p>

        <MirroredStatementsSection />

        {count === 0 && (
          <div className="bg-surface-container rounded-xl p-6 text-center">
            <Icon name="inbox" size={32} className="text-on-surface-faint mx-auto mb-2" />
            <p className="text-sm text-on-surface-dim">{t('shareLink.shared_with_me_empty')}</p>
          </div>
        )}

        {/* Soft upgrade — start your own trip whenever you want (DEC-207 S6). */}
        {!hasTrip && (
          <button
            onClick={() => navigate('/welcome')}
            className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2 btn-press font-semibold text-sm mt-2"
            style={{ background: '#C75B3918', color: 'var(--primary)', border: '1px dashed #C75B3940' }}
          >
            <Icon name="add_circle" size={18} className="text-primary" />
            {t('shareLink.start_my_trip')}
          </button>
        )}
      </div>
    </div>
  );
}
