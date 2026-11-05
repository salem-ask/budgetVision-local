// Stockage persistant : demande au navigateur de ne jamais effacer automatiquement la base du téléphone.

export type StorageProtection = 'protected' | 'not-protected' | 'unknown';

/** Appelé au démarrage. Le navigateur peut accepter tout de suite, plus tard (appli installée) ou refuser. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function storageProtection(): Promise<StorageProtection> {
  try {
    if (!navigator.storage?.persisted) return 'unknown';
    return (await navigator.storage.persisted()) ? 'protected' : 'not-protected';
  } catch {
    return 'unknown';
  }
}
