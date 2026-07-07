import { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ExerciseSetCard } from './ExerciseSetCard';
import { RPEModal } from './RPEModal';
import { useRestTimer } from './useRestTimer';
import type {
  LogSetInput,
  WorkoutLog,
} from '../../infrastructure/execution-client';
import {
  finishSession,
  getSets,
  logSet,
  pauseSession,
  resumeSession,
} from '../../infrastructure/execution-client';
import type {
  Session,
  SessionExercise,
} from '../../infrastructure/planning-client';
import { getSession } from '../../infrastructure/planning-client';
import { AnalysisContext } from '../shared/AnalysisContext';
import { Toast } from '../shared/Toast';
import { useToast } from '../shared/useToast';

export function ExecutionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { message, show: showToast } = useToast();
  const { setPending } = useContext(AnalysisContext);
  const {
    remaining,
    active: timerActive,
    start: startTimer,
    dismiss: dismissTimer,
  } = useRestTimer();

  const [session, setSession] = useState<Session | null>(null);
  const [sessionStatus, setSessionStatus] =
    useState<Session['status']>('planned');
  const [logs, setLogs] = useState<Record<string, WorkoutLog[]>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([getSession(id), getSets(id)])
      .then(([s, sets]) => {
        setSession(s);
        setSessionStatus(s.status);
        const grouped: Record<string, WorkoutLog[]> = {};
        for (const set of sets) {
          const key = set.sessionExerciseId;
          const existing = grouped[key] as WorkoutLog[] | undefined;
          grouped[key] = existing !== undefined ? [...existing, set] : [set];
        }
        setLogs(grouped);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.message.startsWith('404')) {
          navigate('/');
        } else {
          showToast('Erreur de chargement');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, navigate, showToast]);

  const handleLogSet = useCallback(
    async (exercise: SessionExercise, input: LogSetInput) => {
      if (!id || !session) return;
      const optimisticId = `opt-${String(Date.now())}`;
      const optimistic: WorkoutLog = {
        id: optimisticId,
        sessionId: id,
        sessionExerciseId: input.sessionExerciseId,
        userId: session.userId,
        setNumber: input.setNumber,
        repsCompleted: input.repsCompleted ?? null,
        weightKg: input.weightKg ?? null,
        durationSeconds: input.durationSeconds ?? null,
        completedAt: new Date().toISOString(),
      };
      setLogs((prev) => ({
        ...prev,
        [exercise.id]: [...(prev[exercise.id] ?? []), optimistic],
      }));
      setSubmitting((prev) => ({ ...prev, [exercise.id]: true }));
      try {
        const saved = await logSet(id, input);
        setLogs((prev) => ({
          ...prev,
          [exercise.id]: (prev[exercise.id] ?? []).map((l) =>
            l.id === optimisticId ? saved : l,
          ),
        }));
        startTimer();
      } catch {
        setLogs((prev) => ({
          ...prev,
          [exercise.id]: (prev[exercise.id] ?? []).filter(
            (l) => l.id !== optimisticId,
          ),
        }));
        showToast('Set non enregistré — réessayez.');
      } finally {
        setSubmitting((prev) => ({ ...prev, [exercise.id]: false }));
      }
    },
    [id, session, startTimer, showToast],
  );

  const handlePause = async () => {
    if (!id || transitioning) return;
    setTransitioning(true);
    try {
      await pauseSession(id);
      setSessionStatus('paused');
    } catch {
      showToast('Erreur — réessayez.');
    } finally {
      setTransitioning(false);
    }
  };

  const handleResume = async () => {
    if (!id || transitioning) return;
    setTransitioning(true);
    try {
      await resumeSession(id);
      setSessionStatus('active');
    } catch {
      showToast('Erreur — réessayez.');
    } finally {
      setTransitioning(false);
    }
  };

  const handleFinish = async (rpe: number | null, note: string | null) => {
    if (!id) return;
    setFinishing(true);
    try {
      await finishSession(id, rpe, note);
      setPending(id);
      navigate(`/sessions/${id}`);
    } catch {
      showToast('Erreur — réessayez.');
      setFinishing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft-cloud">
        <div className="w-8 h-8 border-2 border-ink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  const sortedExercises = session.exercises
    .slice()
    .sort((a, b) => a.order - b.order);

  return (
    <div className="min-h-screen bg-soft-cloud pb-40">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
        <button
          type="button"
          onClick={() => {
            navigate(-1);
          }}
          className="flex items-center gap-1 text-mute text-sm w-fit"
        >
          ← Quitter
        </button>

        <h1 className="text-2xl font-medium text-ink">Séance en cours</h1>

        {sortedExercises.length === 0 ? (
          <p className="text-mute text-sm">Aucun exercice</p>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedExercises.map((ex) => (
              <ExerciseSetCard
                key={ex.id}
                exercise={ex}
                logs={logs[ex.id] ?? []}
                onLogSet={(input) => {
                  void handleLogSet(ex, input);
                }}
                submitting={submitting[ex.id] ?? false}
              />
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-canvas border-t border-hairline px-4 py-4 flex flex-col gap-3">
        {timerActive && (
          <div className="flex items-center justify-between bg-soft-cloud rounded-full px-4 py-2">
            <span
              className="text-sm font-medium text-ink"
              aria-label={`Temps de repos restant: ${String(remaining)}s`}
            >
              Repos : {remaining}s
            </span>
            <button
              type="button"
              onClick={dismissTimer}
              className="text-mute text-sm font-medium px-3 py-1"
            >
              Passer
            </button>
          </div>
        )}

        <div className="flex gap-3">
          {sessionStatus === 'active' && (
            <button
              type="button"
              disabled={transitioning}
              onClick={() => {
                void handlePause();
              }}
              className="flex-1 bg-soft-cloud text-ink px-6 py-3 rounded-full text-sm font-medium disabled:opacity-50"
            >
              Pause
            </button>
          )}
          {sessionStatus === 'paused' && (
            <button
              type="button"
              disabled={transitioning}
              onClick={() => {
                void handleResume();
              }}
              className="flex-1 bg-soft-cloud text-ink px-6 py-3 rounded-full text-sm font-medium disabled:opacity-50"
            >
              Reprendre
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setShowFinish(true);
            }}
            className="flex-1 bg-ink text-canvas px-6 py-3 rounded-full text-sm font-medium"
          >
            Terminer
          </button>
        </div>
      </div>

      {showFinish && (
        <RPEModal
          onFinish={(rpe, note) => {
            void handleFinish(rpe, note);
          }}
          onCancel={() => {
            setShowFinish(false);
          }}
          loading={finishing}
        />
      )}

      <Toast message={message} />
    </div>
  );
}
