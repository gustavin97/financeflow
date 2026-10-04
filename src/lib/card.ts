/**
 * Fechamento e vencimento do cartão de crédito.
 *
 * A tabela do cartão de um mês é a fatura que VENCE naquele mês. Com fechamento
 * no dia 3 e vencimento no dia 10, a fatura de outubro fecha em 3/out e tem as
 * compras de 4/set a 3/out. Com fechamento no dia 25 e vencimento no dia 5, a
 * fatura de outubro fecha em 25/set (compras de 26/ago a 25/set).
 */
import { addMonths, daysInMonth } from "./dates";

const pad = (n: number) => String(n).padStart(2, "0");
/** dia do mês limitado ao último dia (fechamento no dia 31 em fevereiro = dia 28/29) */
const dayIn = (ym: string, day: number) => `${ym}-${pad(Math.min(day, daysInMonth(ym)))}`;

/** Mês em que a fatura fecha, sabendo o mês em que ela vence. */
const closeYmOf = (dueYm: string, close: number, due: number) => (due > close ? dueYm : addMonths(dueYm, -1));

/** Mês da fatura (mês do vencimento) de uma compra feita em `date`. */
export function faturaYm(date: string, close: number, due: number): string {
  const ym = date.slice(0, 7);
  const closesIn = date <= dayIn(ym, close) ? ym : addMonths(ym, 1);
  return due > close ? closesIn : addMonths(closesIn, 1);
}

/** Período de compras, fechamento e vencimento da fatura que vence em `ym`. */
export function faturaDates(ym: string, close: number, due: number) {
  const closeYm = closeYmOf(ym, close, due);
  const prevClose = dayIn(addMonths(closeYm, -1), close);
  const d = new Date(`${prevClose}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return {
    /** primeira compra que entra nesta fatura */
    start: d.toISOString().slice(0, 10),
    /** dia do fechamento (última compra que entra) */
    close: dayIn(closeYm, close),
    due: dayIn(ym, due),
  };
}

/** Cartão com os dois dias configurados. */
export const hasCycle = (b: { card: boolean; cardClose: number | null; cardDue: number | null }) =>
  b.card && !!b.cardClose && !!b.cardDue;
