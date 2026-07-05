import { Injectable } from '@nestjs/common';
import { OAuthClient, TokenPair } from '../../domain/auth/oauth-client';
import { UserRepository } from '../../domain/auth/user.repository';

@Injectable()
export class HandleOAuthCallbackUseCase {
  constructor(
    private readonly oauthClient: OAuthClient,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(code: string, redirectUri: string): Promise<TokenPair> {
    const tokenPair = await this.oauthClient.exchangeCode(code, redirectUri);
    const profile = await this.oauthClient.fetchUserInfo(tokenPair.accessToken);
    await this.userRepository.save({
      id: profile.id,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      createdAt: new Date(),
    });
    return tokenPair;
  }
}
