import { Injectable, NotFoundException } from '@nestjs/common';
import { SessionAnalysis } from '../../domain/analysis/session-analysis';
import { SessionAnalysisRepository } from '../../domain/analysis/session-analysis.repository';

@Injectable()
export class GetAnalysisUseCase {
  constructor(private readonly analysisRepository: SessionAnalysisRepository) {}

  async execute(sessionId: string, userId: string): Promise<SessionAnalysis> {
    const analysis = await this.analysisRepository.findBySessionId(sessionId);
    if (analysis?.userId !== userId) {
      throw new NotFoundException('Analysis not found');
    }
    return analysis;
  }
}
