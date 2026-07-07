import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FitnessProfileDraft } from '../../infrastructure/profile-client';
import { saveProfile } from '../../infrastructure/profile-client';

const LEVEL_LABEL: Record<FitnessProfileDraft['level'], string> = {
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé',
};

interface Props {
  draft: FitnessProfileDraft;
  onReset: () => void;
}

export function ProfileCard({ draft, onReset }: Props) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = () => {
    setSaving(true);
    void saveProfile(draft)
      .then(() => {
        navigate('/');
      })
      .catch(() => {
        setError("Impossible d'enregistrer le profil. Réessayez.");
        setSaving(false);
      });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-soft-cloud rounded-lg p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="bg-ink text-canvas rounded-full px-3 py-1 text-sm font-medium">
            {LEVEL_LABEL[draft.level]}
          </span>
          <h2 className="text-ink font-medium">Votre profil</h2>
        </div>

        <p className="text-ink text-sm leading-relaxed">{draft.summary}</p>

        {draft.injuryNotes && (
          <p className="text-mute text-sm">
            <span className="font-medium">Limitations :</span>{' '}
            {draft.injuryNotes}
          </p>
        )}

        <div className="text-mute text-xs">
          Plan : {draft.plannerConfig.maxSetsPerExercise} séries ×{' '}
          {String(Math.round(10 * draft.plannerConfig.intensityMultiplier))}{' '}
          reps
        </div>
      </div>

      {error && <p className="text-sm text-sale">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={saving}
          className="bg-ink text-canvas px-6 py-2.5 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {saving ? '…' : 'Confirmer'}
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={saving}
          className="border border-hairline text-ink px-6 py-2.5 rounded-full text-sm font-medium disabled:opacity-50"
        >
          Recommencer
        </button>
      </div>
    </div>
  );
}
