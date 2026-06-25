import type { Phase } from '@/domain/types/phase';

const SELECT_CLASS =
  'bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full mt-1';

export interface PhaseChargePickerProps {
  /** Already sorted, non-deleted phases of the trip. */
  phases: Phase[];
  /** Selected phaseId, or null = AUTO (resolved by date by the caller). */
  value: string | null;
  onChange: (phaseId: string | null) => void;
  label: string;
  /** Copy for the AUTO option (e.g. "Automática (pela data)"). */
  autoLabel: string;
  /** Name of the phase AUTO currently resolves to — shown as a hint, optional. */
  autoResolvedName?: string | null;
}

/**
 * Julio field feedback: a compact "which trecho/fase does this charge?" picker,
 * reused by the receipt, split and Wise-import review screens. It renders nothing
 * when there are fewer than two phases (no real choice). The first option is
 * AUTO (value ''), which maps back to `null` so the caller keeps resolving the
 * phase by date; picking a phase forces that one.
 */
export function PhaseChargePicker({
  phases,
  value,
  onChange,
  label,
  autoLabel,
  autoResolvedName,
}: PhaseChargePickerProps) {
  if (phases.length < 2) return null;
  return (
    <label className="block">
      <span className="text-xs text-on-surface-faint">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className={SELECT_CLASS}
      >
        <option value="">
          {autoResolvedName ? `${autoLabel} · ${autoResolvedName}` : autoLabel}
        </option>
        {phases.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
