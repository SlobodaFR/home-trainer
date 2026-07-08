import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { startSession } from '../../infrastructure/execution-client';
import type { ExerciseWithPreference } from '../../infrastructure/exercise-client';
import { getExercise } from '../../infrastructure/exercise-client';
import type {
  Session,
  SessionExercise,
} from '../../infrastructure/planning-client';
import {
  getSession,
  replanSession,
} from '../../infrastructure/planning-client';
import { useAuth } from '../auth/use-auth';
import { AnalysisPanel } from '../shared/AnalysisPanel';
import { Toast } from '../shared/Toast';
import { useToast } from '../shared/useToast';

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const raw = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function ExerciseRow({ ex, lang }: { ex: SessionExercise; lang: string }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ExerciseWithPreference | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = () => {
    if (!open && !detail) {
      setLoading(true);
      getExercise(ex.exerciseId, lang)
        .then(setDetail)
        .catch(() => undefined)
        .finally(() => {
          setLoading(false);
        });
    }
    setOpen((v) => !v);
  };

  return (
    <div className="flex flex-col py-3 border-b border-hairline last:border-0">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-2 text-left flex-1 min-w-0"
        >
          <span className="text-ink font-medium text-sm truncate">
            {ex.exerciseName}
          </span>
          <span className="text-mute text-xs">{open ? '▲' : '▼'}</span>
        </button>
        <span className="text-mute text-sm shrink-0 ml-3">
          {ex.sets} × {ex.repsOrDuration}
        </span>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          {loading && (
            <div className="h-4 bg-hairline animate-pulse rounded w-2/3" />
          )}
          {detail && (
            <>
              {detail.imageUrl && (
                <img
                  src={detail.imageUrl}
                  alt={detail.name}
                  className="w-full max-h-48 object-cover rounded"
                />
              )}
              {detail.description && (
                <div
                  className="text-mute text-sm [&_p]:mb-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_ul]:list-disc [&_ul]:pl-4"
                  dangerouslySetInnerHTML={{ __html: detail.description }}
                />
              )}
              {detail.muscleGroups.length > 0 && (
                <p className="text-xs text-mute">
                  Muscles : {detail.muscleGroups.join(', ')}
                </p>
              )}
              <Link
                to={`/exercises/${ex.exerciseId}`}
                className="text-xs text-ink underline self-start"
              >
                Voir la fiche complète →
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const lang = user?.language ?? 'en';
  const { message, show: showToast } = useToast();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replanning, setReplanning] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getSession(id)
      .then((s) => {
        setSession(s);
      })
      .catch(() => {
        setError('Séance introuvable');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  const handleStart = async () => {
    if (!id || starting) return;
    setStarting(true);
    try {
      await startSession(id);
      navigate(`/sessions/${id}/execute`);
    } catch {
      showToast('Impossible de démarrer la séance');
      setStarting(false);
    }
  };

  const handleReplan = async () => {
    if (!id || replanning) return;
    setReplanning(true);
    try {
      const updated = await replanSession(id);
      setSession(updated);
      showToast('Séance replanifiée');
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('409')) {
        showToast('Cette séance ne peut pas être replanifiée');
      } else {
        showToast('Erreur, réessayez');
      }
    } finally {
      setReplanning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft-cloud">
        <div className="w-8 h-8 border-2 border-ink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-soft-cloud">
        <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-4">
          <button
            type="button"
            onClick={() => {
              navigate(-1);
            }}
            className="flex items-center gap-1 text-mute text-sm w-fit"
          >
            ← Accueil
          </button>
          <p className="text-mute">{error ?? 'Séance introuvable'}</p>
        </div>
      </div>
    );
  }

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
          ← Accueil
        </button>

        <h1 className="text-2xl font-medium text-ink">
          {formatDate(session.plannedDate)}
        </h1>

        <div className="flex flex-col">
          {session.exercises
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((ex) => (
              <ExerciseRow key={ex.id} ex={ex} lang={lang} />
            ))}
        </div>

        {session.status === 'planned' && (
          <div className="flex gap-3">
            <button
              type="button"
              disabled={starting}
              onClick={() => {
                void handleStart();
              }}
              className="bg-ink text-canvas px-6 py-2 rounded-full text-sm font-medium disabled:opacity-50"
            >
              {starting ? '…' : 'Commencer'}
            </button>
            <button
              type="button"
              disabled={replanning}
              onClick={() => {
                void handleReplan();
              }}
              className="bg-soft-cloud text-ink px-6 py-2 rounded-full text-sm font-medium disabled:opacity-50"
            >
              {replanning ? '…' : 'Replanifier'}
            </button>
          </div>
        )}
        {(session.status === 'active' || session.status === 'paused') && (
          <button
            type="button"
            onClick={() => {
              if (id) navigate(`/sessions/${id}/execute`);
            }}
            className="bg-ink text-canvas px-6 py-2 rounded-full text-sm font-medium self-start"
          >
            Reprendre
          </button>
        )}

        {session.status === 'completed' && id && (
          <AnalysisPanel sessionId={id} />
        )}
      </div>
      <Toast message={message} />
    </div>
  );
}
