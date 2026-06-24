import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { formatMoney } from '@/domain/money';
import { formatDate } from '@/domain/dates';
import {
  buildSplitHistory,
  type SplitClaimChannel,
  type SplitHistory,
  type SplitSession,
} from '@/domain/split';

/** Icon + tone for each "forma foi escolhido" channel. */
const CHANNEL_META: Record<SplitClaimChannel, { icon: string; color: string }> = {
  owner: { icon: 'person', color: 'var(--ai-2)' },
  guest_link: { icon: 'qr_code_2', color: '#6B8F71' },
  manual: { icon: 'edit', color: '#A0A0A0' },
  app_linked: { icon: 'smartphone', color: '#7CA0FF' },
  companion: { icon: 'group', color: '#D4A843' },
};

type HistoryView = 'people' | 'items';

/**
 * The full division record — who ended up with what, how each person joined the
 * table (the channel), and the per-item breakdown, readable BOTH ways: by person
 * ("a minha parte e a de cada um") and by item ("esse prato foi pra quem"). Reused
 * by the live split screen and the committed-expense review so "a conta toda" is
 * always one tap away.
 */
export function SplitHistorySheet({
  open,
  onClose,
  session,
  ownerName,
}: {
  open: boolean;
  onClose: () => void;
  session: SplitSession | null;
  ownerName?: string;
}) {
  const { t } = useTranslation();
  const [view, setView] = useState<HistoryView>('people');
  if (!session) return null;

  const history = buildSplitHistory(session, { ownerName });
  const currency = history.currency;

  return (
    <BottomSheet open={open} onClose={onClose} title={t('splitHistory.title')}>
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex items-baseline justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold text-on-surface truncate">{history.name}</p>
            <p className="text-[11px] text-on-surface-faint">
              {t('splitHistory.started_on', { date: formatDate(history.createdAt, "d 'de' MMM") })}
              {' · '}
              {t(`split.mode_${history.mode}`)}
            </p>
          </div>
          <span className="text-base font-extrabold text-on-surface shrink-0">
            {formatMoney(history.grandTotalCents, currency)}
          </span>
        </div>

        {/* Two ways to read the same division: by person or by item. */}
        <div className="flex p-1 rounded-xl gap-1" style={{ background: 'var(--surface-container)' }}>
          <ViewTab active={view === 'people'} onClick={() => setView('people')} icon="group" label={t('splitHistory.by_person')} />
          <ViewTab active={view === 'items'} onClick={() => setView('items')} icon="receipt_long" label={t('splitHistory.by_item')} />
        </div>

        {view === 'people' ? (
          <PeopleView history={history} currency={currency} t={t} />
        ) : (
          <ItemsView history={history} currency={currency} t={t} />
        )}

        <p className="text-[10px] text-on-surface-faint text-center leading-relaxed">
          {t('splitHistory.footnote')}
        </p>
      </div>
    </BottomSheet>
  );
}

function ViewTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg btn-press transition-colors"
      style={
        active
          ? { background: 'var(--surface-high)', color: 'var(--on-surface)' }
          : { color: 'var(--on-surface-dim)' }
      }
    >
      <Icon name={icon} size={16} className={active ? 'text-on-surface' : 'text-on-surface-dim'} />
      <span className="text-xs font-bold">{label}</span>
    </button>
  );
}

type TFn = ReturnType<typeof useTranslation>['t'];

