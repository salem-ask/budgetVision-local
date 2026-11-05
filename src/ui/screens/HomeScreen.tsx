// Accueil : résumé du mois, objectifs, outils de calcul, évolution de l'épargne et dernière simulation.
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../data/db';
import { list } from '../../data/store';
import { monthlySavings, summarizeBudget } from '../../domain/budget';
import { currentMonth, daysBetween, DAYS_PER_MONTH, formatDuration, shiftMonth, todayIso } from '../../domain/dates';
import { analyzeGoal } from '../../domain/goals';
import { formatNumber, formatPercent } from '../../domain/money';
import { GOAL_KINDS, type Goal } from '../../domain/types';
import { needsBackupReminder } from '../../data/backup';
import { ImportBackup, lastBackupText } from '../BackupControls';
import { useBackupState, useMoney } from '../hooks';
import { Icon, type IconName } from '../icons';
import mark from '../assets/logo-mark.webp';
import { CurrencyConverterSheet, SavingsCalculatorSheet } from './ToolSheets';

const MONTH_SHORT = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
const GOAL_TONES = ['green', 'blue', 'orange', 'violet', 'pink'] as const;

/** Délai avant la date limite : « Dans 6 mois », « Dans 12 jours », « Date dépassée ». */
function untilDeadline(goal: Goal): string {
  const days = daysBetween(todayIso(), goal.deadline);
  if (days < 0) return 'Date dépassée';
  if (days < 31) return days <= 1 ? 'Dans 1 jour' : `Dans ${days} jours`;
  return `Dans ${formatDuration(Math.round(days / DAYS_PER_MONTH))}`;
}

/** Montant court pour les axes : 250K, 1,2M. */
function compact(value: number): string {
  if (value >= 1_000_000) return `${formatNumber(value / 1_000_000, 1)}M`;
  if (value >= 1_000) return `${formatNumber(value / 1_000, 0)}K`;
  return formatNumber(value, 0);
}

