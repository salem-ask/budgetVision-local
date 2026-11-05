// Budget du mois : revenus, dépenses par catégorie, solde, taux d'épargne, camembert et règle 50/30/20.
import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { db, newId } from '../../data/db';
import { list, remove, save } from '../../data/store';
import { applyRule, CATEGORY_COLORS, summarizeBudget, type BudgetSummary, type RuleLine } from '../../domain/budget';
import { currentMonth, daysBetween, daysInMonth, formatMonth, shiftMonth, todayIso } from '../../domain/dates';
import { formatInput, formatMoney, formatPercent } from '../../domain/money';
import { BUCKET_LABELS, type Bucket, type Category, type Currency, type Entry } from '../../domain/types';
import { Alert, amountOf, askConfirm, CurrencyToggle, Donut, Empty, Field, MoneyInput, ProgressBar, Segmented, Sheet, Stat, toast } from '../components';
import { useMoney } from '../hooks';
import { shareOnWhatsApp } from '../share';
import { saveSimulation } from './HistoryScreen';

/** Jours restants dans le mois, aujourd'hui compris (0 pour un mois passé, tout le mois s'il est à venir). */
function daysLeftIn(month: string): number {
  const today = todayIso();
  const thisMonth = today.slice(0, 7);
  if (month < thisMonth) return 0;
  if (month > thisMonth) return daysInMonth(month);
  return daysBetween(today, `${month}-${String(daysInMonth(month)).padStart(2, '0')}`) + 1;
}

function budgetText(month: string, s: BudgetSummary, rule: RuleLine[], currency: Currency) {
  const m = (v: number) => formatMoney(v, currency);
  const lines = [
    { label: 'Mois', value: formatMonth(month) },
    { label: 'Revenus', value: m(s.income) },
    { label: 'Dépenses', value: m(s.expenses) },
    { label: 'Solde disponible', value: m(s.balance) },
    { label: 'Taux d’épargne', value: formatPercent(s.savingsRate) },
    ...s.byCategory.map((t) => ({ label: `Dépenses — ${t.category.name}`, value: `${m(t.amount)} (${formatPercent(t.share)})` })),
    ...(s.income > 0 ? rule.map((r) => ({ label: `50/30/20 — ${BUCKET_LABELS[r.bucket]}`, value: r.message })) : []),
  ];
  const text = [`📊 Mon budget de ${formatMonth(month)}`, ...lines.slice(1).map((l) => `• ${l.label} : ${l.value}`), '', 'Calculé avec BudgetVision'].join('\n');
  return { lines, text };
}