function PeopleView({ history, currency, t }: { history: SplitHistory; currency: string; t: TFn }) {
  const unclaimedCents = history.unclaimed.reduce((sum, u) => sum + u.amountCents, 0);
  return (
    <div className="flex flex-col gap-2.5">
      {history.entries.map((entry) => {
        const meta = CHANNEL_META[entry.channel];
        return (
          <div
            key={entry.participantId}
            className="rounded-2xl p-3.5 flex flex-col gap-2"
            style={{ background: 'var(--surface-container)' }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: `${meta.color}26` }}
              >
                <Icon name={meta.icon} size={18} style={{ color: meta.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-on-surface truncate">
                  {entry.isOwner ? t('split.you') : entry.name}
                </p>
                <p className="text-[10px] font-semibold" style={{ color: meta.color }}>
                  {t(`splitHistory.channel_${entry.channel}`)}
                </p>
              </div>
              <span className="text-sm font-extrabold text-on-surface shrink-0">
                {formatMoney(entry.totalCents, currency)}
              </span>
            </div>

            {entry.lines.length > 0 && (
              <div className="flex flex-col gap-1 pl-11">
                {entry.lines.map((line, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-on-surface-dim truncate">
                      {line.description || t('split.unnamed_item')}
                      {line.sharedCount > 1 && (
                        <span className="text-on-surface-faint">
                          {' · '}
                          {t('split.shared_n', { count: line.sharedCount })}
                        </span>
                      )}
                    </p>
                    <span className="text-[11px] font-semibold text-on-surface-dim shrink-0 tabular">
                      {formatMoney(line.amountCents, currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {(entry.serviceCents !== 0 || entry.adjustmentsCents !== 0) && (
              <div className="flex flex-col gap-1 pl-11">
                {entry.serviceCents !== 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-on-surface-faint">{t('split.tax_short')}</p>
                    <span className="text-[11px] font-semibold text-on-surface-faint tabular">
                      {formatMoney(entry.serviceCents, currency)}
                    </span>
                  </div>
                )}
                {entry.adjustmentsCents !== 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-on-surface-faint">{t('splitHistory.adjustments')}</p>
                    <span className="text-[11px] font-semibold text-on-surface-faint tabular">
                      {formatMoney(entry.adjustmentsCents, currency)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Orphans — the "ninguém pegou" lines that fall to the owner at commit.
          Part of "a conta toda": the bill is only fully shown with these. */}
      {history.unclaimed.length > 0 && (
        <div
          className="rounded-2xl p-3.5 flex flex-col gap-2"
          style={{ background: 'var(--surface-container)', border: '1px solid color-mix(in srgb, var(--warning) 35%, transparent)' }}
        >
          <div className="flex items-center gap-2">
            <Icon name="error" size={16} className="text-warning shrink-0" />
            <p className="text-[13px] font-bold text-warning flex-1 min-w-0">{t('splitHistory.unclaimed_title')}</p>
            <span className="text-sm font-extrabold text-on-surface shrink-0 tabular">
              {formatMoney(unclaimedCents, currency)}
            </span>
          </div>
          <div className="flex flex-col gap-1 pl-6">
            {history.unclaimed.map((u, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-on-surface-dim truncate">
                  {u.description || t('split.unnamed_item')}
                </p>
                <span className="text-[11px] font-semibold text-on-surface-dim shrink-0 tabular">
                  {formatMoney(u.amountCents, currency)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-on-surface-faint pl-6">{t('splitHistory.unclaimed_note')}</p>
        </div>
      )}
    </div>
  );
}

function ItemsView({ history, currency, t }: { history: SplitHistory; currency: string; t: TFn }) {
  return (
    <div className="flex flex-col gap-2.5">
      {history.items.map((item) => (
        <div
          key={item.itemId}
          className="rounded-2xl p-3.5 flex flex-col gap-2"
          style={{ background: 'var(--surface-container)' }}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-on-surface truncate">
              {item.qty > 1 && <span className="text-on-surface-dim">{item.qty}× </span>}
              {item.description || t('split.unnamed_item')}
            </p>
            <span className="text-sm font-extrabold text-on-surface shrink-0 tabular">
              {formatMoney(item.amountCents, currency)}
            </span>
          </div>

          {!item.claimed ? (
            <div className="flex items-center gap-1.5 pl-0.5">
              <Icon name="error" size={14} className="text-warning shrink-0" />
              <p className="text-[11px] font-semibold text-warning">{t('splitHistory.item_nobody')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {item.takers.map((taker) => {
                const meta = CHANNEL_META[taker.channel];
                return (
                  <div key={taker.participantId} className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: `${meta.color}26` }}
                    >
                      <Icon name={meta.icon} size={13} style={{ color: meta.color }} />
                    </div>
                    <p className="text-[12px] font-semibold text-on-surface truncate flex-1 min-w-0">
                      {taker.isOwner ? t('split.you') : taker.name}
                      {taker.weight < 0.999 && (
                        <span className="text-on-surface-faint font-normal">
                          {' · '}
                          {t('splitHistory.item_share', { count: item.takers.length })}
                        </span>
                      )}
                    </p>
                    <span className="text-[12px] font-semibold text-on-surface-dim shrink-0 tabular">
                      {formatMoney(taker.shareCents, currency)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
