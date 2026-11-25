export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
}

export interface UserMe {
  name: string;
  email: string;
  avatarUrl: string | null;
  language: string;
  country: string | null;
}

export abstract class OAuthClient {
  abstract authorizeUrl(redirectUri: string): string;
  abstract exchangeCode(code: string, redirectUri: string): Promise<TokenPair>;
  abstract refresh(refreshToken: string): Promise<TokenPair>;
  abstract fetchUserInfo(accessToken: string): Promise<UserProfile>;
  abstract fetchMe(accessToken: string): Promise<UserMe>;
  /**
   * URL of home-auth's service-initiated logout (contract PC10), to be reached by a top-level
   * navigation. The access token hint is a bearer token: it must only ever be sent to home-auth.
   */
  abstract logoutUrl(params: {
    postLogoutRedirectUri: string;
    state: string;
    accessTokenHint?: string;
  }): string;
}
