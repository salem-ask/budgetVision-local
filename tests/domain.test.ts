import { describe, expect, it } from 'vitest';
import { applyRule, DEFAULT_CATEGORIES, summarizeBudget } from '../src/domain/budget';
import { daysBetween, formatDuration } from '../src/domain/dates';
import { analyzeGoal, validateGoal } from '../src/domain/goals';
import { convert, formatMoney, parseAmount } from '../src/domain/money';
import { runScenarios } from '../src/domain/scenarios';
import type { Category, Contribution, Entry, Goal } from '../src/domain/types';

const sp = (text: string) => text.replace(/ /g, ' ');

describe('montants', () => {
  it('formate avec séparateur de milliers', () => {
    expect(sp(formatMoney(1_250_000, 'CDF'))).toBe('1 250 000 CDF');
    expect(sp(formatMoney(1250.5, 'USD'))).toBe('1 250,50 USD');
    expect(sp(formatMoney(12, 'USD'))).toBe('12 USD');
    expect(sp(formatMoney(-3500.4, 'CDF'))).toBe('-3 500 CDF');
  });

  it('lit les saisies courantes', () => {
    expect(parseAmount('1 250 000')).toBe(1_250_000);
    expect(parseAmount('1 250 000 CDF')).toBe(1_250_000);
    expect(parseAmount('1.250.000')).toBe(1_250_000);
    expect(parseAmount('12,5')).toBe(12.5);
    expect(parseAmount('12.5')).toBe(12.5);
    expect(parseAmount('abc')).toBeNaN();
    expect(parseAmount('')).toBeNaN();
  });

  it('convertit CDF ⇄ USD avec le taux', () => {
    expect(convert(100, 'USD', 'CDF', 2800)).toBe(280_000);
    expect(convert(280_000, 'CDF', 'USD', 2800)).toBe(100);
    expect(convert(5, 'CDF', 'CDF', 2800)).toBe(5);
  });
});

describe('dates', () => {
  it('compte les jours et les durées', () => {
    expect(daysBetween('2026-01-01', '2026-12-31')).toBe(364);
    expect(formatDuration(0.4)).toBe("moins d'un mois");
    expect(formatDuration(3)).toBe('3 mois');
    expect(formatDuration(14.2)).toBe('1 an et 3 mois');
    expect(formatDuration(24)).toBe('2 ans');
  });
});

describe('objectif', () => {
  const goal: Goal = {
    id: 'g', updatedAt: 1, name: 'Moto', kind: 'achat', currency: 'CDF',
    target: 1_200_000, deadline: '2027-01-01', initial: 200_000, regularAmount: 100_000, periodicity: 'month', createdAt: 1,
  };

  it("calcule le restant, la progression et l'effort par période", () => {
    const a = analyzeGoal(goal, [], 2800, '2026-01-01');
    expect(a.saved).toBe(200_000);
    expect(a.remaining).toBe(1_000_000);
    expect(a.progress).toBeCloseTo(1 / 6);
    expect(a.daysLeft).toBe(365);
    expect(a.needed!.perDay).toBeCloseTo(1_000_000 / 365);
    expect(a.needed!.perWeek).toBeCloseTo(1_000_000 / (365 / 7));
    expect(a.needed!.perMonth).toBeCloseTo(1_000_000 / (365 / 30.4375));
    expect(a.monthsNeeded).toBe(10);
    expect(a.status).toBe('on-track');
    expect(sp(a.message)).toMatch(/^À ce rythme, tu atteins ton objectif dans 10 mois/);
  });

  it('compte les versements, même dans une autre devise', () => {
    const c: Contribution = { id: 'c', updatedAt: 1, goalId: 'g', amount: 100, currency: 'USD', date: '2026-01-02', note: '' };
    const a = analyzeGoal(goal, [c], 2800, '2026-01-01');
    expect(a.saved).toBe(480_000);
  });

  it('signale le retard', () => {
    const a = analyzeGoal({ ...goal, regularAmount: 50_000 }, [], 2800, '2026-01-01');
    expect(a.status).toBe('late');
    expect(a.message).toMatch(/^Tu es en retard/);
  });

  it('signale un objectif atteint ou une date dépassée', () => {
    expect(analyzeGoal({ ...goal, initial: 1_500_000 }, [], 2800, '2026-01-01').status).toBe('reached');
    expect(analyzeGoal(goal, [], 2800, '2027-02-01').status).toBe('overdue');
    expect(analyzeGoal({ ...goal, regularAmount: 0 }, [], 2800, '2026-01-01').status).toBe('no-plan');
  });

  it('valide les champs', () => {
    const errors = validateGoal({ name: '', target: 0, deadline: '2020-01-01', initial: -1, regularAmount: 0 }, '2026-01-01');
    expect(Object.keys(errors).sort()).toEqual(['deadline', 'initial', 'name', 'target']);
  });
});

