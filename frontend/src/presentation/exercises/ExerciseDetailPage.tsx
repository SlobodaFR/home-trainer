import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FavoriteButton } from './FavoriteButton';
import { MuscleDiagram } from './MuscleDiagram';
import { PreferenceWeight } from './PreferenceWeight';
import type { ExerciseWithPreference } from '../../infrastructure/exercise-client';
import {
  getExercise,
  removeFavorite,
  setPreference,
  toggleFavorite,
} from '../../infrastructure/exercise-client';
import { useAuth } from '../auth/use-auth';
import { Toast } from '../shared/Toast';
import { useToast } from '../shared/useToast';

export function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const lang = user?.language ?? 'en';
  const [exercise, setExercise] = useState<ExerciseWithPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [preferenceWeight, setPreferenceWeight] = useState<number | null>(null);
  const [savingPreference, setSavingPreference] = useState(false);
  const { message, show: showToast } = useToast();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getExercise(id, lang)
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
  }, [id, lang, navigate, showToast]);

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

        {exercise.imageUrl && (
          <img
            src={exercise.imageUrl}
            alt={exercise.name}
            className="w-full rounded-lg object-cover max-h-72"
          />
        )}

        {exercise.muscleImages.length > 0 && (
          <MuscleDiagram muscleImages={exercise.muscleImages} />
        )}

        {exercise.description && (
          <div
            className="text-mute text-base [&_p]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-0.5"
            dangerouslySetInnerHTML={{ __html: exercise.description }}
          />
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
