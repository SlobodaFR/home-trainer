export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  language: string;
}

export const apiClient = {
  async fetchCurrentUser(): Promise<CurrentUser | null> {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.status === 401) return null;
    return (await res.json()) as CurrentUser;
  },

  /**
   * Local logout. `redirectTo` is home-auth's logout URL when the server runs the
   * service-initiated flow (PC10), null for a local-only logout.
   */
  async logout(): Promise<{ redirectTo: string | null }> {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`logout failed: ${res.status}`);
    const body = (await res.json().catch(() => null)) as {
      redirect_to?: unknown;
    } | null;
    return {
      redirectTo:
        typeof body?.redirect_to === 'string' ? body.redirect_to : null,
    };
  },
};
