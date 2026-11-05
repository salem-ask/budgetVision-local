// Calculs d'un objectif d'épargne. Fonctions pures : aucune lecture de la base ni du réseau.
import { addDays, daysBetween, DAYS_PER_MONTH, formatDate, formatDuration, todayIso } from './dates';
import { convert, formatMoney } from './money';
import type { Contribution, Goal, Periodicity } from './types';

/** Nombre de périodes par mois (en moyenne). */
const PER_MONTH: Record<Periodicity, number> = { day: DAYS_PER_MONTH, week: DAYS_PER_MONTH / 7, month: 1 };

export type GoalStatus = 'reached' | 'on-track' | 'late' | 'overdue' | 'no-plan';

export interface GoalAnalysis {
  /** Capital initial + versements, dans la devise de l'objectif. */
  saved: number;
  remaining: number;
  /** 0 à 1. */
  progress: number;
  daysLeft: number;
  /** Montant à épargner pour tenir la date limite (null si la date est passée ou l'objectif atteint). */
  needed: { perDay: number; perWeek: number; perMonth: number } | null;
  /** Versement régulier ramené au mois. */
  monthlyRate: number;
  /** Temps nécessaire au rythme prévu, en mois (Infinity si aucun versement prévu). */
  monthsNeeded: number;
  /** Date estimée d'atteinte au rythme prévu. */
  projectedDate: string | null;
  status: GoalStatus;
  /** Phrase d'alerte affichée à l'utilisateur. */
  message: string;
}

export function savedAmount(goal: Goal, contributions: Contribution[], rate: number): number {
  return contributions
    .filter((c) => c.goalId === goal.id)
    .reduce((sum, c) => sum + convert(c.amount, c.currency, goal.currency, rate), goal.initial);
}

export function analyzeGoal(goal: Goal, contributions: Contribution[], rate: number, today = todayIso()): GoalAnalysis {
  const saved = savedAmount(goal, contributions, rate);
  const remaining = Math.max(0, goal.target - saved);
  const progress = goal.target > 0 ? Math.min(1, Math.max(0, saved / goal.target)) : 0;
  const daysLeft = daysBetween(today, goal.deadline);
  const monthlyRate = Math.max(0, goal.regularAmount) * PER_MONTH[goal.periodicity];
  const monthsNeeded = remaining === 0 ? 0 : monthlyRate > 0 ? remaining / monthlyRate : Infinity;
  const projectedDate = Number.isFinite(monthsNeeded) ? addDays(today, Math.ceil(monthsNeeded * DAYS_PER_MONTH)) : null;

  const needed =
    remaining > 0 && daysLeft > 0
      ? {
          perDay: remaining / daysLeft,
          perWeek: remaining / (daysLeft / 7),
          // Moins d'un mois restant : tout le reste est à réunir ce mois-ci.
          perMonth: remaining / Math.max(1, daysLeft / DAYS_PER_MONTH),
        }
      : null;

  const money = (value: number) => formatMoney(value, goal.currency);
  let status: GoalStatus;
  let message: string;
  if (remaining === 0) {
    status = 'reached';
    message = 'Bravo, objectif atteint ! 🎉';
  } else if (daysLeft <= 0) {
    status = 'overdue';
    message = `La date limite est dépassée : il manque encore ${money(remaining)}.`;
    if (monthlyRate > 0) message += ` À ce rythme, tu l'atteins dans ${formatDuration(monthsNeeded)}.`;
  } else if (monthlyRate === 0) {
    status = 'no-plan';
    message = `Prévois un versement régulier : il faudrait ${money(needed!.perMonth)} par mois pour tenir la date limite.`;
  } else if (projectedDate! <= goal.deadline) {
    status = 'on-track';
    message = `À ce rythme, tu atteins ton objectif dans ${formatDuration(monthsNeeded)} (vers le ${formatDate(projectedDate!)}).`;
  } else {
    status = 'late';
    const lateDays = daysBetween(goal.deadline, projectedDate!);
    message =
      `Tu es en retard : à ce rythme, il te faut ${formatDuration(monthsNeeded)}, ` +
      `soit ${formatDuration(lateDays / DAYS_PER_MONTH)} après la date limite. ` +
      `Épargne ${money(needed!.perMonth)} par mois pour tenir le ${formatDate(goal.deadline)}.`;
  }

  return { saved, remaining, progress, daysLeft, needed, monthlyRate, monthsNeeded, projectedDate, status, message };
}

/** Champs saisis dans le formulaire d'un objectif. */
export interface GoalInput {
  name: string;
  target: number;
  deadline: string;
  initial: number;
  regularAmount: number;
}

/** Messages d'erreur par champ ; objet vide si tout est valide. */
export function validateGoal(input: GoalInput, today = todayIso()): Partial<Record<keyof GoalInput, string>> {
  const errors: Partial<Record<keyof GoalInput, string>> = {};
  if (!input.name.trim()) errors.name = "Donne un nom à ton objectif (ex. « Moto », « Études »).";
  else if (input.name.trim().length > 60) errors.name = 'Le nom doit faire au plus 60 caractères.';
  if (!(input.target > 0)) errors.target = 'Saisis un montant cible supérieur à 0.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.deadline)) errors.deadline = 'Choisis une date limite.';
  else if (input.deadline <= today) errors.deadline = 'La date limite doit être dans le futur.';
  if (!Number.isFinite(input.initial) || input.initial < 0) errors.initial = 'Le capital initial ne peut pas être négatif.';
  if (!Number.isFinite(input.regularAmount) || input.regularAmount < 0) errors.regularAmount = 'Le versement ne peut pas être négatif.';
  return errors;
}

/** Calcul rapide : combien mettre de côté pour réunir `target` en `months` mois (capital déjà réuni : `initial`). */
export function quickSavings(target: number, months: number, initial = 0) {
  const remaining = Math.max(0, target - initial);
  const days = months * DAYS_PER_MONTH;
  return { remaining, perMonth: remaining / months, perWeek: remaining / (days / 7), perDay: remaining / days };
}
