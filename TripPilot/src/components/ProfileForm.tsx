import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { CUSTOM_PROFILE_ICONS } from '@/utils/category-icons';

export interface ProfileFormData {
  name: string;
  iconName: string;
  typicalValueCents: number;
  safeValueCents: number;
}

/** DEC-099 (R-24): when provided, the form edits an existing profile. */
export interface ProfileFormInitial {
  name: string;
  iconName: string | null;
  typicalValueCents: number;
  safeValueCents: number;
}

interface ProfileFormProps {
  currency: string;
  onSave: (data: ProfileFormData) => void;
  onCancel: () => void;
  initial?: ProfileFormInitial;
}

function centsToInput(cents: number): string {
  return String(cents / 100);
}

export function ProfileForm({ currency, onSave, onCancel, initial }: ProfileFormProps) {
  const { t } = useTranslation();
  const isEdit = initial !== undefined;
  const [name, setName] = useState(initial?.name ?? '');
  const [iconName, setIconName] = useState(initial?.iconName ?? CUSTOM_PROFILE_ICONS[0]!);
  const [value, setValue] = useState(initial ? centsToInput(initial.typicalValueCents) : '');
  const [safeValue, setSafeValue] = useState(initial ? centsToInput(initial.safeValueCents) : '');

  const parsedValue = parseFloat(value.replace(',', '.'));
  const parsedSafe = parseFloat(safeValue.replace(',', '.'));
  const hasSafe = !Number.isNaN(parsedSafe) && parsedSafe > 0;
  const isValid = name.trim().length > 0 && !Number.isNaN(parsedValue) && parsedValue > 0;

  const handleSave = () => {
    if (!isValid) return;
    const typicalValueCents = Math.round(parsedValue * 100);
    onSave({
      name: name.trim(),
      iconName,
      typicalValueCents,
      // Safe value falls back to the typical value when left empty.
      safeValueCents: hasSafe ? Math.round(parsedSafe * 100) : typicalValueCents,
    });
  };

  return (
    <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-3">
      <div>
        <label className="text-xs text-on-surface-faint mb-1 block">{t('profiles.name')}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
          autoFocus
        />
      </div>

      <div>
        <label className="text-xs text-on-surface-faint mb-1 block">{t('profiles.icon')}</label>
        <div className="grid grid-cols-8 gap-1.5">
          {CUSTOM_PROFILE_ICONS.map((icon) => (
            <button
              key={icon}
              onClick={() => setIconName(icon)}
              className={`aspect-square rounded-lg flex items-center justify-center btn-press ${
                iconName === icon ? 'bg-primary/20 ring-1 ring-primary' : 'bg-surface-high'
              }`}
            >
              <Icon
                name={icon}
                size={18}
                className={iconName === icon ? 'text-primary' : 'text-on-surface-dim'}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-on-surface-faint mb-1 block">
          {t('profiles.typical_value')}
        </label>
        <div className="flex items-baseline gap-1 bg-surface-high rounded-lg px-3 py-2">
          <span className="text-on-surface-dim text-sm">{currency}</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0,00"
            className="bg-transparent text-sm text-on-surface tabular outline-none w-full"
          />
        </div>
      </div>

      {/* DEC-099 (R-24): safe value editable when editing an existing profile */}
      {isEdit && (
        <div>
          <label className="text-xs text-on-surface-faint mb-1 block">
            {t('profiles.safe_value')}
          </label>
          <div className="flex items-baseline gap-1 bg-surface-high rounded-lg px-3 py-2">
            <span className="text-on-surface-dim text-sm">{currency}</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={safeValue}
              onChange={(e) => setSafeValue(e.target.value)}
              placeholder="0,00"
              className="bg-transparent text-sm text-on-surface tabular outline-none w-full"
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={!isValid}
          className="flex-1 py-2.5 rounded-xl bg-primary text-on-surface font-medium text-sm btn-press disabled:opacity-40"
        >
          {isEdit ? t('common.save') : t('common.add')}
        </button>
      </div>
    </div>
  );
}
