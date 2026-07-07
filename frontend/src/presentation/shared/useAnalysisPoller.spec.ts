import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAnalysisPoller } from './useAnalysisPoller';
import * as client from '../../infrastructure/analysis-client';

vi.mock('../../infrastructure/analysis-client');

const mockGetAnalysis = vi.mocked(client.getAnalysis);
const mockRetryAnalysis = vi.mocked(client.retryAnalysis);

describe('useAnalysisPoller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGetAnalysis.mockResolvedValue(null);
    mockRetryAnalysis.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does nothing when sessionId is null', () => {
    renderHook(() => useAnalysisPoller(null));
    vi.advanceTimersByTime(10000);
    expect(mockGetAnalysis).not.toHaveBeenCalled();
  });

  it('polls every 5s and updates status when pending', async () => {
    mockGetAnalysis.mockResolvedValue({
      id: 'a-1',
      sessionId: 's-1',
      userId: 'u-1',
      status: 'pending',
      result: null,
    });

    const { result } = renderHook(() => useAnalysisPoller('s-1'));

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(mockGetAnalysis).toHaveBeenCalledWith('s-1');
    expect(result.current.status).toBe('pending');
  });

  it('stops polling and sets done when analysis resolves', async () => {
    mockGetAnalysis.mockResolvedValue({
      id: 'a-1',
      sessionId: 's-1',
      userId: 'u-1',
      status: 'done',
      result: 'Great session!',
    });

    const { result } = renderHook(() => useAnalysisPoller('s-1'));

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(result.current.status).toBe('done');
    expect(result.current.result).toBe('Great session!');

    vi.clearAllMocks();
    vi.advanceTimersByTime(5000);
    expect(mockGetAnalysis).not.toHaveBeenCalled();
  });

  it('sets timeout status after 90s without terminal status', async () => {
    mockGetAnalysis.mockResolvedValue({
      id: 'a-1',
      sessionId: 's-1',
      userId: 'u-1',
      status: 'pending',
      result: null,
    });

    const { result } = renderHook(() => useAnalysisPoller('s-1'));

    await act(async () => {
      vi.advanceTimersByTime(5000 * 19);
      await Promise.resolve();
    });

    expect(result.current.status).toBe('timeout');
  });

  it('retry() calls retryAnalysis and restarts polling', async () => {
    mockGetAnalysis.mockResolvedValue(null);
    mockRetryAnalysis.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAnalysisPoller('s-1'));

    await act(async () => {
      result.current.retry();
      await Promise.resolve();
    });

    expect(mockRetryAnalysis).toHaveBeenCalledWith('s-1');
  });
});
