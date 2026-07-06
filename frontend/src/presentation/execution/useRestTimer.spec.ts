import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRestTimer } from './useRestTimer';

const mockOscillator = {
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  frequency: { value: 0 },
  type: 'sine',
};

const mockGain = {
  connect: vi.fn(),
  gain: {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  },
};

const mockAudioContext = {
  createOscillator: vi.fn(() => mockOscillator),
  createGain: vi.fn(() => mockGain),
  currentTime: 0,
  resume: vi.fn().mockResolvedValue(undefined),
  destination: {},
};

describe('useRestTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => mockAudioContext),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts inactive with remaining=90', () => {
    const { result } = renderHook(() => useRestTimer());
    expect(result.current.remaining).toBe(90);
    expect(result.current.active).toBe(false);
  });

  it('start() sets active=true and remaining=90', () => {
    const { result } = renderHook(() => useRestTimer());
    act(() => {
      result.current.start();
    });
    expect(result.current.active).toBe(true);
    expect(result.current.remaining).toBe(90);
  });

  it('decrements by 1 each second', () => {
    const { result } = renderHook(() => useRestTimer());
    act(() => {
      result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.remaining).toBe(85);
  });

  it('sets active=false and remaining=0 after 90s', () => {
    const { result } = renderHook(() => useRestTimer());
    act(() => {
      result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(90000);
    });
    expect(result.current.active).toBe(false);
    expect(result.current.remaining).toBe(0);
  });

  it('dismiss() stops timer mid-countdown', () => {
    const { result } = renderHook(() => useRestTimer());
    act(() => {
      result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.active).toBe(false);
  });
});
