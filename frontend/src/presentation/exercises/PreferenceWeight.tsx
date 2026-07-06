import type { FC } from 'react';

interface PreferenceWeightProps {
  value: number | null;
  onChange: (weight: number) => void;
  disabled?: boolean;
}

export const PreferenceWeight: FC<PreferenceWeightProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <div
      role="radiogroup"
      aria-label="Poids de préférence"
      className="flex flex-row gap-1"
    >
      {Array.from({ length: 5 }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`Poids ${String(star)}`}
          disabled={disabled}
          onClick={() => {
            onChange(star);
          }}
          className={`text-2xl disabled:opacity-40 ${
            value !== null && star <= value ? 'text-ink' : 'text-mute'
          }`}
        >
          {value !== null && star <= value ? '★' : '☆'}
        </button>
      ))}
    </div>
  );
};
