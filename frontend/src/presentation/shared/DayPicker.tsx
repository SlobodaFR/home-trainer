import type { FC } from 'react';
import { DAY_LABELS } from '../planning/goal-types';

interface DayPickerProps {
  selected: number[];
  onChange: (days: number[]) => void;
}

export const DayPicker: FC<DayPickerProps> = ({ selected, onChange }) => {
  const toggle = (index: number) => {
    if (selected.includes(index)) {
      onChange(selected.filter((d) => d !== index));
    } else {
      onChange([...selected, index].sort((a, b) => a - b));
    }
  };

  return (
    <div className="flex flex-row gap-2">
      {DAY_LABELS.map((label, index) => {
        const active = selected.includes(index);
        return (
          <button
            key={index}
            type="button"
            aria-pressed={active}
            onClick={() => {
              toggle(index);
            }}
            className={
              active
                ? 'w-9 h-9 bg-ink text-canvas rounded-full text-sm font-medium'
                : 'w-9 h-9 border border-gray-300 text-ink rounded-full text-sm font-medium'
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};
