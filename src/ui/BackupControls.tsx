// Sauvegarde dans l'interface : import d'un fichier (avec résumé et confirmation dans la page),
// export (téléchargement) et envoi du fichier (partage du téléphone, WhatsApp…).
import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState, type ChangeEvent } from 'react';
import { backupSummary, backupToFile, buildBackup, describeBackup, formatShortDate, importBackup, markBackupDone, parseBackup, type BackupFile } from '../data/backup';
import { db } from '../data/db';
import { Alert, toast } from './components';

/**
 * Bouton « Importer » : choix d'un fichier .json, validation, résumé, puis « Remplacer » ou « Annuler ».
 * Rien n'est modifié avant la confirmation ; le remplacement se fait en une seule transaction.
 */
export function ImportBackup({ label = 'Importer une sauvegarde', primary = false, onImported }: { label?: string; primary?: boolean; onImported?: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // Permet de rechoisir le même fichier.
    if (!file) return;
    setError('');
    setPending(null);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setError('Impossible de lire ce fichier. Réessaie ou choisis-en un autre.');
      return;
    }
    const result = parseBackup(text);
    if (result.ok) setPending(result.backup);
    else setError(result.error);
  }

  async function replace() {
    if (!pending) return;
    setBusy(true);
    try {
      await importBackup(db, pending);
      toast(`Données importées : ${describeBackup(pending)}`);
      setPending(null);
      onImported?.();
    } catch {
      setError('L’import a échoué : tes données actuelles n’ont pas été modifiées. Réessaie.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="import-backup">
      <input ref={input} type="file" accept=".json,application/json" hidden onChange={(e) => void onFile(e)} />
      {!pending && (
        <button type="button" className={`btn ${primary ? 'btn-primary' : 'btn-secondary'} btn-block`} onClick={() => input.current?.click()}>
          {label}
        </button>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      {pending && (
        <div className="import-confirm" role="group" aria-label="Confirmer l’import">
          <p>
            <strong>{backupSummary(pending)}.</strong>
          </p>
          <Alert tone="warning">Toutes les données actuelles de ce téléphone seront remplacées par celles de cette sauvegarde.</Alert>
          <div className="btn-row">
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setPending(null)}>
              Annuler
            </button>
            <button type="button" className="btn btn-danger-solid" disabled={busy} onClick={() => void replace()}>
              {busy ? 'Import…' : 'Remplacer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function canShareFiles(): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File(['{}'], 'test.json', { type: 'application/json' })] });
  } catch {
    return false;
  }
}

/** Export : la sauvegarde est préparée à l'avance (et tenue à jour) pour que le partage parte dès le toucher. */
export function ExportBackup({ onDone }: { onDone?: (iso: string) => void }) {
  const ready = useLiveQuery(() => buildBackup(db), []);
  const [shareable] = useState(canShareFiles);

  /** Fichier daté de maintenant, construit sans attente à partir de la sauvegarde déjà prête. */
  function freshFile(): { backup: BackupFile; file: File; now: Date } | null {
    if (!ready) return null;
    const now = new Date();
    const backup = { ...ready, exportedAt: now.toISOString() };
    return { backup, file: backupToFile(backup, now), now };
  }

  async function finish(backup: BackupFile, now: Date) {
    onDone?.(await markBackupDone(db, now));
    toast(`Sauvegarde créée : ${describeBackup(backup)}`);
  }

  function download() {
    const made = freshFile();
    if (!made) return;
    const url = URL.createObjectURL(made.file);
    const link = document.createElement('a');
    link.href = url;
    link.download = made.file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    void finish(made.backup, made.now);
  }

  function share() {
    const made = freshFile();
    if (!made) return;
    // Appel direct dans le toucher : aucune attente avant navigator.share.
    navigator.share({ files: [made.file], title: 'Sauvegarde BudgetVision' }).then(
      () => void finish(made.backup, made.now),
      (error: unknown) => {
        if ((error as Error)?.name !== 'AbortError') toast('Envoi impossible : utilise « Exporter mes données ».');
      },
    );
  }

  return (
    <div className="btn-stack">
      <button type="button" className="btn btn-primary btn-block" disabled={!ready} onClick={download}>
        Exporter mes données
      </button>
      {shareable && (
        <button type="button" className="btn btn-whatsapp btn-block" disabled={!ready} onClick={share}>
          Envoyer le fichier (WhatsApp…)
        </button>
      )}
    </div>
  );
}

export function lastBackupText(iso: string | undefined): string {
  if (!iso) return 'Aucune sauvegarde faite sur ce téléphone.';
  const date = new Date(iso);
  return `Dernière sauvegarde : ${formatShortDate(iso)} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`;
}
