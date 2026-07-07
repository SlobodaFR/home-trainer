import { ConflictException, NotFoundException } from '@nestjs/common';
import { AnalysisJobService } from './analysis-job.service';
import { RetryAnalysisUseCase } from './retry-analysis.use-case';
import { SessionAnalysis } from '../../domain/analysis/session-analysis';
import { SessionAnalysisRepository } from '../../domain/analysis/session-analysis.repository';

const base: SessionAnalysis = {
  id: 'a-1',
  sessionId: 's-1',
  userId: 'u-1',
  status: 'failed',
  result: null,
  retryCount: 2,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

function make(analysis: SessionAnalysis | null) {
  const repo = {
    findBySessionId: jest.fn().mockResolvedValue(analysis),
    update: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<SessionAnalysisRepository>;
  const jobService = {
    run: jest.fn(),
  } as unknown as jest.Mocked<AnalysisJobService>;
  const useCase = new RetryAnalysisUseCase(repo, jobService);
  return { useCase, repo, jobService };
}

describe('RetryAnalysisUseCase', () => {
  it('throws 404 when analysis not found', async () => {
    const { useCase } = make(null);
    await expect(useCase.execute('s-1', 'u-1', 'fr')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws 404 when analysis belongs to different user', async () => {
    const { useCase } = make(base);
    await expect(useCase.execute('s-1', 'other', 'fr')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws 409 when status is pending', async () => {
    const { useCase } = make({ ...base, status: 'pending' });
    await expect(useCase.execute('s-1', 'u-1', 'fr')).rejects.toThrow(
      ConflictException,
    );
  });

  it('throws 409 when status is done', async () => {
    const { useCase } = make({ ...base, status: 'done', result: 'ok' });
    await expect(useCase.execute('s-1', 'u-1', 'fr')).rejects.toThrow(
      ConflictException,
    );
  });

  it('resets status and triggers job when failed', async () => {
    const { useCase, repo, jobService } = make(base);
    await useCase.execute('s-1', 'u-1', 'fr');
    expect(repo.update).toHaveBeenCalledWith('a-1', {
      status: 'pending',
      retryCount: 0,
    });
    expect(jobService.run).toHaveBeenCalledWith('s-1', 'u-1', 'fr');
  });
});
