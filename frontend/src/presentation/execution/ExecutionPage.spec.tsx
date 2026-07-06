import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExecutionPage } from './ExecutionPage';
import * as executionClient from '../../infrastructure/execution-client';
import * as planningClient from '../../infrastructure/planning-client';

vi.mock('../../infrastructure/execution-client');
vi.mock('../../infrastructure/planning-client');
vi.mock('./useRestTimer', () => ({
  useRestTimer: () => ({
    remaining: 90,
    active: false,
    start: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

const mockSession = {
  id: 's1',
  userId: 'u1',
  goalId: 'g1',
  plannedDate: '2026-07-06',
  status: 'active' as const,
  rpe: null,
  note: null,
  createdAt: '2026-07-06T00:00:00.000Z',
  exercises: [
    {
      id: 'ex1',
      sessionId: 's1',
      exerciseId: 'e1',
      exerciseName: 'Squat',
      order: 1,
      sets: 3,
      repsOrDuration: '10',
    },
  ],
};

const mockLog = {
  id: 'log1',
  sessionId: 's1',
  sessionExerciseId: 'ex1',
  userId: 'u1',
  setNumber: 1,
  repsCompleted: 10,
  weightKg: 60,
  durationSeconds: null,
  completedAt: '2026-07-06T10:00:00.000Z',
};

function renderPage(route = '/sessions/s1/execute') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/sessions/:id/execute" element={<ExecutionPage />} />
        <Route path="/" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ExecutionPage', () => {
  beforeEach(() => {
    vi.mocked(planningClient.getSession).mockResolvedValue(mockSession);
    vi.mocked(executionClient.getSets).mockResolvedValue([]);
  });

  it('renders exercise names after data loads', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Squat')).toBeDefined();
    });
  });

  it('logSet called on set submit', async () => {
    vi.mocked(executionClient.logSet).mockResolvedValue(mockLog);
    renderPage();
    await waitFor(() => {
      screen.getByText('Squat');
    });

    const repsInput = screen.getByLabelText('Répétitions');
    fireEvent.change(repsInput, { target: { value: '10' } });
    fireEvent.click(screen.getByText('Enregistrer'));

    await waitFor(() => {
      expect(executionClient.logSet).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({
          sessionExerciseId: 'ex1',
          repsCompleted: 10,
        }),
      );
    });
  });

  it('toast shown on logSet failure', async () => {
    vi.mocked(executionClient.logSet).mockRejectedValue(
      new Error('500: error'),
    );
    renderPage();
    await waitFor(() => {
      screen.getByText('Squat');
    });

    const repsInput = screen.getByLabelText('Répétitions');
    fireEvent.change(repsInput, { target: { value: '5' } });
    fireEvent.click(screen.getByText('Enregistrer'));

    await waitFor(() => {
      expect(screen.getByText(/Set non enregistré/)).toBeDefined();
    });
  });

  it('Pause calls pauseSession and shows Reprendre', async () => {
    vi.mocked(executionClient.pauseSession).mockResolvedValue({
      ...mockSession,
      status: 'paused',
    });
    renderPage();
    await waitFor(() => {
      screen.getByText('Squat');
    });

    fireEvent.click(screen.getByText('Pause'));

    await waitFor(() => {
      expect(executionClient.pauseSession).toHaveBeenCalledWith('s1');
      expect(screen.getByText('Reprendre')).toBeDefined();
    });
  });

  it('Finish button opens RPE modal', async () => {
    renderPage();
    await waitFor(() => {
      screen.getByText('Squat');
    });

    fireEvent.click(screen.getByText('Terminer'));

    expect(screen.getByText('Terminer la séance')).toBeDefined();
  });

  it('RPE modal Annuler closes modal', async () => {
    renderPage();
    await waitFor(() => {
      screen.getByText('Squat');
    });

    fireEvent.click(screen.getByText('Terminer'));
    expect(screen.getByText('Terminer la séance')).toBeDefined();

    fireEvent.click(screen.getByText('Annuler'));
    expect(screen.queryByText('Terminer la séance')).toBeNull();
  });

  it('finishSession called on modal submit', async () => {
    vi.mocked(executionClient.finishSession).mockResolvedValue({
      ...mockSession,
      status: 'completed',
    });
    renderPage();
    await waitFor(() => {
      screen.getByText('Squat');
    });

    fireEvent.click(screen.getByText('Terminer'));
    fireEvent.click(screen.getByText('Terminer la séance'));

    await waitFor(() => {
      expect(executionClient.finishSession).toHaveBeenCalledWith(
        's1',
        null,
        null,
      );
    });
  });
});
