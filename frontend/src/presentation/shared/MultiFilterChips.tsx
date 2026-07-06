import type { FC } from 'react';

interface MultiFilterChipsProps {
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}

export const MultiFilterChips: FC<MultiFilterChipsProps> = ({
  options,
  selected,
  onChange,
}) => {
  const toggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((v) => v !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <div className="flex flex-row gap-2 flex-wrap">
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => {
              toggle(option);
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
