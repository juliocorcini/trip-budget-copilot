import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { parseLocaleNumber, toCents, formatMoney } from '@/domain/money';
import { getActiveIntlLocale } from '@/domain/locale';
import {
  compareUnitPrice,
  resolveUnit,
  COMPARATOR_UNITS,
  type UnitPriceItemInput,
} from '@/domain/shopping';
import { Icon } from '@/components/Icon';
import { LoadingScreen } from '@/components/LoadingScreen';
import { DataErrorScreen } from '@/components/DataErrorScreen';

/**
 * DEC-283 — the cost-benefit comparator. A minimalist calculator that answers
 * "which package is the better buy per unit?" (e.g. 120 g for €1 vs 200 g for
 * €2). It is the twin of the converter (DEC-256): the math is a PURE read
 * (`domain/shopping/unit-price.ts`), it never creates an expense, costs zero
 * tokens and works fully offline. An AI "qual vale mais?" hands the parsed items
 * via the `items` query param; otherwise the user fills the rows by hand. The
 * verdict is honest: it ranks only same-dimension items and refuses to compare
 * weight against units.
 */
interface Row {
  id: string;
  label: string;
  price: string;
  quantity: string;
  unit: string;
}

interface SeedItem {
  price?: number;
  quantity?: number;
  unit?: string;
  label?: string;
}

function parseSeedItems(raw: string | null): Row[] | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  const rows = parsed.slice(0, 6).map((item, i): Row => {
    const it = (item ?? {}) as SeedItem;
    const unit = resolveUnit(typeof it.unit === 'string' ? it.unit : null)?.code ?? 'g';
    return {
      id: `seed-${i}`,
      label: typeof it.label === 'string' ? it.label : '',
      price: typeof it.price === 'number' && Number.isFinite(it.price) ? String(it.price) : '',
      quantity: typeof it.quantity === 'number' && Number.isFinite(it.quantity) ? String(it.quantity) : '',
      unit,
    };
  });
  return rows;
}

