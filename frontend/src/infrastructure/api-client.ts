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

  async logout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  },
};
