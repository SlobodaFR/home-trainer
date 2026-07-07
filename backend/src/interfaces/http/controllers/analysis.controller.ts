import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { GetAnalysisUseCase } from '../../../application/analysis/get-analysis.use-case';
import {
  GetHistoryUseCase,
  HistoryEntry,
} from '../../../application/analysis/get-history.use-case';
import { RetryAnalysisUseCase } from '../../../application/analysis/retry-analysis.use-case';
import { SessionAnalysis } from '../../../domain/analysis/session-analysis';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../decorators/current-user.decorator';

@Controller()
export class AnalysisController {
  constructor(
    private readonly getAnalysisUseCase: GetAnalysisUseCase,
    private readonly retryAnalysisUseCase: RetryAnalysisUseCase,
    private readonly getHistoryUseCase: GetHistoryUseCase,
  ) {}

  @Get('analyses/:sessionId')
  async getAnalysis(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<SessionAnalysis> {
    return this.getAnalysisUseCase.execute(sessionId, user.id);
  }

  @Get('history')
  async getHistory(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<HistoryEntry[]> {
    return this.getHistoryUseCase.execute(user.id);
  }

  @Post('analyses/:sessionId/retry')
  @HttpCode(HttpStatus.NO_CONTENT)
  async retryAnalysis(
    @Param('sessionId') sessionId: string,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<void> {
    const locale = acceptLanguage?.split(',')[0]?.split(';')[0]?.trim() ?? 'fr';
    return this.retryAnalysisUseCase.execute(sessionId, user.id, locale);
  }
}
