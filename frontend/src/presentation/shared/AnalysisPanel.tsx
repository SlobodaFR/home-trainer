import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useAnalysisPoller } from './useAnalysisPoller';
import type { AnalysisStatus } from '../../infrastructure/analysis-client';
import {
  getAnalysis,
  retryAnalysis,
} from '../../infrastructure/analysis-client';

interface Props {
  sessionId: string;
}

export function AnalysisPanel({ sessionId }: Props) {
  const [initialStatus, setInitialStatus] = useState<
    AnalysisStatus | null | 'loading'
  >('loading');
  const [initialResult, setInitialResult] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    getAnalysis(sessionId)
      .then((analysis) => {
        if (!analysis) {
          setInitialStatus(null);
        } else {
          setInitialStatus(analysis.status);
          setInitialResult(analysis.result);
        }
      })
      .catch(() => {
        setInitialStatus(null);
      });
  }, [sessionId]);

  const pollSessionId = initialStatus === 'pending' ? sessionId : null;
  const {
    status: polledStatus,
    result: polledResult,
    retry: pollRetry,
  } = useAnalysisPoller(pollSessionId);

  const status = polledStatus ?? initialStatus;
  const result = polledResult ?? initialResult;

  const handleRetry = () => {
    setRetrying(true);
    void retryAnalysis(sessionId)
      .then(() => {
        setInitialStatus('pending');
        setRetrying(false);
        pollRetry();
      })
      .catch(() => {
        setRetrying(false);
      });
  };

  if (initialStatus === 'loading') return null;
  if (status === null) return null;

  return (
    <div className="bg-soft-cloud rounded-lg p-4 flex flex-col gap-3">
      <h2 className="text-sm font-medium text-ink">Analyse LLM</h2>

      {status === 'pending' && (
        <div className="flex items-center gap-2 text-mute text-sm">
          <div className="w-4 h-4 border-2 border-mute border-t-transparent rounded-full animate-spin" />
          Analyse en cours…
        </div>
      )}

      {status === 'done' && result && (
        <div className="prose prose-sm text-ink max-w-none">
          <ReactMarkdown>{result}</ReactMarkdown>
        </div>
      )}

      {status === 'failed' && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-mute">Analyse indisponible.</p>
          <button
            type="button"
            disabled={retrying}
            onClick={handleRetry}
            className="bg-ink text-canvas px-4 py-2 rounded-full text-sm font-medium self-start disabled:opacity-50"
          >
            {retrying ? '…' : 'Réessayer'}
          </button>
        </div>
      )}

      {status === 'timeout' && (
        <p className="text-sm text-mute">
          L&apos;analyse prend plus de temps que prévu. Réessayez plus tard.
        </p>
      )}
    </div>
  );
}
