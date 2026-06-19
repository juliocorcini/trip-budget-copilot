import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { formatMoney } from '@/domain/money';
import { formatDate } from '@/domain/dates';
import { buildSplitHistory, type SplitClaimChannel, type SplitSession } from '@/domain/split';

/** Icon + tone for each "forma foi escolhido" channel. */
const CHANNEL_META: Record<SplitClaimChannel, { icon: string; color: string }> = {
  owner: { icon: 'person', color: '#818CF8' },
  guest_link: { icon: 'qr_code_2', color: '#6B8F71' },
  manual: { icon: 'edit', color: '#A0A0A0' },
  app_linked: { icon: 'smartphone', color: '#7CA0FF' },
  companion: { icon: 'group', color: '#D4A843' },
};

/**
 * The full division record — who ended up with what, how each person joined the
 * table (the channel), and the per-item breakdown. Reused by the live split
 * screen and the committed-outing review so "a conta toda" is always one tap away.
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
        </div>

        {history.unclaimed.length > 0 && (
          <div className="rounded-xl px-3 py-2.5 bg-warning/10 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Icon name="error" size={15} className="text-warning shrink-0" />
              <p className="text-[12px] font-bold text-warning">{t('splitHistory.unclaimed_title')}</p>
            </div>
            {history.unclaimed.map((line, i) => (
              <div key={i} className="flex items-center justify-between gap-2 pl-6">
                <p className="text-[11px] text-on-surface-dim truncate">
                  {line.description || t('split.unnamed_item')}
                </p>
                <span className="text-[11px] font-semibold text-on-surface-dim shrink-0 tabular">
                  {formatMoney(line.amountCents, currency)}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] text-on-surface-faint text-center leading-relaxed">
          {t('splitHistory.footnote')}
        </p>
      </div>
    </BottomSheet>
  );
}
