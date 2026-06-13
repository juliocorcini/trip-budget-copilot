import { Icon } from '@/components/Icon';

// FIELD-14: counters navigate to the expense list pre-filtered by profile/category.
export function OccasionCounter({
  icon,
  count,
  label,
  sublabel,
  iconBg,
  iconColor,
  onClick,
}: {
  icon: string;
  count: number;
  label: string;
  sublabel?: string;
  iconBg: string;
  iconColor: string;
  onClick: () => void;
}) {
  // DEC-085 (R-03): identical card height — 2-line space reserved for the name.
  return (
    <button
      onClick={onClick}
      className="p-3.5 rounded-2xl text-center bg-surface-container btn-press w-full h-full flex flex-col items-center"
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center mb-1.5 shrink-0"
        style={{ background: iconBg }}
      >
        <Icon name={icon} size={18} style={{ color: iconColor }} />
      </div>
      <p className="text-xl font-extrabold tabular text-on-surface">{count}</p>
      <p className="text-[10px] font-bold text-on-surface-dim leading-[13px] min-h-[26px] line-clamp-2 flex items-center justify-center">
        {label}
      </p>
      <p className="text-[9px] font-semibold text-on-surface-faint mt-0.5 min-h-[12px]">
        {sublabel ?? ''}
      </p>
    </button>
  );
}
