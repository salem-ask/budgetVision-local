// Réglages : devise d'affichage, taux de change, thème, sauvegarde et données du téléphone.
import { useEffect, useState, type FormEvent } from 'react';
import { db, wipeAllData } from '../../data/db';
import { save } from '../../data/store';
import { formatInput, formatMoney, parseAmount } from '../../domain/money';
import type { Settings } from '../../domain/types';
import { ExportBackup, ImportBackup, lastBackupText } from '../BackupControls';
import { askConfirm, CurrencyToggle, Field, Segmented, toast } from '../components';
import { useBackupState, useMoney, useTheme, type ThemeChoice } from '../hooks';
import { requestPersistentStorage, storageProtection, type StorageProtection } from '../storage';

async function saveSettings(settings: Settings, changes: Partial<Settings>) {
  await save<Settings>('settings', { ...settings, ...changes });
}

/** Carte « Sauvegarde » : importer (depuis la version en ligne ou une sauvegarde locale), exporter, envoyer. */
function BackupCard({ go }: { go: (path: string) => void }) {
  const { lastBackupAt } = useBackupState();
  return (
    <div className="card" id="sauvegarde">
      <h2>Sauvegarde</h2>
      <p className="muted small">
        Tes données ne sont enregistrées que sur ce téléphone. Exporte-les régulièrement dans un fichier et garde-le en lieu sûr (WhatsApp, Drive, carte SD…) : si le téléphone est perdu ou réinitialisé, ce fichier permet de tout retrouver.
      </p>
      <ExportBackup />
      <p className="muted small center">{lastBackupText(lastBackupAt)}</p>
      <h3 className="subhead">Importer</h3>
      <p className="muted small">
        Choisis un fichier <strong>budgetvision-sauvegarde-….json</strong> : exporté depuis la version en ligne (Réglages → Sauvegarde) ou depuis cette appli.
      </p>
      <ImportBackup onImported={() => go('accueil')} />
    </div>
  );
}

/** Protection du stockage contre l'effacement automatique par le navigateur. */
function StorageCard() {
  const [state, setState] = useState<StorageProtection | null>(null);
  useEffect(() => {
    void storageProtection().then(setState);
  }, []);

  async function ask() {
    await requestPersistentStorage();
    const next = await storageProtection();
    setState(next);
    toast(next === 'protected' ? 'Stockage protégé' : 'Le navigateur n’a pas accordé la protection pour l’instant.');
  }

  async function wipe() {
    const ok = await askConfirm(
      'Effacer toutes les données de ce téléphone (objectifs, versements, budget, historique, réglages) ? Pense à exporter une sauvegarde avant : sans fichier, elles seront perdues.',
      'Tout effacer',
    );
    if (!ok) return;
    await wipeAllData(db);
    toast('Toutes les données ont été effacées');
  }

  return (
    <div className="card">
      <h2>Données du téléphone</h2>
      {state === 'protected' && <p className="storage-state ok">✓ Stockage protégé : le navigateur n’effacera pas tes données automatiquement.</p>}
      {state === 'not-protected' && (
        <>
          <p className="storage-state warn">Stockage non protégé : en cas de manque de place, le navigateur pourrait effacer tes données.</p>
          <p className="muted small">Installe l’appli sur l’écran d’accueil (menu du navigateur → « Installer l’application ») et fais des sauvegardes régulières.</p>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => void ask()}>
            Demander la protection
          </button>
        </>
      )}
      {state === 'unknown' && <p className="muted small">Ce navigateur n’indique pas si le stockage est protégé : fais des sauvegardes régulières.</p>}
      <p className="muted small">Pas de compte, pas de serveur : rien ne quitte ce téléphone, sauf les fichiers que tu exportes.</p>
      <button type="button" className="btn btn-danger btn-block" onClick={() => void wipe()}>
        Effacer toutes les données
      </button>
    </div>
  );
}

export function SettingsScreen({ go }: { go: (path: string) => void }) {
  const { settings } = useMoney();
  const [theme, setTheme] = useTheme();
  const [rate, setRate] = useState(formatInput(settings.rate, 'USD'));
  const [rateError, setRateError] = useState('');
  // Le taux peut changer (import d'une sauvegarde) : le champ suit.
  useEffect(() => setRate(formatInput(settings.rate, 'USD')), [settings.rate]);

  async function submitRate(event: FormEvent) {
    event.preventDefault();
    const value = parseAmount(rate);
    if (!(value > 0)) return setRateError('Saisis un taux supérieur à 0 (ex. 2 850).');
    if (value > 1_000_000) return setRateError('Ce taux paraît trop élevé.');
    setRateError('');
    await saveSettings(settings, { rate: value });
    toast('Taux de change enregistré');
  }

  return (
    <section className="screen">
      <div className="screen-head">
        <h1>Réglages</h1>
      </div>

      <div className="card">
        <h2>Devises</h2>
        <div className="field">
          <span className="label">Afficher les totaux en</span>
          <CurrencyToggle value={settings.displayCurrency} onChange={(c) => void saveSettings(settings, { displayCurrency: c })} />
        </div>
        <form onSubmit={submitRate} noValidate>
          <Field label="Taux de change : 1 USD =" error={rateError} hint="Modifie-le quand le taux du marché change. Toutes les conversions de l’appli l’utilisent.">
            {(id) => (
              <div className="money-input">
                <input id={id} type="text" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
                <span className="money-suffix">CDF</span>
              </div>
            )}
          </Field>
          <button type="submit" className="btn btn-primary btn-block">
            Enregistrer le taux
          </button>
        </form>
        <p className="muted small center">
          Taux actuel : 1 USD = {formatMoney(settings.rate, 'CDF')} · {formatMoney(100_000, 'CDF')} ≈ {formatMoney(100_000 / settings.rate, 'USD')}
        </p>
      </div>

      <div className="card">
        <h2>Apparence</h2>
        <Segmented<ThemeChoice>
          label="Thème"
          value={theme}
          onChange={setTheme}
          options={[
            { id: 'auto', label: 'Auto' },
            { id: 'light', label: 'Clair' },
            { id: 'dark', label: 'Sombre' },
          ]}
        />
      </div>

      <BackupCard go={go} />

      <StorageCard />
      <p className="muted small center">BudgetVision · version locale 2.0</p>
    </section>
  );
}
