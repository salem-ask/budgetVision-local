// Scénarios prudent / intermédiaire / ambitieux : évolution du capital, résultat instantané.
import { useEffect, useRef, useState } from 'react';
import { db, SETTINGS_ID } from '../../data/db';
import { save } from '../../data/store';
import { formatDuration } from '../../domain/dates';
import { convert, formatInput, formatMoney } from '../../domain/money';
import { runScenarios, SCENARIOS, validateScenarios } from '../../domain/scenarios';
import type { Currency, ScenarioParams, Settings } from '../../domain/types';
import { Alert, amountOf, CurrencyToggle, Field, LineChart, MoneyInput, toast } from '../components';
import { useMoney } from '../hooks';
import { shareOnWhatsApp } from '../share';
import { saveSimulation } from './HistoryScreen';

type Form = Record<'initial' | 'target' | 'prudent' | 'intermediaire' | 'ambitieux', string> & { months: string; currency: Currency };

function toForm(p: ScenarioParams): Form {
  const f = (v: number) => formatInput(v, p.currency);
  return { currency: p.currency, months: String(p.months), initial: f(p.initial), target: f(p.target), prudent: f(p.prudent), intermediaire: f(p.intermediaire), ambitieux: f(p.ambitieux) };
}

function toParams(f: Form): ScenarioParams {
  return {
    currency: f.currency,
    months: Number(f.months.trim() || 0),
    initial: amountOf(f.initial),
    target: amountOf(f.target),
    prudent: amountOf(f.prudent),
    intermediaire: amountOf(f.intermediaire),
    ambitieux: amountOf(f.ambitieux),
  };
}

/** Libellé d'un mois sur l'axe : « Auj. », « 6 m », « 2 ans ». */
function monthTick(m: number): string {
  if (m === 0) return 'Auj.';
  if (m % 12 === 0) return m === 12 ? '1 an' : `${m / 12} ans`;
  return `${m} m`;
}

