import { describe, expect, it } from 'vitest';
import { addMonths } from '../src/domain/dates';
import { analyzeRegularity, realPaceMessage } from '../src/domain/regularity';
import type { Contribution, Goal } from '../src/domain/types';

const sp = (text: string) => text.replace(/ /g, ' ');
// Objectif créé le lundi 5 octobre 2026 (heure locale), 15 USD par semaine.
const goal: Goal = {
  id: 'g', updatedAt: 1, name: 'Études', kind: 'etudes', currency: 'USD', target: 1200, deadline: '2027-06-01',
  initial: 0, regularAmount: 15, periodicity: 'week', createdAt: new Date(2026, 9, 5, 10).getTime(),
};
const pay = (date: string, amount: number, currency: Contribution['currency'] = 'USD'): Contribution => ({
  id: `${date}-${amount}`, updatedAt: 1, goalId: 'g', amount, currency, date, note: '',
});

describe('suivi de régularité', () => {
  it('ne s’applique pas sans versement régulier prévu', () => {
    expect(analyzeRegularity({ ...goal, regularAmount: 0 }, [], 2800, 1200, '2026-10-20')).toBeNull();
  });

  it('première semaine en cours', () => {
    const r = analyzeRegularity(goal, [pay('2026-10-06', 5)], 2800, 1195, '2026-10-08')!;
    expect(r.completed).toBe(0);
    expect(r.status).toBe('on-track');
    expect(r.current).toMatchObject({ start: '2026-10-05', paid: 5, planned: 15 });
    expect(sp(r.message)).toBe('Première semaine en cours : 5 USD versés sur 15 USD prévus.');
    expect(realPaceMessage(goal, r)).toBeNull();
  });

  it('signale le retard : 3 semaines écoulées, 45 prévus, 30 versés', () => {
    // Le versement d'un autre objectif est ignoré.
    const contributions = [pay('2026-10-06', 15), pay('2026-10-14', 15), pay('2026-10-27', 5), { ...pay('2026-10-07', 1), goalId: 'autre' }];
    const r = analyzeRegularity(goal, contributions, 2800, 1165, '2026-10-27')!;
    expect(r.completed).toBe(3);
    expect(r.due).toBe(45);
    expect(r.paid).toBe(35);
    expect(r.status).toBe('behind');
    expect(sp(r.message)).toBe('Tu as 10 USD de retard sur ton plan : 3 semaines écoulées, 45 USD prévus, 35 USD versés.');
    expect(r.recent.map((p) => [p.start, p.paid, p.current])).toEqual([
      ['2026-10-05', 15, false],
      ['2026-10-12', 15, false],
      ['2026-10-19', 0, false],
      ['2026-10-26', 5, true],
    ]);
    // Moyenne réelle sur les 3 semaines terminées : 30 / 3 = 10 USD.
    expect(r.averagePerPeriod).toBe(10);
    expect(sp(realPaceMessage(goal, r)!)).toMatch(/^En moyenne, tu verses 10 USD par semaine/);
  });

  it('compte les versements dans une autre devise et signale l’avance', () => {
    const r = analyzeRegularity(goal, [pay('2026-10-06', 84_000, 'CDF')], 2800, 1170, '2026-10-13')!;
    expect(r.paid).toBe(30);
    expect(r.status).toBe('ahead');
    expect(sp(r.message)).toMatch(/^Bravo, tu as 15 USD d’avance/);
  });

  it('démarre au premier versement s’il est antérieur à la création', () => {
    const r = analyzeRegularity(goal, [pay('2026-09-28', 15)], 2800, 1185, '2026-10-06')!;
    expect(r.start).toBe('2026-09-28');
    expect(r.completed).toBe(1);
    expect(r.status).toBe('on-track');
  });

  it('suit aussi un plan mensuel (mois calendaires à partir du début)', () => {
    const monthly = { ...goal, periodicity: 'month' as const, regularAmount: 100, createdAt: new Date(2026, 0, 31).getTime() };
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    const r = analyzeRegularity(monthly, [pay('2026-02-01', 100), pay('2026-03-05', 100)], 2800, 1000, '2026-04-10')!;
    expect(r.completed).toBe(2);
    expect(r.due).toBe(200);
    expect(r.status).toBe('on-track');
  });
});
