import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AnalysisJobService } from './analysis-job.service';
import { SessionAnalysisRepository } from '../../domain/analysis/session-analysis.repository';

@Injectable()
export class RetryAnalysisUseCase {
  constructor(
    private readonly analysisRepository: SessionAnalysisRepository,
    private readonly analysisJobService: AnalysisJobService,
  ) {}

  async execute(
    sessionId: string,
    userId: string,
    locale: string,
  ): Promise<void> {
    const analysis = await this.analysisRepository.findBySessionId(sessionId);
    if (analysis?.userId !== userId) {
      throw new NotFoundException('Analysis not found');
    }
    if (analysis.status !== 'failed') {
      throw new ConflictException('Analysis is not in failed state');
    }
    await this.analysisRepository.update(analysis.id, {
      status: 'pending',
      retryCount: 0,
    });
    this.analysisJobService.run(sessionId, userId, locale);
  }
}
