export const MONTHS_LONG = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
export const MONTHS_SHORT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export const YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isYm(s: unknown): s is string {
  return typeof s === "string" && YM_RE.test(s);
}

export function currentYm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function splitYm(ym: string): { year: number; month: number } {
  const [y, m] = ym.split("-").map(Number);
  return { year: y, month: m };
}

export function addMonths(ym: string, n: number): string {
  const { year, month } = splitYm(ym);
  const idx = year * 12 + (month - 1) + n;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function diffMonths(a: string, b: string): number {
  const A = splitYm(a);
  const B = splitYm(b);
  return (B.year - A.year) * 12 + (B.month - A.month);
}

export function ymLabel(ym: string): string {
  const { year, month } = splitYm(ym);
  return `${MONTHS_LONG[month - 1]} de ${year}`;
}

export function ymShort(ym: string): string {
  const { year, month } = splitYm(ym);
  return `${MONTHS_SHORT[month - 1]}/${String(year).slice(2)}`;
}

export function daysInMonth(ym: string): number {
  const { year, month } = splitYm(ym);
  return new Date(year, month, 0).getDate();
}

export function monthRange(ym: string): { min: string; max: string } {
  return { min: `${ym}-01`, max: `${ym}-${String(daysInMonth(ym)).padStart(2, "0")}` };
}

/** Leva uma data (YYYY-MM-DD) para outro mês mantendo o dia (limitado ao último dia). */
export function shiftDateToMonth(date: string | null, ym: string): string | null {
  if (!date) return null;
  const day = Number(date.slice(8, 10));
  if (!day) return null;
  const d = Math.min(day, daysInMonth(ym));
  return `${ym}-${String(d).padStart(2, "0")}`;
}
