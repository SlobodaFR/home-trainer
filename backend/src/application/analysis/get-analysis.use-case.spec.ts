import { NotFoundException } from '@nestjs/common';
import { GetAnalysisUseCase } from './get-analysis.use-case';
import { SessionAnalysis } from '../../domain/analysis/session-analysis';
import { SessionAnalysisRepository } from '../../domain/analysis/session-analysis.repository';

const mockAnalysis: SessionAnalysis = {
  id: 'a-1',
  sessionId: 's-1',
  userId: 'u-1',
  status: 'done',
  result: 'Good session',
  retryCount: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

function makeRepo(analysis: SessionAnalysis | null) {
  return {
    findBySessionId: jest.fn().mockResolvedValue(analysis),
  } as unknown as jest.Mocked<SessionAnalysisRepository>;
}

describe('GetAnalysisUseCase', () => {
  it('returns analysis when found and owned by user', async () => {
    const useCase = new GetAnalysisUseCase(makeRepo(mockAnalysis));
    const result = await useCase.execute('s-1', 'u-1');
    expect(result).toEqual(mockAnalysis);
  });

  it('throws 404 when analysis not found', async () => {
    const useCase = new GetAnalysisUseCase(makeRepo(null));
    await expect(useCase.execute('s-1', 'u-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws 404 when analysis belongs to different user', async () => {
    const useCase = new GetAnalysisUseCase(makeRepo(mockAnalysis));
    await expect(useCase.execute('s-1', 'other-user')).rejects.toThrow(
      NotFoundException,
    );
  });
});
