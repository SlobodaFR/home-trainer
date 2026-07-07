import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AnalysisContext } from './AnalysisContext';
import { useAnalysisPoller } from './useAnalysisPoller';

export function AnalysisBanner() {
  const { pendingSessionId, setPending } = useContext(AnalysisContext);
  const { status, retry } = useAnalysisPoller(pendingSessionId);

  if (!pendingSessionId) return null;

  const dismiss = () => {
    setPending(null);
  };

  if (status === 'done') {
    return (
      <div
        role="status"
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-4 px-4 py-3 bg-canvas border-b border-hairline shadow-sm"
      >
        <span className="text-sm text-ink">Analyse prête</span>
        <div className="flex items-center gap-3">
          <Link
            to={`/sessions/${pendingSessionId}`}
            onClick={dismiss}
            className="bg-ink text-canvas px-4 py-1.5 rounded-full text-sm font-medium"
          >
            Voir les résultats
          </Link>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fermer"
            className="text-mute text-sm"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div
        role="status"
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-4 px-4 py-3 bg-canvas border-b border-hairline shadow-sm"
      >
        <span className="text-sm text-ink">Analyse indisponible</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={retry}
            className="bg-ink text-canvas px-4 py-1.5 rounded-full text-sm font-medium"
          >
            Réessayer
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fermer"
            className="text-mute text-sm"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  if (status === 'timeout') {
    return (
      <div
        role="status"
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-4 px-4 py-3 bg-canvas border-b border-hairline shadow-sm"
      >
        <span className="text-sm text-mute">
          L&apos;analyse prend plus de temps que prévu. Réessayez plus tard.
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer"
          className="text-mute text-sm"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-4 px-4 py-3 bg-canvas border-b border-hairline shadow-sm"
    >
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-ink border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-mute">Analyse en cours…</span>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fermer"
        className="text-mute text-sm"
      >
        ✕
      </button>
    </div>
  );
}
