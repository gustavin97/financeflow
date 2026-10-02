/**
 * Sinalizadores do mês: avisam quando o dinheiro está chegando no vermelho.
 * Tudo é calculado a partir dos lançamentos; nada fica salvo.
 */
import { refLabel, type MonthCalc } from "./calc";
import { currentYm, todayIso } from "./dates";
import { fmtBRL, fmtPct } from "./money";
import { blockTotals, budgetLimit, cardIds, onCard } from "./summary";
import type { Block, Carry, Member } from "./types";

export type AlertLevel = "danger" | "warning" | "ok";

export interface FinAlert {
  id: string;
  level: AlertLevel;
  title: string;
  detail?: string;
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const dayOf = (iso: string) => Number(iso.slice(8, 10));

export function monthAlerts(input: {
  ym: string;
  blocks: Block[];
  members: Member[];
  carry: Carry;
  calc: MonthCalc;
  /** despesas do mês anterior, para comparar (opcional) */
  prevExpense?: number | null;
  today?: string;
}): FinAlert[] {
  const { ym, blocks, members, carry, calc } = input;
  const today = input.today ?? todayIso();
  const isCurrent = ym === currentYm();
  const isPast = ym < currentYm();
  const out: FinAlert[] = [];
  const all = calc.scopes.get("all")!;
  const spent = all.expense + all.savings;

  /* ---------- saldo previsto do mês ---------- */
  if (all.income <= 0 && spent > 0) {
    out.push({
      id: "no-income",
      level: "danger",
      title: "Nenhuma receita lançada",
      detail: `Já há ${fmtBRL(spent)} em saídas. Lance os salários para ver quanto sobra.`,
    });
  } else if (all.balance < 0) {
    out.push({
      id: "balance",
      level: "danger",
      title: `O mês fecha no vermelho: faltam ${fmtBRL(-all.balance)}`,
      detail: `As saídas (${fmtBRL(spent)}) passam da renda (${fmtBRL(all.income)}) em ${fmtPct(-all.balance / all.income, 1)}. Corte, adie despesas ou guarde menos este mês.`,
    });
  } else if (all.income > 0 && all.balance < all.income * 0.1) {
    out.push({
      id: "balance",
      level: "warning",
      title: `Margem apertada: sobram só ${fmtBRL(all.balance)}`,
      detail: `É ${fmtPct(all.balance / all.income, 1)} da renda. Qualquer imprevisto leva o mês para o vermelho.`,
    });
  }

  const accumulated = carry.planned + all.balance;
  if (accumulated < 0 && carry.planned !== 0) {
    out.push({
      id: "accumulated",
      level: "danger",
      title: `Saldo acumulado negativo: ${fmtBRL(accumulated)}`,
      detail: `Somando os meses anteriores (${fmtBRL(carry.planned)}), a conta não fecha.`,
    });
  }

  /* ---------- fontes de dinheiro que não cobrem as tabelas ---------- */
  const lastBySource = new Map<string, { end: number; name: string }>();
  for (const b of blocks) {
    const r = calc.running.get(b.id);
    if (r) lastBySource.set(r.source, { end: r.end, name: b.name });
  }
  const coveredMembers = new Set<string>();
  for (const [source, last] of lastBySource) {
    // "todas as receitas" já é o alerta de saldo acima
    if (source === "kind:income" || last.end >= 0) continue;
    const m = source.match(/^kind:income:(.+)$/);
    if (m) coveredMembers.add(m[1]);
    out.push({
      id: `source-${source}`,
      level: "danger",
      title: `${refLabel(source, blocks, members)} não cobre as tabelas que saem dela`,
      detail: `Faltam ${fmtBRL(-last.end)} até “${last.name}”. Mude a origem de alguma tabela ou reduza gastos.`,
    });
  }

  /* ---------- cada pessoa ---------- */
  for (const m of members) {
    const s = calc.scopes.get(m.id);
    if (!s || coveredMembers.has(m.id) || s.income + s.expense + s.savings === 0) continue;
    if (s.balance < 0)
      out.push({
        id: `member-${m.id}`,
        level: "danger",
        title: `${m.name} fecha o mês no vermelho (${fmtBRL(s.balance)})`,
        detail: `Receitas ${fmtBRL(s.income)} − despesas ${fmtBRL(s.expense)} − economias ${fmtBRL(s.savings)}.`,
      });
  }

  /* ---------- cartões ---------- */
  for (const [id, c] of calc.cards) {
    const b = blocks.find((x) => x.id === id)!;
    if (c.available !== null && c.available < 0)
      out.push({
        id: `card-${id}`,
        level: "danger",
        title: `Fatura de “${b.name}” passou do limite em ${fmtBRL(-c.available)}`,
        detail: `Limite ${fmtBRL(c.limit!)} · fatura ${fmtBRL(c.bill)}.`,
      });
    else if (c.limit && c.bill >= c.limit * 0.8)
      out.push({
        id: `card-${id}`,
        level: "warning",
        title: `“${b.name}” já usou ${fmtPct(c.bill / c.limit)} do limite`,
        detail: `Disponível ${fmtBRL(c.available!)} de ${fmtBRL(c.limit)}.`,
      });
  }
  const cards = cardIds(blocks);

  /* ---------- limites das tabelas ---------- */
  for (const b of blocks) {
    if (b.kind !== "expense" || b.card || b.budgetType === "none") continue;
    const r = calc.running.get(b.id);
    const limit = budgetLimit(b, r ? calc.resolve(r.source) : all.income);
    if (!limit) continue;
    const total = blockTotals(b).total;
    if (total > limit)
      out.push({
        id: `limit-${b.id}`,
        level: "danger",
        title: `“${b.name}” passou do limite em ${fmtBRL(total - limit)}`,
        detail: `Limite ${fmtBRL(limit)} · lançado ${fmtBRL(total)}.`,
      });
    else if (total >= limit * 0.8)
      out.push({
        id: `limit-${b.id}`,
        level: "warning",
        title: `“${b.name}” já usou ${fmtPct(total / limit)} do limite`,
        detail: `Restam ${fmtBRL(limit - total)} de ${fmtBRL(limit)}.`,
      });
  }

  /* ---------- vencimentos ---------- */
  if (!isPast || isCurrent) {
    const soon = addDays(today, 3);
    const overdue: { d: string; v: number }[] = [];
    const dueSoon: { d: string; v: number }[] = [];
    for (const b of blocks) {
      if (b.kind !== "expense" || b.card) continue;
      for (const e of b.entries) {
        if (e.status !== "pending" || !e.date || e.amount <= 0 || onCard(e, cards)) continue;
        const item = { d: e.description || b.name, v: e.amount };
        if (e.date < today) overdue.push(item);
        else if (e.date <= soon) dueSoon.push(item);
      }
    }
    const list = (xs: { d: string }[]) =>
      xs.slice(0, 3).map((x) => x.d).join(", ") + (xs.length > 3 ? ` e mais ${xs.length - 3}` : "");
    const sum = (xs: { v: number }[]) => xs.reduce((s, x) => s + x.v, 0);
    if (overdue.length)
      out.push({
        id: "overdue",
        level: "danger",
        title: `${overdue.length} ${overdue.length === 1 ? "conta vencida" : "contas vencidas"} (${fmtBRL(sum(overdue))})`,
        detail: `${list(overdue)}. Se já pagou, marque como pago.`,
      });
    if (dueSoon.length)
      out.push({
        id: "due-soon",
        level: "warning",
        title: `${dueSoon.length} ${dueSoon.length === 1 ? "conta vence" : "contas vencem"} nos próximos 3 dias (${fmtBRL(sum(dueSoon))})`,
        detail: list(dueSoon),
      });
  }

  /* ---------- fluxo de caixa: falta dinheiro antes do salário cair? ---------- */
  if (isCurrent && all.balance >= 0) {
    let cash = carry.realized + all.incomeDone - all.expenseDone - all.savingsDone;
    const end = `${ym}-31`;
    const moves: { date: string; v: number }[] = [];
    for (const b of blocks) {
      if (b.kind === "total") continue;
      const card = calc.cards.get(b.id);
      if (card) {
        // fatura ainda não paga: sai do caixa (sem data, o cenário mais prudente é hoje)
        if (card.paid === null && card.bill > 0) moves.push({ date: today, v: -card.bill });
        continue;
      }
      const sign = b.kind === "income" ? 1 : -1;
      for (const e of b.entries)
        if (e.status === "pending" && e.amount && !onCard(e, cards))
          // sem data: receitas no fim do mês, saídas hoje (o cenário mais prudente)
          moves.push({ date: e.date ?? (sign > 0 ? end : today), v: sign * e.amount });
    }
    moves.sort((a, b) => (a.date === b.date ? b.v - a.v : a.date < b.date ? -1 : 1));
    for (const mv of moves) {
      cash += mv.v;
      if (cash < 0) {
        out.push({
          id: "cash",
          level: "warning",
          title: `Pode faltar dinheiro por volta do dia ${dayOf(mv.date < today ? today : mv.date)}`,
          detail: `Há contas vencendo antes das receitas que ainda não caíram (falta ${fmtBRL(-cash)} nesse momento). Confira as datas ou marque o que já recebeu.`,
        });
        break;
      }
    }
  }

  /* ---------- comparação com o mês anterior ---------- */
  if (input.prevExpense && input.prevExpense > 0 && all.expense > input.prevExpense * 1.15) {
    out.push({
      id: "vs-prev",
      level: "warning",
      title: `Despesas ${fmtPct(all.expense / input.prevExpense - 1)} maiores que no mês anterior`,
      detail: `${fmtBRL(all.expense)} agora contra ${fmtBRL(input.prevExpense)}.`,
    });
  }

  for (const id of calc.cyclic) {
    const b = blocks.find((x) => x.id === id);
    if (b)
      out.push({
        id: `cycle-${id}`,
        level: "warning",
        title: `“${b.name}” depende dela mesma`,
        detail: "Uma linha aponta para uma tabela que, por sua vez, aponta de volta. Essa linha conta como zero.",
      });
  }

  if (!out.some((a) => a.level !== "ok") && all.income > 0)
    out.push({
      id: "ok",
      level: "ok",
      title: `Tudo sob controle: sobram ${fmtBRL(all.balance)}`,
      detail: `${fmtPct(all.balance / all.income, 1)} da renda livre no fim do mês.`,
    });

  const rank = { danger: 0, warning: 1, ok: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}
