import { describe, expect, it } from 'vitest';
import {
  backupFileName,
  backupSummary,
  buildBackup,
  countUserData,
  describeBackup,
  getLastBackup,
  importBackup,
  needsBackupReminder,
  NOT_A_BACKUP,
  parseBackup,
  type BackupFile,
} from '../src/data/backup';
import { DEFAULT_CATEGORIES } from '../src/domain/budget';
import { BudgetDB, newId, seedDefaults, wipeAllData } from '../src/data/db';

const freshDb = () => new BudgetDB(`backup-${newId()}`);

/** Fichier tel que l'exporte la version en ligne : champ `account`, catégories par défaut, réglages, résidus de synchro. */
function onlineFile(): Record<string, unknown> {
  return {
    app: 'BudgetVision',
    version: 1,
    exportedAt: '2026-11-05T17:44:00.000Z',
    source: 'en-ligne',
    account: 'awa',
    data: {
      goals: [
        { id: 'g1', updatedAt: 1_760_000_000_000, name: 'Moto', kind: 'achat', currency: 'CDF', target: 2_500_000, deadline: '2027-06-30', initial: 100_000, regularAmount: 50_000, periodicity: 'week', createdAt: 1_759_000_000_000 },
        { id: 'g2', updatedAt: 1_760_000_000_001, name: 'Études', kind: 'etudes', currency: 'USD', target: 1200, deadline: '2027-09-01', initial: 0, regularAmount: 100, periodicity: 'month', createdAt: 1_759_000_000_001 },
        // Pierre tombale venue de la synchronisation : à écarter.
        { id: 'g-old', updatedAt: 1_760_000_000_002, deleted: true },
      ],
      contributions: [
        { id: 'c1', updatedAt: 1_760_000_000_010, goalId: 'g1', amount: 50_000, currency: 'CDF', date: '2026-10-01', note: 'Paie' },
        { id: 'c2', updatedAt: 1_760_000_000_011, goalId: 'g2', amount: 100, currency: 'USD', date: '2026-10-15', note: '' },
      ],
      entries: [
        { id: 'e1', updatedAt: 1_760_000_000_020, kind: 'income', amount: 1_250_000, currency: 'CDF', categoryId: '', label: 'Salaire', month: '2026-11', createdAt: 1 },
        { id: 'e2', updatedAt: 1_760_000_000_021, kind: 'expense', amount: 300_000, currency: 'CDF', categoryId: 'cat-loyer', label: 'Loyer', month: '2026-11', createdAt: 2 },
        { id: 'e3', updatedAt: 1_760_000_000_022, kind: 'expense', amount: 40, currency: 'USD', categoryId: 'cat-perso', label: 'Abonnement', month: '2026-11', createdAt: 3, dirty: 0 },
      ],
      categories: [
        // Catégories par défaut (l'une renommée sur la version en ligne) + une personnalisée.
        ...DEFAULT_CATEGORIES.filter((c) => c.id !== 'cat-autres').map((c) => ({ ...c, updatedAt: 0 })),
        { id: 'cat-nourriture', name: 'Nourriture et marché', bucket: 'besoin', color: '#f59e0b', builtin: true, updatedAt: 1_760_000_000_030 },
        { id: 'cat-perso', name: 'Internet', bucket: 'envie', color: '#ec4899', updatedAt: 1_760_000_000_031, unknownField: 'ignoré' },
      ],
      simulations: [
        { id: 's1', updatedAt: 5, kind: 'goal', title: 'Objectif Moto', lines: [{ label: 'Par mois', value: '200 000 CDF' }], text: 'Moto : 200 000 CDF par mois', createdAt: 5 },
      ],
      settings: [
        { id: 'settings', updatedAt: 1_760_000_000_040, rate: 2900, displayCurrency: 'USD', scenarios: { currency: 'CDF', initial: 0, months: 12, target: 0, prudent: 50_000, intermediaire: 100_000, ambitieux: 200_000 } },
      ],
    },
  };
}

