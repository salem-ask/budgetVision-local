// Budget mensuel : totaux, répartition par catégorie et règle 50/30/20. Fonctions pures.
import { convert, formatPercent } from './money';
import type { Bucket, Category, Currency, Entry } from './types';

/**
 * Catégories fournies par l'appli. Leurs identifiants sont fixes (les mêmes que dans la
 * version en ligne) : une sauvegarde importée les remplace sans créer de doublon.
 */
export const DEFAULT_CATEGORIES: Omit<Category, 'updatedAt'>[] = [
  { id: 'cat-nourriture', name: 'Nourriture', bucket: 'besoin', color: '#f59e0b', builtin: true },
  { id: 'cat-transport', name: 'Transport', bucket: 'besoin', color: '#3b82f6', builtin: true },
  { id: 'cat-loyer', name: 'Loyer', bucket: 'besoin', color: '#8b5cf6', builtin: true },
  { id: 'cat-sante', name: 'Santé', bucket: 'besoin', color: '#ef4444', builtin: true },
  { id: 'cat-eglise', name: 'Église / dons', bucket: 'envie', color: '#14b8a6', builtin: true },
  { id: 'cat-epargne', name: 'Épargne', bucket: 'epargne', color: '#22c55e', builtin: true },
  { id: 'cat-autres', name: 'Autres', bucket: 'envie', color: '#64748b', builtin: true },
];

/** Couleurs proposées pour les catégories personnalisées (lisibles en clair et en sombre). */
export const CATEGORY_COLORS = ['#ec4899', '#0ea5e9', '#a855f7', '#f97316', '#84cc16', '#06b6d4', '#e11d48', '#eab308'];

export const RULE_TARGETS: Record<Bucket, number> = { besoin: 0.5, envie: 0.3, epargne: 0.2 };

export interface CategoryTotal {
  category: Category;
  amount: number;
  share: number;
}

export interface BudgetSummary {
  income: number;
  expenses: number;
  /** Revenus − dépenses (toutes catégories, épargne comprise). */
  balance: number;
  /** Solde restant à dépenser par jour jusqu'à la fin du mois (null si le mois est passé). */
  perDayLeft: number | null;
  /** Dépenses classées « Épargne » + solde positif non dépensé. */
  savings: number;
  /** Épargne / revenus. */
  savingsRate: number;
  byCategory: CategoryTotal[];
  byBucket: Record<Bucket, number>;
}

/**
 * Totaux d'un mois, convertis dans la devise d'affichage.
 * `daysLeft` : jours restants dans le mois, aujourd'hui compris (0 si mois passé).
 */
export function summarizeBudget(
  entries: Entry[],
  categories: Category[],
  currency: Currency,
  rate: number,
  daysLeft: number,
): BudgetSummary {
  const value = (e: Entry) => convert(e.amount, e.currency, currency, rate);
  const income = entries.filter((e) => e.kind === 'income').reduce((s, e) => s + value(e), 0);
  const expenseEntries = entries.filter((e) => e.kind === 'expense');
  const expenses = expenseEntries.reduce((s, e) => s + value(e), 0);
  const balance = income - expenses;

  // Catégories pas encore chargées ou supprimées : « Autres » sert de repli.
  const builtinOther = { ...DEFAULT_CATEGORIES.find((c) => c.id === 'cat-autres')!, updatedAt: 0 };
  const fallback = categories.find((c) => c.id === 'cat-autres') ?? builtinOther;
  const byId = new Map(categories.map((c) => [c.id, c]));
  byId.set(fallback.id, fallback);
  const totals = new Map<string, number>();
  for (const e of expenseEntries) {
    // Catégorie supprimée entre-temps : la dépense compte dans « Autres ».
    const category = byId.get(e.categoryId) ?? fallback;
    totals.set(category.id, (totals.get(category.id) ?? 0) + value(e));
  }
  const byCategory = [...totals]
    .map(([id, amount]) => ({ category: byId.get(id)!, amount, share: expenses > 0 ? amount / expenses : 0 }))
    .sort((a, b) => b.amount - a.amount);

  const byBucket: Record<Bucket, number> = { besoin: 0, envie: 0, epargne: 0 };
  for (const { category, amount } of byCategory) byBucket[category.bucket] += amount;

  const savings = byBucket.epargne + Math.max(0, balance);
  return {
    income,
    expenses,
    balance,
    perDayLeft: daysLeft > 0 ? Math.max(0, balance) / daysLeft : null,
    savings,
    savingsRate: income > 0 ? savings / income : 0,
    byCategory,
    byBucket,
  };
}

