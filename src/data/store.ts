// Écritures de l'application, directement dans la base du téléphone.
import type { Stored } from '../domain/types';
import { db, stamp, tables, type Entity } from './db';

/** Enregistre un élément (création ou modification) avec un `updatedAt` à jour. */
export async function save<T extends Stored>(entity: Entity, record: Omit<T, 'updatedAt'> & { updatedAt?: number }): Promise<T> {
  const next = { ...record, updatedAt: stamp() } as unknown as T;
  await tables(db)[entity].put(next);
  return next;
}

/** Supprime définitivement un élément. */
export async function remove(entity: Entity, id: string): Promise<void> {
  await tables(db)[entity].delete(id);
}

/** Supprime un objectif et tous ses versements. */
export async function removeGoal(goalId: string): Promise<void> {
  await db.transaction('rw', db.goals, db.contributions, async () => {
    await db.contributions.where('goalId').equals(goalId).delete();
    await db.goals.delete(goalId);
  });
}

/** Liste lue en base (tableau vide pendant le chargement). */
export function list<T>(rows: T[] | undefined): T[] {
  return rows ?? [];
}
