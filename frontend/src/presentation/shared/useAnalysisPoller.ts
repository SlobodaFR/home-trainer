import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnalysisStatus } from '../../infrastructure/analysis-client';
import {
  getAnalysis,
  retryAnalysis,
} from '../../infrastructure/analysis-client';

const POLL_INTERVAL_MS = 5000;
const MAX_TICKS = 18; // 90s / 5s

export interface AnalysisPollerState {
  status: AnalysisStatus | 'timeout' | null;
  result: string | null;
  retry: () => void;
}

export function useAnalysisPoller(
  sessionId: string | null,
): AnalysisPollerState {
  const [status, setStatus] = useState<AnalysisStatus | 'timeout' | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ticksRef = useRef(0);
  const activeRef = useRef(false);

  const stopPolling = useCallback(() => {
    activeRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    ticksRef.current = 0;
  }, []);

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      setStatus(null);
      setResult(null);
      ticksRef.current = 0;
      activeRef.current = true;

      intervalRef.current = setInterval(() => {
        ticksRef.current += 1;
        if (ticksRef.current > MAX_TICKS) {
          stopPolling();
          setStatus('timeout');
          return;
        }

        void getAnalysis(id).then((analysis) => {
          if (!activeRef.current) return;
          if (!analysis) return;
          if (analysis.status === 'done' || analysis.status === 'failed') {
            stopPolling();
            setStatus(analysis.status);
            setResult(analysis.result);
          } else {
            setStatus(analysis.status);
          }
        });
      }, POLL_INTERVAL_MS);
    },
    [stopPolling],
  );

  useEffect(() => {
    if (!sessionId) return;
    startPolling(sessionId);
    return stopPolling;
  }, [sessionId, startPolling, stopPolling]);

  const retry = useCallback(() => {
    if (!sessionId) return;
    void retryAnalysis(sessionId).then(() => {
      startPolling(sessionId);
    });
  }, [sessionId, startPolling]);

  return { status, result, retry };
}
