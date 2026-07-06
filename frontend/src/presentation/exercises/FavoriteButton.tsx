import type { FC } from 'react';
import { useCallback, useRef, useState } from 'react';

interface FavoriteButtonProps {
  isFavorite: boolean;
  onToggle: (newValue: boolean) => Promise<void>;
  disabled?: boolean;
}

export const FavoriteButton: FC<FavoriteButtonProps> = ({
  isFavorite,
  onToggle,
  disabled = false,
}) => {
  const [optimistic, setOptimistic] = useState(isFavorite);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(async () => {
    if (disabled) return;
    if (debounceRef.current) return;

    const newValue = !optimistic;
    setOptimistic(newValue);

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
    }, 300);

    try {
      await onToggle(newValue);
    } catch {
      setOptimistic(!newValue);
    }
  }, [disabled, optimistic, onToggle]);

  return (
    <button
      type="button"
      aria-label={optimistic ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      aria-pressed={optimistic}
      disabled={disabled}
      onClick={() => {
        void handleClick();
      }}
      className="w-10 h-10 rounded-full bg-soft-cloud flex items-center justify-center text-xl disabled:opacity-40"
    >
      <span className={optimistic ? 'text-success' : 'text-mute'}>
        {optimistic ? '♥' : '♡'}
      </span>
    </button>
  );
};
