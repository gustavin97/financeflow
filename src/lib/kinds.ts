import type { ColType, Kind } from "./types";

export const KIND_META: Record<
  Kind,
  {
    label: string;
    plural: string;
    color: string;
    dateLabel: string;
    pending: string;
    done: string;
    doneAll: string;
    hint: string;
  }
> = {
  income: {
    label: "Receita",
    plural: "Receitas",
    color: "#107c41",
    dateLabel: "Data",
    pending: "A receber",
    done: "Recebido",
    doneAll: "Marcar tudo como recebido",
    hint: "Salário, freelas, rendimentos e qualquer dinheiro que entra.",
  },
  expense: {
    label: "Despesa",
    plural: "Despesas",
    color: "#c4361f",
    dateLabel: "Vencimento",
    pending: "A pagar",
    done: "Pago",
    doneAll: "Marcar tudo como pago",
    hint: "Contas da casa, cartão, compras, lazer, viagens, planos... todo dinheiro que sai.",
  },
  savings: {
    label: "Economias",
    plural: "Economias",
    color: "#1d5fbf",
    dateLabel: "Data",
    pending: "Previsto",
    done: "Guardado",
    doneAll: "Marcar tudo como guardado",
    hint: "Dinheiro guardado: reserva, investimentos, aportes para metas (apartamento, carro, viagem).",
  },
  total: {
    label: "Total",
    plural: "Totais",
    color: "#4a3aa7",
    dateLabel: "",
    pending: "",
    done: "",
    doneAll: "",
    hint: "Soma e subtrai outras tabelas: renda do casal, despesas somadas, quanto sobra...",
  },
};

/** Cartão de crédito: uma tabela de despesa com limite e fatura. */
export const CARD_META = {
  label: "Cartão de crédito",
  short: "Cartão",
  color: "#8a4fa3",
  hint: "Limite e fatura. Despesas de outras tabelas podem ser pagas com ele; pagar a fatura sai das receitas.",
};

/** Cores usadas nos segmentos de despesa da barra de distribuição. */
export const EXPENSE_PALETTE = [
  "#c4361f",
  "#d9822b",
  "#a67c00",
  "#8a4fa3",
  "#2a8797",
  "#b0476a",
  "#5f8a3a",
  "#6b7280",
];

/**
 * Paleta categórica dos gráficos do painel (ordem fixa, validada para
 * daltonismo). Categorias além da 8ª viram "Outros".
 */
export const CHART_PALETTE = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
];
export const OTHER_COLOR = "#9aa3ab";

/** As três primeiras cores da paleta continuam distintas entre si em qualquer combinação. */
export const MEMBER_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#e87ba4", "#4a3aa7", "#eda100"];
export const SHARED_COLOR = "#6b7280";

export const GOAL_COLORS = [
  "#1d5fbf",
  "#107c41",
  "#d9822b",
  "#8a4fa3",
  "#2a8797",
  "#b0476a",
];

export interface BlockPreset {
  name: string;
  kind: Exclude<Kind, "total">;
  hint: string;
  columns?: { name: string; type: ColType }[];
}

/** Modelos oferecidos em "Nova tabela". */
export const BLOCK_PRESETS: BlockPreset[] = [
  { name: "Salário", kind: "income", hint: "Entrada fixa do mês", columns: [{ name: "Origem", type: "text" }] },
  { name: "Renda extra", kind: "income", hint: "Freelas, vendas, bônus", columns: [{ name: "Origem", type: "text" }] },
  { name: "Contas da casa", kind: "expense", hint: "Aluguel, luz, água, internet", columns: [{ name: "Categoria", type: "text" }] },
  { name: "Mercado", kind: "expense", hint: "Compras do mês", columns: [{ name: "Local", type: "text" }] },
  { name: "Viagens", kind: "expense", hint: "Passagens, hospedagem, passeios", columns: [{ name: "Destino", type: "text" }, { name: "Categoria", type: "text" }] },
  { name: "Planos e assinaturas", kind: "expense", hint: "Saúde, celular, streaming, academia", columns: [{ name: "Categoria", type: "text" }, { name: "Renovação", type: "date" }] },
  { name: "Lazer", kind: "expense", hint: "Passeios, restaurantes", columns: [{ name: "Categoria", type: "text" }] },
  { name: "Economias", kind: "savings", hint: "Reserva e investimentos", columns: [{ name: "Onde está", type: "text" }] },
  { name: "Cofrinho de metas", kind: "savings", hint: "Aportes para apartamento, carro..." },
];
