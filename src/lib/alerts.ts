/**
 * Sinalizadores do mês: avisam quando o dinheiro está chegando no vermelho.
 * Tudo é calculado a partir dos lançamentos; nada fica salvo.
 *
 * Cada aviso é de alguém (scope): de uma pessoa ou do conjunto. A saúde de cada
 * pessoa é avaliada separada, com a parte dela nas contas do conjunto. O que é
 * da casa inteira (meses anteriores, caixa, comparação) fica no conjunto.
 */
import { ownerScope, refLabel, type MonthCalc } from "./calc";
import { faturaDates, hasCycle } from "./card";
import { addMonths as addMonthsYm, currentYm, todayIso } from "./dates";
import { fmtBRL, fmtPct } from "./money";
import { blockTotals, budgetLimit, cardIds, onCard } from "./summary";
import type { Block, Carry, Member } from "./types";

export type AlertLevel = "danger" | "warning" | "ok";

export interface FinAlert {
  id: string;
  /** de quem é o aviso: id da pessoa ou "shared" (conjunto / casa inteira) */
  scope: string;
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

export const ALERT_RANK = { danger: 0, warning: 1, ok: 2 } as const;

/** Pior nível entre os avisos (null = nenhum aviso). */
export function worstLevel(alerts: FinAlert[]): AlertLevel | null {
  return alerts.reduce<AlertLevel | null>(
    (w, a) => (w === null || ALERT_RANK[a.level] < ALERT_RANK[w] ? a.level : w),
    null,
  );
}

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
  // sem pessoas cadastradas, tudo é do conjunto
  const scopeOf = (b: Block) => ownerScope(b, members);

  /* ---------- saldo previsto do mês: de cada pessoa ---------- */
  // cada pessoa paga a parte dela no conjunto, na proporção da renda
  const shared = calc.scopes.get("shared")!;
  const sharedOut = shared.expense + shared.savings - shared.income;
  const peopleIncome = members.reduce((t, m) => t + (calc.scopes.get(m.id)?.income ?? 0), 0);
  const health = members.length
    ? members.map((m) => {
        const ms = calc.scopes.get(m.id)!;
        const ratio = peopleIncome > 0 ? ms.income / peopleIncome : 1 / members.length;
        return {
          scope: m.id,
          who: m.name,
          income: ms.income,
          out: ms.expense + ms.savings,
          part: sharedOut > 0 ? Math.round(sharedOut * ratio) : 0,
        };
      })
    : [{ scope: "shared", who: "", income: all.income, out: all.expense + all.savings, part: 0 }];

  for (const h of health) {
    const spent = h.out + h.part;
    const balance = h.income - spent;
    const of = h.who ? ` de ${h.who}` : "";
    const partNote = h.part ? ` (inclui ${fmtBRL(h.part)} da parte no conjunto)` : "";
    if (spent === 0 && h.income === 0) continue;
    if (h.income <= 0)
      out.push({
        id: `no-income-${h.scope}`,
        scope: h.scope,
        level: "danger",
        title: `Nenhuma receita${of} lançada`,
        detail: `Já há ${fmtBRL(spent)} em saídas${partNote}. Lance as receitas para ver quanto sobra.`,
      });
    else if (balance < 0)
      out.push({
        id: `balance-${h.scope}`,
        scope: h.scope,
        level: "danger",
        title: `O mês${of} fecha no vermelho: faltam ${fmtBRL(-balance)}`,
        detail: `As saídas (${fmtBRL(spent)})${partNote} passam da renda (${fmtBRL(h.income)}) em ${fmtPct(-balance / h.income, 1)}. Corte, adie despesas ou guarde menos este mês.`,
      });
    else if (balance < h.income * 0.1)
      out.push({
        id: `balance-${h.scope}`,
        scope: h.scope,
        level: "warning",
        title: `Margem apertada${of}: sobram só ${fmtBRL(balance)}`,
        detail: `É ${fmtPct(balance / h.income, 1)} da renda${partNote}. Qualquer imprevisto leva o mês para o vermelho.`,
      });
  }

  /* ---------- saldo do conjunto ---------- */
  if (members.length) {
    const partsTotal = health.reduce((t, h) => t + h.part, 0);
    // conjunto com receitas próprias que não cobrem as contas dele
    if (shared.income > 0 && shared.balance < 0)
      out.push({
        id: "balance-shared",
        scope: "shared",
        level: "danger",
        title: `O conjunto fecha no vermelho: faltam ${fmtBRL(-shared.balance)}`,
        detail: `Receitas do conjunto ${fmtBRL(shared.income)} − despesas ${fmtBRL(shared.expense)} − economias ${fmtBRL(shared.savings)}.`,
      });
    // contas do conjunto maiores que a renda do casal
    else if (shared.income <= 0 && sharedOut > 0 && peopleIncome < partsTotal)
      out.push({
        id: "balance-shared",
        scope: "shared",
        level: "danger",
        title: `As contas do conjunto (${fmtBRL(sharedOut)}) passam da renda do casal`,
        detail: `Renda das pessoas: ${fmtBRL(peopleIncome)}.`,
      });
  }

