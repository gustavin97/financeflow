/** Contas do painel: agrupamento de gastos, comparação e projeção. */
import { buildCalc, ownerScope, type ScopeTotals } from "./calc";
import type { Block, Carry, Member } from "./types";

/** "block" | "person" | "desc" | "col:<nome da coluna em minúsculas>" */
export type GroupBy = string;

export interface GroupOption {
  value: GroupBy;
  label: string;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Colunas de texto criadas nas tabelas de despesa viram opções de agrupamento. */
export function groupOptions(blockSets: Block[][], members: Member[]): GroupOption[] {
  const opts: GroupOption[] = [
    { value: "block", label: "Tabela" },
    { value: "desc", label: "Descrição" },
  ];
  if (members.length) opts.push({ value: "person", label: "Pessoa" });
  const seen = new Map<string, string>();
  for (const blocks of blockSets)
    for (const b of blocks)
      if (b.kind === "expense")
        for (const c of b.columns)
          if (c.type === "text" && !seen.has(norm(c.name))) seen.set(norm(c.name), c.name.trim());
  for (const [key, name] of seen) opts.push({ value: `col:${key}`, label: `Coluna “${name}”` });
  return opts;
}

/** Soma das despesas por grupo. `who` filtra por dono ("all", "shared" ou id). */
export function spendByGroup(blocks: Block[], members: Member[], groupBy: GroupBy, who: string) {
  const out = new Map<string, { label: string; value: number }>();
  const add = (label: string, v: number) => {
    const key = norm(label) || "—";
    const cur = out.get(key);
    if (cur) cur.value += v;
    else out.set(key, { label: label.trim() || "—", value: v });
  };
  for (const b of blocks) {
    if (b.kind !== "expense") continue;
    const owner = ownerScope(b, members);
    if (who !== "all" && owner !== who) continue;
    if (groupBy === "block") {
      add(b.name, b.entries.reduce((s, e) => s + e.amount, 0));
      continue;
    }
    if (groupBy === "person") {
      const name = owner === "shared" ? "Conjunto" : (members.find((m) => m.id === owner)?.name ?? "Conjunto");
      add(name, b.entries.reduce((s, e) => s + e.amount, 0));
      continue;
    }
    const col = groupBy.startsWith("col:") ? b.columns.find((c) => norm(c.name) === groupBy.slice(4)) : null;
    for (const e of b.entries) {
      if (!e.amount) continue;
      if (groupBy === "desc") add(e.description || "(sem descrição)", e.amount);
      else {
        const v = col ? e.extra[col.id] : null;
        add(typeof v === "string" && v.trim() ? v : `Sem ${groupBy.slice(4)}`, e.amount);
      }
    }
  }
  return out;
}

export interface CompareRow {
  key: string;
  label: string;
  current: number;
  previous: number;
}

/** Junta mês atual e anterior; as maiores categorias primeiro, o resto vira "Outros". */
export function compareGroups(
  cur: Map<string, { label: string; value: number }>,
  prev: Map<string, { label: string; value: number }> | null,
  limit = 8,
): CompareRow[] {
  const keys = new Set([...cur.keys(), ...(prev?.keys() ?? [])]);
  const rows: CompareRow[] = [...keys]
    .map((k) => ({
      key: k,
      label: cur.get(k)?.label ?? prev?.get(k)?.label ?? k,
      current: cur.get(k)?.value ?? 0,
      previous: prev?.get(k)?.value ?? 0,
    }))
    .filter((r) => r.current || r.previous)
    .sort((a, b) => b.current - a.current || b.previous - a.previous);
  if (rows.length <= limit) return rows;
  const head = rows.slice(0, limit - 1);
  const tail = rows.slice(limit - 1);
  head.push({
    key: "__outros",
    label: `Outros (${tail.length})`,
    current: tail.reduce((s, r) => s + r.current, 0),
    previous: tail.reduce((s, r) => s + r.previous, 0),
  });
  return head;
}

export interface MonthPoint extends ScopeTotals {
  ym: string;
}

export function monthSeries(months: { ym: string; blocks: Block[] }[], members: Member[], carry: Carry, who: string) {
  return months.map((m) => {
    const { scopes } = buildCalc(m.blocks, members, carry);
    return { ym: m.ym, ...(scopes.get(who) ?? scopes.get("all")!) } as MonthPoint;
  });
}

export interface Projection {
  basedOn: string[];
  income: number;
  expense: number;
  savings: number;
  /** quanto daria para guardar: receita prevista − despesa prevista */
  canSave: number;
  /** variação média das despesas por mês (ex.: 0.05 = +5%/mês) */
  expenseTrend: number | null;
}

/**
 * Projeção do próximo mês: média ponderada dos últimos 3 meses com dados
 * (o mais recente pesa 3, o anterior 2, o outro 1).
 */
export function project(series: MonthPoint[]): Projection | null {
  const withData = series.filter((p) => p.income + p.expense > 0).slice(-3);
  if (!withData.length) return null;
  const weights = withData.map((_, i) => i + 1);
  const wsum = weights.reduce((a, b) => a + b, 0);
  const avg = (f: (p: MonthPoint) => number) =>
    Math.round(withData.reduce((s, p, i) => s + f(p) * weights[i], 0) / wsum);
  const income = avg((p) => p.income);
  const expense = avg((p) => p.expense);
  const savings = avg((p) => p.savings);
  let expenseTrend: number | null = null;
  if (withData.length >= 2) {
    const first = withData[0].expense;
    const last = withData[withData.length - 1].expense;
    if (first > 0) expenseTrend = Math.pow(last / first, 1 / (withData.length - 1)) - 1;
  }
  return {
    basedOn: withData.map((p) => p.ym),
    income,
    expense,
    savings,
    canSave: income - expense,
    expenseTrend,
  };
}
