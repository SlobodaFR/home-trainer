import { AnalysisModule } from './analysis.module';
import type { AnalysisJobService } from '../application/analysis/analysis-job.service';

describe('AnalysisModule', () => {
  it('recovers pending analyses once the application has bootstrapped', async () => {
    const recoverPending = vi.fn().mockResolvedValue(undefined);
    const module = new AnalysisModule({
      recoverPending,
    } as unknown as AnalysisJobService);
    await module.onApplicationBootstrap();
    expect(recoverPending).toHaveBeenCalledTimes(1);
  });
});
