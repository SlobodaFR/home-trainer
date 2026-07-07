import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { startSession } from '../../infrastructure/execution-client';
import type { Session } from '../../infrastructure/planning-client';
import {
  getSession,
  replanSession,
} from '../../infrastructure/planning-client';
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

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

        <div className="flex flex-col divide-y divide-hairline">
          {session.exercises
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((ex) => (
              <div key={ex.id} className="flex justify-between py-3">
                <span className="text-ink font-medium text-sm">
                  {ex.exerciseName}
                </span>
                <span className="text-mute text-sm">
                  {ex.sets} × {ex.repsOrDuration}
                </span>
              </div>
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