  // saldo dos meses anteriores é da casa inteira: fica no conjunto
  const accumulated = carry.planned + all.balance;
  if (accumulated < 0 && carry.planned !== 0) {
    out.push({
      id: "accumulated",
      scope: "shared",
      level: "danger",
      title: `Saldo acumulado negativo: ${fmtBRL(accumulated)}`,
      detail: `Somando os meses anteriores (${fmtBRL(carry.planned)}), a conta não fecha.`,
    });
  }

  /* ---------- fontes de dinheiro que não cobrem as tabelas ---------- */
  const lastBySource = new Map<string, { end: number; name: string; scope: string }>();
  for (const b of blocks) {
    const r = calc.running.get(b.id);
    if (r) lastBySource.set(r.source, { end: r.end, name: b.name, scope: scopeOf(b) });
  }
  for (const [source, last] of lastBySource) {
    // "todas as receitas" já é o alerta de saldo acima
    if (source === "kind:income" || last.end >= 0) continue;
    const m = source.match(/^kind:income:(.+)$/);
    out.push({
      id: `source-${source}`,
      scope: m && members.some((x) => x.id === m[1]) ? m[1] : last.scope,
      level: "danger",
      title: `${refLabel(source, blocks, members)} não cobre as tabelas que saem dela`,
      detail: `Faltam ${fmtBRL(-last.end)} até “${last.name}”. Mude a origem de alguma tabela ou reduza gastos.`,
    });
  }

  /* ---------- cartões ---------- */
  for (const [id, c] of calc.cards) {
    const b = blocks.find((x) => x.id === id)!;
    if (c.available !== null && c.available < 0)
      out.push({
        id: `card-${id}`,
        scope: scopeOf(b),
        level: "danger",
        title: `Fatura de “${b.name}” passou do limite em ${fmtBRL(-c.available)}`,
        detail: `Limite ${fmtBRL(c.limit!)} · fatura ${fmtBRL(c.bill)}.`,
      });
    else if (c.limit && c.limit - c.available! >= c.limit * 0.8)
      out.push({
        id: `card-${id}`,
        scope: scopeOf(b),
        level: "warning",
        title: `“${b.name}” já usou ${fmtPct((c.limit - c.available!) / c.limit)} do limite`,
        detail: `Disponível ${fmtBRL(c.available!)} de ${fmtBRL(c.limit)}.`,
      });
  }
  const cards = cardIds(blocks);

