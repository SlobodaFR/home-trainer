import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { AccessTokenPayload } from '../../domain/auth/access-token-payload';
import { AccessTokenVerifier } from '../../domain/auth/access-token-verifier';
import { FeatureFlags } from '../../domain/shared/feature-flags';

/** Behind this flag the access token's audience, issuer and algorithm are verified (code default: off). */
const VERIFY_TOKEN_CLAIMS_FLAG = 'auth-verify-token-claims';

interface AuthServiceJwtPayload extends JWTPayload {
  email?: string;
  name?: string;
}

@Injectable()
export class JwksAccessTokenVerifier extends AccessTokenVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(
    private readonly config: ConfigService,
    private readonly flags: FeatureFlags,
  ) {
    super();
    const authServiceUrl = this.config.getOrThrow<string>('AUTH_SERVICE_URL');
    this.issuer = new URL(authServiceUrl).origin;
    this.audience = this.config.getOrThrow<string>('AUTH_CLIENT_ID');
    this.jwks = createRemoteJWKSet(
      new URL('/.well-known/jwks.json', authServiceUrl),
    );
  }

  async verify(token: string): Promise<AccessTokenPayload | null> {
    try {
      const { payload } = await jwtVerify<AuthServiceJwtPayload>(
        token,
        this.jwks,
        (await this.claimsEnforced())
          ? {
              audience: this.audience,
              issuer: this.issuer,
              algorithms: ['RS256'],
            }
          : undefined,
      );
      if (!payload.sub || !payload.email || !payload.name || !payload.iat) {
        return null;
      }
      return {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        issuedAt: new Date(payload.iat * 1000),
      };
    } catch {
      return null;
    }
  }

  /** Never blocks nor throws: any failure to read the flag means the current behaviour. */
  private async claimsEnforced(): Promise<boolean> {
    try {
      return await this.flags.isEnabled(VERIFY_TOKEN_CLAIMS_FLAG, false);
    } catch {
      return false;
    }
  }
}
