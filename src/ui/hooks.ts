// Accès réactif aux données locales, aux réglages et à la sauvegarde.
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';
import { countUserData, getLastBackup } from '../data/backup';
import { db, defaultSettings, SETTINGS_ID } from '../data/db';
import { convert, formatMoney } from '../domain/money';
import type { Currency, Settings } from '../domain/types';

/** État de la sauvegarde : date de la dernière, et nombre d'éléments saisis (undefined pendant le chargement). */
export function useBackupState(): { lastBackupAt?: string; dataCount?: number } {
  return (
    useLiveQuery(async () => ({ lastBackupAt: await getLastBackup(db), dataCount: await countUserData(db) }), [], undefined) ?? {}
  );
}

export function useSettings(): Settings {
  return useLiveQuery(() => db.settings.get(SETTINGS_ID), [], undefined) ?? defaultSettings();
}

/**
 * Formatage des montants dans la devise d'affichage choisie, avec conversion
 * automatique depuis la devise d'origine.
 */
export function useMoney() {
  const settings = useSettings();
  const currency = settings.displayCurrency;
  const toDisplay = useCallback(
    (amount: number, from: Currency) => convert(amount, from, currency, settings.rate),
    [currency, settings.rate],
  );
  const fmt = useCallback((amount: number, from: Currency = currency) => formatMoney(toDisplay(amount, from), currency), [toDisplay, currency]);
  return { fmt, toDisplay, currency, rate: settings.rate, settings };
}

/** Navigation par « # » : fonctionne hors ligne et dans un sous-dossier, sans règle serveur. */
export function useHashRoute(): [string[], (path: string) => void] {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const onChange = () => {
      setParts(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const go = useCallback((path: string) => {
    window.location.hash = `#/${path.replace(/^\//, '')}`;
  }, []);
  return [parts, go];
}

export type ThemeChoice = 'auto' | 'light' | 'dark';

/** Thème propre à l'appareil : appliqué via l'attribut data-theme. */
export function useTheme(): [ThemeChoice, (theme: ThemeChoice) => void] {
  const [theme, setThemeState] = useState<ThemeChoice>(() => {
    try {
      const saved = localStorage.getItem('theme');
      return saved === 'light' || saved === 'dark' ? saved : 'auto';
    } catch {
      return 'auto';
    }
  });
  const setTheme = useCallback((next: ThemeChoice) => {
    setThemeState(next);
    try {
      if (next === 'auto') localStorage.removeItem('theme');
      else localStorage.setItem('theme', next);
    } catch {
      // Stockage indisponible (navigation privée) : le choix vaut pour cette session.
    }
    if (next === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
  }, []);
  return [theme, setTheme];
}
