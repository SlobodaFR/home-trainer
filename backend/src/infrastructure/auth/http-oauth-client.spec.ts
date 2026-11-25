import { ConfigService } from '@nestjs/config';
import { HttpOAuthClient } from './http-oauth-client';

const config = {
  getOrThrow: (key: string) =>
    ({
      AUTH_SERVICE_URL: 'https://auth.example.test',
      AUTH_CLIENT_ID: 'client-id',
      AUTH_CLIENT_SECRET: 'client-secret',
    })[key],
} as unknown as ConfigService;

describe('HttpOAuthClient.logoutUrl (PC10)', () => {
  it('builds /logout with client_id, return URI, state and the optional hint', () => {
    const client = new HttpOAuthClient(config);
    const url = new URL(
      client.logoutUrl({
        postLogoutRedirectUri: 'https://app/api/auth/logged-out',
        state: 's',
        accessTokenHint: 'tok',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://auth.example.test/logout');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe(
      'https://app/api/auth/logged-out',
    );
    expect(url.searchParams.get('state')).toBe('s');
    expect(url.searchParams.get('access_token_hint')).toBe('tok');
  });

  it('omits the hint when there is none', () => {
    const url = new URL(
      new HttpOAuthClient(config).logoutUrl({
        postLogoutRedirectUri: 'https://app/x',
        state: 's',
      }),
    );
    expect(url.searchParams.has('access_token_hint')).toBe(false);
  });
});
