import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './api-client';

describe('apiClient.logout', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts to /api/auth/logout and returns the redirect_to of the service-initiated flow', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ redirect_to: 'https://auth.example/logout?x=1' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient.logout()).resolves.toEqual({
      redirectTo: 'https://auth.example/logout?x=1',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('returns null for a local-only logout (null, absent or non-string redirect_to)', async () => {
    for (const body of [{ redirect_to: null }, {}, { redirect_to: 3 }]) {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: async () => body }),
      );
      await expect(apiClient.logout()).resolves.toEqual({ redirectTo: null });
    }
  });

  it('rejects when the server refuses the logout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403 }),
    );
    await expect(apiClient.logout()).rejects.toThrow('logout failed');
  });
});
