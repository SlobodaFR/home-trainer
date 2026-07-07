import { Injectable } from '@nestjs/common';
import { WorkoutLog } from '../../domain/execution/workout-log';
import { Goal } from '../../domain/planning/goal';
import { Session } from '../../domain/planning/session';

interface BuildParams {
  currentSession: Session;
  history: Session[];
  logsBySession: Map<string, WorkoutLog[]>;
  goal: Goal;
  locale: string;
}

function formatSet(log: WorkoutLog): string {
  const parts: string[] = [`set ${String(log.setNumber)}`];
  if (log.repsCompleted !== null)
    parts.push(`${String(log.repsCompleted)} reps`);
  if (log.weightKg !== null) parts.push(`${String(log.weightKg)} kg`);
  if (log.durationSeconds !== null)
    parts.push(`${String(log.durationSeconds)}s`);
  return parts.join(', ');
}

function formatSession(session: Session, logs: WorkoutLog[]): string {
  const lines: string[] = [`Date: ${session.plannedDate}`];
  if (session.rpe !== null) lines.push(`RPE: ${String(session.rpe)}/10`);
  if (session.note) lines.push(`Note: ${session.note}`);
  for (const ex of session.exercises) {
    const exLogs = logs.filter((l) => l.sessionExerciseId === ex.id);
    if (exLogs.length > 0) {
      lines.push(`  ${ex.exerciseName}: ${exLogs.map(formatSet).join(' | ')}`);
    } else {
      lines.push(`  ${ex.exerciseName}: no sets logged`);
    }
  }
  return lines.join('\n');
}

@Injectable()
export class PromptBuilderService {
  build(params: BuildParams): { systemPrompt: string; userPrompt: string } {
    const { currentSession, history, logsBySession, goal, locale } = params;

    const systemPrompt = [
      `You are a personal sports coach assistant. Respond in the language identified by locale: ${locale}.`,
      'Provide a concise, practical analysis (3-5 sentences) focusing on: volume vs previous sessions, fatigue signals (RPE trend), consistency, and one concrete suggestion.',
      'Do not repeat the raw data — interpret it.',
    ].join(' ');

    const recentHistory = history.slice(0, 5);

    const lines: string[] = [
      `Goal: ${goal.type} — ${goal.targetDescription} (${String(goal.horizonWeeks)} weeks)`,
      '',
      '## Current session',
      formatSession(currentSession, logsBySession.get(currentSession.id) ?? []),
    ];

    if (recentHistory.length > 0) {
      lines.push('', '## Recent sessions (most recent first)');
      for (const s of recentHistory) {
        lines.push('', formatSession(s, logsBySession.get(s.id) ?? []));
      }
    }

    return { systemPrompt, userPrompt: lines.join('\n') };
  }
}