export function BudgetScreen() {
  const [month, setMonth] = useState(currentMonth());
  const entries = list(useLiveQuery(() => db.entries.where('month').equals(month).toArray(), [month]));
  const categories = list(useLiveQuery(() => db.categories.toArray(), []));
  const { fmt, currency, rate } = useMoney();
  const [form, setForm] = useState<{ kind: Entry['kind']; entry?: Entry } | null>(null);
  const [showRule, setShowRule] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  const summary = summarizeBudget(entries, categories, currency, rate, daysLeftIn(month));
  const rule = applyRule(summary);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const incomes = entries.filter((e) => e.kind === 'income').sort((a, b) => b.createdAt - a.createdAt);
  const expenses = entries.filter((e) => e.kind === 'expense').sort((a, b) => b.createdAt - a.createdAt);
  const spentShare = summary.income > 0 ? summary.expenses / summary.income : 0;

  return (
    <section className="screen">
      <div className="screen-head">
        <h1>Budget</h1>
      </div>
      <div className="month-picker">
        <button type="button" className="icon-btn" aria-label="Mois précédent" onClick={() => setMonth(shiftMonth(month, -1))}>
          ‹
        </button>
        <strong>{formatMonth(month)}</strong>
        <button type="button" className="icon-btn" aria-label="Mois suivant" onClick={() => setMonth(shiftMonth(month, 1))}>
          ›
        </button>
      </div>

      <div className="card hero">
        <span className="muted small">Solde disponible</span>
        <div className={`big-amount ${summary.balance < 0 ? 'negative' : ''}`}>{fmt(summary.balance)}</div>
        <ProgressBar value={spentShare} tone={spentShare > 1 ? 'danger' : spentShare > 0.9 ? 'warning' : 'brand'} />
        <div className="progress-legend">
          <span>{summary.income > 0 ? `${formatPercent(spentShare)} du revenu dépensé` : 'Ajoute tes revenus du mois'}</span>
        </div>
        {summary.balance < 0 && <Alert tone="danger">Tu dépenses plus que tu ne gagnes ce mois-ci.</Alert>}
      </div>

      <div className="stats-grid">
        <Stat label="Revenus" value={fmt(summary.income)} tone="positive" />
        <Stat label="Dépenses" value={fmt(summary.expenses)} tone="negative" />
        <Stat label="Reste par jour" value={summary.perDayLeft === null ? '—' : fmt(summary.perDayLeft)} />
        <Stat label="Taux d’épargne" value={formatPercent(summary.savingsRate)} />
      </div>

      <div className="btn-row">
        <button type="button" className="btn btn-success" onClick={() => setForm({ kind: 'income' })}>
          + Revenu
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setForm({ kind: 'expense' })}>
          + Dépense
        </button>
      </div>

      <button type="button" className="btn btn-accent btn-block" onClick={() => setShowRule(true)} disabled={summary.income <= 0}>
        ⚖️ Règle 50/30/20
      </button>
      {summary.income <= 0 && <p className="muted small center">La règle 50/30/20 s’active dès qu’un revenu est saisi.</p>}

      {summary.byCategory.length > 0 && (
        <div className="card">
          <h2>Dépenses par catégorie</h2>
          <div className="donut-wrap">
            <Donut
              parts={summary.byCategory.map((t) => ({ label: t.category.name, value: t.amount, color: t.category.color }))}
              center={
                <>
                  <span className="muted small">Total</span>
                  <strong>{fmt(summary.expenses)}</strong>
                </>
              }
            />
            <ul className="legend-list">
              {summary.byCategory.map((t) => (
                <li key={t.category.id}>
                  <i style={{ background: t.category.color }} />
                  <span className="grow">{t.category.name}</span>
                  <span className="muted">{formatPercent(t.share)}</span>
                  <strong>{fmt(t.amount)}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <EntryList title="Revenus" entries={incomes} fmt={fmt} categoryById={categoryById} onEdit={(entry) => setForm({ kind: 'income', entry })} />
      <EntryList title="Dépenses" entries={expenses} fmt={fmt} categoryById={categoryById} onEdit={(entry) => setForm({ kind: 'expense', entry })} />
      {entries.length === 0 && (
        <Empty icon="📒" title="Rien pour ce mois">
          <p>Commence par ton revenu (salaire, commerce…), puis ajoute tes dépenses : nourriture, transport, loyer…</p>
        </Empty>
      )}

      <div className="btn-stack">
        <button type="button" className="btn btn-secondary btn-block" onClick={() => setShowCategories(true)}>
          🏷 Gérer les catégories
        </button>
        {entries.length > 0 && (
          <>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={async () => {
                const { lines, text } = budgetText(month, summary, rule, currency);
                await saveSimulation('budget', `Budget de ${formatMonth(month)}`, lines, text);
                toast('Budget enregistré dans l’historique');
              }}
            >
              💾 Enregistrer dans l’historique
            </button>
            <button type="button" className="btn btn-whatsapp btn-block" onClick={() => shareOnWhatsApp(budgetText(month, summary, rule, currency).text)}>
              Partager sur WhatsApp
            </button>
          </>
        )}
      </div>

      {form && <EntryForm kind={form.kind} entry={form.entry} month={month} categories={categories} onClose={() => setForm(null)} />}
      {showRule && <RuleSheet rule={rule} income={summary.income} fmt={fmt} onClose={() => setShowRule(false)} />}
      {showCategories && <CategoriesSheet categories={categories} onClose={() => setShowCategories(false)} />}
    </section>
  );
}

function EntryList({
  title,
  entries,
  fmt,
  categoryById,
  onEdit,
}: {
  title: string;
  entries: Entry[];
  fmt: (amount: number, from?: Currency) => string;
  categoryById: Map<string, Category>;
  onEdit: (entry: Entry) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="card">
      <h2>{title}</h2>
      <ul className="rows">
        {entries.map((e) => {
          const category = categoryById.get(e.categoryId);
          return (
            <li key={e.id}>
              <button type="button" className="row row-btn" onClick={() => onEdit(e)}>
                {e.kind === 'expense' && <i className="swatch" style={{ background: category?.color ?? '#64748b' }} />}
                <div className="grow">
                  <strong>{e.label || (e.kind === 'income' ? 'Revenu' : (category?.name ?? 'Autres'))}</strong>
                  {e.kind === 'expense' && e.label && <span className="muted small">{category?.name ?? 'Autres'}</span>}
                </div>
                <span className={e.kind === 'income' ? 'positive' : ''}>{fmt(e.amount, e.currency)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EntryForm({ kind, entry, month, categories, onClose }: { kind: Entry['kind']; entry?: Entry; month: string; categories: Category[]; onClose: () => void }) {
  const { currency: displayCurrency } = useMoney();
  const [currency, setCurrency] = useState<Currency>(entry?.currency ?? displayCurrency);
  const [amount, setAmount] = useState(entry ? formatInput(entry.amount, entry.currency) : '');
  const [label, setLabel] = useState(entry?.label ?? '');
  const [categoryId, setCategoryId] = useState(entry?.categoryId ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const sortedCategories = [...categories].sort((a, b) => Number(Boolean(b.builtin)) - Number(Boolean(a.builtin)));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = amountOf(amount);
    const found: Record<string, string> = {};
    if (!(value > 0)) found.amount = Number.isNaN(value) ? 'Montant invalide : utilise seulement des chiffres.' : 'Saisis un montant supérieur à 0.';
    if (kind === 'expense' && !categoryId) found.categoryId = 'Choisis une catégorie.';
    setErrors(found);
    if (Object.keys(found).length) return;
    await save<Entry>('entry', {
      id: entry?.id ?? newId(),
      createdAt: entry?.createdAt ?? Date.now(),
      kind,
      amount: value,
      currency,
      categoryId: kind === 'expense' ? categoryId : '',
      label: label.trim().slice(0, 60),
      month: entry?.month ?? month,
    });
    toast(entry ? 'Modifié' : kind === 'income' ? 'Revenu ajouté' : 'Dépense ajoutée');
    onClose();
  }

  return (
    <Sheet title={`${entry ? 'Modifier' : 'Ajouter'} ${kind === 'income' ? 'un revenu' : 'une dépense'}`} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <span className="label">Devise</span>
          <CurrencyToggle value={currency} onChange={setCurrency} />
        </div>
        <Field label="Montant" error={errors.amount}>
          {(id) => <MoneyInput id={id} value={amount} onChange={setAmount} currency={currency} />}
        </Field>
        {kind === 'expense' && (
          <div className={`field${errors.categoryId ? ' has-error' : ''}`}>
            <span className="label">Catégorie</span>
            <div className="chips">
              {sortedCategories.map((c) => (
                <button key={c.id} type="button" className={`chip-btn${categoryId === c.id ? ' active' : ''}`} onClick={() => setCategoryId(c.id)} aria-pressed={categoryId === c.id}>
                  <i style={{ background: c.color }} />
                  {c.name}
                </button>
              ))}
            </div>
            {errors.categoryId && <p className="field-error">{errors.categoryId}</p>}
          </div>
        )}
        <Field label="Libellé (facultatif)">
          {(id) => <input id={id} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder={kind === 'income' ? 'Ex. salaire, vente…' : 'Ex. marché, taxi…'} />}
        </Field>
        <button type="submit" className="btn btn-primary btn-block">
          Enregistrer
        </button>
        {entry && (
          <button
            type="button"
            className="btn btn-danger btn-block"
            onClick={async () => {
              if (await askConfirm('Supprimer cette ligne ?')) {
                await remove('entry', entry.id);
                toast('Supprimé');
                onClose();
              }
            }}
          >
            Supprimer
          </button>
        )}
      </form>
    </Sheet>
  );
}

function RuleSheet({ rule, income, fmt, onClose }: { rule: RuleLine[]; income: number; fmt: (amount: number) => string; onClose: () => void }) {
  const tones: Record<RuleLine['verdict'], 'success' | 'warning' | 'info'> = { ok: 'success', over: 'warning', under: 'info' };
  return (
    <Sheet title="Règle 50/30/20" onClose={onClose}>
      <p className="muted">
        Sur un revenu de <strong>{fmt(income)}</strong> : 50 % pour les besoins, 30 % pour les envies, 20 % pour l’épargne.
      </p>
      {rule.map((r) => {
        // Pour l'épargne, dépasser la cible est une bonne nouvelle.
        const tone = r.bucket === 'epargne' && r.verdict === 'over' ? 'success' : r.bucket !== 'epargne' && r.verdict === 'under' ? 'success' : r.bucket === 'epargne' && r.verdict === 'under' ? 'warning' : tones[r.verdict];
        return (
          <div key={r.bucket} className="card rule">
            <div className="card-head">
              <h3>
                {BUCKET_LABELS[r.bucket]} <span className="muted">· {formatPercent(r.target)}</span>
              </h3>
              <strong>{formatPercent(r.share)}</strong>
            </div>
            <div className="rule-bars">
              <div>
                <span className="muted small">Conseillé</span>
                <ProgressBar value={r.target} tone="success" />
                <span className="small">{fmt(r.advised)}</span>
              </div>
              <div>
                <span className="muted small">Réel</span>
                <ProgressBar value={r.share} tone={tone === 'warning' ? 'warning' : 'brand'} />
                <span className="small">{fmt(r.actual)}</span>
              </div>
            </div>
            <Alert tone={tone}>{r.message}</Alert>
          </div>
        );
      })}
      <p className="muted small">
        L’épargne réelle compte les dépenses de la catégorie « Épargne » et l’argent non dépensé. Chaque catégorie est classée en besoin, envie ou épargne (modifiable dans « Gérer les catégories »).
      </p>
    </Sheet>
  );
}

function CategoriesSheet({ categories, onClose }: { categories: Category[]; onClose: () => void }) {
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const sorted = [...categories].sort((a, b) => Number(Boolean(b.builtin)) - Number(Boolean(a.builtin)) || a.name.localeCompare(b.name, 'fr'));
  if (editing) return <CategoryForm category={editing === 'new' ? undefined : editing} categories={categories} onClose={() => setEditing(null)} />;
  return (
    <Sheet title="Catégories" onClose={onClose}>
      <ul className="rows">
        {sorted.map((c) => (
          <li key={c.id}>
            <button type="button" className="row row-btn" onClick={() => setEditing(c)}>
              <i className="swatch" style={{ background: c.color }} />
              <strong className="grow">{c.name}</strong>
              <span className="muted small">{BUCKET_LABELS[c.bucket]}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-primary btn-block" onClick={() => setEditing('new')}>
        + Nouvelle catégorie
      </button>
    </Sheet>
  );
}

function CategoryForm({ category, categories, onClose }: { category?: Category; categories: Category[]; onClose: () => void }) {
  const [name, setName] = useState(category?.name ?? '');
  const [bucket, setBucket] = useState<Bucket>(category?.bucket ?? 'envie');
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length]);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return setError('Donne un nom à la catégorie.');
    if (categories.some((c) => c.id !== category?.id && c.name.toLocaleLowerCase('fr') === clean.toLocaleLowerCase('fr'))) {
      return setError('Une catégorie porte déjà ce nom.');
    }
    await save<Category>('category', { id: category?.id ?? newId(), name: clean.slice(0, 30), bucket, color, ...(category?.builtin ? { builtin: true } : {}) });
    toast('Catégorie enregistrée');
    onClose();
  }

  return (
    <Sheet title={category ? 'Modifier la catégorie' : 'Nouvelle catégorie'} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <Field label="Nom" error={error}>
          {(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="Ex. Scolarité, Téléphone…" />}
        </Field>
        <div className="field">
          <span className="label">Groupe (règle 50/30/20)</span>
          <Segmented label="Groupe" value={bucket} onChange={setBucket} options={(Object.keys(BUCKET_LABELS) as Bucket[]).map((b) => ({ id: b, label: BUCKET_LABELS[b] }))} />
        </div>
        <div className="field">
          <span className="label">Couleur</span>
          <div className="colors">
            {[...new Set([color, ...CATEGORY_COLORS])].map((c) => (
              <button key={c} type="button" className={`color${c === color ? ' active' : ''}`} style={{ background: c }} aria-label={`Couleur ${c}`} aria-pressed={c === color} onClick={() => setColor(c)} />
            ))}
          </div>
        </div>
        <button type="submit" className="btn btn-primary btn-block">
          Enregistrer
        </button>
        {category && !category.builtin && (
          <button
            type="button"
            className="btn btn-danger btn-block"
            onClick={async () => {
              if (await askConfirm(`Supprimer la catégorie « ${category.name} » ? Ses dépenses passeront dans « Autres ».`)) {
                await remove('category', category.id);
                toast('Catégorie supprimée');
                onClose();
              }
            }}
          >
            Supprimer
          </button>
        )}
      </form>
    </Sheet>
  );
}
