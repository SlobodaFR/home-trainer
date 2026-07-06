import type { FC } from 'react';

interface StepperProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

export const Stepper: FC<StepperProps> = ({
  value,
  min,
  max,
  step,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="inline-flex items-center gap-3">
      <button
        type="button"
        aria-label="Diminuer"
        disabled={disabled || value <= min}
        onClick={() => {
          onChange(Math.max(min, value - step));
        }}
        className="w-8 h-8 rounded-full bg-soft-cloud text-ink font-medium disabled:opacity-30"
      >
        −
      </button>
      <span className="min-w-[2.5rem] text-center text-ink font-medium">
        {value}
      </span>
      <button
        type="button"
        aria-label="Augmenter"
        disabled={disabled || value >= max}
        onClick={() => {
          onChange(Math.min(max, value + step));
        }}
        className="w-8 h-8 rounded-full bg-soft-cloud text-ink font-medium disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
};
