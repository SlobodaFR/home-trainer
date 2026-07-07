import { Test } from '@nestjs/testing';
import { AnalysisController } from './analysis.controller';
import { GetAnalysisUseCase } from '../../../application/analysis/get-analysis.use-case';
import { GetHistoryUseCase } from '../../../application/analysis/get-history.use-case';
import { RetryAnalysisUseCase } from '../../../application/analysis/retry-analysis.use-case';

const mockUser = { id: 'u-1', email: 'test@example.com', name: 'Test' };

const mockHistory = [
  {
    session: {
      id: 's-1',
      userId: 'u-1',
      goalId: 'g-1',
      plannedDate: '2026-07-01',
      status: 'completed' as const,
      rpe: 7,
      note: null,
      createdAt: new Date('2026-07-01'),
      exercises: [],
    },
    volumeKg: 980,
    analysisStatus: 'done' as const,
  },
];

describe('AnalysisController', () => {
  let controller: AnalysisController;
  let getHistory: jest.Mocked<GetHistoryUseCase>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AnalysisController],
      providers: [
        { provide: GetAnalysisUseCase, useValue: { execute: jest.fn() } },
        { provide: RetryAnalysisUseCase, useValue: { execute: jest.fn() } },
        { provide: GetHistoryUseCase, useValue: { execute: jest.fn() } },
      ],
    }).compile();

    controller = module.get(AnalysisController);
    getHistory = module.get(GetHistoryUseCase);
  });

  it('GET /history returns history entries for current user', async () => {
    getHistory.execute.mockResolvedValue(mockHistory);
    const result = await controller.getHistory(mockUser);
    expect(getHistory.execute).toHaveBeenCalledWith('u-1');
    expect(result).toEqual(mockHistory);
  });
});
