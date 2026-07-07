import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HistoryEntry } from '../../infrastructure/analysis-client';
import { getHistory } from '../../infrastructure/analysis-client';

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function AnalysisChip({ status }: { status: HistoryEntry['analysisStatus'] }) {
  if (!status) return null;
  if (status === 'done') {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium border border-hairline text-success">
        Analysé
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium border border-hairline text-sale">
        Échec
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium border border-hairline text-mute">
      En cours
    </span>
  );
}

export function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getHistory()
      .then(setEntries)
      .catch(() => {
        setError(true);
      });
  }, []);

  if (entries === null && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft-cloud">
        <div className="w-8 h-8 border-2 border-ink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-soft-cloud">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <p className="text-mute">Impossible de charger l&apos;historique.</p>
        </div>
      </div>
    );
  }

  if (!entries?.length) {
    return (
      <div className="min-h-screen bg-soft-cloud">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <p className="text-mute">
            Aucune séance complétée pour l&apos;instant.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-soft-cloud">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-2">
        <h1 className="text-2xl font-medium text-ink mb-4">Historique</h1>
        {entries.map((entry) => (
          <Link
            key={entry.session.id}
            to={`/sessions/${entry.session.id}`}
            className="bg-canvas rounded-lg px-4 py-3 flex flex-col gap-1 hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">
                {formatDate(entry.session.plannedDate)}
              </span>
              <AnalysisChip status={entry.analysisStatus} />
            </div>
            <span className="text-sm text-mute truncate">
              {entry.session.exercises.map((e) => e.exerciseName).join(', ')}
            </span>
            <span className="text-xs text-mute">
              {entry.volumeKg > 0 ? `${entry.volumeKg.toFixed(1)} kg` : '—'}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
