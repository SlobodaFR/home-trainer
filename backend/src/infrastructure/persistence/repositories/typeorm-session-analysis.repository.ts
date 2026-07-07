import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AnalysisStatus,
  SessionAnalysis,
} from '../../../domain/analysis/session-analysis';
import { SessionAnalysisRepository } from '../../../domain/analysis/session-analysis.repository';
import { SessionAnalysisOrmEntity } from '../entities/session-analysis.orm-entity';

@Injectable()
export class TypeOrmSessionAnalysisRepository extends SessionAnalysisRepository {
  constructor(
    @InjectRepository(SessionAnalysisOrmEntity)
    private readonly repo: Repository<SessionAnalysisOrmEntity>,
  ) {
    super();
  }

  async findBySessionId(sessionId: string): Promise<SessionAnalysis | null> {
    const entity = await this.repo.findOne({ where: { sessionId } });
    if (!entity) return null;
    return this.toDomain(entity);
  }

  async save(
    data: Omit<SessionAnalysis, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SessionAnalysis> {
    const entity = this.repo.create({
      sessionId: data.sessionId,
      userId: data.userId,
      status: data.status,
      result: data.result,
      retryCount: data.retryCount,
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async update(
    id: string,
    patch: Partial<Pick<SessionAnalysis, 'status' | 'result' | 'retryCount'>>,
  ): Promise<void> {
    await this.repo.update(id, patch);
  }

  private toDomain(entity: SessionAnalysisOrmEntity): SessionAnalysis {
    return {
      id: entity.id,
      sessionId: entity.sessionId,
      userId: entity.userId,
      status: entity.status as AnalysisStatus,
      result: entity.result,
      retryCount: entity.retryCount,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
