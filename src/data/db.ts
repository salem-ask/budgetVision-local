// Base locale (IndexedDB via Dexie) : seul endroit où vivent les données.
// Aucun serveur, aucune synchronisation : tout reste sur ce téléphone.
import Dexie, { type Table } from 'dexie';
import { DEFAULT_CATEGORIES } from '../domain/budget';
import { DEFAULT_SCENARIOS } from '../domain/scenarios';
import type { Category, Contribution, Entry, Goal, Settings, Simulation, Stored } from '../domain/types';

/** Types d'éléments enregistrés (mêmes noms que dans la version en ligne). */
export const ENTITIES = ['goal', 'contribution', 'entry', 'category', 'simulation', 'settings'] as const;
export type Entity = (typeof ENTITIES)[number];

interface MetaRow {
  key: string;
  value: string;
}

export class BudgetDB extends Dexie {
  goals!: Table<Goal, string>;
  contributions!: Table<Contribution, string>;
  entries!: Table<Entry, string>;
  categories!: Table<Category, string>;
  simulations!: Table<Simulation, string>;
  settings!: Table<Settings, string>;
  meta!: Table<MetaRow, string>;

  constructor(name = 'budgetvision-local') {
    super(name);
    this.version(1).stores({
      goals: 'id',
      contributions: 'id, goalId',
      entries: 'id, month',
      categories: 'id',
      simulations: 'id, createdAt',
      settings: 'id',
      meta: 'key',
    });
  }
}

export const db = new BudgetDB();

/** Table de chaque type d'élément. */
export function tables(database: BudgetDB): Record<Entity, Table<Stored, string>> {
  return {
    goal: database.goals,
    contribution: database.contributions,
    entry: database.entries,
    category: database.categories,
    simulation: database.simulations,
    settings: database.settings,
  } as unknown as Record<Entity, Table<Stored, string>>;
}

export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Contexte non sécurisé (http hors localhost) : UUID v4 via getRandomValues.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

let lastStamp = 0;
/** Horodatage de modification strictement croissant sur cet appareil. */
export function stamp(): number {
  lastStamp = Math.max(lastStamp + 1, Date.now());
  return lastStamp;
}

export async function getMeta(database: BudgetDB, key: string): Promise<string | undefined> {
  return (await database.meta.get(key))?.value;
}

export async function setMeta(database: BudgetDB, key: string, value: string | null): Promise<void> {
  if (value === null) await database.meta.delete(key);
  else await database.meta.put({ key, value });
}

export const SETTINGS_ID = 'settings';

/** Réglages par défaut (updatedAt = 0 : jamais modifiés). */
export function defaultSettings(): Settings {
  return { id: SETTINGS_ID, updatedAt: 0, rate: 2850, displayCurrency: 'CDF', scenarios: { ...DEFAULT_SCENARIOS } };
}

/**
 * Complète la base : catégories par défaut manquantes (identifiants fixes, updatedAt = 0)
 * et réglages par défaut s'ils sont absents. Sans effet sur ce qui existe déjà.
 */
export async function seedDefaults(database: BudgetDB): Promise<void> {
  await database.transaction('rw', database.categories, database.settings, async () => {
    for (const category of DEFAULT_CATEGORIES) {
      if (!(await database.categories.get(category.id))) await database.categories.put({ ...category, updatedAt: 0 });
    }
    if (!(await database.settings.get(SETTINGS_ID))) await database.settings.put(defaultSettings());
  });
}

/** Efface toutes les données du téléphone, puis remet les catégories et réglages par défaut. */
export async function wipeAllData(database: BudgetDB): Promise<void> {
  await database.transaction(
    'rw',
    [database.goals, database.contributions, database.entries, database.categories, database.simulations, database.settings, database.meta],
    async () => {
      for (const table of Object.values(tables(database))) await table.clear();
      await database.meta.clear();
    },
  );
  await seedDefaults(database);
}