  /* ---------- fechamento e vencimento das faturas (só no mês atual) ---------- */
  if (isCurrent) {
    for (const [id, c] of calc.cards) {
      const b = blocks.find((x) => x.id === id)!;
      if (!hasCycle(b)) continue;
      const f = faturaDates(ym, b.cardClose!, b.cardDue!);
      const unpaid = c.paid === null && c.due > 0;
      if (unpaid && f.due < today)
        out.push({
          id: `card-due-${id}`,
          scope: scopeOf(b),
          level: "danger",
          title: `Fatura de “${b.name}” venceu dia ${dayOf(f.due)} (${fmtBRL(c.due)})`,
          detail: "Se já pagou, marque a fatura como paga na tabela do cartão.",
        });
      else if (unpaid && f.due <= addDays(today, 3))
        out.push({
          id: `card-due-${id}`,
          scope: scopeOf(b),
          level: "warning",
          title:
            f.due === today
              ? `Fatura de “${b.name}” vence hoje (${fmtBRL(c.due)})`
              : `Fatura de “${b.name}” vence dia ${dayOf(f.due)} (${fmtBRL(c.due)})`,
        });
      // o fechamento da próxima fatura (a deste mês pode já ter fechado no mês anterior)
      const next = faturaDates(addMonthsYm(ym, 1), b.cardClose!, b.cardDue!);
      const closing = [f.close, next.close].find((d) => d >= today);
      if (closing && closing <= addDays(today, 2))
        out.push({
          id: `card-close-${id}`,
          scope: scopeOf(b),
          level: "warning",
          title: `Fatura de “${b.name}” fecha ${closing === today ? "hoje" : `dia ${dayOf(closing)}`}`,
          detail: "Compras depois do fechamento entram na fatura seguinte.",
        });
    }
  }

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
        scope: scopeOf(b),
        level: "danger",
        title: `“${b.name}” passou do limite em ${fmtBRL(total - limit)}`,
        detail: `Limite ${fmtBRL(limit)} · lançado ${fmtBRL(total)}.`,
      });
    else if (total >= limit * 0.8)
      out.push({
        id: `limit-${b.id}`,
        scope: scopeOf(b),
        level: "warning",
        title: `“${b.name}” já usou ${fmtPct(total / limit)} do limite`,
        detail: `Restam ${fmtBRL(limit - total)} de ${fmtBRL(limit)}.`,
      });
  }

  /* ---------- vencimentos, separados por dono ---------- */
  if (!isPast || isCurrent) {
    const soon = addDays(today, 3);
    type Due = { d: string; v: number; scope: string };
    const overdueAll: Due[] = [];
    const dueSoonAll: Due[] = [];
    for (const b of blocks) {
      if (b.kind !== "expense" || b.card) continue;
      for (const e of b.entries) {
        if (e.status !== "pending" || !e.date || e.amount <= 0 || onCard(e, cards)) continue;
        const item = { d: e.description || b.name, v: e.amount, scope: scopeOf(b) };
        if (e.date < today) overdueAll.push(item);
        else if (e.date <= soon) dueSoonAll.push(item);
      }
    }
    const list = (xs: { d: string }[]) =>
      xs.slice(0, 3).map((x) => x.d).join(", ") + (xs.length > 3 ? ` e mais ${xs.length - 3}` : "");
    const sum = (xs: { v: number }[]) => xs.reduce((s, x) => s + x.v, 0);
    for (const scope of new Set([...overdueAll, ...dueSoonAll].map((x) => x.scope))) {
      const overdue = overdueAll.filter((x) => x.scope === scope);
      const dueSoon = dueSoonAll.filter((x) => x.scope === scope);
      if (overdue.length)
        out.push({
          id: `overdue-${scope}`,
          scope,
          level: "danger",
          title: `${overdue.length} ${overdue.length === 1 ? "conta vencida" : "contas vencidas"} (${fmtBRL(sum(overdue))})`,
          detail: `${list(overdue)}. Se já pagou, marque como pago.`,
        });
      if (dueSoon.length)
        out.push({
          id: `due-soon-${scope}`,
          scope,
          level: "warning",
          title: `${dueSoon.length} ${dueSoon.length === 1 ? "conta vence" : "contas vencem"} nos próximos 3 dias (${fmtBRL(sum(dueSoon))})`,
          detail: list(dueSoon),
        });
    }
  }

  /* ---------- fluxo de caixa da casa: falta dinheiro antes do salário cair? ---------- */
  if (isCurrent && all.balance >= 0) {
    let cash = carry.realized + all.incomeDone - all.expenseDone - all.savingsDone;
    const end = `${ym}-31`;
    const moves: { date: string; v: number }[] = [];
    for (const b of blocks) {
      if (b.kind === "total") continue;
      // o cartão é crédito: o pagamento da fatura é linha de despesa
      if (calc.cards.has(b.id)) continue;
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
          scope: "shared",
          level: "warning",
          title: `Pode faltar dinheiro por volta do dia ${dayOf(mv.date < today ? today : mv.date)}`,
          detail: `Há contas vencendo antes das receitas que ainda não caíram (falta ${fmtBRL(-cash)} nesse momento). Confira as datas ou marque o que já recebeu.`,
        });
        break;
      }
    }
  }

  /* ---------- comparação com o mês anterior (casa inteira) ---------- */
  if (input.prevExpense && input.prevExpense > 0 && all.expense > input.prevExpense * 1.15) {
    out.push({
      id: "vs-prev",
      scope: "shared",
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
        scope: scopeOf(b),
        level: "warning",
        title: `“${b.name}” depende dela mesma`,
        detail: "Uma linha aponta para uma tabela que, por sua vez, aponta de volta. Essa linha conta como zero.",
      });
  }

  /* ---------- tudo certo: um por pessoa ---------- */
  for (const h of health) {
    const balance = h.income - h.out - h.part;
    if (h.income > 0 && !out.some((a) => a.scope === h.scope && a.level !== "ok"))
      out.push({
        id: `ok-${h.scope}`,
        scope: h.scope,
        level: "ok",
        title: `Tudo sob controle: sobram ${fmtBRL(balance)}`,
        detail: `${fmtPct(balance / h.income, 1)} da renda livre no fim do mês.`,
      });
  }

  return out.sort((a, b) => ALERT_RANK[a.level] - ALERT_RANK[b.level]);
}
