import { useCallback, useEffect, useRef, useState } from 'react';
import { ExerciseCard } from './ExerciseCard';
import { FilterChips } from './FilterChips';
import { EQUIPMENT_OPTIONS, MUSCLE_GROUPS } from './exercise-filters';
import type { ExerciseWithPreference } from '../../infrastructure/exercise-client';
import {
  listExercises,
  removeFavorite,
  toggleFavorite,
} from '../../infrastructure/exercise-client';
import { Toast } from '../shared/Toast';
import { useToast } from '../shared/useToast';

const PAGE_SIZE = 20;

export function ExercisesPage() {
  const [exercises, setExercises] = useState<ExerciseWithPreference[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [muscleGroup, setMuscleGroup] = useState<string | undefined>();
  const [equipment, setEquipment] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { message, show: showToast } = useToast();
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (pg: number, reset: boolean) => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      if (reset) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const result = await listExercises({
          muscleGroup,
          equipment,
          page: pg,
          limit: PAGE_SIZE,
        });
        setTotal(result.total);
        setExercises((prev) =>
          reset ? result.data : [...prev, ...result.data],
        );
        setPage(pg);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('Erreur de chargement');
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [muscleGroup, equipment],
  );

  useEffect(() => {
    void load(1, true);
  }, [load]);

  const handleLoadMore = () => {
    void load(page + 1, false);
  };

  const makeFavoriteHandler =
    (exercise: ExerciseWithPreference) => async (newValue: boolean) => {
      try {
        if (newValue) {
          await toggleFavorite(exercise.id);
        } else {
          await removeFavorite(exercise.id);
        }
        setExercises((prev) =>
          prev.map((e) =>
            e.id === exercise.id ? { ...e, isFavorite: newValue } : e,
          ),
        );
      } catch {
        showToast('Erreur lors de la mise à jour des favoris');
        throw new Error('favorite update failed');
      }
    };

  const hasMore = exercises.length < total;

  return (
    <div className="min-h-screen bg-soft-cloud">
      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-4">
        <h1 className="text-2xl font-medium text-ink">Exercices</h1>

        <div className="flex flex-col gap-2">
          <FilterChips
            options={MUSCLE_GROUPS}
            selected={muscleGroup}
            onChange={(v) => {
              setMuscleGroup(v);
            }}
          />
          <FilterChips
            options={EQUIPMENT_OPTIONS}
            selected={equipment}
            onChange={(v) => {
              setEquipment(v);
            }}
          />
        </div>

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-soft-cloud animate-pulse h-24 rounded"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-2 py-12 text-mute">
            <p>{error}</p>
            <button
              type="button"
              className="text-ink underline text-sm"
              onClick={() => void load(1, true)}
            >
              Réessayer
            </button>
          </div>
        )}

        {!loading && !error && exercises.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-mute">
            <p>Aucun exercice trouvé</p>
            {(muscleGroup !== undefined || equipment !== undefined) && (
              <button
                type="button"
                className="text-ink underline text-sm"
                onClick={() => {
                  setMuscleGroup(undefined);
                  setEquipment(undefined);
                }}
              >
                Effacer les filtres
              </button>
            )}
          </div>
        )}

        {!loading && exercises.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {exercises.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                onFavoriteToggle={makeFavoriteHandler(exercise)}
              />
            ))}
          </div>
        )}

        {!loading && hasMore && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              disabled={loadingMore}
              onClick={handleLoadMore}
              className="bg-ink text-canvas px-6 py-2 rounded-full text-sm font-medium disabled:opacity-50"
            >
              {loadingMore ? 'Chargement…' : 'Charger plus'}
            </button>
          </div>
        )}
      </div>
      <Toast message={message} />
    </div>
  );
}
