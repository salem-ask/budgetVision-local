// Scénarios d'épargne : capital = capital initial + versement mensuel × nombre de mois.
// Pas d'intérêts composés (hors V1).
import type { ScenarioParams } from './types';

export type ScenarioId = 'prudent' | 'intermediaire' | 'ambitieux';
export const SCENARIOS: { id: ScenarioId; label: string; color: string }[] = [
  { id: 'prudent', label: 'Prudent', color: '#0ea5e9' },
  { id: 'intermediaire', label: 'Intermédiaire', color: '#f59e0b' },
  { id: 'ambitieux', label: 'Ambitieux', color: '#22c55e' },
];

export const DEFAULT_SCENARIOS: ScenarioParams = {
  currency: 'CDF',
  initial: 0,
  months: 12,
  target: 0,
  prudent: 50_000,
  intermediaire: 100_000,
  ambitieux: 200_000,
};

export interface ScenarioResult {
  id: ScenarioId;
  monthly: number;
  /** Capital à la fin de chaque mois, de 0 (aujourd'hui) à `months`. */
  points: number[];
  final: number;
  totalSaved: number;
  /** Mois nécessaires pour atteindre le montant visé (null si aucun montant visé ; Infinity si jamais). */
  monthsToTarget: number | null;
}

export function runScenarios(params: ScenarioParams): ScenarioResult[] {
  const months = Math.max(1, Math.min(600, Math.round(params.months)));
  return SCENARIOS.map(({ id }) => {
    const monthly = Math.max(0, params[id]);
    const points = Array.from({ length: months + 1 }, (_, m) => params.initial + monthly * m);
    let monthsToTarget: number | null = null;
    if (params.target > 0) {
      const missing = params.target - params.initial;
      monthsToTarget = missing <= 0 ? 0 : monthly > 0 ? Math.ceil(missing / monthly) : Infinity;
    }
    return { id, monthly, points, final: points[months], totalSaved: monthly * months, monthsToTarget };
  });
}

export function validateScenarios(params: ScenarioParams): string | null {
  if (!Number.isFinite(params.months) || params.months < 1 || params.months > 600) return 'La durée doit être comprise entre 1 et 600 mois.';
  if (!Number.isFinite(params.initial) || params.initial < 0) return 'Le capital initial ne peut pas être négatif.';
  for (const { id, label } of SCENARIOS) {
    if (!Number.isFinite(params[id]) || params[id] < 0) return `Le versement « ${label} » ne peut pas être négatif.`;
  }
  return null;
}
