import { useState } from 'react';
import type {
  LogSetInput,
  WorkoutLog,
} from '../../infrastructure/execution-client';
import type { SessionExercise } from '../../infrastructure/planning-client';

interface ExerciseSetCardProps {
  exercise: SessionExercise;
  logs: WorkoutLog[];
  onLogSet: (input: LogSetInput) => void;
  submitting: boolean;
}

export function ExerciseSetCard({
  exercise,
  logs,
  onLogSet,
  submitting,
}: ExerciseSetCardProps) {
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [duration, setDuration] = useState('');

  const handleSubmit = () => {
    const setNumber = logs.length + 1;
    const input: LogSetInput = {
      sessionExerciseId: exercise.id,
      setNumber,
    };
    if (reps !== '') input.repsCompleted = parseInt(reps, 10);
    if (weight !== '') input.weightKg = parseFloat(weight);
    if (duration !== '') input.durationSeconds = parseInt(duration, 10);
    onLogSet(input);
    setReps('');
    setWeight('');
    setDuration('');
  };

  const isEmpty = reps === '' && weight === '' && duration === '';

  return (
    <div className="bg-canvas rounded p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-ink">{exercise.exerciseName}</span>
        <span className="text-mute text-sm">
          {logs.length}/{exercise.sets} × {exercise.repsOrDuration}
        </span>
      </div>

      {logs.length > 0 && (
        <div className="flex flex-col gap-1">
          {logs.map((log) => (
            <div key={log.id} className="text-xs text-mute flex gap-3">
              <span>Set {log.setNumber}</span>
              {log.repsCompleted !== null && (
                <span>{log.repsCompleted} rép.</span>
              )}
              {log.weightKg !== null && <span>{log.weightKg} kg</span>}
              {log.durationSeconds !== null && (
                <span>{log.durationSeconds} s</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="number"
          min="0"
          value={reps}
          onChange={(e) => {
            setReps(e.target.value);
          }}
          placeholder="Rép."
          aria-label="Répétitions"
          className="border border-hairline rounded px-3 py-1.5 text-sm w-20 text-ink"
        />
        <input
          type="number"
          min="0"
          step="0.5"
          value={weight}
          onChange={(e) => {
            setWeight(e.target.value);
          }}
          placeholder="kg"
          aria-label="Poids en kg"
          className="border border-hairline rounded px-3 py-1.5 text-sm w-20 text-ink"
        />
        <input
          type="number"
          min="1"
          value={duration}
          onChange={(e) => {
            setDuration(e.target.value);
          }}
          placeholder="s"
          aria-label="Durée en secondes"
          className="border border-hairline rounded px-3 py-1.5 text-sm w-20 text-ink"
        />
        <button
          type="button"
          disabled={submitting || isEmpty}
          onClick={handleSubmit}
          className="bg-ink text-canvas px-4 py-1.5 rounded-full text-sm font-medium disabled:opacity-50"
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
}
