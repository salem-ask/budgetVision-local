// Composants communs : champs, montants, graphiques (SVG, sans bibliothèque), fenêtres.
import { useEffect, useId, useState, type ReactNode } from 'react';
import { formatInput, parseAmount } from '../domain/money';
import type { Currency } from '../domain/types';

// --- Champs ---

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Champ de montant : clavier numérique, séparateur de milliers ajouté en quittant le champ.
 * La valeur reste une chaîne ; on la lit avec `parseAmount` au moment d'enregistrer.
 */
export function MoneyInput({
  id,
  value,
  onChange,
  currency,
  placeholder = '0',
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  currency: Currency;
  placeholder?: string;
}) {
  return (
    <div className="money-input">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          const amount = parseAmount(value);
          if (Number.isFinite(amount)) onChange(formatInput(amount, currency));
        }}
      />
      <span className="money-suffix">{currency}</span>
    </div>
  );
}

/** Montant saisi → nombre (champ vide = 0, saisie invalide = NaN). */
export function amountOf(value: string): number {
  return value.trim() === '' ? 0 : parseAmount(value);
}

export function CurrencyToggle({ value, onChange, label = 'Devise' }: { value: Currency; onChange: (c: Currency) => void; label?: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {(['CDF', 'USD'] as Currency[]).map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} className={value === c ? 'active' : ''} onClick={() => onChange(c)}>
          {c}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={value === o.id ? 'active' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// --- Affichage ---

export function ProgressBar({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'warning' | 'danger' | 'success' }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className={`progress tone-${tone}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <strong className={`stat-value${tone ? ` ${tone}` : ''}`}>{value}</strong>
    </div>
  );
}

export function Alert({ tone, children }: { tone: 'info' | 'success' | 'warning' | 'danger'; children: ReactNode }) {
  return <div className={`alert alert-${tone}`}>{children}</div>;
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden>
        {icon}
      </div>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

/** Camembert (anneau) : une part par catégorie. */
export function Donut({ parts, center }: { parts: { label: string; value: number; color: string }[]; center?: ReactNode }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const radius = 15.915; // circonférence = 100 : les longueurs sont des pourcentages.
  let offset = 25; // Départ en haut.
  return (
    <div className="donut">
      <svg viewBox="0 0 42 42" role="img" aria-label="Répartition des dépenses par catégorie">
        <circle cx="21" cy="21" r={radius} fill="none" stroke="var(--line)" strokeWidth="6" />
        {total > 0 &&
          parts.map((p) => {
            const length = (p.value / total) * 100;
            const segment = (
              <circle
                key={p.label}
                cx="21"
                cy="21"
                r={radius}
                fill="none"
                stroke={p.color}
                strokeWidth="6"
                strokeDasharray={`${length} ${100 - length}`}
                strokeDashoffset={offset}
              />
            );
            offset -= length;
            return segment;
          })}
      </svg>
      {center && <div className="donut-center">{center}</div>}
    </div>
  );
}

/** Graphique en courbes : une ligne par série, axe des mois en bas. */
export function LineChart({
  series,
  formatY,
  xLabel,
}: {
  series: { label: string; color: string; points: number[] }[];
  formatY: (value: number) => string;
  xLabel: (index: number) => string;
}) {
  const W = 320;
  const H = 180;
  const pad = { left: 8, right: 8, top: 12, bottom: 22 };
  const count = Math.max(...series.map((s) => s.points.length), 2);
  const max = Math.max(1, ...series.flatMap((s) => s.points));
  const x = (i: number) => pad.left + (i / (count - 1)) * (W - pad.left - pad.right);
  const y = (v: number) => pad.top + (1 - v / max) * (H - pad.top - pad.bottom);
  const ticks = [0, Math.floor((count - 1) / 2), count - 1];
  return (
    <figure className="chart">
      <div className="chart-max">{formatY(max)}</div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Évolution du capital selon les scénarios" preserveAspectRatio="none">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad.left} x2={W - pad.right} y1={y(max * f)} y2={y(max * f)} stroke="var(--line)" strokeWidth="1" />
        ))}
        <line x1={pad.left} x2={W - pad.right} y1={y(0)} y2={y(0)} stroke="var(--line-strong)" strokeWidth="1" />
        {series.map((s) => (
          <polyline
            key={s.label}
            fill="none"
            stroke={s.color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            points={s.points.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
          />
        ))}
      </svg>
      <div className="chart-x">
        {ticks.map((t) => (
          <span key={t}>{xLabel(t)}</span>
        ))}
      </div>
      <figcaption className="legend">
        {series.map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

// --- Fenêtres ---

/** Panneau qui monte du bas de l'écran (formulaires). */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Fermer" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/**
 * Confirmation dans la page (remplace `confirm()`, bloqué dans certains cadres et peu lisible sur mobile).
 * Renvoie vrai si l'utilisateur confirme.
 */
interface ConfirmRequest {
  message: string;
  confirmLabel: string;
  resolve: (ok: boolean) => void;
}
let askImpl: ((request: ConfirmRequest) => void) | null = null;
export function askConfirm(message: string, confirmLabel = 'Supprimer'): Promise<boolean> {
  return new Promise((resolve) => (askImpl ? askImpl({ message, confirmLabel, resolve }) : resolve(window.confirm(message))));
}
export function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  useEffect(() => {
    askImpl = setRequest;
    return () => {
      askImpl = null;
    };
  }, []);
  if (!request) return null;
  const close = (ok: boolean) => {
    request.resolve(ok);
    setRequest(null);
  };
  return (
    <div className="confirm-backdrop" onClick={() => close(false)}>
      <div className="confirm" role="alertdialog" aria-modal="true" aria-label="Confirmation" onClick={(e) => e.stopPropagation()}>
        <p>{request.message}</p>
        <div className="btn-row">
          <button type="button" className="btn btn-secondary" onClick={() => close(false)} autoFocus>
            Annuler
          </button>
          <button type="button" className="btn btn-danger-solid" onClick={() => close(true)}>
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Message bref en bas de l'écran. */
let showToastImpl: (text: string) => void = () => {};
export function toast(text: string) {
  showToastImpl(text);
}
export function ToastHost() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    showToastImpl = (next) => {
      setText(next);
      clearTimeout(timer);
      timer = setTimeout(() => setText(null), 2600);
    };
    return () => clearTimeout(timer);
  }, []);
  return text ? (
    <div className="toast" role="status">
      {text}
    </div>
  ) : null;
}
