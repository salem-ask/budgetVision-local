// Sauvegarde par fichier : export, validation et import (remplacement complet des données).
// Le format est celui de la version en ligne (« source »: « en-ligne ») : ses fichiers s'importent ici tels quels.
import { CURRENCIES, GOAL_KINDS, SIMULATION_LABELS, type Category, type Contribution, type Entry, type Goal, type Settings, type Simulation } from '../domain/types';
import { DEFAULT_CATEGORIES } from '../domain/budget';
import { defaultSettings, getMeta, SETTINGS_ID, setMeta, type BudgetDB } from './db';

export const BACKUP_APP = 'BudgetVision';
export const BACKUP_VERSION = 1;
/** Clé (table meta) de la date de la dernière sauvegarde, ISO 8601. */
export const LAST_BACKUP_KEY = 'lastBackupAt';
/** Au-delà, l'Accueil rappelle de sauvegarder. */
export const BACKUP_REMINDER_DAYS = 30;

export type BackupSource = 'en-ligne' | 'locale';

export interface BackupData {
  goals: Goal[];
  contributions: Contribution[];
  entries: Entry[];
  categories: Category[];
  simulations: Simulation[];
  /** Zéro ou un élément (id « settings »). */
  settings: Settings[];
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: typeof BACKUP_VERSION;
  /** Date d'export, ISO 8601. */
  exportedAt: string;
  /** D'où vient le fichier : « en-ligne » (version avec compte) ou « locale » (cette version). */
  source: BackupSource;
  /** Identifiant du compte exporté (version en ligne, information seulement). */
  account?: string;
  data: BackupData;
}

export const NOT_A_BACKUP = 'Ce fichier n’est pas une sauvegarde BudgetVision.';

// --- Export ---

export async function buildBackup(database: BudgetDB, now = new Date()): Promise<BackupFile> {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    source: 'locale',
    data: {
      goals: await database.goals.toArray(),
      contributions: await database.contributions.toArray(),
      entries: await database.entries.toArray(),
      categories: await database.categories.toArray(),
      simulations: await database.simulations.toArray(),
      settings: await database.settings.toArray(),
    },
  };
}

