// Objectifs d'épargne : liste, création/modification, détail avec calculs et versements.
import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { db, newId } from '../../data/db';
import { list, remove, removeGoal, save } from '../../data/store';
import { formatDate, formatDuration, isValidIsoDate, todayIso } from '../../domain/dates';
import { analyzeGoal, validateGoal, type GoalAnalysis } from '../../domain/goals';
import { formatInput, formatMoney, formatPercent } from '../../domain/money';
import { analyzeRegularity, PERIOD_NAMES, realPaceMessage, type Regularity } from '../../domain/regularity';
import { GOAL_KINDS, PERIODICITY_LABELS, type Contribution, type Currency, type Goal, type GoalKind, type Periodicity } from '../../domain/types';
import { Alert, amountOf, askConfirm, CurrencyToggle, Empty, Field, MoneyInput, ProgressBar, Segmented, Sheet, Stat, toast } from '../components';
import { useMoney } from '../hooks';
import { shareOnWhatsApp } from '../share';
import { saveSimulation } from './HistoryScreen';

const kindOf = (kind: GoalKind) => GOAL_KINDS.find((k) => k.id === kind) ?? GOAL_KINDS[GOAL_KINDS.length - 1];

function toneOf(analysis: GoalAnalysis): 'success' | 'info' | 'warning' | 'danger' {
  return analysis.status === 'reached' || analysis.status === 'on-track' ? 'success' : analysis.status === 'no-plan' ? 'info' : analysis.status === 'late' ? 'warning' : 'danger';
}