export function HomeScreen({ go }: { go: (path: string) => void }) {
  const { fmt, currency, rate } = useMoney();
  const month = currentMonth();
  const entries = list(useLiveQuery(() => db.entries.toArray(), []));
  const categories = list(useLiveQuery(() => db.categories.toArray(), []));
  const goals = list(useLiveQuery(() => db.goals.toArray(), []));
  const contributions = list(useLiveQuery(() => db.contributions.toArray(), []));
  const lastSimulation = list(useLiveQuery(() => db.simulations.orderBy('createdAt').reverse().limit(5).toArray(), []))[0];
  const [span, setSpan] = useState<6 | 12>(6);
  const [tool, setTool] = useState<'calcul' | 'devises' | null>(null);
  const backup = useBackupState();
  const isEmpty = backup.dataCount === 0;
  const remind = backup.dataCount !== undefined && needsBackupReminder(backup.lastBackupAt, backup.dataCount > 0);

  const summary = summarizeBudget(entries.filter((e) => e.month === month), categories, currency, rate, 0);
  const months = Array.from({ length: span }, (_, i) => shiftMonth(month, i - span + 1));
  const savings = monthlySavings(entries, categories, currency, rate, months);
  const maxSaving = Math.max(...savings.map((s) => s.savings), 0);
  const sortedGoals = [...goals].sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 6);

  const stats: { label: string; value: string; icon: IconName; tone: string }[] = [
    { label: 'Revenus', value: fmt(summary.income), icon: 'wallet', tone: 'green' },
    { label: 'Dépenses', value: fmt(summary.expenses), icon: 'cart', tone: 'red' },
    { label: 'Solde disponible', value: fmt(summary.balance), icon: 'piggy', tone: 'blue' },
    { label: 'Taux d’épargne', value: formatPercent(summary.savingsRate), icon: 'percent', tone: 'violet' },
  ];
  const tools: { title: string; hint: string; icon: IconName; tone: string; action: () => void }[] = [
    { title: 'Calculateur d’épargne', hint: 'Sommes et durées', icon: 'calculator', tone: 'green', action: () => setTool('calcul') },
    { title: 'Objectifs financiers', hint: 'Planifie tes projets', icon: 'target', tone: 'blue', action: () => go('objectifs') },
    { title: 'Projections financières', hint: 'Simule tes scénarios', icon: 'trend', tone: 'orange', action: () => go('scenarios') },
    { title: 'Budget personnel', hint: 'Revenus et dépenses', icon: 'wallet', tone: 'pink', action: () => go('budget') },
    { title: 'Convertisseur de devises', hint: 'CDF ⇄ USD', icon: 'swap', tone: 'violet', action: () => setTool('devises') },
    { title: 'Historique des calculs', hint: 'Tes simulations', icon: 'list', tone: 'sky', action: () => go('historique') },
  ];

  return (
    <section className="screen home">
      <div className="home-hero">
        <div className="home-hero-text">
          <h1>Prends le contrôle de tes finances</h1>
          <p>Des outils simples pour mieux planifier ton avenir.</p>
        </div>
        <img src={mark} alt="" width="132" height="132" className="home-hero-art" />
      </div>

      {isEmpty && (
        <div className="card home-notice">
          <h2>Tu utilisais la version en ligne ?</h2>
          <p className="muted small">
            Sur la version en ligne, va dans Réglages → Sauvegarde → « Exporter mes données », puis choisis ici le fichier obtenu. Tes objectifs, versements, budget et historique seront enregistrés sur ce téléphone.
          </p>
          <ImportBackup label="Importer mes données de la version en ligne" primary />
        </div>
      )}
      {remind && (
        <button type="button" className="card home-empty" onClick={() => go('reglages')}>
          <span className="round-icon tone-orange">
            <Icon name="save" />
          </span>
          <span className="grow">
            <strong>Pense à sauvegarder tes données</strong>
            <span className="muted small">{lastBackupText(backup.lastBackupAt)} Tes données ne sont que sur ce téléphone.</span>
          </span>
          <Icon name="chevron" />
        </button>
      )}

      <div className="home-stats">
        {stats.map((s) => (
          <button key={s.label} type="button" className="home-stat" onClick={() => go('budget')}>
            <span className={`round-icon tone-${s.tone}`}>
              <Icon name={s.icon} />
            </span>
            <span className="home-stat-label">{s.label}</span>
            <strong className={s.label === 'Solde disponible' && summary.balance < 0 ? 'negative' : ''}>{s.value}</strong>
            <span className={`home-stat-period text-${s.tone}`}>Ce mois-ci</span>
          </button>
        ))}
      </div>

      <div className="section-head">
        <h2>Mes objectifs</h2>
        <a href="#/objectifs" className="see-all">
          Voir tout <Icon name="chevron" size={16} />
        </a>
      </div>
      {sortedGoals.length === 0 ? (
        <button type="button" className="card home-empty" onClick={() => go('objectifs')}>
          <span className="round-icon tone-blue">
            <Icon name="target" />
          </span>
          <span className="grow">
            <strong>Crée ton premier objectif</strong>
            <span className="muted small">Moto, études, maison… l’appli calcule ce qu’il faut mettre de côté.</span>
          </span>
          <Icon name="chevron" />
        </button>
      ) : (
        <div className="goal-strip">
          {sortedGoals.map((goal, index) => {
            const a = analyzeGoal(goal, contributions, rate);
            const tone = GOAL_TONES[index % GOAL_TONES.length];
            return (
              <button key={goal.id} type="button" className="goal-tile" onClick={() => go(`objectifs/${goal.id}`)}>
                <div className="goal-tile-head">
                  <span className={`round-icon tone-${tone}`} aria-hidden>
                    {GOAL_KINDS.find((k) => k.id === goal.kind)?.icon ?? '🎯'}
                  </span>
                  <span className="grow">
                    <span className="goal-tile-name">{goal.name}</span>
                    <strong>{fmt(goal.target, goal.currency)}</strong>
                  </span>
                </div>
                <div className="goal-tile-progress">
                  <div className={`bar tone-${tone}`}>
                    <div style={{ width: `${Math.round(a.progress * 100)}%` }} />
                  </div>
                  <span>{formatPercent(a.progress)}</span>
                </div>
                <span className="goal-tile-when">
                  <Icon name="calendar" size={15} /> {a.status === 'reached' ? 'Objectif atteint' : untilDeadline(goal)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="section-head">
        <h2>Outils de calcul</h2>
      </div>
      <div className="tool-grid">
        {tools.map((t) => (
          <button key={t.title} type="button" className={`tool tone-bg-${t.tone}`} onClick={t.action}>
            <span className={`square-icon tone-${t.tone}`}>
              <Icon name={t.icon} />
            </span>
            <span className="grow">
              <strong>{t.title}</strong>
              <span className={`small text-${t.tone}`}>{t.hint}</span>
            </span>
            <Icon name="chevron" size={18} />
          </button>
        ))}
      </div>

      <div className="home-bottom">
        <div className="card">
          <div className="card-head">
            <h2>Évolution de mon épargne</h2>
            <select aria-label="Période" value={span} onChange={(e) => setSpan(Number(e.target.value) as 6 | 12)} className="mini-select">
              <option value={6}>6 mois</option>
              <option value={12}>12 mois</option>
            </select>
          </div>
          {maxSaving > 0 ? (
            <div className="bars" role="img" aria-label={`Épargne réelle des ${span} derniers mois`}>
              <div className="bars-axis">
                <span>{compact(maxSaving)}</span>
                <span>{compact(maxSaving / 2)}</span>
                <span>0</span>
              </div>
              <div className="bars-plot">
                {savings.map((s) => {
                  const [, m] = s.month.split('-').map(Number);
                  return (
                    <div key={s.month} className="bars-col" title={`${fmt(s.savings)}`}>
                      <div className="bars-bar" style={{ height: `${(s.savings / maxSaving) * 100}%` }} />
                      <span>{MONTH_SHORT[m - 1]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="muted small">Saisis tes revenus et tes dépenses dans « Budget » : l’épargne de chaque mois s’affichera ici.</p>
          )}
          <p className="muted small">Épargne réelle : dépenses « Épargne » + argent non dépensé du mois.</p>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>
              <Icon name="history" size={18} /> Dernière simulation
            </h2>
            {lastSimulation && (
              <a href={`#/historique/${lastSimulation.id}`} className="see-all" aria-label="Ouvrir la dernière simulation">
                <Icon name="chevron" />
              </a>
            )}
          </div>
          {lastSimulation ? (
            <button type="button" className="last-sim" onClick={() => go(`historique/${lastSimulation.id}`)}>
              <strong>{lastSimulation.title}</strong>
              <dl>
                {lastSimulation.lines.slice(-3).map((line, i) => (
                  <div key={i}>
                    <dt>{line.label}</dt>
                    <dd>{line.value}</dd>
                  </div>
                ))}
              </dl>
            </button>
          ) : (
            <p className="muted small">Aucune simulation enregistrée. Essaie le calculateur d’épargne ci-dessus.</p>
          )}
        </div>
      </div>

      {tool === 'calcul' && <SavingsCalculatorSheet onClose={() => setTool(null)} />}
      {tool === 'devises' && <CurrencyConverterSheet onClose={() => setTool(null)} onEditRate={() => go('reglages')} />}
    </section>
  );
}
