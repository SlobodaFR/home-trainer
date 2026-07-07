import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GOAL_TYPE_OPTIONS } from './goal-types';
import type { Goal, Session } from '../../infrastructure/planning-client';
import {
  deleteGoal,
  getActiveGoal,
  listSessions,
} from '../../infrastructure/planning-client';
import { ProfileMissingBanner } from '../shared/ProfileMissingBanner';

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const raw = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(d);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function goalTypeLabel(type: Goal['type']): string {
  return GOAL_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export function DashboardPage() {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [goalLoading, setGoalLoading] = useState(true);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const handleDeleteGoal = async () => {
    if (!goal) return;
    setDeleting(true);
    try {
      await deleteGoal(goal.id);
      setGoal(null);
      setSessions([]);
      setConfirmDelete(false);
    } catch {
      setGoalError("Erreur lors de la suppression de l'objectif");
    } finally {
      setDeleting(false);
    }
  };

  const loadData = () => {
    setGoalLoading(true);
    setSessionsLoading(true);
    setGoalError(null);
    setSessionsError(null);

    void Promise.allSettled([getActiveGoal(), listSessions()]).then(
      ([goalResult, sessionsResult]) => {
        if (goalResult.status === 'fulfilled') {
          setGoal(goalResult.value);
        } else {
          setGoalError("Impossible de charger l'objectif");
        }
        setGoalLoading(false);

        if (sessionsResult.status === 'fulfilled') {
          setSessions(sessionsResult.value);
        } else {
          setSessionsError('Impossible de charger les séances');
        }
        setSessionsLoading(false);
      },
    );
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-soft-cloud">
      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
        <ProfileMissingBanner />
        <h1 className="text-2xl font-medium text-ink">Tableau de bord</h1>

        {/* Goal panel */}
        {goalLoading && (
          <div className="h-24 bg-canvas animate-pulse rounded" />
        )}

        {!goalLoading && goalError && (
          <div className="flex flex-col items-center gap-2 py-8 text-mute">
            <p>{goalError}</p>
            <button
              type="button"
              className="text-ink underline text-sm"
              onClick={loadData}
            >
              Réessayer
            </button>
          </div>
        )}

        {!goalLoading && !goalError && goal === null && (
          <div className="bg-canvas rounded p-6 flex flex-col items-center gap-4 text-center">
            <p className="text-mute">Aucun objectif actif</p>
            <Link
              to="/goals/new"
              className="bg-ink text-canvas px-6 py-2 rounded-full text-sm font-medium"
            >
              Définir un objectif
            </Link>
          </div>
        )}

        {!goalLoading && !goalError && goal !== null && (
          <div className="bg-canvas rounded p-6 flex flex-col gap-3">
            <span className="self-start bg-soft-cloud text-ink rounded-full px-3 py-1 text-xs font-medium">
              {goalTypeLabel(goal.type)}
            </span>
            <p className="text-ink font-medium text-lg">
              {goal.targetDescription}
            </p>
            <p className="text-mute text-sm">
              {goal.horizonWeeks} sem. · {goal.sessionDurationMinutes} min
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to="/goals/new"
                className="border border-hairline text-ink px-5 py-2 rounded-full text-sm font-medium"
              >
                Changer d&apos;objectif
              </Link>
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDelete(true);
                  }}
                  className="border border-hairline text-mute px-5 py-2 rounded-full text-sm font-medium"
                >
                  Supprimer
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void handleDeleteGoal();
                    }}
                    disabled={deleting}
                    className="bg-ink text-canvas px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
                  >
                    {deleting ? '…' : 'Confirmer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDelete(false);
                    }}
                    className="border border-hairline text-mute px-5 py-2 rounded-full text-sm font-medium"
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sessions list — only when goal exists */}
        {!goalLoading && !goalError && goal !== null && (
          <>
            <h2 className="text-lg font-medium text-ink">Séances à venir</h2>

            {sessionsLoading && (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-14 bg-canvas animate-pulse rounded"
                  />
                ))}
              </div>
            )}

            {!sessionsLoading && sessionsError && (
              <div className="flex flex-col items-center gap-2 py-4 text-mute">
                <p>{sessionsError}</p>
                <button
                  type="button"
                  className="text-ink underline text-sm"
                  onClick={loadData}
                >
                  Réessayer
                </button>
              </div>
            )}

            {!sessionsLoading && !sessionsError && sessions.length === 0 && (
              <p className="text-mute text-sm py-4">Aucune séance planifiée</p>
            )}

            {!sessionsLoading && !sessionsError && sessions.length > 0 && (
              <div className="flex flex-col gap-2">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="bg-canvas rounded p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-ink text-sm font-medium">
                        {formatDate(s.plannedDate)}
                      </span>
                      <span className="text-mute text-xs">
                        {s.exercises.length} exercice
                        {s.exercises.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <Link
                      to={`/sessions/${s.id}`}
                      className="border border-gray-300 text-ink px-4 py-1.5 rounded-full text-sm font-medium shrink-0"
                    >
                      Voir
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
