import type { FC } from 'react';

interface FilterChipsProps {
  options: string[];
  selected: string | undefined;
  onChange: (value: string | undefined) => void;
}

export const FilterChips: FC<FilterChipsProps> = ({
  options,
  selected,
  onChange,
}) => {
  return (
    <div className="flex flex-row gap-2 overflow-x-auto pb-1">
      {options.map((option) => {
        const active = selected === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => {
              onChange(active ? undefined : option);
            }}
            className={
              active
                ? 'shrink-0 bg-ink text-canvas rounded-full px-4 py-2 text-sm font-medium'
                : 'shrink-0 border border-gray-300 text-ink rounded-full px-4 py-2 text-sm font-medium'
            }
          >
            {option}
          </button>
        );
      })}
    </div>
  );
};
