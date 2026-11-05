// Outils rapides de l'accueil : calculateur d'épargne et convertisseur de devises.
import { useState } from 'react';
import { formatDuration } from '../../domain/dates';
import { quickSavings } from '../../domain/goals';
import { convert, formatMoney } from '../../domain/money';
import type { Currency } from '../../domain/types';
import { Alert, amountOf, CurrencyToggle, Field, MoneyInput, Sheet, toast } from '../components';
import { useMoney } from '../hooks';
import { shareOnWhatsApp } from '../share';
import { saveSimulation } from './HistoryScreen';

/** Calculateur d'épargne : montant visé + durée → effort par mois, semaine et jour. */
export function SavingsCalculatorSheet({ onClose }: { onClose: () => void }) {
  const { currency: displayCurrency } = useMoney();
  const [currency, setCurrency] = useState<Currency>(displayCurrency);
  const [target, setTarget] = useState('');
  const [initial, setInitial] = useState('');
  const [months, setMonths] = useState('6');

  const t = amountOf(target);
  const i = amountOf(initial);
  const m = Number(months);
  let error = '';
  if (target.trim() && !(t > 0)) error = 'Saisis un montant visé supérieur à 0.';
  else if (Number.isNaN(i) || i < 0) error = 'Le montant déjà épargné est invalide.';
  else if (months.trim() && !(m >= 1 && m <= 600)) error = 'La durée doit être comprise entre 1 et 600 mois.';
  const ready = !error && t > 0 && m >= 1;
  const result = ready ? quickSavings(t, m, i) : null;
  const money = (v: number) => formatMoney(v, currency);

  function summary() {
    const r = result!;
    const lines = [
      { label: 'Montant visé', value: money(t) },
      ...(i > 0 ? [{ label: 'Déjà épargné', value: money(i) }] : []),
      { label: 'Durée', value: formatDuration(m) },
      { label: 'Épargne mensuelle', value: money(r.perMonth) },
      { label: 'Épargne hebdomadaire', value: money(r.perWeek) },
      { label: 'Épargne quotidienne', value: money(r.perDay) },
    ];
    const text = [`🧮 Épargner ${money(t)} en ${formatDuration(m)}`, ...lines.slice(1).map((l) => `• ${l.label} : ${l.value}`), '', 'Calculé avec BudgetVision'].join('\n');
    return { lines, text };
  }

  return (
    <Sheet title="Calculateur d’épargne" onClose={onClose}>
      <div className="field">
        <span className="label">Devise</span>
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>
      <Field label="Montant à réunir">{(id) => <MoneyInput id={id} value={target} onChange={setTarget} currency={currency} placeholder="Ex. 1 000 000" />}</Field>
      <div className="grid-2">
        <Field label="Durée (mois)">
          {(id) => <input id={id} type="text" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value.replace(/\D/g, '').slice(0, 3))} />}
        </Field>
        <Field label="Déjà épargné">{(id) => <MoneyInput id={id} value={initial} onChange={setInitial} currency={currency} />}</Field>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {result && (
        <div className="calc-result">
          <div className="calc-row main">
            <span>Par mois</span>
            <strong>{money(result.perMonth)}</strong>
          </div>
          <div className="calc-row">
            <span>Par semaine</span>
            <strong>{money(result.perWeek)}</strong>
          </div>
          <div className="calc-row">
            <span>Par jour</span>
            <strong>{money(result.perDay)}</strong>
          </div>
          <div className="btn-stack">
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={async () => {
                const { lines, text } = summary();
                await saveSimulation('calcul', `Épargne pour ${money(t)}`, lines, text);
                toast('Calcul enregistré dans l’historique');
                onClose();
              }}
            >
              💾 Enregistrer dans l’historique
            </button>
            <button type="button" className="btn btn-whatsapp btn-block" onClick={() => shareOnWhatsApp(summary().text)}>
              Partager sur WhatsApp
            </button>
          </div>
        </div>
      )}
      {!result && !error && <p className="muted small">Indique un montant et une durée : le résultat s’affiche aussitôt.</p>}
    </Sheet>
  );
}

/** Convertisseur CDF ⇄ USD avec le taux défini dans les réglages. */
export function CurrencyConverterSheet({ onClose, onEditRate }: { onClose: () => void; onEditRate: () => void }) {
  const { rate } = useMoney();
  const [from, setFrom] = useState<Currency>('USD');
  const [amount, setAmount] = useState('100');
  const to: Currency = from === 'USD' ? 'CDF' : 'USD';
  const value = amountOf(amount);
  return (
    <Sheet title="Convertisseur de devises" onClose={onClose}>
      <div className="field">
        <span className="label">Je convertis des</span>
        <CurrencyToggle value={from} onChange={setFrom} />
      </div>
      <Field label="Montant">{(id) => <MoneyInput id={id} value={amount} onChange={setAmount} currency={from} />}</Field>
      <div className="convert-result" aria-live="polite">
        {Number.isFinite(value) && value > 0 ? (
          <>
            <span className="muted small">{formatMoney(value, from)} =</span>
            <strong>{formatMoney(convert(value, from, to, rate), to)}</strong>
          </>
        ) : (
          <span className="muted">Saisis un montant.</span>
        )}
      </div>
      <p className="muted small center">Taux utilisé : 1 USD = {formatMoney(rate, 'CDF')}</p>
      <button type="button" className="btn btn-secondary btn-block" onClick={onEditRate}>
        Modifier le taux de change
      </button>
    </Sheet>
  );
}
