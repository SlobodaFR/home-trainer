import { useState } from 'react';

interface RPEModalProps {
  onFinish: (rpe: number | null, note: string | null) => void;
  onCancel: () => void;
  loading: boolean;
}

export function RPEModal({ onFinish, onCancel, loading }: RPEModalProps) {
  const [rpe, setRpe] = useState<number | null>(null);
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-end z-50">
      <div className="bg-canvas rounded-t-2xl p-6 flex flex-col gap-4 w-full">
        <h2 className="text-lg font-medium text-ink">
          Comment s&apos;est passée la séance ?
        </h2>

        <div className="flex flex-col gap-2">
          <p className="text-sm text-mute">Effort perçu (RPE)</p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                autoFocus={n === 1}
                onClick={() => {
                  setRpe(rpe === n ? null : n);
                }}
                className={
                  rpe === n
                    ? 'bg-ink text-canvas rounded-full px-4 py-2 text-sm font-medium'
                    : 'bg-canvas text-ink border border-hairline rounded-full px-4 py-2 text-sm font-medium'
                }
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
          }}
          maxLength={1000}
          rows={3}
          placeholder="Note optionnelle…"
          className="border border-hairline rounded p-2 text-sm w-full resize-none text-ink"
        />

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              onFinish(rpe, note.trim() !== '' ? note.trim() : null);
            }}
            className="bg-ink text-canvas px-6 py-3 rounded-full text-sm font-medium disabled:opacity-50"
          >
            {loading ? '…' : 'Terminer la séance'}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="bg-soft-cloud text-ink px-6 py-3 rounded-full text-sm font-medium disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
