import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import {
  COMPARISON_ROWS,
  columnRecommendation,
  comparisonColumns,
  type InstallAudience,
  type Recommendation,
  type SupportLevel,
} from './install-content';

const LEVEL_ICON: Record<SupportLevel, string> = { yes: 'check', partial: 'remove', no: 'close' };
const LEVEL_COLOR: Record<SupportLevel, string> = { yes: '#16a34a', partial: '#d97706', no: '' };
const VERDICT_STYLE: Record<Recommendation, React.CSSProperties> = {
  recommended: { background: 'rgba(22,163,74,0.16)', color: '#16a34a' },
  ok: { background: 'var(--surface-container)', color: 'var(--on-surface-dim)' },
  discouraged: { background: 'rgba(220,38,38,0.14)', color: '#dc2626' },
};

/** Item A — the App(APK) × PWA × Web capability comparison (data from install-content). */
export function InstallComparison({ audience }: { audience: InstallAudience }) {
  const { t } = useTranslation();
  // DEC-364 (A2/A3): the App(APK) column shows only on Android; iOS/desktop see
  // Atalho × Navegador. The set comes from the data, never hidden by CSS.
  const columns = comparisonColumns(audience);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--surface-high)' }}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr style={{ background: 'var(--surface-high)' }}>
            <th className="p-2.5 text-[11px] font-bold text-on-surface-dim">{t('install.cmp_feature')}</th>
            {columns.map((col) => {
              const rec = columnRecommendation(col, audience);
              return (
                <th key={col} className="p-2 text-center align-top">
                  <p className="text-[11px] font-extrabold text-on-surface">{t(`install.col_${col}`)}</p>
                  <span
                    className="inline-block mt-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wide"
                    style={VERDICT_STYLE[rec]}
                  >
                    {t(`install.verdict_${rec}`)}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {COMPARISON_ROWS.map((row) => (
            <tr key={row.id} style={{ borderTop: '1px solid var(--surface-high)' }}>
              <td className="p-2.5 text-[11px] font-semibold text-on-surface">{t(`install.cmp_${row.id}`)}</td>
              {columns.map((col) => {
                const level = row[col];
                return (
                  <td
                    key={col}
                    className={`p-2.5 text-center ${level === 'no' ? 'text-on-surface-faint' : ''}`}
                    style={level === 'no' ? undefined : { color: LEVEL_COLOR[level] }}
                    aria-label={t(`install.level_${level}`)}
                  >
                    <Icon name={LEVEL_ICON[level]} size={16} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