export function ComparatorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trip, settings, loading, error, retry } = useAppData();

  const idRef = useRef(0);
  const newId = () => `row-${idRef.current++}`;
  const emptyRow = (): Row => ({ id: newId(), label: '', price: '', quantity: '', unit: 'g' });

  const [rows, setRows] = useState<Row[]>(() => {
    const seeded = parseSeedItems(searchParams.get('items'));
    if (seeded && seeded.length >= 1) {
      const padded = seeded.length >= 2 ? seeded : [...seeded, { ...emptyRow(), unit: seeded[0]!.unit }];
      return padded.map((r) => ({ ...r, id: newId() }));
    }
    return [emptyRow(), emptyRow()];
  });

  if (!trip) {
    if (error) return <DataErrorScreen onRetry={retry} />;
    if (loading) return <LoadingScreen />;
    return <Navigate to="/welcome" replace />;
  }

  const baseCurrency = trip.baseCurrency ?? settings?.defaultCurrency ?? 'EUR';

  const items: UnitPriceItemInput[] = rows.map((r) => {
    const price = parseLocaleNumber(r.price);
    const quantity = parseLocaleNumber(r.quantity);
    return {
      id: r.id,
      label: r.label.trim() || undefined,
      priceCents: price === null || price < 0 ? -1 : toCents(price),
      quantity: quantity === null ? -1 : quantity,
      unit: r.unit,
    };
  });
  const comparison = compareUnitPrice(items);

  const setRow = (id: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRow = () => setRows((prev) => (prev.length >= 6 ? prev : [...prev, emptyRow()]));
  const removeRow = (id: string) => setRows((prev) => (prev.length <= 2 ? prev : prev.filter((r) => r.id !== id)));

  const displayUnitLabel = (code: string | null): string => {
    if (!code) return '';
    if (code === 'l') return 'L';
    if (code === 'un') return t('comparator.unit_each');
    return code;
  };

  const formatPerUnit = (perDisplayUnitCents: number, displayUnit: string | null): string => {
    const money =
      perDisplayUnitCents < 100
        ? new Intl.NumberFormat(getActiveIntlLocale(), {
            style: 'currency',
            currency: baseCurrency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 3,
          }).format(perDisplayUnitCents / 100)
        : formatMoney(Math.round(perDisplayUnitCents), baseCurrency);
    return `${money}/${displayUnitLabel(displayUnit)}`;
  };

  const rowName = (row: Row, index: number): string =>
    row.label.trim() || t('comparator.item_n', { n: index + 1 });

  const bestName = (() => {
    if (!comparison.bestId) return '';
    const idx = rows.findIndex((r) => r.id === comparison.bestId);
    return idx >= 0 ? rowName(rows[idx]!, idx) : '';
  })();

  const verdict = (() => {
    if (comparison.mixedDimensions) {
      return { tone: 'warn' as const, icon: 'warning', text: t('comparator.mixed_dimensions') };
    }
    if (comparison.comparableCount < 2) {
      return { tone: 'hint' as const, icon: 'info', text: t('comparator.need_two') };
    }
    if (comparison.tie) {
      return { tone: 'tie' as const, icon: 'drag_handle', text: t('comparator.tie') };
    }
    const pct = comparison.savingsPct === null ? 0 : Math.round(comparison.savingsPct);
    return {
      tone: 'win' as const,
      icon: 'savings',
      text: t('comparator.winner', { name: bestName, pct }),
    };
  })();

  const verdictStyle: Record<string, string> = {
    win: 'bg-tertiary-container text-on-tertiary-container',
    tie: 'bg-surface-container text-on-surface',
    warn: 'bg-surface-container text-on-surface',
    hint: 'bg-surface-container text-on-surface-faint',
  };

  const numberInputClass =
    'w-full px-3 py-2.5 rounded-xl text-base font-bold tabular bg-surface-high text-on-surface outline-none';
  const selectClass =
    'px-2.5 py-2.5 rounded-xl text-sm font-semibold bg-surface-high text-on-surface outline-none appearance-none text-center';

  return (
    <div className="max-w-[430px] mx-auto flex flex-col gap-4 pb-4 pt-2 min-h-screen px-[var(--page-padding-x)]">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <div className="flex flex-col">
          <h1 className="text-heading font-bold text-on-surface">{t('comparator.title')}</h1>
          <p className="text-[11px] text-on-surface-faint">{t('comparator.subtitle')}</p>
        </div>
      </div>

      {/* One card per item: price + quantity + unit, with its per-unit price. */}
      <div className="flex flex-col gap-3">
        {rows.map((row, index) => {
          const entry = comparison.entries.find((e) => e.id === row.id);
          const isBest = comparison.bestId === row.id;
          const isWorst = comparison.bestId !== null && comparison.comparableCount > 1 && comparison.worstId === row.id;
          return (
            <div
              key={row.id}
              className="rounded-2xl px-3 py-3 flex flex-col gap-2.5 transition-shadow"
              style={{
                background: 'var(--surface-container)',
                boxShadow: isBest ? '0 0 0 2px var(--tertiary, #2e7d32)' : undefined,
              }}
            >
              <div className="flex items-center gap-2">
                <input
                  value={row.label}
                  onChange={(e) => setRow(row.id, { label: e.target.value })}
                  placeholder={t('comparator.item_n', { n: index + 1 })}
                  className="flex-1 bg-transparent text-sm font-semibold text-on-surface outline-none placeholder:text-on-surface-faint placeholder:font-normal"
                />
                {isBest && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container shrink-0">
                    {t('comparator.best_badge')}
                  </span>
                )}
                {rows.length > 2 && (
                  <button
                    onClick={() => removeRow(row.id)}
                    className="btn-press p-1 shrink-0"
                    aria-label={t('comparator.remove_item')}
                  >
                    <Icon name="close" size={16} className="text-on-surface-faint" />
                  </button>
                )}
              </div>

              <div className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-[10px] font-semibold text-on-surface-faint">{t('comparator.price_label')}</label>
                  <input
                    value={row.price}
                    onChange={(e) => setRow(row.id, { price: e.target.value })}
                    inputMode="decimal"
                    placeholder="0"
                    className={numberInputClass}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-[10px] font-semibold text-on-surface-faint">{t('comparator.quantity_label')}</label>
                  <input
                    value={row.quantity}
                    onChange={(e) => setRow(row.id, { quantity: e.target.value })}
                    inputMode="decimal"
                    placeholder="0"
                    className={numberInputClass}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-on-surface-faint">{t('comparator.unit_label')}</label>
                  <select value={row.unit} onChange={(e) => setRow(row.id, { unit: e.target.value })} className={selectClass}>
                    {COMPARATOR_UNITS.map((code) => (
                      <option key={code} value={code}>
                        {code === 'l' ? 'L' : code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {entry?.valid && entry.perDisplayUnitCents !== null && (
                <p
                  className={`text-xs font-semibold tabular ${
                    isBest ? 'text-tertiary' : isWorst ? 'text-on-surface-faint' : 'text-on-surface-dim'
                  }`}
                >
                  {formatPerUnit(entry.perDisplayUnitCents, entry.displayUnit)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {rows.length < 6 && (
        <button
          onClick={addRow}
          className="btn-press self-start flex items-center gap-1.5 text-sm font-semibold text-primary px-1"
        >
          <Icon name="add" size={18} />
          {t('comparator.add_item')}
        </button>
      )}

      {/* The verdict. */}
      <div className={`rounded-2xl px-4 py-4 flex items-center gap-3 ${verdictStyle[verdict.tone]}`}>
        <Icon name={verdict.icon} size={22} />
        <p className="text-sm font-semibold leading-snug">{verdict.text}</p>
      </div>
    </div>
  );
}