function parseOk(value: unknown): BackupFile {
  const result = parseBackup(typeof value === 'string' ? value : JSON.stringify(value));
  if (!result.ok) throw new Error(result.error);
  return result.backup;
}

describe('sauvegarde : import d’un fichier de la version en ligne', () => {
  it('valide, écarte les éléments supprimés et les champs inconnus, et résume', () => {
    const backup = parseOk(onlineFile());
    expect(backup.source).toBe('en-ligne');
    expect(backup.account).toBe('awa');
    expect(backup.data.goals.map((g) => g.id)).toEqual(['g1', 'g2']);
    expect(backup.data.entries[2]).not.toHaveProperty('dirty');
    expect(backup.data.categories.find((c) => c.id === 'cat-perso')).not.toHaveProperty('unknownField');
    expect(describeBackup(backup)).toBe('2 objectifs, 2 versements, 3 lignes de budget, 1 simulation');
    expect(backupSummary(backup)).toBe('Sauvegarde du 5 nov. 2026, compte awa : 2 objectifs, 2 versements, 3 lignes de budget, 1 simulation');
  });

  it('remplace toutes les données, recrée les catégories par défaut manquantes et garde les réglages importés', async () => {
    const db = freshDb();
    await seedDefaults(db);
    await db.goals.put({ id: 'ancien', updatedAt: 1, name: 'Ancien', kind: 'autre', currency: 'CDF', target: 1, deadline: '2027-01-01', initial: 0, regularAmount: 0, periodicity: 'month', createdAt: 1 });

    await importBackup(db, parseOk(onlineFile()));

    expect((await db.goals.toArray()).map((g) => g.id).sort()).toEqual(['g1', 'g2']);
    expect(await db.contributions.count()).toBe(2);
    expect(await db.entries.count()).toBe(3);
    expect(await db.simulations.count()).toBe(1);
    const categories = await db.categories.toArray();
    expect(categories).toHaveLength(DEFAULT_CATEGORIES.length + 1);
    expect(categories.find((c) => c.id === 'cat-nourriture')?.name).toBe('Nourriture et marché');
    expect(categories.find((c) => c.id === 'cat-autres')).toMatchObject({ name: 'Autres', updatedAt: 0 });
    expect(await db.settings.get('settings')).toMatchObject({ rate: 2900, displayCurrency: 'USD' });
    expect(await getLastBackup(db)).toBe('2026-11-05T17:44:00.000Z');
    expect(await countUserData(db)).toBe(8);
  });

  it('remet les réglages par défaut si la sauvegarde n’en a pas', async () => {
    const db = freshDb();
    const file = onlineFile();
    (file.data as Record<string, unknown>).settings = [];
    await importBackup(db, parseOk(file));
    expect(await db.settings.get('settings')).toMatchObject({ rate: 2850, displayCurrency: 'CDF', updatedAt: 0 });
  });
});

describe('sauvegarde : export', () => {
  it('aller-retour export → import identique', async () => {
    const source = freshDb();
    await importBackup(source, parseOk(onlineFile()));
    const exported = await buildBackup(source, new Date('2026-11-06T09:00:00Z'));
    expect(exported).toMatchObject({ app: 'BudgetVision', version: 1, source: 'locale', exportedAt: '2026-11-06T09:00:00.000Z' });
    expect(exported).not.toHaveProperty('account');

    const text = JSON.stringify(exported, null, 2);
    const target = freshDb();
    await seedDefaults(target);
    await importBackup(target, parseOk(text));
    const again = await buildBackup(target, new Date('2026-11-06T09:00:00Z'));
    const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
    for (const key of Object.keys(exported.data) as (keyof BackupFile['data'])[]) {
      expect(byId(again.data[key] as { id: string }[])).toEqual(byId(exported.data[key] as { id: string }[]));
    }
  });

  it('nomme le fichier avec la date du jour', () => {
    expect(backupFileName(new Date(2026, 10, 5))).toBe('budgetvision-sauvegarde-2026-11-05.json');
  });

  it('« tout effacer » vide la base et remet les valeurs par défaut', async () => {
    const db = freshDb();
    await importBackup(db, parseOk(onlineFile()));
    await wipeAllData(db);
    expect(await countUserData(db)).toBe(0);
    expect(await db.categories.count()).toBe(DEFAULT_CATEGORIES.length);
    expect(await db.settings.get('settings')).toMatchObject({ rate: 2850 });
    expect(await getLastBackup(db)).toBeUndefined();
  });
});