export function ScenariosScreen() {
  const { settings, rate } = useMoney();
  const [form, setForm] = useState<Form>(() => toForm(settings.scenarios));
  const loaded = useRef(settings.updatedAt > 0);

  // Les réglages arrivent de la base (ou d'un autre appareil) après le premier rendu.
  useEffect(() => {
    if (!loaded.current && settings.updatedAt > 0) {
      loaded.current = true;
      setForm(toForm(settings.scenarios));
    }
  }, [settings]);

  const params = toParams(form);
  const error = validateScenarios(params);
  const results = error ? [] : runScenarios(params);

  // Paramètres mémorisés peu après la dernière saisie.
  useEffect(() => {
    if (error) return;
    const timer = setTimeout(async () => {
      const current = (await db.settings.get(SETTINGS_ID)) ?? settings;
      if (JSON.stringify(current.scenarios) === JSON.stringify(params)) return;
      loaded.current = true;
      await save<Settings>('settings', { ...current, scenarios: params });
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params), error]);

  const set = (key: keyof Form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const money = (v: number) => formatMoney(v, params.currency);
  const other: Currency = params.currency === 'CDF' ? 'USD' : 'CDF';

  function changeCurrency(next: Currency) {
    if (next === form.currency) return;
    // Les montants saisis sont convertis avec le taux du jour.
    const p = toParams(form);
    const c = (v: number) => (Number.isFinite(v) ? convert(v, p.currency, next, rate) : 0);
    const round = (v: number) => (next === 'CDF' ? Math.round(v) : Math.round(v * 100) / 100);
    setForm(toForm({ ...p, currency: next, initial: round(c(p.initial)), target: round(c(p.target)), prudent: round(c(p.prudent)), intermediaire: round(c(p.intermediaire)), ambitieux: round(c(p.ambitieux)) }));
  }

  function summary() {
    const lines = [
      { label: 'Capital initial', value: money(params.initial) },
      { label: 'Durée', value: formatDuration(params.months) },
      ...(params.target > 0 ? [{ label: 'Montant visé', value: money(params.target) }] : []),
      ...results.flatMap((r) => {
        const label = SCENARIOS.find((s) => s.id === r.id)!.label;
        const reach = r.monthsToTarget === null ? '' : r.monthsToTarget === Infinity ? ' — montant visé jamais atteint' : ` — montant visé atteint en ${formatDuration(r.monthsToTarget)}`;
        return [{ label: `${label} (${money(r.monthly)} / mois)`, value: `${money(r.final)}${reach}` }];
      }),
    ];
    const text = [`📈 Mes scénarios d’épargne sur ${formatDuration(params.months)}`, ...lines.map((l) => `• ${l.label} : ${l.value}`), '', 'Calculé avec BudgetVision (sans intérêts)'].join('\n');
    return { lines, text };
  }

  return (
    <section className="screen">
      <div className="screen-head">
        <h1>Scénarios</h1>
      </div>
      <p className="muted">Compare trois rythmes d’épargne mensuelle. Le résultat se met à jour à chaque saisie (sans intérêts).</p>

      <div className="card">
        <div className="field">
          <span className="label">Devise</span>
          <CurrencyToggle value={form.currency} onChange={changeCurrency} />
        </div>
        <div className="grid-2">
          <Field label="Capital initial">{(id) => <MoneyInput id={id} value={form.initial} onChange={set('initial')} currency={form.currency} />}</Field>
          <Field label="Durée (mois)">
            {(id) => <input id={id} type="text" inputMode="numeric" value={form.months} onChange={(e) => set('months')(e.target.value.replace(/\D/g, '').slice(0, 3))} />}
          </Field>
        </div>
        <Field label="Montant visé (facultatif)" hint="Pour savoir quand chaque scénario l’atteint.">
          {(id) => <MoneyInput id={id} value={form.target} onChange={set('target')} currency={form.currency} />}
        </Field>
        {SCENARIOS.map((s) => (
          <Field key={s.id} label={`${s.label} — par mois`}>
            {(id) => (
              <div className="with-dot">
                <i style={{ background: s.color }} />
                <MoneyInput id={id} value={form[s.id]} onChange={set(s.id)} currency={form.currency} />
              </div>
            )}
          </Field>
        ))}
      </div>

      {error ? (
        <Alert tone="danger">{error}</Alert>
      ) : (
        <>
          <div className="card">
            <h2>Évolution du capital</h2>
            <LineChart
              series={results.map((r) => {
                const s = SCENARIOS.find((x) => x.id === r.id)!;
                return { label: s.label, color: s.color, points: r.points };
              })}
              formatY={money}
              xLabel={monthTick}
            />
          </div>
          <div className="list">
            {results.map((r) => {
              const s = SCENARIOS.find((x) => x.id === r.id)!;
              return (
                <div key={r.id} className="card scenario" style={{ borderLeftColor: s.color }}>
                  <div className="card-head">
                    <h3>{s.label}</h3>
                    <span className="muted small">{money(r.monthly)} / mois</span>
                  </div>
                  <div className="big-amount">{money(r.final)}</div>
                  <span className="muted small">
                    dans {formatDuration(params.months)} · ≈ {formatMoney(convert(r.final, params.currency, other, rate), other)}
                  </span>
                  {r.monthsToTarget !== null && (
                    <p className="small">
                      {r.monthsToTarget === 0
                        ? 'Montant visé déjà atteint.'
                        : r.monthsToTarget === Infinity
                          ? 'Sans versement, le montant visé n’est jamais atteint.'
                          : `Montant visé atteint en ${formatDuration(r.monthsToTarget)}.`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="btn-stack">
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={async () => {
                const { lines, text } = summary();
                await saveSimulation('scenarios', `Scénarios sur ${formatDuration(params.months)}`, lines, text);
                toast('Simulation enregistrée dans l’historique');
              }}
            >
              💾 Enregistrer dans l’historique
            </button>
            <button type="button" className="btn btn-whatsapp btn-block" onClick={() => shareOnWhatsApp(summary().text)}>
              Partager sur WhatsApp
            </button>
          </div>
        </>
      )}
    </section>
  );
}
