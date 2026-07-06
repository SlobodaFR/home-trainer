import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSets, logSet, startSession } from './execution-client';

describe('execution-client', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('startSession posts to correct URL with credentials', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 's1', status: 'active' }),
      text: () => Promise.resolve(''),
    });
    vi.stubGlobal('fetch', mockFetch);

    await startSession('s1');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/sessions/s1/start',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('logSet sends correct JSON body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'log1' }),
      text: () => Promise.resolve(''),
    });
    vi.stubGlobal('fetch', mockFetch);

    await logSet('s1', {
      sessionExerciseId: 'ex1',
      setNumber: 1,
      repsCompleted: 10,
      weightKg: 50,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/sessions/s1/sets',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          sessionExerciseId: 'ex1',
          setNumber: 1,
          repsCompleted: 10,
          weightKg: 50,
        }),
      }),
    );
  });

  it('getSets fetches from correct URL and returns array', async () => {
    const mockSets = [{ id: 'log1' }];
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockSets),
      text: () => Promise.resolve(''),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await getSets('s1');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/sessions/s1/sets',
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(result).toEqual(mockSets);
  });

  it('throws Error with status on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: () => Promise.resolve('Not Found'),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(startSession('s1')).rejects.toThrow('404:');
  });
});
