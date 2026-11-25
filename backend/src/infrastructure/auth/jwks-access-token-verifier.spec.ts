import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { ConfigService } from '@nestjs/config';
import {
  exportJWK,
  generateKeyPair,
  JWK,
  KeyLike,
  SignJWT,
  type JWTPayload,
} from 'jose';
import { FeatureFlags } from '../../domain/shared/feature-flags';
import { JwksAccessTokenVerifier } from './jwks-access-token-verifier';

const CLIENT_ID = 'trainer-client';
const FLAG = 'auth-verify-token-claims';

class FakeFlags extends FeatureFlags {
  readonly calls: Array<[string, boolean]> = [];
  constructor(private readonly value: boolean | 'throws') {
    super();
  }
  isEnabled(key: string, codeDefault: boolean): Promise<boolean> {
    this.calls.push([key, codeDefault]);
    return this.value === 'throws'
      ? Promise.reject(new Error('flags down'))
      : Promise.resolve(this.value);
  }
}

describe('JwksAccessTokenVerifier', () => {
  let server: Server;
  let origin: string;
  let privateKey: KeyLike;

  beforeAll(async () => {
    const pair = await generateKeyPair('RS256', { extractable: true });
    privateKey = pair.privateKey;
    const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: 'k1' };
    server = createServer((req, res) => {
      if (req.url === '/.well-known/jwks.json') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ keys: [jwk] }));
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    origin = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function verifier(flags: FeatureFlags): JwksAccessTokenVerifier {
    const values: Record<string, string> = {
      AUTH_SERVICE_URL: `${origin}/`,
      AUTH_CLIENT_ID: CLIENT_ID,
    };
    const config = {
      getOrThrow: (key: string) => values[key],
    } as unknown as ConfigService;
    return new JwksAccessTokenVerifier(config, flags);
  }

  async function token(
    overrides: {
      alg?: string;
      aud?: string | string[] | null;
      iss?: string | null;
      claims?: JWTPayload;
    } = {},
  ): Promise<string> {
    const jwt = new SignJWT({
      email: 'ada@example.test',
      name: 'Ada',
      ...overrides.claims,
    })
      .setProtectedHeader({ alg: overrides.alg ?? 'RS256', kid: 'k1' })
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('5m');
    if (overrides.aud !== null) jwt.setAudience(overrides.aud ?? CLIENT_ID);
    if (overrides.iss !== null) jwt.setIssuer(overrides.iss ?? origin);
    return jwt.sign(privateKey);
  }

  describe('flag off (code default): behaviour unchanged', () => {
    it('reads the flag with code default false', async () => {
      const flags = new FakeFlags(false);
      await verifier(flags).verify(await token());
      expect(flags.calls).toEqual([[FLAG, false]]);
    });

    it('accepts a valid token', async () => {
      await expect(
        verifier(new FakeFlags(false)).verify(await token()),
      ).resolves.toMatchObject({
        sub: 'user-1',
        email: 'ada@example.test',
        name: 'Ada',
      });
    });

    it.each([
      ['another app audience', { aud: 'another-client' }],
      ['a foreign issuer', { iss: 'https://evil.example.test' }],
      ['no audience and no issuer', { aud: null, iss: null }],
      ['a non-RS256 algorithm (PS256)', { alg: 'PS256' }],
    ])('still accepts %s', async (_label, overrides) => {
      await expect(
        verifier(new FakeFlags(false)).verify(await token(overrides)),
      ).resolves.toMatchObject({ sub: 'user-1' });
    });

    it('rejects a token with a bad signature or missing claims as before', async () => {
      const v = verifier(new FakeFlags(false));
      expect(await v.verify('not-a-jwt')).toBeNull();
      expect(
        await v.verify(await token({ claims: { email: undefined } })),
      ).toBeNull();
    });
  });

  describe('flag on: audience, issuer and algorithm are verified', () => {
    it('accepts a valid token', async () => {
      await expect(
        verifier(new FakeFlags(true)).verify(await token()),
      ).resolves.toMatchObject({
        sub: 'user-1',
        email: 'ada@example.test',
        name: 'Ada',
      });
    });

    it('rejects a token issued for another app', async () => {
      expect(
        await verifier(new FakeFlags(true)).verify(
          await token({ aud: 'another-client' }),
        ),
      ).toBeNull();
    });

    it('accepts an audience array containing this app (jose semantics; home-auth never issues one)', async () => {
      expect(
        await verifier(new FakeFlags(true)).verify(
          await token({ aud: [CLIENT_ID, 'another-client'] }),
        ),
      ).not.toBeNull();
    });

    it('rejects a token without audience', async () => {
      expect(
        await verifier(new FakeFlags(true)).verify(await token({ aud: null })),
      ).toBeNull();
    });

    it('rejects a wrong issuer', async () => {
      expect(
        await verifier(new FakeFlags(true)).verify(
          await token({ iss: 'https://evil.example.test' }),
        ),
      ).toBeNull();
    });

    it('rejects an issuer that only differs by path (origin comparison)', async () => {
      expect(
        await verifier(new FakeFlags(true)).verify(
          await token({ iss: `${origin}/other` }),
        ),
      ).toBeNull();
    });

    it('rejects a token without issuer', async () => {
      expect(
        await verifier(new FakeFlags(true)).verify(await token({ iss: null })),
      ).toBeNull();
    });

    it('rejects an algorithm other than RS256 (PS256, same key)', async () => {
      expect(
        await verifier(new FakeFlags(true)).verify(
          await token({ alg: 'PS256' }),
        ),
      ).toBeNull();
    });
  });

  it('never blocks on the flag: a failing evaluation behaves as flag off', async () => {
    await expect(
      verifier(new FakeFlags('throws')).verify(
        await token({ aud: 'another-client' }),
      ),
    ).resolves.toMatchObject({ sub: 'user-1' });
  });
});