describe('sauvegarde : fichiers refusés', () => {
  it('refuse un fichier qui n’est pas du JSON ou qui vient d’une autre appli', () => {
    expect(parseBackup('pas du json')).toEqual({ ok: false, error: NOT_A_BACKUP });
    expect(parseBackup(JSON.stringify({ ...onlineFile(), app: 'GESTOCK' }))).toEqual({ ok: false, error: NOT_A_BACKUP });
    expect(parseBackup('[]')).toEqual({ ok: false, error: NOT_A_BACKUP });
  });

  it('refuse une sauvegarde abîmée avec un message qui dit quoi', () => {
    const errorOf = (mutate: (file: Record<string, any>) => void) => {
      const file = onlineFile() as Record<string, any>;
      mutate(file);
      const result = parseBackup(JSON.stringify(file));
      return result.ok ? '' : result.error;
    };
    expect(errorOf((f) => (f.data.goals[0].target = -5))).toBe('Sauvegarde abîmée : Objectif n° 1 « Moto » : montant cible invalide.');
    expect(errorOf((f) => (f.data.goals[0].target = '1000'))).toMatch(/montant cible invalide/);
    expect(errorOf((f) => (f.data.contributions[1].date = '15/10/2026'))).toBe('Sauvegarde abîmée : Versement n° 2 : date (format AAAA-MM-JJ attendu) invalide.');
    expect(errorOf((f) => (f.data.entries[0].currency = 'EUR'))).toMatch(/Ligne de budget n° 1 « Salaire » : devise \(CDF ou USD attendu\) invalide/);
    expect(errorOf((f) => delete f.data.contributions)).toBe('Sauvegarde abîmée : il manque la liste des versements.');
    expect(errorOf((f) => (f.source = 'autre'))).toMatch(/^Sauvegarde abîmée : origine inconnue/);
    expect(errorOf((f) => (f.version = 0))).toMatch(/^Sauvegarde abîmée/);
    expect(errorOf((f) => (f.version = 2))).toMatch(/version plus récente/);
    expect(errorOf((f) => (f.data.settings[0].rate = 0))).toMatch(/taux de change invalide/);
  });

  it('un import refusé ne touche pas aux données', async () => {
    const db = freshDb();
    await importBackup(db, parseOk(onlineFile()));
    const bad = parseBackup(JSON.stringify({ ...onlineFile(), app: 'Autre' }));
    expect(bad.ok).toBe(false);
    expect(await db.goals.count()).toBe(2);
  });
});

describe('rappel de sauvegarde', () => {
  const now = new Date('2026-11-05T12:00:00Z');
  it('ne rappelle rien tant que l’appli est vide', () => {
    expect(needsBackupReminder(undefined, false, now)).toBe(false);
  });
  it('rappelle s’il y a des données et jamais de sauvegarde', () => {
    expect(needsBackupReminder(undefined, true, now)).toBe(true);
  });
  it('rappelle au-delà de 30 jours', () => {
    expect(needsBackupReminder('2026-10-20T12:00:00Z', true, now)).toBe(false);
    expect(needsBackupReminder('2026-10-06T12:00:00Z', true, now)).toBe(false);
    expect(needsBackupReminder('2026-10-06T11:00:00Z', true, now)).toBe(true);
  });
});
