import type { Block, Carry, Entry } from "./types";

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
  // receita só entra no total depois de recebida, e despesa depois de paga
  if (b.kind === "income" || b.kind === "expense") total = done;
  return { total, done, pending: total - done, count, doneCount };
}

/* ------------------------------------------------------------------ */
/* Cartão de crédito                                                   */
/* ------------------------------------------------------------------ */

/** Ids dos cartões de crédito do mês. */
export function cardIds(blocks: Block[]): Set<string> {
  return new Set(blocks.filter((b) => b.card && b.kind === "expense").map((b) => b.id));
}

/** Linha de despesa paga com um cartão deste mês (não sai do saldo, entra na fatura). */
export const onCard = (e: Entry, cards: Set<string>) => !!e.payWith && cards.has(e.payWith);

export interface CardInfo {
  /** limite do cartão; null = sem limite definido */
  limit: number | null;
  /** compras lançadas direto na tabela do cartão */
  own: number;
  /** despesas de outras tabelas pagas com o cartão */
  charges: { block: Block; entry: Entry }[];
  chargesTotal: number;
  /** fatura = own + chargesTotal */
  bill: number;
  paid: number | null;
  /** fatura fechada que vence no mês (compras fora da tabela); null = não informada */
  closed: number | null;
  /** quanto o pagamento cobre: a fatura fechada, se informada; senão a fatura da tabela */
  due: number;
  /** limite − fatura − o que falta pagar da fatura fechada */
  available: number | null;
}

export function cardInfo(card: Block, blocks: Block[]): CardInfo {
  const own = card.entries.reduce((s, e) => s + e.amount, 0);
  const charges: CardInfo["charges"] = [];
  for (const b of blocks) {
    if (b.id === card.id || b.kind !== "expense" || b.card) continue;
    for (const e of b.entries) if (e.payWith === card.id) charges.push({ block: b, entry: e });
  }
  const chargesTotal = charges.reduce((s, c) => s + c.entry.amount, 0);
  const bill = own + chargesTotal;
  const limit = card.budgetType === "amount" && card.budgetValue > 0 ? Math.round(card.budgetValue) : null;
  const closed = card.cardClosed;
  const paid = card.cardPaid;
  // pagar a fatura fechada libera o limite que ela ocupa
  const owed = closed === null ? 0 : Math.max(0, closed - (paid ?? 0));
  const available = limit === null ? null : limit - bill - owed;
  return { limit, own, charges, chargesTotal, bill, paid, closed, due: closed ?? bill, available };
}

/**
 * Valores que entram nas somas do mês. Despesas pagas com cartão contam como
 * previstas na própria tabela, mas só viram "pagas" quando a fatura é paga:
 * o realizado do cartão é o valor pago da fatura.
 */
export function cashTotals(b: Block, cards: Set<string>) {
  if (b.card && cards.has(b.id)) {
    // com a fatura fechada informada, é ela que se paga no mês; as compras da tabela vão para a próxima
    return { total: b.cardClosed ?? b.entries.reduce((s, e) => s + e.amount, 0), done: b.cardPaid ?? 0 };
  }
  let total = 0;
  let done = 0;
  for (const e of b.entries) {
    total += e.amount;
    if (e.status === "done" && !onCard(e, cards)) done += e.amount;
  }
  return { total, done };
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
  const cards = cardIds(blocks);
  for (const b of blocks) {
    // tabelas de total só repetem valores das outras: não entram nas somas
    if (b.kind === "total") continue;
    const t = cashTotals(b, cards);
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
