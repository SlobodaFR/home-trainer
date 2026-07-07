import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProfileCard } from './ProfileCard';
import { getActiveGoal } from '../../infrastructure/planning-client';
import type {
  AssessInput,
  FitnessProfileDraft,
} from '../../infrastructure/profile-client';
import { assessFitness } from '../../infrastructure/profile-client';
import { FilterChips } from '../exercises/FilterChips';
import { PLANNING_EQUIPMENT_OPTIONS } from '../planning/goal-types';
import { MultiFilterChips } from '../shared/MultiFilterChips';

const INJURY_TAGS = [
  'Genoux',
  'Dos',
  'Épaules',
  'Poignets',
  'Hanches',
  'Aucune',
];
const LEVEL_OPTIONS = ['Débutant', 'Intermédiaire', 'Avancé'];
const LEVEL_MAP: Record<string, AssessInput['experience']> = {
  Débutant: 'débutant',
  Intermédiaire: 'intermédiaire',
  Avancé: 'avancé',
};

export function AssessmentPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [levelLabel, setLevelLabel] = useState<string | undefined>(undefined);
  const [yearsTraining, setYearsTraining] = useState(0);
  const [injuries, setInjuries] = useState<string[]>([]);
  const [injuryNote, setInjuryNote] = useState('');
  const [equipmentComfort, setEquipmentComfort] = useState<string[]>([]);
  const [specificGoal, setSpecificGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<FitnessProfileDraft | null>(null);

  useEffect(() => {
    void getActiveGoal().then((goal) => {
      if (goal?.availableEquipment) {
        setEquipmentComfort(goal.availableEquipment);
      }
    });
  }, []);

  const handleReset = () => {
    setStep(0);
    setDraft(null);
    setError('');
  };

  const handleAssess = () => {
    if (!levelLabel) return;
    setLoading(true);
    setError('');
    const input: AssessInput = {
      experience: LEVEL_MAP[levelLabel] ?? 'intermédiaire',
      yearsTraining,
      injuries,
      injuryNote,
      equipmentComfort,
      specificGoal,
    };
    void assessFitness(input)
      .then((result) => {
        setDraft(result);
        setStep(4);
      })
      .catch(() => {
        setError('Erreur lors de la génération du profil. Réessayez.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="min-h-screen bg-soft-cloud">
      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
        <button
          type="button"
          onClick={() => {
            navigate(-1);
          }}
          className="flex items-center gap-1 text-mute text-sm w-fit"
        >
          ← Retour
        </button>

        <h1 className="text-2xl font-medium text-ink">
          Votre profil d'entraînement
        </h1>

        {step < 4 && (
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-ink' : 'bg-hairline'}`}
              />
            ))}
          </div>
        )}

        {step === 0 && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-ink font-medium text-sm">
                Votre niveau
              </label>
              <FilterChips
                options={LEVEL_OPTIONS}
                selected={levelLabel}
                onChange={setLevelLabel}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-ink font-medium text-sm">
                Années d'entraînement
              </label>
              <input
                type="number"
                min={0}
                max={50}
                value={yearsTraining}
                onChange={(e) => {
                  setYearsTraining(Number(e.target.value));
                }}
                className="w-24 px-4 py-2 rounded border border-hairline bg-canvas text-ink text-sm"
              />
            </div>

            <button
              type="button"
              disabled={!levelLabel}
              onClick={() => {
                setStep(1);
              }}
              className="bg-ink text-canvas px-6 py-2.5 rounded-full text-sm font-medium self-start disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-ink font-medium text-sm">
                Blessures ou limitations
              </label>
              <MultiFilterChips
                options={INJURY_TAGS}
                selected={injuries}
                onChange={setInjuries}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-ink font-medium text-sm">
                Précisions (optionnel)
              </label>
              <textarea
                value={injuryNote}
                onChange={(e) => {
                  setInjuryNote(e.target.value);
                }}
                placeholder="Ex: douleur au genou gauche depuis 6 mois"
                rows={3}
                className="w-full px-4 py-2 rounded border border-hairline bg-canvas text-ink text-sm resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep(0);
                }}
                className="border border-hairline text-ink px-6 py-2.5 rounded-full text-sm font-medium"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep(2);
                }}
                className="bg-ink text-canvas px-6 py-2.5 rounded-full text-sm font-medium"
              >
                Suivant
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-ink font-medium text-sm">
                Équipement que vous maîtrisez
              </label>
              <MultiFilterChips
                options={PLANNING_EQUIPMENT_OPTIONS}
                selected={equipmentComfort}
                onChange={setEquipmentComfort}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                }}
                className="border border-hairline text-ink px-6 py-2.5 rounded-full text-sm font-medium"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep(3);
                }}
                className="bg-ink text-canvas px-6 py-2.5 rounded-full text-sm font-medium"
              >
                Suivant
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-ink font-medium text-sm">
                Votre objectif précis
              </label>
              <textarea
                value={specificGoal}
                maxLength={300}
                onChange={(e) => {
                  setSpecificGoal(e.target.value);
                }}
                placeholder="Ex: progresser sur le squat barre, retrouver mobilité épaule…"
                rows={4}
                className="w-full px-4 py-2 rounded border border-hairline bg-canvas text-ink text-sm resize-none"
              />
              <span className="text-mute text-xs self-end">
                {specificGoal.length}/300
              </span>
            </div>

            {error && <p className="text-sm text-sale">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep(2);
                }}
                disabled={loading}
                className="border border-hairline text-ink px-6 py-2.5 rounded-full text-sm font-medium disabled:opacity-50"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={handleAssess}
                disabled={loading || specificGoal.trim().length === 0}
                className="bg-ink text-canvas px-6 py-2.5 rounded-full text-sm font-medium disabled:opacity-50"
              >
                {loading ? 'Génération…' : 'Générer mon profil'}
              </button>
            </div>
          </div>
        )}

        {step === 4 && draft && (
          <ProfileCard draft={draft} onReset={handleReset} />
        )}
      </div>
    </div>
  );
}
