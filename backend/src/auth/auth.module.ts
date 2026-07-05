import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HandleOAuthCallbackUseCase } from '../application/auth/handle-oauth-callback.use-case';
import { HandleSessionRevokedUseCase } from '../application/auth/handle-session-revoked.use-case';
import { AccessTokenVerifier } from '../domain/auth/access-token-verifier';
import { OAuthClient } from '../domain/auth/oauth-client';
import { RevokedSessionRepository } from '../domain/auth/revoked-session.repository';
import { UserRepository } from '../domain/auth/user.repository';
import { HttpOAuthClient } from '../infrastructure/auth/http-oauth-client';
import { JwksAccessTokenVerifier } from '../infrastructure/auth/jwks-access-token-verifier';
import { RevokedSessionOrmEntity } from '../infrastructure/persistence/entities/revoked-session.orm-entity';
import { UserOrmEntity } from '../infrastructure/persistence/entities/user.orm-entity';
import { TypeOrmRevokedSessionRepository } from '../infrastructure/persistence/repositories/typeorm-revoked-session.repository';
import { TypeOrmUserRepository } from '../infrastructure/persistence/repositories/typeorm-user.repository';
import { AuthController } from '../interfaces/http/controllers/auth.controller';
import { JwtAuthGuard } from '../interfaces/http/guards/jwt-auth.guard';

@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity, RevokedSessionOrmEntity])],
  controllers: [AuthController],
  providers: [
    HandleOAuthCallbackUseCase,
    HandleSessionRevokedUseCase,
    { provide: OAuthClient, useClass: HttpOAuthClient },
    { provide: AccessTokenVerifier, useClass: JwksAccessTokenVerifier },
    { provide: UserRepository, useClass: TypeOrmUserRepository },
    {
      provide: RevokedSessionRepository,
      useClass: TypeOrmRevokedSessionRepository,
    },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AuthModule {}
