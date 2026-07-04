import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useLocation, useNavigate } from 'react-router';
import { parseShareKeyFromHash } from '@/domain/sync';
import { formatMoney } from '@/domain/money';
import { formatDate, localDayOf, localClockTime } from '@/domain/dates';
import { imageUrl } from '@/data/sync/media-link';
import { getCategoryIcon } from '@/utils/category-icons';
import { Icon } from '@/components/Icon';
import {
  fetchSharedExpense,
  type FetchExpenseStatus,
} from './expense-share';
import type { ExpenseSharePayload } from '@/domain/sync';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; status: FetchExpenseStatus }
  | { kind: 'ready'; payload: ExpenseSharePayload };

/**
 * DEC-457 — the shared-expense landing route `/x/:id`. Lives OUTSIDE BootGate
 * so anyone (no app, no trip) can open it. Read-only: the guest sees the
 * expense exactly as the owner shared it — amount, category, date, place,
 * notes and photos — and nothing else of the owner's finances. The AES key
 * comes from the `#k=` fragment (legacy) or the worker escrow (DEC-455).
 */
export function ExpenseSharePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const location = useLocation();

  const id = params.id ?? null;
  const key = useMemo(() => parseShareKeyFromHash(location.hash), [location.hash]);
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });

  const run = useCallback(async () => {
    if (!id) {
      setLoad({ kind: 'error', status: 'bad_key' });
      return;
    }
    setLoad({ kind: 'loading' });
    const res = await fetchSharedExpense(id, key);
    if (res.status === 'ok') setLoad({ kind: 'ready', payload: res.payload });
    else setLoad({ kind: 'error', status: res.status });
  }, [id, key]);

  useEffect(() => {
    void run();
  }, [run]);

  if (load.kind === 'loading') {
    return (
      <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center gap-4 px-8">
        <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-on-surface-dim">{t('expenseShare.opening')}</p>
      </div>
    );
  }

  if (load.kind === 'error') {
    const message: Record<FetchExpenseStatus, string> = {
      revoked: t('expenseShare.err_revoked'),
      not_found: t('expenseShare.err_not_found'),
      bad_key: t('expenseShare.err_bad_key'),
      error: t('expenseShare.err_network'),
    };
    return (
      <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center gap-4 px-8 text-center">
        <Icon name="link_off" size={40} className="text-on-surface-faint" />
        <p className="text-sm text-on-surface-dim leading-relaxed">{message[load.status]}</p>
        {load.status === 'error' && (
          <button
            onClick={() => void run()}
            className="px-6 py-3 rounded-xl bg-primary text-on-surface font-semibold text-sm btn-press"
          >
            {t('expenseShare.retry')}
          </button>
        )}
        <button onClick={() => navigate('/')} className="text-xs text-primary btn-press">
          {t('expenseShare.go_home')}
        </button>
      </div>
    );
  }

  const { payload } = load;
  return (
    <div className="min-h-screen bg-surface-base flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md flex flex-col gap-4">
        <p className="text-xs text-on-surface-faint text-center">
          {t('expenseShare.shared_by', { name: payload.ownerName })}
        </p>

        <div className="bg-surface-container rounded-2xl p-5 text-center">
          <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 bg-primary/10">
            <Icon name={getCategoryIcon(payload.category)} size={24} className="text-primary" />
          </div>
          <p className="text-display font-extrabold tabular text-on-surface leading-none">
            {formatMoney(payload.amountCents, payload.currency)}
          </p>
          {payload.description && (
            <p className="text-sm text-on-surface-dim mt-2">{payload.description}</p>
          )}
        </div>

        <div className="bg-surface-container rounded-xl divide-y divide-on-surface-mute">
          {payload.category && (
            <ShareDetailRow
              label={t('expenses.category')}
              value={t(`categories.${payload.category}` as never)}
            />
          )}
          <ShareDetailRow label={t('expenses.date')} value={formatDate(localDayOf(payload.date))} />
          <ShareDetailRow label={t('expenses.time')} value={localClockTime(payload.date)} />
          {payload.placeLabel && (
            <ShareDetailRow label={t('expenses.location_label')} value={payload.placeLabel} />
          )}
        </div>

        {payload.notes && (
          <div className="bg-surface-container rounded-xl p-4">
            <p className="text-xs text-on-surface-faint mb-1">{t('expenseShare.notes')}</p>
            <p className="text-sm text-on-surface whitespace-pre-wrap">{payload.notes}</p>
          </div>
        )}

        {payload.images.length > 0 && (
          <div className={payload.images.length === 1 ? '' : 'grid grid-cols-2 gap-2'}>
            {payload.images.map((img) => (
              <a
                key={img.r2Id}
                href={imageUrl({ r2Id: img.r2Id, mime: img.mime, w: img.w, h: img.h })}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl overflow-hidden bg-surface-container"
              >
                <img
                  src={imageUrl({ r2Id: img.r2Id, mime: img.mime, w: img.w, h: img.h })}
                  alt={payload.description || t('expenseShare.photo_alt')}
                  loading="lazy"
                  className="w-full h-auto object-cover"
                />
              </a>
            ))}
          </div>
        )}

        <button
          onClick={() => navigate('/')}
          className="mt-2 text-xs text-primary btn-press text-center"
        >
          {t('expenseShare.made_with')}
        </button>
      </div>
    </div>
  );
}

function ShareDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      <span className="text-xs text-on-surface-faint shrink-0">{label}</span>
      <span className="text-sm text-on-surface text-right">{value}</span>
    </div>
  );
}