/** « budgetvision-sauvegarde-2026-11-05.json » (date locale). */
export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `budgetvision-sauvegarde-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

export function backupToFile(backup: BackupFile, now = new Date()): File {
  return new File([JSON.stringify(backup, null, 2)], backupFileName(now), { type: 'application/json' });
}

// --- Résumés ---

/** « 3 objectifs, 12 versements, 42 lignes de budget, 5 simulations ». */
export function describeBackup(file: BackupFile): string {
  const d = file.data;
  const part = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
  return [
    part(d.goals.length, 'objectif', 'objectifs'),
    part(d.contributions.length, 'versement', 'versements'),
    part(d.entries.length, 'ligne de budget', 'lignes de budget'),
    part(d.simulations.length, 'simulation', 'simulations'),
  ].join(', ');
}

/** « 5 nov. 2026 » (date locale). */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** « Sauvegarde du 5 nov. 2026, compte awa : 3 objectifs, 12 versements, … ». */
export function backupSummary(file: BackupFile): string {
  const origin = file.account ? `, compte ${file.account}` : file.source === 'locale' ? ' (version locale)' : '';
  return `Sauvegarde du ${formatShortDate(file.exportedAt)}${origin} : ${describeBackup(file)}`;
}

// --- Validation ---

class BackupError extends Error {}

type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Lecture champ par champ d'un élément, avec un message qui dit quoi est abîmé. */
function reader(row: Raw, what: string) {
  const fail = (field: string): never => {
    throw new BackupError(`${what} : ${field} invalide.`);
  };
  return {
    str(key: string, label: string, fallback?: string): string {
      const v = row[key];
      if (v === undefined && fallback !== undefined) return fallback;
      return typeof v === 'string' ? v : fail(label);
    },
    id(): string {
      const v = row.id;
      return typeof v === 'string' && v.trim() !== '' ? v : fail('identifiant');
    },
    amount(key: string, label: string): number {
      const v = row[key];
      return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fail(label);
    },
    date(key: string, label: string): string {
      const v = row[key];
      return typeof v === 'string' && DATE_RE.test(v) ? v : fail(`${label} (format AAAA-MM-JJ attendu)`);
    },
    month(key: string, label: string): string {
      const v = row[key];
      return typeof v === 'string' && MONTH_RE.test(v) ? v : fail(`${label} (format AAAA-MM attendu)`);
    },
    currency(key = 'currency'): Contribution['currency'] {
      const v = row[key];
      return CURRENCIES.includes(v as never) ? (v as Contribution['currency']) : fail('devise (CDF ou USD attendu)');
    },
    oneOf<T extends string>(key: string, label: string, allowed: readonly T[]): T {
      const v = row[key];
      return allowed.includes(v as T) ? (v as T) : fail(label);
    },
    /** updatedAt et createdAt (ms) : 0 accepté. */
    time(key: string): number {
      const v = row[key];
      return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fail(key === 'updatedAt' ? 'date de modification' : 'date de création');
    },
  };
}

function nameOf(row: Raw, key: string): string {
  return typeof row[key] === 'string' && row[key] ? ` « ${row[key] as string} »` : '';
}

/** Lit un tableau d'éléments : écarte les éléments supprimés (`deleted: true`) et les champs inconnus. */
function readList<T>(data: Raw, key: keyof BackupData, label: string, labelOne: string, nameKey: string, read: (row: Raw, what: string) => T): T[] {
  const list = data[key];
  if (!Array.isArray(list)) throw new BackupError(`il manque la liste des ${label}.`);
  const out: T[] = [];
  list.forEach((row, index) => {
    const what = `${labelOne} n° ${index + 1}${isObject(row) ? nameOf(row, nameKey) : ''}`;
    if (!isObject(row)) throw new BackupError(`${what} : élément illisible.`);
    if (row.deleted === true) return;
    out.push(read(row, what));
  });
  return out;
}

const PERIODICITIES = ['day', 'week', 'month'] as const;
const BUCKETS = ['besoin', 'envie', 'epargne'] as const;

function readGoal(row: Raw, what: string): Goal {
  const r = reader(row, what);
  return {
    id: r.id(),
    updatedAt: r.time('updatedAt'),
    name: r.str('name', 'nom'),
    kind: r.oneOf('kind', 'type d’objectif', GOAL_KINDS.map((k) => k.id)),
    currency: r.currency(),
    target: r.amount('target', 'montant cible'),
    deadline: r.date('deadline', 'date limite'),
    initial: r.amount('initial', 'capital de départ'),
    regularAmount: r.amount('regularAmount', 'versement régulier'),
    periodicity: r.oneOf('periodicity', 'périodicité', PERIODICITIES),
    createdAt: r.time('createdAt'),
  };
}

function readContribution(row: Raw, what: string): Contribution {
  const r = reader(row, what);
  return {
    id: r.id(),
    updatedAt: r.time('updatedAt'),
    goalId: r.str('goalId', 'objectif lié'),
    amount: r.amount('amount', 'montant'),
    currency: r.currency(),
    date: r.date('date', 'date'),
    note: r.str('note', 'note', ''),
  };
}

function readEntry(row: Raw, what: string): Entry {
  const r = reader(row, what);
  return {
    id: r.id(),
    updatedAt: r.time('updatedAt'),
    kind: r.oneOf('kind', 'type (revenu ou dépense)', ['income', 'expense'] as const),
    amount: r.amount('amount', 'montant'),
    currency: r.currency(),
    categoryId: r.str('categoryId', 'catégorie', ''),
    label: r.str('label', 'libellé', ''),
    month: r.month('month', 'mois'),
    createdAt: r.time('createdAt'),
  };
}

function readCategory(row: Raw, what: string): Category {
  const r = reader(row, what);
  const category: Category = {
    id: r.id(),
    updatedAt: r.time('updatedAt'),
    name: r.str('name', 'nom'),
    bucket: r.oneOf('bucket', 'groupe 50/30/20', BUCKETS),
    color: r.str('color', 'couleur'),
  };
  if (row.builtin === true) category.builtin = true;
  return category;
}

function readSimulation(row: Raw, what: string): Simulation {
  const r = reader(row, what);
  const lines = row.lines;
  if (!Array.isArray(lines) || !lines.every((l) => isObject(l) && typeof l.label === 'string' && typeof l.value === 'string')) {
    throw new BackupError(`${what} : lignes du résumé invalides.`);
  }
  return {
    id: r.id(),
    updatedAt: r.time('updatedAt'),
    kind: r.oneOf('kind', 'type de simulation', Object.keys(SIMULATION_LABELS) as Simulation['kind'][]),
    title: r.str('title', 'titre'),
    lines: lines.map((l) => ({ label: (l as Raw).label as string, value: (l as Raw).value as string })),
    text: r.str('text', 'texte'),
    createdAt: r.time('createdAt'),
  };
}

function readSettings(row: Raw, what: string): Settings {
  const r = reader(row, what);
  if (row.id !== SETTINGS_ID) throw new BackupError(`${what} : identifiant invalide (« settings » attendu).`);
  const rate = r.amount('rate', 'taux de change');
  if (!(rate > 0)) throw new BackupError(`${what} : taux de change invalide (doit être supérieur à 0).`);
  if (!isObject(row.scenarios)) throw new BackupError(`${what} : paramètres des scénarios invalides.`);
  const s = reader(row.scenarios, `${what}, scénarios`);
  return {
    id: SETTINGS_ID,
    updatedAt: r.time('updatedAt'),
    rate,
    displayCurrency: r.currency('displayCurrency'),
    scenarios: {
      currency: s.currency(),
      initial: s.amount('initial', 'capital de départ'),
      months: s.amount('months', 'durée'),
      target: s.amount('target', 'montant visé'),
      prudent: s.amount('prudent', 'versement prudent'),
      intermediaire: s.amount('intermediaire', 'versement intermédiaire'),
      ambitieux: s.amount('ambitieux', 'versement ambitieux'),
    },
  };
}

export type ParseResult = { ok: true; backup: BackupFile } | { ok: false; error: string };

/** Valide le contenu d'un fichier de sauvegarde (texte JSON). Ne touche pas à la base. */
export function parseBackup(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: NOT_A_BACKUP };
  }
  if (!isObject(json) || json.app !== BACKUP_APP) return { ok: false, error: NOT_A_BACKUP };
  if (typeof json.version === 'number' && json.version > BACKUP_VERSION) {
    return { ok: false, error: 'Cette sauvegarde vient d’une version plus récente de BudgetVision : mets l’appli à jour, puis réessaie.' };
  }
  try {
    if (json.version !== BACKUP_VERSION) throw new BackupError('numéro de version inconnu.');
    if (json.source !== 'en-ligne' && json.source !== 'locale') throw new BackupError('origine inconnue (« en-ligne » ou « locale » attendu).');
    if (typeof json.exportedAt !== 'string' || Number.isNaN(Date.parse(json.exportedAt))) throw new BackupError('date d’export invalide.');
    if (!isObject(json.data)) throw new BackupError('les données sont absentes.');
    const data = json.data;
    const settings = readList(data, 'settings', 'réglages', 'Réglages', 'id', readSettings);
    if (settings.length > 1) throw new BackupError('plusieurs réglages trouvés (un seul attendu).');
    const backup: BackupFile = {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt: new Date(json.exportedAt).toISOString(),
      source: json.source,
      ...(typeof json.account === 'string' && json.account ? { account: json.account } : {}),
      data: {
        goals: readList(data, 'goals', 'objectifs', 'Objectif', 'name', readGoal),
        contributions: readList(data, 'contributions', 'versements', 'Versement', 'note', readContribution),
        entries: readList(data, 'entries', 'lignes de budget', 'Ligne de budget', 'label', readEntry),
        categories: readList(data, 'categories', 'catégories', 'Catégorie', 'name', readCategory),
        simulations: readList(data, 'simulations', 'simulations', 'Simulation', 'title', readSimulation),
        settings,
      },
    };
    return { ok: true, backup };
  } catch (error) {
    if (error instanceof BackupError) return { ok: false, error: `Sauvegarde abîmée : ${error.message}` };
    throw error;
  }
}

// --- Import ---

/**
 * Remplace toutes les données du téléphone par celles de la sauvegarde, en une seule transaction
 * (tout ou rien), puis recrée les catégories par défaut manquantes et les réglages s'ils sont absents.
 * La date de la sauvegarde devient la date de dernière sauvegarde : ces données existent dans ce fichier.
 */
export async function importBackup(database: BudgetDB, backup: BackupFile): Promise<void> {
  const { data } = backup;
  await database.transaction(
    'rw',
    [database.goals, database.contributions, database.entries, database.categories, database.simulations, database.settings, database.meta],
    async () => {
      await Promise.all([
        database.goals.clear(),
        database.contributions.clear(),
        database.entries.clear(),
        database.categories.clear(),
        database.simulations.clear(),
        database.settings.clear(),
      ]);
      await database.goals.bulkPut(data.goals);
      await database.contributions.bulkPut(data.contributions);
      await database.entries.bulkPut(data.entries);
      await database.categories.bulkPut(data.categories);
      await database.simulations.bulkPut(data.simulations);
      await database.settings.bulkPut(data.settings);
      for (const category of DEFAULT_CATEGORIES) {
        if (!(await database.categories.get(category.id))) await database.categories.put({ ...category, updatedAt: 0 });
      }
      if (!(await database.settings.get(SETTINGS_ID))) await database.settings.put(defaultSettings());
      await setMeta(database, LAST_BACKUP_KEY, backup.exportedAt);
    },
  );
}

// --- Rappel ---

/** Nombre d'éléments saisis par l'utilisateur (hors catégories et réglages, qui existent toujours). */
export async function countUserData(database: BudgetDB): Promise<number> {
  const counts = await Promise.all([database.goals.count(), database.contributions.count(), database.entries.count(), database.simulations.count()]);
  return counts.reduce((a, b) => a + b, 0);
}

export async function getLastBackup(database: BudgetDB): Promise<string | undefined> {
  return getMeta(database, LAST_BACKUP_KEY);
}

export async function markBackupDone(database: BudgetDB, now = new Date()): Promise<string> {
  const iso = now.toISOString();
  await setMeta(database, LAST_BACKUP_KEY, iso);
  return iso;
}

/** Rappel « Pense à sauvegarder » : jamais sauvegardé alors qu'il y a des données, ou dernière sauvegarde trop ancienne. */
export function needsBackupReminder(lastBackupAt: string | undefined, hasData: boolean, now = new Date()): boolean {
  if (!hasData) return false;
  if (!lastBackupAt) return true;
  const last = Date.parse(lastBackupAt);
  if (Number.isNaN(last)) return true;
  return now.getTime() - last > BACKUP_REMINDER_DAYS * 24 * 3600 * 1000;
}
