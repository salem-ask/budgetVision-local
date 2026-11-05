// Suivi de régularité d'un objectif : versements réels comparés au plan
// (« 15 USD par semaine »), période par période. Fonctions pures.
import { addDays, addMonths, DAYS_PER_MONTH, formatDuration, formatShortDate, toIsoDate, todayIso } from './dates';
import { convert, formatMoney } from './money';
import type { Contribution, Goal, Periodicity } from './types';

const PER_MONTH: Record<Periodicity, number> = { day: DAYS_PER_MONTH, week: DAYS_PER_MONTH / 7, month: 1 };
export const PERIOD_NAMES: Record<Periodicity, { one: string; this: string; many: string; first: string }> = {
  day: { one: 'jour', this: 'Aujourd’hui', many: 'jours', first: 'Premier jour' },
  week: { one: 'semaine', this: 'Cette semaine', many: 'semaines', first: 'Première semaine' },
  month: { one: 'mois', this: 'Ce mois-ci', many: 'mois', first: 'Premier mois' },
};

export interface PeriodTrack {
  /** Premier jour de la période (AAAA-MM-JJ). */
  start: string;
  /** Premier jour de la période suivante (exclu). */
  end: string;
  label: string;
  paid: number;
  planned: number;
  current: boolean;
}

export type RegularityStatus = 'ahead' | 'on-track' | 'behind';

export interface Regularity {
  /** Début du suivi : création de l'objectif, ou premier versement s'il est antérieur. */
  start: string;
  /** Périodes entièrement écoulées. */
  completed: number;
  /** Montant prévu pour les périodes écoulées. */
  due: number;
  /** Versé depuis le début du suivi (dans la devise de l'objectif). */
  paid: number;
  /** Versé − prévu : négatif = retard. */
  diff: number;
  status: RegularityStatus;
  current: PeriodTrack;
  /** Dernières périodes, de la plus ancienne à la période en cours. */
  recent: PeriodTrack[];
  /** Moyenne réellement versée par période écoulée (null avant la fin de la première période). */
  averagePerPeriod: number | null;
  /** Temps restant au rythme réel, en mois (null si pas encore de moyenne, Infinity si moyenne nulle). */
  monthsAtRealPace: number | null;
  message: string;
}

function periodStart(start: string, periodicity: Periodicity, index: number): string {
  if (periodicity === 'month') return addMonths(start, index);
  return addDays(start, index * (periodicity === 'week' ? 7 : 1));
}

/** Index de la période contenant `today` (0 = la première). */
function currentIndex(start: string, periodicity: Periodicity, today: string): number {
  if (today < start) return 0;
  if (periodicity !== 'month') {
    const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
    return Math.floor(days / (periodicity === 'week' ? 7 : 1));
  }
  let i = 0;
  while (periodStart(start, 'month', i + 1) <= today) i += 1;
  return i;
}

/**
 * Compare les versements au plan de l'objectif. `null` si aucun versement régulier n'est prévu.
 * `remaining` : reste à réunir (pour estimer le temps au rythme réel).
 * `money` : formatage des montants du message (par défaut dans la devise de l'objectif).
 */
export function analyzeRegularity(
  goal: Goal,
  contributions: Contribution[],
  rate: number,
  remaining: number,
  today = todayIso(),
  money: (value: number) => string = (v) => formatMoney(v, goal.currency),
  recentCount = 8,
): Regularity | null {
  if (!(goal.regularAmount > 0)) return null;
  const mine = contributions
    .filter((c) => c.goalId === goal.id && c.date <= today)
    .map((c) => ({ date: c.date, amount: convert(c.amount, c.currency, goal.currency, rate) }));
  const created = toIsoDate(new Date(goal.createdAt));
  const start = mine.reduce((min, c) => (c.date < min ? c.date : min), created <= today ? created : today);
  const amount = goal.regularAmount;
  const p = goal.periodicity;

  const index = currentIndex(start, p, today);
  const track = (i: number): PeriodTrack => {
    const s = periodStart(start, p, i);
    const e = periodStart(start, p, i + 1);
    const paid = mine.filter((c) => c.date >= s && c.date < e).reduce((sum, c) => sum + c.amount, 0);
    return { start: s, end: e, label: formatShortDate(s), paid, planned: amount, current: i === index };
  };
  const recent = Array.from({ length: Math.min(recentCount, index + 1) }, (_, k) => track(index - Math.min(recentCount, index + 1) + 1 + k));
  const current = recent[recent.length - 1];

  const completed = index;
  const due = completed * amount;
  const paid = mine.reduce((sum, c) => sum + c.amount, 0);
  const diff = paid - due;
  const tolerance = amount * 0.001;
  const status: RegularityStatus = diff < -tolerance ? 'behind' : diff >= amount - tolerance && completed > 0 ? 'ahead' : 'on-track';

  const paidCompleted = paid - current.paid;
  const averagePerPeriod = completed > 0 ? paidCompleted / completed : null;
  const monthsAtRealPace = averagePerPeriod === null ? null : remaining <= 0 ? 0 : averagePerPeriod > 0 ? remaining / (averagePerPeriod * PER_MONTH[p]) : Infinity;

  const m = money;
  const names = PERIOD_NAMES[p];
  const elapsed = `${completed} ${completed > 1 ? names.many : names.one}`;
  const elapsedVerb = p === 'week' ? (completed > 1 ? 'écoulées' : 'écoulée') : completed > 1 ? 'écoulés' : 'écoulé';
  let message: string;
  if (completed === 0) {
    message =
      current.paid >= amount - tolerance
        ? `${names.first} : ${m(current.paid)} versés, le plan est respecté.`
        : `${names.first} en cours : ${m(current.paid)} versés sur ${m(amount)} prévus.`;
  } else if (status === 'behind') {
    message = `Tu as ${m(-diff)} de retard sur ton plan : ${elapsed} ${elapsedVerb}, ${m(due)} prévus, ${m(paid)} versés.`;
  } else if (status === 'ahead') {
    message = `Bravo, tu as ${m(diff)} d’avance sur ton plan : ${m(paid)} versés pour ${m(due)} prévus.`;
  } else {
    message = `Tu es à jour : ${m(paid)} versés pour ${m(due)} prévus sur ${elapsed}.`;
  }
  return { start, completed, due, paid, diff, status, current, recent, averagePerPeriod, monthsAtRealPace, message };
}

/** Phrase sur le rythme réel : « En moyenne 12 USD par semaine : il te faudra encore 1 an et 2 mois. » */
export function realPaceMessage(goal: Goal, r: Regularity, money: (value: number) => string = (v) => formatMoney(v, goal.currency)): string | null {
  if (r.averagePerPeriod === null || r.monthsAtRealPace === null) return null;
  const m = money;
  const per = `par ${PERIOD_NAMES[goal.periodicity].one}`;
  if (r.monthsAtRealPace === 0) return null;
  if (r.averagePerPeriod <= 0) return 'Aucun versement depuis le début du suivi : à ce rythme, l’objectif ne sera pas atteint.';
  return `En moyenne, tu verses ${m(r.averagePerPeriod)} ${per} : à ce rythme réel, il te faudra encore ${formatDuration(r.monthsAtRealPace)}.`;
}
