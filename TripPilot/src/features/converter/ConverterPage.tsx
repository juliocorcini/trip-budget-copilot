import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import {
  convertAmount,
  convertWithManualRate,
  converterCurrencies,
  rateAgeDays,
  parseLocaleNumber,
  toCents,
  formatMoney,
  type ConversionResult,
} from '@/domain/money';
import { getActiveIntlLocale } from '@/domain/locale';
import { fetchExchangeRates } from '@/utils/exchange-rates';
import { appSettingsRepository } from '@/data/repositories';
import { Icon } from '@/components/Icon';
import { OfflineSeal } from '@/components/OfflineSeal';
import { LoadingScreen } from '@/components/LoadingScreen';
import { DataErrorScreen } from '@/components/DataErrorScreen';
import { showToast } from '@/components/Toast';

/**
 * FB-04 (DEC-256) — the dedicated currency converter. A minimalist calculator
 * (amount + two pickers + ⇄ + a big result) that REUSES the frozen FX snapshot
 * (no new provider/key) and is honest about the rate age. The conversion is a
 * pure read (`domain/money/converter.ts`) — it never touches the budget. When a
 * pair has no cached rate (or the traveler is offline), a one-tap manual rate
 * keeps it usable; the rate age is always visible (a converter that lies is
 * worse than none).
 */
