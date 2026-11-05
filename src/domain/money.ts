// Montants : conversion CDF ⇄ USD, affichage « 1 250 000 CDF » et lecture des saisies.
import type { Currency } from './types';

/** Espace insécable : un montant n'est jamais coupé en fin de ligne. */
const NBSP = ' ';

/** Convertit un montant. `rate` = nombre de CDF pour 1 USD. */
export function convert(amount: number, from: Currency, to: Currency, rate: number): number {
  if (from === to || !Number.isFinite(amount)) return amount;
  if (!(rate > 0)) return amount;
  return from === 'USD' ? amount * rate : amount / rate;
}

/** Groupe les milliers par espaces : 1250000 → « 1 250 000 ». */
function groupThousands(integer: string): string {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/**
 * Formate un nombre à la française : séparateur de milliers « espace », décimales « , ».
 * `decimals` : nombre maximal de décimales (les zéros inutiles sont retirés).
 */
export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '—';
  const negative = value < 0;
  const fixed = Math.abs(value).toFixed(decimals);
  let [integer, fraction = ''] = fixed.split('.');
  fraction = fraction.replace(/0+$/, '');
  const text = groupThousands(integer) + (fraction ? `,${fraction}` : '');
  return negative && Number(fixed) !== 0 ? `-${text}` : text;
}

/** « 1 250 000 CDF » ou « 450,50 USD ». Les CDF sont arrondis à l'unité. */
export function formatMoney(value: number, currency: Currency): string {
  const decimals = currency === 'USD' ? 2 : 0;
  // USD : deux décimales ou aucune (12,5 → 12,50).
  let text = formatNumber(value, decimals);
  if (currency === 'USD' && /,\d$/.test(text)) text += '0';
  return `${text}${NBSP}${currency}`;
}

/**
 * Lit une saisie : « 1 250 000 », « 1250000,5 », « 1.250.000 », « 12.5 ».
 * Renvoie NaN si ce n'est pas un nombre.
 */
export function parseAmount(raw: string): number {
  let text = raw.replace(/[\s  ]/g, '').replace(/(CDF|USD|FC|\$)/gi, '');
  if (!text) return NaN;
  if (text.includes(',')) {
    // La virgule est la décimale : les points sont des séparateurs de milliers.
    text = text.replace(/\./g, '').replace(',', '.');
  } else if ((text.match(/\./g) ?? []).length > 1 || /^\d{1,3}(\.\d{3})+$/.test(text)) {
    // « 1.250.000 » : points de milliers.
    text = text.replace(/\./g, '');
  }
  if (!/^-?\d+(\.\d+)?$/.test(text)) return NaN;
  return Number(text);
}

/** Valeur affichée dans un champ de montant : groupée, sans devise. */
export function formatInput(value: number, currency: Currency): string {
  if (!Number.isFinite(value) || value === 0) return '';
  return formatNumber(value, currency === 'USD' ? 2 : 0);
}

/** Pourcentage arrondi : 0.652 → « 65 % ». */
export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return '—';
  return `${formatNumber(ratio * 100, 0)}${NBSP}%`;
}
