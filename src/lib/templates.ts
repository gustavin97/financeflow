import type { BudgetType, ColType, Kind } from "./types";

export interface BlockTemplate {
  name: string;
  kind: Kind;
  budgetType: BudgetType;
  budgetValue: number;
  columns: { name: string; type: ColType }[];
}

/** Modelo inicial de um mês novo. */
export const DEFAULT_BLOCKS: BlockTemplate[] = [
  {
    name: "Receitas",
    kind: "income",
    budgetType: "none",
    budgetValue: 0,
    columns: [{ name: "Origem", type: "text" }],
  },
  { name: "Contas da casa", kind: "expense", budgetType: "none", budgetValue: 0, columns: [] },
  {
    name: "Cartão de crédito",
    kind: "expense",
    budgetType: "none",
    budgetValue: 0,
    columns: [{ name: "Parcela", type: "text" }],
  },
  {
    name: "Compras online",
    kind: "expense",
    budgetType: "none",
    budgetValue: 0,
    columns: [{ name: "Loja", type: "text" }],
  },
  { name: "Lazer", kind: "expense", budgetType: "percent", budgetValue: 10, columns: [] },
  { name: "Cofrinho", kind: "savings", budgetType: "percent", budgetValue: 20, columns: [] },
];
