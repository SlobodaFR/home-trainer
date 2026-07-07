import { PromptBuilderService } from './prompt-builder.service';
import { WorkoutLog } from '../../domain/execution/workout-log';
import { Goal } from '../../domain/planning/goal';
import { Session } from '../../domain/planning/session';

const makeSession = (
  id: string,
  date: string,
  rpe: number | null = null,
): Session => ({
  id,
  userId: 'user-1',
  goalId: 'goal-1',
  plannedDate: date,
  status: 'completed',
  rpe,
  note: null,
  createdAt: new Date('2026-01-01'),
  exercises: [
    {
      id: `ex-${id}`,
      sessionId: id,
      exerciseId: 'e1',
      exerciseName: 'Push-up',
      order: 1,
      sets: 3,
      repsOrDuration: '10',
    },
  ],
});

const makeLog = (sessionId: string, seId: string): WorkoutLog => ({
  id: 'log-1',
  sessionId,
  sessionExerciseId: seId,
  userId: 'user-1',
  setNumber: 1,
  repsCompleted: 10,
  weightKg: null,
  durationSeconds: null,
  completedAt: new Date('2026-01-01'),
});

const goal: Goal = {
  id: 'goal-1',
  userId: 'user-1',
  type: 'strength',
  targetDescription: 'Improve upper body',
  horizonWeeks: 8,
  availabilityDays: [1, 3, 5],
  sessionDurationMinutes: 45,
  availableEquipment: [],
  activeFrom: '2026-01-01',
  isActive: true,
  createdAt: new Date('2026-01-01'),
};

describe('PromptBuilderService', () => {
  let service: PromptBuilderService;

  beforeEach(() => {
    service = new PromptBuilderService();
  });

  it('includes locale in system prompt', () => {
    const currentSession = makeSession('s1', '2026-07-07');
    const { systemPrompt } = service.build({
      currentSession,
      history: [],
      logsBySession: new Map(),
      goal,
      locale: 'fr',
    });
    expect(systemPrompt).toContain('locale: fr');
  });

  it('includes exercise name in user prompt', () => {
    const currentSession = makeSession('s1', '2026-07-07');
    const { userPrompt } = service.build({
      currentSession,
      history: [],
      logsBySession: new Map(),
      goal,
      locale: 'en',
    });
    expect(userPrompt).toContain('Push-up');
  });

  it('does not include userId in user prompt', () => {
    const currentSession = makeSession('s1', '2026-07-07');
    const { userPrompt } = service.build({
      currentSession,
      history: [],
      logsBySession: new Map(),
      goal,
      locale: 'fr',
    });
    expect(userPrompt).not.toContain('user-1');
  });

  it('caps history at 5 sessions', () => {
    const currentSession = makeSession('s-current', '2026-07-07');
    const history = Array.from({ length: 8 }, (_, i) =>
      makeSession(`s${String(i)}`, `2026-07-0${String(i + 1)}`),
    );
    const { userPrompt } = service.build({
      currentSession,
      history,
      logsBySession: new Map(),
      goal,
      locale: 'fr',
    });
    const occurrences = (userPrompt.match(/Date:/g) ?? []).length;
    expect(occurrences).toBe(6); // 1 current + 5 history
  });

  it('includes set details in user prompt', () => {
    const currentSession = makeSession('s1', '2026-07-07');
    const log = makeLog('s1', 'ex-s1');
    const { userPrompt } = service.build({
      currentSession,
      history: [],
      logsBySession: new Map([['s1', [log]]]),
      goal,
      locale: 'fr',
    });
    expect(userPrompt).toContain('10 reps');
  });
});