export function GoalsScreen({ go }: { go: (path: string) => void }) {
  const goals = list(useLiveQuery(() => db.goals.toArray(), []));
  const contributions = list(useLiveQuery(() => db.contributions.toArray(), []));
  const { fmt, rate } = useMoney();
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);

  const sorted = [...goals].sort((a, b) => a.deadline.localeCompare(b.deadline));
  return (
    <section className="screen">
      <div className="screen-head">
        <h1>Mes objectifs</h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          + Nouvel objectif
        </button>
      </div>
      {sorted.length === 0 ? (
        <Empty icon="🎯" title="Aucun objectif pour l’instant">
          <p>Indique combien tu veux réunir et pour quand : l’appli calcule ce qu’il faut mettre de côté chaque jour, semaine ou mois.</p>
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            Créer mon premier objectif
          </button>
        </Empty>
      ) : (
        <div className="list">
          {sorted.map((goal) => {
            const a = analyzeGoal(goal, contributions, rate);
            return (
              <button key={goal.id} type="button" className="card goal-card" onClick={() => go(`objectifs/${goal.id}`)}>
                <div className="goal-card-head">
                  <span className="goal-icon" aria-hidden>
                    {kindOf(goal.kind).icon}
                  </span>
                  <div className="grow">
                    <strong>{goal.name}</strong>
                    <span className="muted small">Avant le {formatDate(goal.deadline)}</span>
                  </div>
                  <span className={`chip chip-${toneOf(a)}`}>{formatPercent(a.progress)}</span>
                </div>
                <ProgressBar value={a.progress} tone={toneOf(a) === 'danger' ? 'danger' : toneOf(a) === 'warning' ? 'warning' : 'brand'} />
                <div className="goal-card-foot">
                  <span>{fmt(a.saved, goal.currency)}</span>
                  <span className="muted">sur {fmt(goal.target, goal.currency)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {editing && <GoalForm goal={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={(g) => go(`objectifs/${g.id}`)} />}
    </section>
  );
}

function GoalForm({ goal, onClose, onSaved }: { goal?: Goal; onClose: () => void; onSaved: (goal: Goal) => void }) {
  const { currency: displayCurrency } = useMoney();
  const [name, setName] = useState(goal?.name ?? '');
  const [kind, setKind] = useState<GoalKind>(goal?.kind ?? 'achat');
  const [currency, setCurrency] = useState<Currency>(goal?.currency ?? displayCurrency);
  const [target, setTarget] = useState(goal ? formatInput(goal.target, goal.currency) : '');
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [initial, setInitial] = useState(goal ? formatInput(goal.initial, goal.currency) : '');
  const [regular, setRegular] = useState(goal ? formatInput(goal.regularAmount, goal.currency) : '');
  const [periodicity, setPeriodicity] = useState<Periodicity>(goal?.periodicity ?? 'month');
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    const input = { name, target: amountOf(target), deadline, initial: amountOf(initial), regularAmount: amountOf(regular) };
    // Une date limite déjà passée reste acceptée pour un objectif existant (pour le consulter ou le prolonger).
    const found = validateGoal(input, goal && deadline === goal.deadline ? '0000-00-00' : todayIso());
    if (Number.isNaN(input.target)) found.target = 'Montant invalide : utilise seulement des chiffres (ex. 1 250 000).';
    if (Number.isNaN(input.initial)) found.initial = 'Montant invalide.';
    if (Number.isNaN(input.regularAmount)) found.regularAmount = 'Montant invalide.';
    setErrors(found as Record<string, string>);
    if (Object.keys(found).length) return;
    const saved = await save<Goal>('goal', {
      id: goal?.id ?? newId(),
      createdAt: goal?.createdAt ?? Date.now(),
      name: name.trim(),
      kind,
      currency,
      target: input.target,
      deadline,
      initial: input.initial,
      regularAmount: input.regularAmount,
      periodicity,
    });
    toast(goal ? 'Objectif modifié' : 'Objectif créé');
    onClose();
    if (!goal) onSaved(saved);
  }

  return (
    <Sheet title={goal ? 'Modifier l’objectif' : 'Nouvel objectif'} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <Field label="Nom de l’objectif" error={errors.name}>
          {(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Moto, frais d’études…" maxLength={60} />}
        </Field>
        <div className="field">
          <span className="label">Type</span>
          <div className="kind-grid">
            {GOAL_KINDS.map((k) => (
              <button key={k.id} type="button" className={`kind${kind === k.id ? ' active' : ''}`} onClick={() => setKind(k.id)} aria-pressed={kind === k.id}>
                <span aria-hidden>{k.icon}</span>
                {k.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="label">Devise de l’objectif</span>
          <CurrencyToggle value={currency} onChange={setCurrency} />
        </div>
        <Field label="Montant cible" error={errors.target}>
          {(id) => <MoneyInput id={id} value={target} onChange={setTarget} currency={currency} />}
        </Field>
        <Field label="Date limite" error={errors.deadline}>
          {(id) => <input id={id} type="date" value={deadline} min={todayIso()} onChange={(e) => setDeadline(e.target.value)} />}
        </Field>
        <Field label="Capital initial (déjà épargné)" error={errors.initial}>
          {(id) => <MoneyInput id={id} value={initial} onChange={setInitial} currency={currency} />}
        </Field>
        <Field label="Versement régulier prévu" error={errors.regularAmount} hint="Ce que tu comptes mettre de côté régulièrement (facultatif).">
          {(id) => <MoneyInput id={id} value={regular} onChange={setRegular} currency={currency} />}
        </Field>
        <div className="field">
          <Segmented
            label="Fréquence"
            value={periodicity}
            onChange={setPeriodicity}
            options={(Object.keys(PERIODICITY_LABELS) as Periodicity[]).map((p) => ({ id: p, label: PERIODICITY_LABELS[p] }))}
          />
        </div>
        <button type="submit" className="btn btn-primary btn-block">
          Enregistrer
        </button>
      </form>
    </Sheet>
  );
}

/** Résumé texte d'un objectif (historique et WhatsApp). */
function goalSummary(goal: Goal, a: GoalAnalysis) {
  const m = (v: number) => formatMoney(v, goal.currency);
  const lines = [
    { label: 'Objectif', value: `${kindOf(goal.kind).label} — ${goal.name}` },
    { label: 'Montant cible', value: m(goal.target) },
    { label: 'Date limite', value: formatDate(goal.deadline) },
    { label: 'Déjà épargné', value: `${m(a.saved)} (${formatPercent(a.progress)})` },
    { label: 'Reste à réunir', value: m(a.remaining) },
  ];
  if (a.needed) {
    lines.push(
      { label: 'À épargner par jour', value: m(a.needed.perDay) },
      { label: 'À épargner par semaine', value: m(a.needed.perWeek) },
      { label: 'À épargner par mois', value: m(a.needed.perMonth) },
    );
  }
  if (goal.regularAmount > 0) {
    lines.push({ label: 'Versement prévu', value: `${m(goal.regularAmount)} ${PERIODICITY_LABELS[goal.periodicity]}` });
    if (Number.isFinite(a.monthsNeeded) && a.remaining > 0) lines.push({ label: 'Temps nécessaire', value: formatDuration(a.monthsNeeded) });
  }
  lines.push({ label: 'Bilan', value: a.message });
  const text = [`🎯 Mon objectif d’épargne : ${goal.name}`, ...lines.slice(1).map((l) => `• ${l.label} : ${l.value}`), '', 'Calculé avec BudgetVision'].join('\n');
  return { lines, text };
}

export function GoalDetail({ id, go }: { id: string; go: (path: string) => void }) {
  const goal = useLiveQuery(() => db.goals.get(id), [id]);
  const contributions = list(useLiveQuery(() => db.contributions.where('goalId').equals(id).toArray(), [id]));
  const { fmt, rate } = useMoney();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  if (goal === undefined) {
    return (
      <section className="screen">
        <Empty icon="🔍" title="Objectif introuvable">
          <button type="button" className="btn btn-secondary" onClick={() => go('objectifs')}>
            Retour aux objectifs
          </button>
        </Empty>
      </section>
    );
  }
  const a = analyzeGoal(goal, contributions, rate);
  const regularity = a.status === 'reached' ? null : analyzeRegularity(goal, contributions, rate, a.remaining, undefined, (v) => fmt(v, goal.currency));
  const c = goal.currency;
  const sortedContributions = [...contributions].sort((x, y) => y.date.localeCompare(x.date) || y.updatedAt - x.updatedAt);

  return (
    <section className="screen">
      <button type="button" className="back" onClick={() => go('objectifs')}>
        ← Objectifs
      </button>
      <div className="card hero">
        <div className="goal-card-head">
          <span className="goal-icon big" aria-hidden>
            {kindOf(goal.kind).icon}
          </span>
          <div className="grow">
            <h1>{goal.name}</h1>
            <span className="muted">
              {fmt(goal.target, c)} avant le {formatDate(goal.deadline)}
            </span>
          </div>
        </div>
        <ProgressBar value={a.progress} tone={a.status === 'late' ? 'warning' : a.status === 'overdue' ? 'danger' : 'brand'} />
        <div className="progress-legend">
          <span>
            <strong>{fmt(a.saved, c)}</strong> épargnés
          </span>
          <span>{formatPercent(a.progress)}</span>
        </div>
        <Alert tone={toneOf(a)}>{a.message}</Alert>
      </div>

      <div className="stats-grid">
        <Stat label="Reste à réunir" value={fmt(a.remaining, c)} />
        <Stat label="Jours restants" value={a.daysLeft > 0 ? String(a.daysLeft) : '0'} />
      </div>

      {a.needed && (
        <div className="card">
          <h2>Pour tenir la date limite</h2>
          <div className="effort">
            <div>
              <span className="muted small">par jour</span>
              <strong>{fmt(a.needed.perDay, c)}</strong>
            </div>
            <div>
              <span className="muted small">par semaine</span>
              <strong>{fmt(a.needed.perWeek, c)}</strong>
            </div>
            <div>
              <span className="muted small">par mois</span>
              <strong>{fmt(a.needed.perMonth, c)}</strong>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h2>À ton rythme</h2>
        {goal.regularAmount > 0 ? (
          <p>
            Tu prévois <strong>{fmt(goal.regularAmount, c)}</strong> {PERIODICITY_LABELS[goal.periodicity]}
            {goal.periodicity !== 'month' && <>, soit {fmt(a.monthlyRate, c)} par mois</>}.
            {a.remaining > 0 && Number.isFinite(a.monthsNeeded) && (
              <>
                {' '}
                Temps nécessaire : <strong>{formatDuration(a.monthsNeeded)}</strong>
                {a.projectedDate && <> (vers le {formatDate(a.projectedDate)})</>}.
              </>
            )}
          </p>
        ) : (
          <p className="muted">Aucun versement régulier prévu. Modifie l’objectif pour en ajouter un.</p>
        )}
      </div>

      {regularity && <RegularityCard goal={goal} regularity={regularity} fmt={fmt} onAdd={() => setAdding(true)} />}

      <div className="card">
        <div className="card-head">
          <h2>Versements</h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
            + Ajouter
          </button>
        </div>
        <ul className="rows">
          <li className="row">
            <div className="grow">
              <strong>Capital initial</strong>
            </div>
            <span>{fmt(goal.initial, c)}</span>
          </li>
          {sortedContributions.map((x) => (
            <li key={x.id} className="row">
              <div className="grow">
                <strong>{formatDate(x.date)}</strong>
                {x.note && <span className="muted small">{x.note}</span>}
              </div>
              <span>{fmt(x.amount, x.currency)}</span>
              <button
                type="button"
                className="icon-btn"
                aria-label="Supprimer ce versement"
                onClick={async () => {
                  if (await askConfirm('Supprimer ce versement ?')) {
                    await remove('contribution', x.id);
                    toast('Versement supprimé');
                  }
                }}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
        {sortedContributions.length === 0 && <p className="muted small">Ajoute chaque somme mise de côté pour suivre ta progression.</p>}
      </div>

      <div className="btn-stack">
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={async () => {
            const { lines, text } = goalSummary(goal, a);
            await saveSimulation('goal', `Objectif : ${goal.name}`, lines, text);
            toast('Simulation enregistrée dans l’historique');
          }}
        >
          💾 Enregistrer dans l’historique
        </button>
        <button type="button" className="btn btn-whatsapp btn-block" onClick={() => shareOnWhatsApp(goalSummary(goal, a).text)}>
          Partager sur WhatsApp
        </button>
        <div className="btn-row">
          <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
            ✏️ Modifier
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={async () => {
              if (await askConfirm(`Supprimer l’objectif « ${goal.name} » et ses versements ?`)) {
                await removeGoal(goal.id);
                toast('Objectif supprimé');
                go('objectifs');
              }
            }}
          >
            Supprimer
          </button>
        </div>
      </div>

      {editing && <GoalForm goal={goal} onClose={() => setEditing(false)} onSaved={() => {}} />}
      {adding && (
        <ContributionForm
          goal={goal}
          // Montant proposé : ce qui manque pour la période en cours, sinon le versement prévu.
          suggested={regularity && regularity.current.paid < regularity.current.planned ? regularity.current.planned - regularity.current.paid : goal.regularAmount}
          onClose={() => setAdding(false)}
        />
      )}
    </section>
  );
}

function ContributionForm({ goal, suggested, onClose }: { goal: Goal; suggested: number; onClose: () => void }) {
  const [currency, setCurrency] = useState<Currency>(goal.currency);
  const [amount, setAmount] = useState(suggested > 0 ? formatInput(goal.currency === 'CDF' ? Math.round(suggested) : Math.round(suggested * 100) / 100, goal.currency) : '');
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = amountOf(amount);
    const found: Record<string, string> = {};
    if (!(value > 0)) found.amount = 'Saisis un montant supérieur à 0.';
    if (!isValidIsoDate(date)) found.date = 'Choisis une date.';
    setErrors(found);
    if (Object.keys(found).length) return;
    await save<Contribution>('contribution', { id: newId(), goalId: goal.id, amount: value, currency, date, note: note.trim().slice(0, 80) });
    toast('Versement ajouté');
    onClose();
  }

  return (
    <Sheet title="Ajouter un versement" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <span className="label">Devise</span>
          <CurrencyToggle value={currency} onChange={setCurrency} />
        </div>
        <Field label="Montant" error={errors.amount}>
          {(id) => <MoneyInput id={id} value={amount} onChange={setAmount} currency={currency} />}
        </Field>
        <Field label="Date" error={errors.date}>
          {(id) => <input id={id} type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label="Note (facultatif)">{(id) => <input id={id} value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} placeholder="Ex. salaire de mars" />}</Field>
        <button type="submit" className="btn btn-primary btn-block">
          Ajouter
        </button>
      </form>
    </Sheet>
  );
}

const REGULARITY_LABELS: Record<Regularity['status'], { text: string; tone: 'success' | 'warning' | 'info' }> = {
  ahead: { text: 'En avance', tone: 'success' },
  'on-track': { text: 'À jour', tone: 'success' },
  behind: { text: 'En retard', tone: 'warning' },
};

/** Suivi de régularité : versements réels comparés au plan, période par période. */
function RegularityCard({ goal, regularity: r, fmt, onAdd }: { goal: Goal; regularity: Regularity; fmt: (amount: number, from?: Currency) => string; onAdd: () => void }) {
  const c = goal.currency;
  const names = PERIOD_NAMES[goal.periodicity];
  const label = REGULARITY_LABELS[r.status];
  const pace = realPaceMessage(goal, r, (v) => fmt(v, c));
  const currentDone = r.current.paid >= r.current.planned * 0.999;
  return (
    <div className="card regularity">
      <div className="card-head">
        <h2>Suivi de régularité</h2>
        <span className={`chip chip-${label.tone}`}>{r.completed === 0 ? 'Démarrage' : label.text}</span>
      </div>
      <Alert tone={r.status === 'behind' ? 'warning' : 'success'}>{r.message}</Alert>

      {r.completed > 0 && (
        <div className="regularity-totals">
          <div>
            <span className="muted small">Prévu</span>
            <strong>{fmt(r.due, c)}</strong>
          </div>
          <div>
            <span className="muted small">Versé</span>
            <strong>{fmt(r.paid, c)}</strong>
          </div>
          <div>
            <span className="muted small">Écart</span>
            <strong className={r.diff < 0 ? 'negative' : 'positive'}>
              {r.diff > 0 ? '+' : ''}
              {fmt(r.diff, c)}
            </strong>
          </div>
        </div>
      )}

      <div className="regularity-current">
        <div>
          <strong>{names.this}</strong> <span className="muted small">depuis le {formatDate(r.current.start)}</span>
          <div className="regularity-amount">
            {fmt(r.current.paid, c)} <span className="muted">sur {fmt(r.current.planned, c)}</span>
          </div>
        </div>
        <ProgressBar value={r.current.paid / r.current.planned} tone={currentDone ? 'success' : 'brand'} />
        {!currentDone && (
          <button type="button" className="btn btn-secondary btn-block" onClick={onAdd}>
            + Ajouter un versement
          </button>
        )}
      </div>

      {r.recent.length > 1 && (
        <div>
          <span className="muted small">Dernières {goal.periodicity === 'week' ? 'semaines' : goal.periodicity === 'day' ? 'journées' : 'périodes'}</span>
          <ol className="period-strip" aria-label="Versé par période">
            {r.recent.map((p) => {
              const ratio = Math.min(1, p.paid / p.planned);
              const state = p.paid >= p.planned * 0.999 ? 'full' : p.paid > 0 ? 'partial' : p.current ? 'pending' : 'missed';
              return (
                <li key={p.start} className={`period ${state}${p.current ? ' current' : ''}`} title={`${p.label} : ${formatMoney(p.paid, c)} sur ${formatMoney(p.planned, c)}`}>
                  <span className="period-bar">
                    <span style={{ height: `${Math.max(ratio * 100, p.paid > 0 ? 8 : 0)}%` }} />
                  </span>
                  <span className="period-mark" aria-hidden>
                    {state === 'full' ? '✓' : state === 'missed' ? '✕' : state === 'partial' ? '½' : '…'}
                  </span>
                  <span className="period-label">{p.label}</span>
                </li>
              );
            })}
          </ol>
          <p className="muted small">✓ plan respecté · ½ versement partiel · ✕ rien versé · … période en cours</p>
        </div>
      )}
      {pace && <p className="small">{pace}</p>}
    </div>
  );
}
