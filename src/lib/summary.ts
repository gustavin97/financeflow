import type { Block, Carry, Entry } from "./types";

/** Só linhas marcadas (recebido, pago, guardado, na fatura...) entram nas contas. */
export const counts = (e: Pick<Entry, "status">) => e.status === "done";

export function blockTotals(b: Block) {
  let done = 0;
  let pending = 0;
  let doneCount = 0;
  let count = 0;
  for (const e of b.entries) {
    // linhas em branco (criadas com Enter para digitar rápido) não entram na contagem
    if (e.description.trim() !== "" || e.amount !== 0) count++;
    if (counts(e)) {
      done += e.amount;
      doneCount++;
    } else pending += e.amount;
  }
  return { total: done, done, pending, count, doneCount };
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
  /** pagamentos avulsos (adiantamentos): saem do saldo e abatem o gasto */
  extra: number;
  /** gasto do cartão: fatura − pagamentos avulsos (não fica negativo) */
  net: number;
  /** quanto o pagamento cobre: a fatura fechada, se informada; senão a fatura da tabela */
  due: number;
  /** limite − fatura − o que falta pagar da fatura fechada + pagamentos avulsos */
  available: number | null;
}

export function cardInfo(card: Block, blocks: Block[]): CardInfo {
  // só compras marcadas entram na fatura
  const own = card.entries.reduce((s, e) => (counts(e) ? s + e.amount : s), 0);
  const charges: CardInfo["charges"] = [];
  for (const b of blocks) {
    if (b.id === card.id || b.kind !== "expense" || b.card) continue;
    for (const e of b.entries) if (e.payWith === card.id) charges.push({ block: b, entry: e });
  }
  const chargesTotal = charges.reduce((s, c) => (counts(c.entry) ? s + c.entry.amount : s), 0);
  const bill = own + chargesTotal;
  const limit = card.budgetType === "amount" && card.budgetValue > 0 ? Math.round(card.budgetValue) : null;
  const closed = card.cardClosed;
  const paid = card.cardPaid;
  // pagar a fatura fechada libera o limite que ela ocupa
  const owed = closed === null ? 0 : Math.max(0, closed - (paid ?? 0));
  const extra = card.cardExtra;
  // o limite usado não fica negativo: pagar além do devido não cria limite extra
  const available = limit === null ? null : limit - Math.max(0, bill + owed - extra);
  return { limit, own, charges, chargesTotal, bill, paid, closed, extra, net: Math.max(0, bill - extra), due: closed ?? bill, available };
}

/**
 * Valores que entram nas somas do mês: só as linhas marcadas (`total`);
 * `pending` é o que ainda falta marcar. O cartão é crédito: as compras nele
 * (na tabela do cartão ou pagas com ele) não entram nas somas, e o pagamento
 * da fatura é lançado como linha numa tabela de despesas. O valor pago
 * registrado no cartão só abate o gasto e libera o limite.
 */
export function cashTotals(b: Block, cards: Set<string>) {
  if (b.card && cards.has(b.id)) return { total: 0, done: 0, pending: 0 };
  let done = 0;
  let pending = 0;
  for (const e of b.entries) {
    if (onCard(e, cards)) continue;
    if (counts(e)) done += e.amount;
    else pending += e.amount;
  }
  return { total: done, done, pending };
}

export interface MonthSummary {
  income: number;
  incomeDone: number;
  expense: number;
  expenseDone: number;
  savings: number;
  savingsDone: number;
  /** linhas ainda não marcadas: não entram nas contas */
  incomePending: number;
  expensePending: number;
  savingsPending: number;
  /** receitas − despesas − cofrinho (só linhas marcadas) */
  balance: number;
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
    incomePending: 0,
    expensePending: 0,
    savingsPending: 0,
  };
  const cards = cardIds(blocks);
  for (const b of blocks) {
    // tabelas de total só repetem valores das outras: não entram nas somas
    if (b.kind === "total") continue;
    const t = cashTotals(b, cards);
    if (b.kind === "income") {
      s.income += t.total;
      s.incomeDone += t.done;
      s.incomePending += t.pending;
    } else if (b.kind === "expense") {
      s.expense += t.total;
      s.expenseDone += t.done;
      s.expensePending += t.pending;
    } else {
      s.savings += t.total;
      s.savingsDone += t.done;
      s.savingsPending += t.pending;
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
