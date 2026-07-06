import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GOAL_TYPE_OPTIONS, PLANNING_EQUIPMENT_OPTIONS } from './goal-types';
import type { GoalType } from '../../infrastructure/planning-client';
import { createGoal } from '../../infrastructure/planning-client';
import { FilterChips } from '../exercises/FilterChips';
import { DayPicker } from '../shared/DayPicker';
import { MultiFilterChips } from '../shared/MultiFilterChips';
import { Stepper } from '../shared/Stepper';
import { Toast } from '../shared/Toast';
import { useToast } from '../shared/useToast';

export function GoalFormPage() {
  const navigate = useNavigate();
  const { message, show: showToast } = useToast();

  const [type, setType] = useState<GoalType | ''>('');
  const [targetDescription, setTargetDescription] = useState('');
  const [horizonWeeks, setHorizonWeeks] = useState(4);
  const [availabilityDays, setAvailabilityDays] = useState<number[]>([]);
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(60);
  const [availableEquipment, setAvailableEquipment] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [typeError, setTypeError] = useState(false);
  const [daysError, setDaysError] = useState(false);

  const typeLabels = GOAL_TYPE_OPTIONS.map((o) => o.label);
  const selectedLabel =
    type !== ''
      ? (GOAL_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? undefined)
      : undefined;

  const handleTypeChange = (label: string | undefined) => {
    if (!label) {
      setType('');
    } else {
      const found = GOAL_TYPE_OPTIONS.find((o) => o.label === label);
      if (found) setType(found.value);
    }
    setTypeError(false);
  };

  const handleSubmit = async () => {
    let hasError = false;
    if (type === '') {
      setTypeError(true);
      hasError = true;
    }
    if (availabilityDays.length === 0) {
      setDaysError(true);
      hasError = true;
    }
    if (hasError) return;

    setSubmitting(true);
    try {
      await createGoal({
        type: type as GoalType,
        targetDescription,
        horizonWeeks,
        availabilityDays,
        sessionDurationMinutes,
        availableEquipment,
      });
      showToast('Objectif enregistré, séances planifiées');
      setTimeout(() => {
        navigate('/');
      }, 800);
    } catch {
      showToast('Erreur, réessayez');
      setSubmitting(false);
    }
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
          ← Accueil
        </button>

        <h1 className="text-2xl font-medium text-ink">Définir un objectif</h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
          className="flex flex-col gap-6"
        >
          {/* Type */}
          <div className="flex flex-col gap-2">
            <label className="text-ink font-medium text-sm">
              Type d&apos;objectif
            </label>
            <FilterChips
              options={typeLabels}
              selected={selectedLabel}
              onChange={handleTypeChange}
            />
            {typeError && (
              <p className="text-red-500 text-xs">Sélectionnez un type</p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <label className="text-ink font-medium text-sm">Description</label>
            <input
              type="text"
              value={targetDescription}
              onChange={(e) => {
                setTargetDescription(e.target.value);
              }}
              placeholder="Ex: améliorer le squat"
              className="w-full px-4 py-2 rounded border border-gray-300 bg-canvas text-ink text-sm"
            />
          </div>

          {/* Horizon */}
          <div className="flex flex-col gap-2">
            <label className="text-ink font-medium text-sm">Durée</label>
            <div className="flex items-center gap-3">
              <Stepper
                value={horizonWeeks}
                min={1}
                max={12}
                step={1}
                onChange={setHorizonWeeks}
                disabled={submitting}
              />
              <span className="text-mute text-sm">semaines</span>
            </div>
          </div>

          {/* Availability days */}
          <div className="flex flex-col gap-2">
            <label className="text-ink font-medium text-sm">
              Jours disponibles
            </label>
            <DayPicker
              selected={availabilityDays}
              onChange={(days) => {
                setAvailabilityDays(days);
                setDaysError(false);
              }}
            />
            {daysError && (
              <p className="text-red-500 text-xs">
                Sélectionnez au moins un jour
              </p>
            )}
          </div>

          {/* Session duration */}
          <div className="flex flex-col gap-2">
            <label className="text-ink font-medium text-sm">
              Durée de séance
            </label>
            <div className="flex items-center gap-3">
              <Stepper
                value={sessionDurationMinutes}
                min={20}
                max={120}
                step={5}
                onChange={setSessionDurationMinutes}
                disabled={submitting}
              />
              <span className="text-mute text-sm">min</span>
            </div>
          </div>

          {/* Equipment */}
          <div className="flex flex-col gap-2">
            <label className="text-ink font-medium text-sm">
              Équipement disponible
            </label>
            <MultiFilterChips
              options={PLANNING_EQUIPMENT_OPTIONS}
              selected={availableEquipment}
              onChange={setAvailableEquipment}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="bg-ink text-canvas px-8 py-3 rounded-full font-medium disabled:opacity-50 self-start"
          >
            {submitting ? '…' : 'Enregistrer'}
          </button>
        </form>
      </div>
      <Toast message={message} />
    </div>
  );
}
