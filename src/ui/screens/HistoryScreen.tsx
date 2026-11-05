// Historique : simulations enregistrées, consultables, partageables et supprimables (pas modifiables).
import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId } from '../../data/db';
import { list, remove, save } from '../../data/store';
import { SIMULATION_LABELS, type Simulation, type SimulationKind } from '../../domain/types';
import { askConfirm, Empty, toast } from '../components';
import { shareOnWhatsApp } from '../share';

const ICONS: Record<SimulationKind, string> = { goal: '🎯', budget: '📊', scenarios: '📈', calcul: '🧮' };

/** Enregistre une simulation figée : ses lignes sont déjà formatées. */
export async function saveSimulation(kind: SimulationKind, title: string, lines: Simulation['lines'], text: string): Promise<void> {
  await save<Simulation>('simulation', { id: newId(), kind, title, lines, text, createdAt: Date.now() });
}

function formatStamp(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} à ${pad(d.getHours())}h${pad(d.getMinutes())}`;
}

async function confirmRemove(simulation: Simulation): Promise<boolean> {
  if (!(await askConfirm(`Supprimer « ${simulation.title} » de l’historique ?`))) return false;
  await remove('simulation', simulation.id);
  toast('Simulation supprimée');
  return true;
}

export function HistoryScreen({ go }: { go: (path: string) => void }) {
  const simulations = list(useLiveQuery(() => db.simulations.orderBy('createdAt').reverse().toArray(), []));
  return (
    <section className="screen">
      <div className="screen-head">
        <h1>Historique</h1>
      </div>
      {simulations.length === 0 ? (
        <Empty icon="🗂" title="Aucune simulation enregistrée">
          <p>Depuis un objectif, le budget ou les scénarios, touche « Enregistrer dans l’historique » pour garder un résultat.</p>
        </Empty>
      ) : (
        <ul className="list">
          {simulations.map((s) => (
            <li key={s.id}>
              <button type="button" className="card row-btn history-item" onClick={() => go(`historique/${s.id}`)}>
                <span className="goal-icon" aria-hidden>
                  {ICONS[s.kind]}
                </span>
                <div className="grow">
                  <strong>{s.title}</strong>
                  <span className="muted small">
                    {SIMULATION_LABELS[s.kind]} · {formatStamp(s.createdAt)}
                  </span>
                </div>
                <span aria-hidden>›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SimulationDetail({ id, go }: { id: string; go: (path: string) => void }) {
  const simulation = useLiveQuery(() => db.simulations.get(id), [id]);
  if (!simulation) {
    return (
      <section className="screen">
        <Empty icon="🔍" title="Simulation introuvable">
          <button type="button" className="btn btn-secondary" onClick={() => go('historique')}>
            Retour à l’historique
          </button>
        </Empty>
      </section>
    );
  }
  return (
    <section className="screen">
      <button type="button" className="back" onClick={() => go('historique')}>
        ← Historique
      </button>
      <div className="card">
        <span className="muted small">
          {ICONS[simulation.kind]} {SIMULATION_LABELS[simulation.kind]} · enregistrée le {formatStamp(simulation.createdAt)}
        </span>
        <h1>{simulation.title}</h1>
        <dl className="summary">
          {simulation.lines.map((line, i) => (
            <div key={i}>
              <dt>{line.label}</dt>
              <dd>{line.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="btn-stack">
        <button type="button" className="btn btn-whatsapp btn-block" onClick={() => shareOnWhatsApp(simulation.text)}>
          Partager sur WhatsApp
        </button>
        <button
          type="button"
          className="btn btn-danger btn-block"
          onClick={async () => {
            if (await confirmRemove(simulation)) go('historique');
          }}
        >
          Supprimer
        </button>
      </div>
    </section>
  );
}
