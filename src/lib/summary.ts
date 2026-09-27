import type { Block, Carry } from "./types";

export function blockTotals(b: Block) {
  let total = 0;
  let done = 0;
  let doneCount = 0;
  let count = 0;
  for (const e of b.entries) {
    total += e.amount;
    // linhas em branco (criadas com Enter para digitar rápido) não entram na contagem
    if (e.description.trim() !== "" || e.amount !== 0) count++;
    if (e.status === "done") {
      done += e.amount;
      doneCount++;
    }
  }
  return { total, done, pending: total - done, count, doneCount };
}

export interface MonthSummary {
  income: number;
  incomeDone: number;
  expense: number;
  expenseDone: number;
  savings: number;
  savingsDone: number;
  /** previsto: receitas - despesas - cofrinho */
  balance: number;
  /** realizado: recebido - pago - guardado */
  balanceRealized: number;
  accumulated: number;
  accumulatedRealized: number;
  savingsRate: number;
}

export function computeSummary(blocks: Block[], carry: Carry): MonthSummary {
  const s = {
    income: 0,
    incomeDone: 0,
    expense: 0,
    expenseDone: 0,
    savings: 0,
    savingsDone: 0,
  };
  for (const b of blocks) {
    // tabelas de total só repetem valores das outras: não entram nas somas
    if (b.kind === "total") continue;
    const t = blockTotals(b);
    if (b.kind === "income") {
      s.income += t.total;
      s.incomeDone += t.done;
    } else if (b.kind === "expense") {
      s.expense += t.total;
      s.expenseDone += t.done;
    } else {
      s.savings += t.total;
      s.savingsDone += t.done;
    }
  }
  const balance = s.income - s.expense - s.savings;
  const balanceRealized = s.incomeDone - s.expenseDone - s.savingsDone;
  return {
    ...s,
    balance,
    balanceRealized,
    accumulated: carry.planned + balance,
    accumulatedRealized: carry.realized + balanceRealized,
    savingsRate: s.income > 0 ? s.savings / s.income : 0,
  };
}

/** Limite/meta da tabela em centavos, ou null quando não há. `base` é o dinheiro de onde a tabela sai. */
export function budgetLimit(b: Block, base: number): number | null {
  if (b.budgetType === "amount") return Math.round(b.budgetValue);
  if (b.budgetType === "percent") return Math.round((base * b.budgetValue) / 100);
  return null;
}
