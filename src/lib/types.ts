/** Tabelas "de lançamento" guardam valores; a de total calcula a partir das outras. */
export type EntryKind = "income" | "expense" | "savings";
export type Kind = EntryKind | "total";
export type ColType = "text" | "number" | "currency" | "date";
export type BudgetType = "none" | "amount" | "percent";
export type Status = "pending" | "done";

export interface ExtraColumn {
  id: string;
  name: string;
  type: ColType;
}

export type ExtraValue = string | number | null;

/** Pessoa da casa (ex.: marido e esposa). Tabelas podem pertencer a uma pessoa. */
export interface Member {
  id: string;
  name: string;
  color: string;
  position: number;
}

export interface Entry {
  id: string;
  blockId: string;
  description: string;
  /** valor em centavos (nas tabelas de total, só vale quando `ref` é nulo) */
  amount: number;
  /** YYYY-MM-DD */
  date: string | null;
  status: Status;
  goalId: string | null;
  /** economias: meta própria da linha, em centavos. null = sem meta */
  target: number | null;
  extra: Record<string, ExtraValue>;
  position: number;
  /** tabelas de total: de onde vem o valor da linha (ver lib/calc.ts) */
  ref: string | null;
  /** tabelas de total: 1 soma, -1 subtrai */
  sign: 1 | -1;
  /** despesas: id do cartão de crédito que paga a linha. null = sai do saldo */
  payWith: string | null;
  /** parcela de uma compra parcelada (ex.: 3 de 12). id null = parcelamento já excluído */
  installment: { id: string | null; no: number; count: number } | null;
}

export interface Block {
  id: string;
  ym: string;
  name: string;
  kind: Kind;
  budgetType: BudgetType;
  /** centavos (amount) ou porcentagem (percent) */
  budgetValue: number;
  columns: ExtraColumn[];
  position: number;
  /** dono da tabela; null = conjunto (do casal) */
  memberId: string | null;
  /** despesas/cofrinho: de onde sai o dinheiro (ref). null = padrão */
  source: string | null;
  /** despesa que é um cartão de crédito: tem limite (budgetValue) e fatura */
  card: boolean;
  /** cartão: valor pago da fatura (centavos). null = ainda não paga */
  cardPaid: number | null;
  /** cartão: dia do fechamento e do vencimento da fatura (null = não informado) */
  cardClose: number | null;
  cardDue: number | null;
  entries: Entry[];
}

export interface GoalLite {
  id: string;
  name: string;
  color: string;
}

export interface Carry {
  planned: number;
  realized: number;
}

export type SurplusMode = "ask" | "auto" | "off";

/** Sobra do último mês fechado, mostrada no mês atual. */
export interface SurplusInfo {
  /** mês que fechou */
  ym: string;
  /** pending: esperando a decisão; saved: guardada (aviso ainda não visto) */
  state: "pending" | "saved";
  /** pending: sobra disponível; saved: valor guardado */
  amount: number;
  /** preferências da conta (pending) ou meta usada (saved) */
  goalId: string | null;
  pct: number;
}

export interface MonthPayload {
  ym: string;
  initialized: boolean;
  /** mês de onde este foi copiado ao abrir sozinho (enquanto o aviso não é dispensado) */
  autoFrom: string | null;
  previousYm: string | null;
  blocks: Block[];
  goals: GoalLite[];
  members: Member[];
  carry: Carry;
  /** só no mês atual, quando há sobra do mês anterior para decidir ou aviso para ver */
  surplus: SurplusInfo | null;
}

export interface GoalStat {
  id: string;
  name: string;
  color: string;
  targetAmount: number;
  /** YYYY-MM ou null */
  targetMonth: string | null;
  saved: number;
  planned: number;
  monthlyAvg: number;
  history: { ym: string; total: number; done: number }[];
}

export interface AnnualPayload {
  year: number;
  carryIn: number;
  months: { ym: string; income: number; expense: number; savings: number }[];
  categories: { name: string; kind: EntryKind; total: number }[];
}

export interface DashboardPayload {
  ym: string;
  members: Member[];
  carry: Carry;
  /** do mais antigo ao `ym` (até 6 meses, só os que existem) */
  months: { ym: string; blocks: Block[] }[];
  /** próximo mês, se já foi iniciado */
  next: { ym: string; blocks: Block[] } | null;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}
