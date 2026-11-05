// Types métier. Chaque élément enregistré porte `id` et `updatedAt` (ms).
// Mêmes champs et mêmes identifiants que la version en ligne : une sauvegarde de celle-ci s'importe telle quelle.

export type Currency = 'CDF' | 'USD';
export const CURRENCIES: Currency[] = ['CDF', 'USD'];

export interface Stored {
  id: string;
  /** Date de dernière modification (ms). */
  updatedAt: number;
}

export type Periodicity = 'day' | 'week' | 'month';
export const PERIODICITY_LABELS: Record<Periodicity, string> = { day: 'par jour', week: 'par semaine', month: 'par mois' };

export type GoalKind = 'achat' | 'etudes' | 'voyage' | 'entreprise' | 'maison' | 'urgence' | 'autre';
export const GOAL_KINDS: { id: GoalKind; label: string; icon: string }[] = [
  { id: 'achat', label: 'Achat', icon: '🛒' },
  { id: 'etudes', label: 'Études', icon: '🎓' },
  { id: 'voyage', label: 'Voyage', icon: '✈️' },
  { id: 'entreprise', label: 'Entreprise', icon: '💼' },
  { id: 'maison', label: 'Maison', icon: '🏠' },
  { id: 'urgence', label: "Fonds d'urgence", icon: '🛟' },
  { id: 'autre', label: 'Autre', icon: '🎯' },
];

export interface Goal extends Stored {
  name: string;
  kind: GoalKind;
  currency: Currency;
  target: number;
  /** Date limite, AAAA-MM-JJ. */
  deadline: string;
  /** Capital déjà disponible au départ. */
  initial: number;
  /** Versement régulier prévu (0 si aucun). */
  regularAmount: number;
  periodicity: Periodicity;
  createdAt: number;
}

/** Versement effectué vers un objectif. */
export interface Contribution extends Stored {
  goalId: string;
  amount: number;
  currency: Currency;
  /** AAAA-MM-JJ. */
  date: string;
  note: string;
}

/** Groupe de la règle 50/30/20. */
export type Bucket = 'besoin' | 'envie' | 'epargne';
export const BUCKET_LABELS: Record<Bucket, string> = { besoin: 'Besoins', envie: 'Envies', epargne: 'Épargne' };

export interface Category extends Stored {
  name: string;
  bucket: Bucket;
  color: string;
  /** Catégorie fournie par l'appli (renommable, pas supprimable). */
  builtin?: boolean;
}

/** Ligne de budget : un revenu ou une dépense d'un mois donné. */
export interface Entry extends Stored {
  kind: 'income' | 'expense';
  amount: number;
  currency: Currency;
  /** Dépenses seulement. */
  categoryId: string;
  label: string;
  /** Mois concerné, AAAA-MM. */
  month: string;
  createdAt: number;
}

export interface ScenarioParams {
  currency: Currency;
  initial: number;
  months: number;
  /** Montant visé (facultatif, 0 = aucun) : indique quand chaque scénario l'atteint. */
  target: number;
  prudent: number;
  intermediaire: number;
  ambitieux: number;
}

export type Theme = 'auto' | 'light' | 'dark';

/** Réglages du compte : un seul élément, id « settings ». */
export interface Settings extends Stored {
  /** Nombre de CDF pour 1 USD. */
  rate: number;
  /** Devise dans laquelle les totaux sont affichés. */
  displayCurrency: Currency;
  scenarios: ScenarioParams;
}

export type SimulationKind = 'goal' | 'budget' | 'scenarios' | 'calcul';
export const SIMULATION_LABELS: Record<SimulationKind, string> = { goal: 'Objectif', budget: 'Budget', scenarios: 'Scénarios', calcul: 'Calcul d’épargne' };

/** Simulation enregistrée dans l'historique : figée (pas de modification), seulement consultée ou supprimée. */
export interface Simulation extends Stored {
  kind: SimulationKind;
  title: string;
  /** Lignes « libellé : valeur » déjà formatées, affichées à la réouverture. */
  lines: { label: string; value: string }[];
  /** Résumé en texte, prêt à partager sur WhatsApp. */
  text: string;
  createdAt: number;
}
