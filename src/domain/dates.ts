// Dates en heure locale, au format AAAA-MM-JJ (jours) ou AAAA-MM (mois).

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAY_MS = 24 * 60 * 60 * 1000;
/** Durée moyenne d'un mois en jours (365,25 / 12). */
export const DAYS_PER_MONTH = 30.4375;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIso(now = new Date()): string {
  return toIsoDate(now);
}

export function currentMonth(now = new Date()): string {
  return todayIso(now).slice(0, 7);
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseIsoDate(value);
  return toIsoDate(date) === value;
}

export function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Nombre de jours de `from` à `to` (positif si `to` est après). Insensible aux changements d'heure. */
export function daysBetween(from: string, to: string): number {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / DAY_MS);
}

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** « 15 mars 2027 ». */
export function formatDate(iso: string): string {
  if (!isValidIsoDate(iso)) return iso;
  const date = parseIsoDate(iso);
  return `${date.getDate() === 1 ? '1er' : date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** « mars 2027 ». */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** Nombre de jours du mois (AAAA-MM). */
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/**
 * Durée lisible à partir d'un nombre de mois : « 3 mois », « 1 an et 2 mois », « moins d'un mois ».
 */
export function formatDuration(months: number): string {
  if (!Number.isFinite(months)) return '—';
  const total = Math.ceil(months - 1e-9);
  if (total <= 0) return "moins d'un mois";
  if (months < 1) return "moins d'un mois";
  const years = Math.floor(total / 12);
  const rest = total % 12;
  const y = years === 0 ? '' : years === 1 ? '1 an' : `${years} ans`;
  const m = rest === 0 ? '' : `${rest} mois`;
  return [y, m].filter(Boolean).join(' et ');
}

/** Ajoute des mois en gardant le jour (ramené au dernier jour du mois si besoin : 31 janv. + 1 mois → 28/29 févr.). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const first = new Date(y, m - 1 + months, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return toIsoDate(new Date(first.getFullYear(), first.getMonth(), Math.min(d, last)));
}

/** « 6 oct. » (sans l'année), pour les étiquettes courtes. */
export function formatShortDate(iso: string): string {
  const short = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const date = parseIsoDate(iso);
  return `${date.getDate()} ${short[date.getMonth()]}`;
}