export interface RuleLine {
  bucket: Bucket;
  /** Montant conseillé (part du revenu). */
  advised: number;
  /** Montant réel. */
  actual: number;
  /** Part réelle du revenu (0 à 1+). */
  share: number;
  target: number;
  /** Écart jugé : « ok » si à 5 points près de la cible, sinon trop ou pas assez. */
  verdict: 'ok' | 'over' | 'under';
  message: string;
}

/**
 * Règle 50/30/20 : 50 % besoins, 30 % envies, 20 % épargne.
 * L'épargne réelle compte les dépenses « Épargne » et le solde non dépensé.
 */
export function applyRule(summary: BudgetSummary): RuleLine[] {
  const { income } = summary;
  const actual: Record<Bucket, number> = {
    besoin: summary.byBucket.besoin,
    envie: summary.byBucket.envie,
    epargne: summary.savings,
  };
  return (Object.keys(RULE_TARGETS) as Bucket[]).map((bucket) => {
    const target = RULE_TARGETS[bucket];
    const share = income > 0 ? actual[bucket] / income : 0;
    const diff = share - target;
    const verdict = Math.abs(diff) <= 0.05 ? 'ok' : diff > 0 ? 'over' : 'under';
    const pct = formatPercent(share);
    const goal = formatPercent(target);
    const messages: Record<Bucket, Record<RuleLine['verdict'], string>> = {
      besoin: {
        ok: `Tu dépenses ${pct} en besoins : c'est équilibré (conseil : ${goal}).`,
        over: `Tu dépenses ${pct} en besoins, au-dessus des ${goal} conseillés.`,
        under: `Tu dépenses ${pct} en besoins, sous les ${goal} conseillés : bien maîtrisé.`,
      },
      envie: {
        ok: `Tu dépenses ${pct} en envies : c'est équilibré (conseil : ${goal}).`,
        over: `Tu dépenses ${pct} en envies, au-dessus des ${goal} conseillés : c'est là qu'on peut réduire.`,
        under: `Tu dépenses ${pct} en envies, sous les ${goal} conseillés.`,
      },
      epargne: {
        ok: `Tu épargnes ${pct} de ton revenu : objectif tenu (conseil : ${goal}).`,
        over: `Tu épargnes ${pct} de ton revenu, au-delà des ${goal} conseillés. Bravo !`,
        under: `Tu épargnes ${pct} de ton revenu, sous les ${goal} conseillés.`,
      },
    };
    return { bucket, advised: income * target, actual: actual[bucket], share, target, verdict, message: messages[bucket][verdict] };
  });
}

export interface MonthlySavings {
  month: string;
  /** Épargne réelle du mois : dépenses « Épargne » + solde positif non dépensé. */
  savings: number;
  income: number;
}

/** Épargne réelle de chaque mois demandé (pour le graphique de l'accueil). */
export function monthlySavings(entries: Entry[], categories: Category[], currency: Currency, rate: number, months: string[]): MonthlySavings[] {
  return months.map((month) => {
    const summary = summarizeBudget(
      entries.filter((e) => e.month === month),
      categories,
      currency,
      rate,
      0,
    );
    return { month, savings: summary.savings, income: summary.income };
  });
}
