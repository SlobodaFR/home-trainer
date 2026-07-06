import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EverkineticViewer } from './EverkineticViewer';
import { FavoriteButton } from './FavoriteButton';
import { PreferenceWeight } from './PreferenceWeight';
import type { ExerciseWithPreference } from '../../infrastructure/exercise-client';
import {
  getExercise,
  removeFavorite,
  setPreference,
  toggleFavorite,
} from '../../infrastructure/exercise-client';
import { Toast } from '../shared/Toast';
import { useToast } from '../shared/useToast';

export function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [exercise, setExercise] = useState<ExerciseWithPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [preferenceWeight, setPreferenceWeight] = useState<number | null>(null);
  const [savingPreference, setSavingPreference] = useState(false);
  const { message, show: showToast } = useToast();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getExercise(id)
      .then((ex) => {
        setExercise(ex);
        setPreferenceWeight(ex.preferenceWeight);
      })
      .catch(() => {
        showToast('Exercice introuvable');
        navigate('/exercises', { replace: true });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, navigate, showToast]);

  const handleFavoriteToggle = async (newValue: boolean) => {
    if (!id) return;
    try {
      if (newValue) {
        await toggleFavorite(id);
      } else {
        await removeFavorite(id);
      }
      setExercise((prev) => (prev ? { ...prev, isFavorite: newValue } : prev));
    } catch {
      showToast('Erreur lors de la mise à jour des favoris');
      throw new Error('favorite update failed');
    }
  };

  const handlePreferenceChange = async (weight: number) => {
    if (!id || savingPreference) return;
    setSavingPreference(true);
    const prev = preferenceWeight;
    setPreferenceWeight(weight);
    try {
      await setPreference(id, weight);
    } catch {
      setPreferenceWeight(prev);
      showToast('Erreur lors de la sauvegarde de la préférence');
    } finally {
      setSavingPreference(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft-cloud">
        <div className="w-8 h-8 border-2 border-ink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!exercise) return null;

  return (
    <div className="min-h-screen bg-soft-cloud">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
        <button
          type="button"
          onClick={() => {
            navigate(-1);
          }}
          className="flex items-center gap-1 text-mute text-sm w-fit"
        >
          ← Exercices
        </button>

        <h1 className="text-2xl font-medium text-ink">{exercise.name}</h1>

        <EverkineticViewer slug={exercise.everkineticSlug} />

        {exercise.description && (
          <p className="text-mute text-base whitespace-pre-wrap">
            {exercise.description}
          </p>
        )}

        {exercise.youtubeUrl && (
          <div className="aspect-video w-full">
            <iframe
              src={exercise.youtubeUrl.replace('watch?v=', 'embed/')}
              title="Vidéo exercice"
              allow="autoplay; encrypted-media"
              allowFullScreen
              className="w-full h-full rounded"
            />
          </div>
        )}

        <div className="flex items-center gap-4 py-2">
          <FavoriteButton
            isFavorite={exercise.isFavorite}
            onToggle={handleFavoriteToggle}
          />
          <PreferenceWeight
            value={preferenceWeight}
            onChange={(w) => {
              void handlePreferenceChange(w);
            }}
            disabled={savingPreference}
          />
        </div>
      </div>
      <Toast message={message} />
    </div>
  );
}
