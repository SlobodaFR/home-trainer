import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { FavoriteButton } from './FavoriteButton';
import type { ExerciseWithPreference } from '../../infrastructure/exercise-client';

interface ExerciseCardProps {
  exercise: ExerciseWithPreference;
  onFavoriteToggle: (newValue: boolean) => Promise<void>;
}

export const ExerciseCard: FC<ExerciseCardProps> = ({
  exercise,
  onFavoriteToggle,
}) => {
  const navigate = useNavigate();

  return (
    <div className="bg-canvas border border-gray-100 p-4 flex flex-col gap-2">
      <div className="flex gap-3 items-start">
        <div
          className="flex-1 cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => {
            navigate(`/exercises/${exercise.id}`);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ')
              navigate(`/exercises/${exercise.id}`);
          }}
        >
          <h3 className="text-base font-medium text-ink leading-snug">
            {exercise.name}
          </h3>
          {exercise.muscleGroups.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {exercise.muscleGroups.slice(0, 3).map((mg) => (
                <span
                  key={mg}
                  className="text-xs text-mute bg-soft-cloud px-2 py-0.5 rounded-full"
                >
                  {mg}
                </span>
              ))}
            </div>
          )}
        </div>
        {exercise.imageUrl && (
          <img
            src={exercise.imageUrl}
            alt=""
            className="w-14 h-14 object-cover rounded flex-shrink-0"
          />
        )}
      </div>
      <div className="flex justify-end">
        <FavoriteButton
          isFavorite={exercise.isFavorite}
          onToggle={onFavoriteToggle}
        />
      </div>
    </div>
  );
};
