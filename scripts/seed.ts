/**
 * Cria um casal de demonstração com 3 meses de dados.
 *   npm run seed
 * Login: demo@financeflow.app  |  Senha: demo12345
 */
import bcrypt from "bcryptjs";
import { addMonths } from "../src/lib/dates";
import {
  createBlock,
  createEntry,
  createGoal,
  createMember,
  createUser,
  deleteUser,
  findUserByEmail,
  initMonth,
  updateBlock,
  updateEntry,
} from "../src/lib/queries";
import type { ColType, EntryKind } from "../src/lib/types";

const EMAIL = "demo@financeflow.app";
const PASSWORD = "demo12345";

// [descrição, valor (centavos), dia, extras por nome de coluna]
type Row = [string, number, number, Record<string, string>?];

interface Plan {
  name: string;
  kind: EntryKind;
  owner: "ana" | "bruno" | null;
  columns?: { name: string; type: ColType }[];
  percent?: number;
  rows: (offset: number) => Row[];
}

/** Pequena variação mês a mês para as comparações ficarem interessantes. */
const vary = (base: number, offset: number, pct: number) => Math.round(base * (1 + pct * offset));

async function main() {
  const existing = findUserByEmail(EMAIL);
  if (existing) deleteUser(existing.id);

  const user = createUser("Ana e Bruno", EMAIL, await bcrypt.hash(PASSWORD, 10));
  const uid = user.id;
  const ana = createMember(uid, { name: "Ana" });
  const bruno = createMember(uid, { name: "Bruno" });
  const who = { ana: ana.id, bruno: bruno.id };

  const now = new Date();
  const ym0 = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const today = now.getDate();

  const apt = createGoal(uid, { name: "Entrada do apartamento", targetAmount: 8_000_000, targetMonth: addMonths(ym0, 40), color: "#1d5fbf" });
  const car = createGoal(uid, { name: "Carro", targetAmount: 4_500_000, targetMonth: addMonths(ym0, 28), color: "#d9822b" });
  const trip = createGoal(uid, { name: "Viagem", targetAmount: 800_000, targetMonth: addMonths(ym0, 12), color: "#8a4fa3" });

  const plans: Plan[] = [
    {
      name: "Salário (Ana)",
      kind: "income",
      owner: "ana",
      columns: [{ name: "Origem", type: "text" }],
      rows: (o) => [
        ["Salário", 620000, 5, { Origem: "Empresa" }],
        ...(o !== 0 ? ([["Freelance de design", 85000, 22, { Origem: "Cliente avulso" }]] as Row[]) : []),
      ],
    },
    {
      name: "Salário (Bruno)",
      kind: "income",
      owner: "bruno",
      columns: [{ name: "Origem", type: "text" }],
      rows: () => [["Salário", 480000, 6, { Origem: "Empresa" }]],
    },
    {
      name: "Contas da casa",
      kind: "expense",
      owner: null,
      columns: [{ name: "Categoria", type: "text" }],
      rows: (o) => [
        ["Aluguel", 285000, 10, { Categoria: "Moradia" }],
        ["Condomínio", 62000, 10, { Categoria: "Moradia" }],
        ["Energia", vary(24740, o, 0.08), 15, { Categoria: "Serviços" }],
        ["Água", 9620, 18, { Categoria: "Serviços" }],
        ["Internet", 11990, 20, { Categoria: "Serviços" }],
      ],
    },
    {
      name: "Mercado",
      kind: "expense",
      owner: null,
      columns: [{ name: "Categoria", type: "text" }],
      rows: (o) => [
        ["Compra do mês", vary(98000, o, 0.06), 3, { Categoria: "Alimentação" }],
        ["Feira e padaria", vary(32000, o, 0.1), 17, { Categoria: "Alimentação" }],
      ],
    },
    {
      name: "Cartão (Ana)",
      kind: "expense",
      owner: "ana",
      columns: [
        { name: "Categoria", type: "text" },
        { name: "Parcela", type: "text" },
      ],
      rows: (o) => [
        ["Farmácia", 8990, 8, { Categoria: "Saúde" }],
        ["Curso de inglês", 19900, 14, { Categoria: "Educação", Parcela: `${3 + o + 2}/10` }],
        ["Roupas", vary(38900, o, 0.25), 16, { Categoria: "Compras" }],
      ],
    },
    {
      name: "Cartão (Bruno)",
      kind: "expense",
      owner: "bruno",
      columns: [
        { name: "Categoria", type: "text" },
        { name: "Parcela", type: "text" },
      ],
      rows: (o) => [
        ["Combustível", vary(42000, o, 0.05), 12, { Categoria: "Transporte" }],
        ["Fone bluetooth", 24990, 9, { Categoria: "Compras", Parcela: "1/3" }],
        ["Academia", 11900, 5, { Categoria: "Saúde" }],
      ],
    },
    {
      name: "Planos e assinaturas",
      kind: "expense",
      owner: null,
      columns: [{ name: "Categoria", type: "text" }],
      rows: () => [
        ["Plano de saúde", 98000, 7, { Categoria: "Saúde" }],
        ["Celulares", 11800, 11, { Categoria: "Serviços" }],
        ["Streaming", 5590, 19, { Categoria: "Lazer" }],
      ],
    },
    {
      name: "Lazer",
      kind: "expense",
      owner: null,
      percent: 10,
      columns: [{ name: "Categoria", type: "text" }],
      rows: (o) => [
        ["Cinema", 6200, 7, { Categoria: "Lazer" }],
        ["Jantar fora", vary(28000, o, 0.3), 13, { Categoria: "Lazer" }],
        ...(o === 0 ? ([["Ingresso do show", 36000, today + 2 > 28 ? 28 : today + 2, { Categoria: "Lazer" }]] as Row[]) : []),
      ],
    },
    {
      name: "Viagens",
      kind: "expense",
      owner: null,
      columns: [
        { name: "Destino", type: "text" },
        { name: "Categoria", type: "text" },
      ],
      rows: (o) =>
        o === 0
          ? [
              ["Passagens", 124000, 4, { Destino: "Salvador", Categoria: "Viagem" }],
              ["Hotel (sinal)", 45000, 21, { Destino: "Salvador", Categoria: "Viagem" }],
            ]
          : [],
    },
  ];

  const savingsPlan: [string, number, string][] = [
    ["Aporte: apartamento", 60000, apt],
    ["Aporte: carro", 30000, car],
    ["Aporte: viagem", 20000, trip],
  ];

  for (const offset of [-2, -1, 0]) {
    const ym = addMonths(ym0, offset);
    initMonth(uid, ym, "blank");
    const status = (day: number) => (offset < 0 || day <= today ? "done" : "pending");

    for (const p of plans) {
      const block = createBlock(uid, {
        ym,
        name: p.name,
        kind: p.kind,
        memberId: p.owner ? who[p.owner] : null,
        columns: (p.columns ?? []).map((c, i) => ({ id: `c_${i}${Math.random().toString(36).slice(2, 7)}`, ...c })),
      });
      if (p.percent) updateBlock(uid, block.id, { budgetType: "percent", budgetValue: p.percent });
      for (const [desc, amount, day, extra] of p.rows(offset)) {
        const date = `${ym}-${String(day).padStart(2, "0")}`;
        const e = createEntry(uid, block.id, { description: desc, amount, date, status: status(day) });
        if (extra) {
          const mapped: Record<string, string | null> = {};
          for (const col of block.columns) if (extra[col.name] !== undefined) mapped[col.id] = extra[col.name] || null;
          updateEntry(uid, e.id, { extra: mapped });
        }
      }
    }

    const savings = createBlock(uid, { ym, name: "Economias", kind: "savings", memberId: null });
    updateBlock(uid, savings.id, { budgetType: "percent", budgetValue: 10 });
    for (const [desc, amount, goalId] of savingsPlan)
      createEntry(uid, savings.id, { description: desc, amount, date: `${ym}-05`, status: status(5), goalId });

    // tabelas de total: juntam o montante do casal
    createBlock(uid, {
      ym,
      name: "Renda do casal",
      kind: "total",
      rows: [
        { description: "Receitas de Ana", ref: `kind:income:${ana.id}`, sign: 1 },
        { description: "Receitas de Bruno", ref: `kind:income:${bruno.id}`, sign: 1 },
      ],
    });
    createBlock(uid, {
      ym,
      name: "Sobra do casal",
      kind: "total",
      rows: [
        { description: "Todas as receitas", ref: "kind:income", sign: 1 },
        { description: "Todas as despesas", ref: "kind:expense", sign: -1 },
        { description: "Todo o cofrinho", ref: "kind:savings", sign: -1 },
      ],
    });
  }

  console.log(`\nCasal de demonstração criado.\n  E-mail: ${EMAIL}\n  Senha:  ${PASSWORD}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