describe('budget et règle 50/30/20', () => {
  const categories = DEFAULT_CATEGORIES.map((c) => ({ ...c, updatedAt: 0 })) as Category[];
  const entry = (kind: Entry['kind'], amount: number, categoryId = '', currency: Entry['currency'] = 'CDF'): Entry => ({
    id: `${kind}-${amount}-${categoryId}`, updatedAt: 1, kind, amount, currency, categoryId, label: '', month: '2026-03', createdAt: 1,
  });

  it('calcule solde, taux d’épargne et répartition', () => {
    const entries = [
      entry('income', 1_000_000),
      entry('expense', 400_000, 'cat-nourriture'),
      entry('expense', 250_000, 'cat-loyer'),
      entry('expense', 100_000, 'cat-epargne'),
      entry('expense', 50, 'cat-eglise', 'USD'),
      entry('expense', 10_000, 'categorie-supprimee'),
    ];
    const s = summarizeBudget(entries, categories, 'CDF', 2000, 10);
    expect(s.income).toBe(1_000_000);
    expect(s.expenses).toBe(860_000);
    expect(s.balance).toBe(140_000);
    expect(s.perDayLeft).toBe(14_000);
    expect(s.savings).toBe(240_000);
    expect(s.savingsRate).toBeCloseTo(0.24);
    expect(s.byCategory[0].category.id).toBe('cat-nourriture');
    expect(s.byCategory.find((t) => t.category.id === 'cat-autres')!.amount).toBe(10_000);
    expect(s.byBucket).toEqual({ besoin: 650_000, envie: 110_000, epargne: 100_000 });

    // Catégories pas encore chargées : tout compte dans « Autres », sans erreur.
    expect(summarizeBudget(entries, [], 'CDF', 2000, 10).byCategory).toEqual([expect.objectContaining({ amount: 860_000 })]);

    const rule = applyRule(s);
    expect(rule[0]).toMatchObject({ bucket: 'besoin', advised: 500_000, verdict: 'over' });
    expect(sp(rule[0].message)).toBe('Tu dépenses 65 % en besoins, au-dessus des 50 % conseillés.');
    expect(rule[1].verdict).toBe('under');
    expect(rule[2].verdict).toBe('ok');
  });
});

describe('scénarios', () => {
  it('fait évoluer le capital sans intérêts', () => {
    const [prudent, , ambitieux] = runScenarios({
      currency: 'CDF', initial: 100_000, months: 12, target: 1_000_000, prudent: 50_000, intermediaire: 75_000, ambitieux: 150_000,
    });
    expect(prudent.points).toHaveLength(13);
    expect(prudent.final).toBe(700_000);
    expect(prudent.monthsToTarget).toBe(18);
    expect(ambitieux.final).toBe(1_900_000);
    expect(ambitieux.monthsToTarget).toBe(6);
  });
});

describe('accueil', () => {
  it('calcule le rythme d’épargne rapide', async () => {
    const { quickSavings } = await import('../src/domain/goals');
    const r = quickSavings(1_000_000, 6);
    expect(r.perMonth).toBeCloseTo(166_666.67, 1);
    expect(r.perWeek).toBeCloseTo(1_000_000 / (6 * 30.4375 / 7));
    expect(r.perDay).toBeCloseTo(1_000_000 / (6 * 30.4375));
    expect(quickSavings(100, 2, 150).remaining).toBe(0);
  });

  it('donne l’épargne réelle de chaque mois', async () => {
    const { monthlySavings } = await import('../src/domain/budget');
    const categories = DEFAULT_CATEGORIES.map((c) => ({ ...c, updatedAt: 0 })) as Category[];
    const e = (month: string, kind: Entry['kind'], amount: number, categoryId = ''): Entry => ({
      id: `${month}-${kind}-${amount}`, updatedAt: 1, kind, amount, currency: 'CDF', categoryId, label: '', month, createdAt: 1,
    });
    const result = monthlySavings(
      [e('2026-01', 'income', 500_000), e('2026-01', 'expense', 400_000, 'cat-nourriture'), e('2026-02', 'income', 300_000), e('2026-02', 'expense', 50_000, 'cat-epargne'), e('2026-02', 'expense', 300_000, 'cat-loyer')],
      categories, 'CDF', 2800, ['2026-01', '2026-02', '2026-03'],
    );
    // Février : 50 000 épargnés, mais solde négatif (−50 000) : l'épargne reste 50 000.
    expect(result.map((r) => r.savings)).toEqual([100_000, 50_000, 0]);
  });
});