export function ConverterPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trip, wallets, settings, loading, error, retry, reload } = useAppData();

  const [amount, setAmount] = useState(() => searchParams.get('amount') ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualRate, setManualRate] = useState('');
  const [fetching, setFetching] = useState(false);
  const initedRef = useRef(false);

  const frozen = settings?.frozenRates ?? null;
  const baseCurrency = trip?.baseCurrency ?? settings?.defaultCurrency ?? 'EUR';
  const anchor = settings?.anchorCurrency ?? null;
  // M21 (DEC-256): "home" = the anchor when set, else the user's default currency.
  // The converter opens converting the trip currency → home so it's useful at the
  // first tap (never a dead EUR→EUR when a distinct home is known).
  const homeCurrency = (anchor ?? settings?.defaultCurrency ?? '').trim().toUpperCase() || null;
  // FB-04: an AI "quanto é X em Y?" hands the pair via query — seed both so they
  // always appear as options, even if absent from the wallets/snapshot.
  const queryFrom = (searchParams.get('from') ?? '').trim().toUpperCase() || null;
  const queryTo = (searchParams.get('to') ?? '').trim().toUpperCase() || null;

  const currencies = converterCurrencies(frozen, [
    baseCurrency,
    ...wallets.map((w) => w.currency),
    ...(homeCurrency ? [homeCurrency] : []),
    ...(queryFrom ? [queryFrom] : []),
    ...(queryTo ? [queryTo] : []),
  ]);

  // Defaults once data is in. A query pair (from the AI) wins; otherwise DEC-256:
  // from = trip currency → to = anchor (home) when set and different, else the
  // first foreign currency we know about.
  useEffect(() => {
    if (initedRef.current || !trip) return;
    initedRef.current = true;
    const fromDefault = queryFrom && currencies.includes(queryFrom) ? queryFrom : baseCurrency;
    const firstForeign = currencies.find((c) => c !== fromDefault) ?? fromDefault;
    const toDefault =
      queryTo && currencies.includes(queryTo) && queryTo !== fromDefault
        ? queryTo
        : homeCurrency && homeCurrency !== fromDefault && currencies.includes(homeCurrency)
          ? homeCurrency
          : firstForeign;
    setFrom(fromDefault);
    setTo(toDefault);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip]);

  if (!trip) {
    if (error) return <DataErrorScreen onRetry={retry} />;
    if (loading) return <LoadingScreen />;
    return <Navigate to="/welcome" replace />;
  }

  const value = parseLocaleNumber(amount);
  const manualRateValue = parseLocaleNumber(manualRate);
  const ageLabel = (() => {
    if (!frozen) return t('converter.no_snapshot');
    const date = new Date(frozen.fetchedAt).toLocaleDateString(i18n.language);
    const days = rateAgeDays(frozen, new Date());
    if (days === null || days <= 0) return t('converter.rate_age_today', { date });
    return t('converter.rate_age', { count: days, date });
  })();
  const result: ConversionResult | null =
    value === null || value < 0
      ? null
      : manualMode
        ? convertWithManualRate(value, manualRateValue ?? 0)
        : convertAmount(value, from, to, frozen);

  // The pair has no cached rate (and isn't same-currency) → nudge the manual path.
  const pairUnavailable = !manualMode && from !== to && value !== null && result === null;
  const rateForLine = result?.rate ?? null;

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const refreshRates = async () => {
    setFetching(true);
    try {
      const rates = await fetchExchangeRates(baseCurrency);
      if (rates) {
        await appSettingsRepository.update({ frozenRates: rates });
        await reload();
        showToast(t('converter.updated'), 'success');
      } else {
        showToast(t('converter.update_failed'), 'warning');
      }
    } catch {
      showToast(t('converter.update_failed'), 'warning');
    } finally {
      setFetching(false);
    }
  };

  const formatRate = (rate: number): string =>
    new Intl.NumberFormat(getActiveIntlLocale(), {
      minimumFractionDigits: 2,
      maximumFractionDigits: rate < 1 ? 4 : 2,
    }).format(rate);

  const currencyOption = (code: string) => (
    <option key={code} value={code}>
      {code}
    </option>
  );

  const selectClass =
    'flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold bg-surface-container text-on-surface outline-none appearance-none text-center';

  return (
    <div className="max-w-[430px] mx-auto flex flex-col gap-4 pb-4 pt-2 min-h-screen px-[var(--page-padding-x)]">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('converter.title')}</h1>
        <OfflineSeal className="ml-auto" />
      </div>

      {/* Amount + currency pickers with the ⇄ swap between them. */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-on-surface">{t('converter.amount_label')}</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder={t('converter.amount_placeholder')}
            autoFocus
            className="px-4 py-3 rounded-2xl text-2xl font-bold tabular bg-surface-container text-on-surface outline-none placeholder:text-on-surface-faint placeholder:font-normal"
          />
        </div>

        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-on-surface-faint">{t('converter.from_label')}</label>
            <select value={from} onChange={(e) => setFrom(e.target.value)} className={selectClass}>
              {currencies.map(currencyOption)}
            </select>
          </div>
          <button
            onClick={swap}
            className="btn-press mb-0.5 w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--surface-high)' }}
            aria-label={t('converter.swap')}
          >
            <Icon name="swap_horiz" size={20} className="text-primary" />
          </button>
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-on-surface-faint">{t('converter.to_label')}</label>
            <select value={to} onChange={(e) => setTo(e.target.value)} className={selectClass}>
              {currencies.map(currencyOption)}
            </select>
          </div>
        </div>
      </div>

      {/* The big result. */}
      <div className="rounded-2xl px-4 py-5 flex flex-col items-center gap-1" style={{ background: 'var(--surface-container)' }}>
        {result ? (
          <>
            <p className="text-3xl font-extrabold text-on-surface tabular text-center">
              {formatMoney(toCents(result.amount), to)}
            </p>
            {rateForLine !== null && (
              <p className="text-xs text-on-surface-dim text-center">
                {t('converter.rate_line', { from, rate: formatRate(rateForLine), to })}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-on-surface-faint text-center">
            {pairUnavailable ? t('converter.no_rate_hint') : t('converter.enter_amount')}
          </p>
        )}
      </div>

      {/* Honesty stamp: rate age + 1-tap refresh. Always visible (Critic). */}
      <div className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: 'var(--surface-container)' }}>
        <span className="text-[11px] text-on-surface-faint">{ageLabel}</span>
        <button
          onClick={refreshRates}
          disabled={fetching}
          className="text-[11px] font-semibold text-primary btn-press flex items-center gap-1 disabled:opacity-50"
        >
          <Icon name="refresh" size={13} />
          {fetching ? t('converter.updating') : t('converter.update')}
        </button>
      </div>

      {/* Manual rate — always one tap away (offline / missing pair). */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setManualMode((v) => !v)}
          className="flex items-center justify-between btn-press"
        >
          <span className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
            <Icon name="tune" size={13} className="text-on-surface-dim" />
            {t('converter.manual_rate')}
          </span>
          <Icon name={manualMode ? 'expand_less' : 'expand_more'} size={18} className="text-on-surface-faint" />
        </button>
        {manualMode && (
          <div className="flex flex-col gap-1.5 rounded-xl px-3 py-3" style={{ background: 'var(--surface-container)' }}>
            <label className="text-[11px] font-semibold text-on-surface-faint">
              {t('converter.manual_rate_label', { from, to })}
            </label>
            <input
              value={manualRate}
              onChange={(e) => setManualRate(e.target.value)}
              inputMode="decimal"
              placeholder={t('converter.manual_rate_placeholder')}
              className="px-3 py-2.5 rounded-xl text-sm bg-surface-high text-on-surface outline-none placeholder:text-on-surface-faint"
            />
          </div>
        )}
      </div>
    </div>
  );
}
