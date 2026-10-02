/**
 * Camada de dados (somente servidor). Todas as funções recebem o userId e
 * filtram por ele: um usuário nunca enxerga dados de outro.
 */
import crypto from "node:crypto";
import { getDb } from "./db";
import { ApiError } from "./errors";
import { DEFAULT_BLOCKS } from "./templates";
import { GOAL_COLORS, MEMBER_COLORS } from "./kinds";
import { remapRef } from "./calc";
import { addMonths, shiftDateToMonth } from "./dates";
import type {
  AnnualPayload,
  Block,
  DashboardPayload,
  EntryKind,
  BudgetType,
  Carry,
  Entry,
  ExtraColumn,
  ExtraValue,
  GoalLite,
  GoalStat,
  Kind,
  Member,
  MonthPayload,
  Status,
} from "./types";

type Bind = string | number | null;

const uid = () => crypto.randomUUID();

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function parseJson<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function mapBlock(r: Row): Omit<Block, "entries"> {
  return {
    id: r.id,
    ym: r.ym,
    name: r.name,
    kind: r.kind,
    budgetType: r.budget_type,
    budgetValue: r.budget_value,
    columns: parseJson<ExtraColumn[]>(r.columns, []),
    position: r.position,
    memberId: r.member_id ?? null,
    source: r.source ?? null,
    card: r.card === 1,
    cardPaid: r.card_paid ?? null,
  };
}

function mapEntry(r: Row): Entry {
  return {
    id: r.id,
    blockId: r.block_id,
    description: r.description,
    amount: r.amount,
    date: r.date,
    status: r.status,
    goalId: r.goal_id,
    extra: parseJson<Record<string, ExtraValue>>(r.extra, {}),
    position: r.position,
    ref: r.ref ?? null,
    sign: r.sign === -1 ? -1 : 1,
    payWith: r.pay_with ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Usuários                                                            */
/* ------------------------------------------------------------------ */

export function findUserByEmail(email: string) {
  return getDb().prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as
    | Row
    | undefined;
}

export function findUserById(id: string) {
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as Row | undefined;
}

export function createUser(name: string, email: string, passwordHash: string) {
  const id = uid();
  getDb()
    .prepare("INSERT INTO users (id, name, email, password_hash) VALUES (?,?,?,?)")
    .run(id, name, email.toLowerCase(), passwordHash);
  return { id, name, email: email.toLowerCase() };
}

export function updateUserName(id: string, name: string) {
  getDb().prepare("UPDATE users SET name = ? WHERE id = ?").run(name, id);
}

export function updateUserPassword(id: string, hash: string) {
  getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, id);
}

export function deleteUser(id: string) {
  getDb().prepare("DELETE FROM users WHERE id = ?").run(id);
}

/* ------------------------------------------------------------------ */
/* Pessoas da casa                                                     */
/* ------------------------------------------------------------------ */

export function listMembers(userId: string): Member[] {
  return (
    getDb()
      .prepare("SELECT * FROM members WHERE user_id = ? ORDER BY position, created_at")
      .all(userId) as Row[]
  ).map((r) => ({ id: r.id, name: r.name, color: r.color, position: r.position }));
}

function assertMember(userId: string, memberId: string | null | undefined) {
  if (!memberId) return;
  const m = getDb().prepare("SELECT 1 FROM members WHERE id = ? AND user_id = ?").get(memberId, userId);
  if (!m) throw new ApiError("Pessoa não encontrada.", 404);
}

export function createMember(userId: string, input: { name: string; color?: string }): Member {
  const db = getDb();
  const count = (db.prepare("SELECT COUNT(*) AS c FROM members WHERE user_id = ?").get(userId) as Row).c as number;
  if (count >= 8) throw new ApiError("No máximo 8 pessoas por conta.");
  const id = uid();
  const color = input.color ?? MEMBER_COLORS[count % MEMBER_COLORS.length];
  db.prepare("INSERT INTO members (id, user_id, name, color, position) VALUES (?,?,?,?,?)").run(
    id,
    userId,
    input.name,
    color,
    count,
  );
  return { id, name: input.name, color, position: count };
}

export function updateMember(userId: string, id: string, patch: { name?: string; color?: string }) {
  assertMember(userId, id);
  const db = getDb();
  if (patch.name !== undefined) db.prepare("UPDATE members SET name = ? WHERE id = ?").run(patch.name, id);
  if (patch.color !== undefined) db.prepare("UPDATE members SET color = ? WHERE id = ?").run(patch.color, id);
}

/** As tabelas da pessoa passam a ser do conjunto; nada é apagado. */
export function deleteMember(userId: string, id: string) {
  assertMember(userId, id);
  getDb().prepare("DELETE FROM members WHERE id = ?").run(id);
}

/* ------------------------------------------------------------------ */
/* Mês                                                                 */
/* ------------------------------------------------------------------ */

/** Saldo acumulado de todos os meses anteriores a `ym`. */
function carryBefore(userId: string, ym: string): Carry {
  const db = getDb();
  // linhas de cartão (na tabela do cartão ou pagas com ele) só viram realizado
  // quando a fatura é paga: aí conta o valor pago (card_paid)
  const rows = db
    .prepare(
      `SELECT b.kind AS kind,
              COALESCE(SUM(e.amount), 0) AS total,
              COALESCE(SUM(CASE WHEN e.status = 'done' AND b.card = 0 AND c.id IS NULL THEN e.amount ELSE 0 END), 0) AS done
         FROM entries e JOIN blocks b ON b.id = e.block_id
         LEFT JOIN blocks c ON c.id = e.pay_with AND c.card = 1 AND c.kind = 'expense'
        WHERE b.user_id = ? AND b.ym < ? AND b.kind != 'total'
        GROUP BY b.kind`,
    )
    .all(userId, ym) as Row[];
  const carry: Carry = { planned: 0, realized: 0 };
  for (const r of rows) {
    const sign = r.kind === "income" ? 1 : -1;
    carry.planned += sign * r.total;
    carry.realized += sign * r.done;
  }
  const paid = db
    .prepare(
      `SELECT COALESCE(SUM(card_paid), 0) AS p FROM blocks
        WHERE user_id = ? AND ym < ? AND card = 1 AND kind = 'expense'`,
    )
    .get(userId, ym) as Row;
  carry.realized -= paid.p as number;
  return carry;
}

export function getMonth(userId: string, ym: string): MonthPayload {
  const db = getDb();
  const initialized = !!db
    .prepare("SELECT 1 FROM months WHERE user_id = ? AND ym = ?")
    .get(userId, ym);
  const prev = db
    .prepare("SELECT ym FROM months WHERE user_id = ? AND ym < ? ORDER BY ym DESC LIMIT 1")
    .get(userId, ym) as Row | undefined;

  const blockRows = db
    .prepare("SELECT * FROM blocks WHERE user_id = ? AND ym = ? ORDER BY position, created_at")
    .all(userId, ym) as Row[];
  const entryRows = db
    .prepare(
      `SELECT e.* FROM entries e JOIN blocks b ON b.id = e.block_id
        WHERE b.user_id = ? AND b.ym = ? ORDER BY e.position, e.created_at`,
    )
    .all(userId, ym) as Row[];

  const byBlock = new Map<string, Entry[]>();
  for (const r of entryRows) {
    const e = mapEntry(r);
    const list = byBlock.get(e.blockId);
    if (list) list.push(e);
    else byBlock.set(e.blockId, [e]);
  }
  const blocks: Block[] = blockRows.map((r) => ({
    ...mapBlock(r),
    entries: byBlock.get(r.id) ?? [],
  }));

  const goals = db
    .prepare("SELECT id, name, color FROM goals WHERE user_id = ? ORDER BY created_at")
    .all(userId) as unknown as GoalLite[];

  return {
    ym,
    initialized,
    previousYm: prev?.ym ?? null,
    blocks,
    goals,
    members: listMembers(userId),
    carry: carryBefore(userId, ym),
  };
}

function insertBlock(
  userId: string,
  ym: string,
  b: {
    name: string;
    kind: Kind;
    budgetType: BudgetType;
    budgetValue: number;
    columns: ExtraColumn[];
    position: number;
    memberId?: string | null;
    source?: string | null;
    card?: boolean;
  },
): string {
  const id = uid();
  getDb()
    .prepare(
      `INSERT INTO blocks (id, user_id, ym, name, kind, budget_type, budget_value, columns, position, member_id, source, card)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      id,
      userId,
      ym,
      b.name,
      b.kind,
      b.budgetType,
      b.budgetValue,
      JSON.stringify(b.columns),
      b.position,
      b.memberId ?? null,
      b.source ?? null,
      b.kind === "expense" && b.card ? 1 : 0,
    );
  return id;
}

export type StartMode = "default" | "blank" | "copy" | "structure";

export function initMonth(userId: string, ym: string, mode: StartMode) {
  const db = getDb();
  const exists = db.prepare("SELECT 1 FROM months WHERE user_id = ? AND ym = ?").get(userId, ym);
  if (exists) return;

  const run = db.transaction(() => {
    if (mode === "default") {
      DEFAULT_BLOCKS.forEach((t, i) =>
        insertBlock(userId, ym, {
          ...t,
          columns: t.columns.map((c) => ({ id: "c_" + uid().slice(0, 8), ...c })),
          position: i,
        }),
      );
    } else if (mode === "copy" || mode === "structure") {
      const prev = db
        .prepare("SELECT ym FROM months WHERE user_id = ? AND ym < ? ORDER BY ym DESC LIMIT 1")
        .get(userId, ym) as Row | undefined;
      if (!prev) throw new ApiError("Não existe um mês anterior para copiar.");
      const blocks = db
        .prepare("SELECT * FROM blocks WHERE user_id = ? AND ym = ? ORDER BY position, created_at")
        .all(userId, prev.ym) as Row[];
      const insertEntry = db.prepare(
        `INSERT INTO entries (id, block_id, user_id, description, amount, date, status, goal_id, extra, position, ref, sign, pay_with)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      );
      // 1º cria as tabelas, 2º as linhas: assim dá para trocar os ids das referências
      const ids = new Map<string, string>();
      for (const br of blocks) ids.set(br.id, insertBlock(userId, ym, mapBlock(br)));
      for (const br of blocks) {
        const nb = mapBlock(br);
        const newId = ids.get(br.id)!;
        if (nb.source) db.prepare("UPDATE blocks SET source = ? WHERE id = ?").run(remapRef(nb.source, ids), newId);
        // linhas de tabelas de total são estrutura (fórmulas): copiadas nos dois modos
        if (mode === "copy" || nb.kind === "total") {
          const entries = db
            .prepare("SELECT * FROM entries WHERE block_id = ? ORDER BY position, created_at")
            .all(br.id) as Row[];
          for (const er of entries) {
            const e = mapEntry(er);
            // datas do tipo "data" nas colunas extras também acompanham o novo mês
            const extra = { ...e.extra };
            for (const c of nb.columns) {
              if (c.type === "date" && typeof extra[c.id] === "string") {
                extra[c.id] = shiftDateToMonth(extra[c.id] as string, ym);
              }
            }
            insertEntry.run(
              uid(),
              newId,
              userId,
              e.description,
              e.amount,
              shiftDateToMonth(e.date, ym),
              "pending",
              e.goalId,
              JSON.stringify(extra),
              e.position,
              remapRef(e.ref, ids),
              e.sign,
              (e.payWith && ids.get(e.payWith)) || null,
            );
          }
        }
      }
    }
    db.prepare("INSERT INTO months (user_id, ym) VALUES (?,?)").run(userId, ym);
  });
  run();
}

/* ------------------------------------------------------------------ */
/* Tabelas (blocos)                                                    */
/* ------------------------------------------------------------------ */

function ownedBlock(userId: string, id: string): Row {
  const r = getDb().prepare("SELECT * FROM blocks WHERE id = ? AND user_id = ?").get(id, userId) as
    | Row
    | undefined;
  if (!r) throw new ApiError("Tabela não encontrada.", 404);
  return r;
}

export function createBlock(
  userId: string,
  input: {
    ym: string;
    name: string;
    kind: Kind;
    columns?: ExtraColumn[];
    memberId?: string | null;
    source?: string | null;
    card?: boolean;
    rows?: { description: string; ref: string | null; sign: 1 | -1 }[];
  },
): Block {
  const db = getDb();
  assertMember(userId, input.memberId);
  const pos = (
    db
      .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM blocks WHERE user_id = ? AND ym = ?")
      .get(userId, input.ym) as Row
  ).p as number;
  // criar uma tabela também "inicia" o mês, caso ainda não exista
  db.prepare("INSERT OR IGNORE INTO months (user_id, ym) VALUES (?,?)").run(userId, input.ym);
  const id = insertBlock(userId, input.ym, {
    name: input.name,
    kind: input.kind,
    budgetType: "none",
    budgetValue: 0,
    columns: input.columns ?? [],
    position: pos,
    memberId: input.memberId ?? null,
    source: input.source ?? null,
    card: input.card,
  });
  const entries = (input.rows ?? []).map((r) => createEntry(userId, id, r));
  return { ...mapBlock(ownedBlock(userId, id)), entries };
}

export function updateBlock(
  userId: string,
  id: string,
  patch: {
    name?: string;
    budgetType?: BudgetType;
    budgetValue?: number;
    columns?: ExtraColumn[];
    memberId?: string | null;
    source?: string | null;
    card?: boolean;
    cardPaid?: number | null;
  },
) {
  const db = getDb();
  const current = ownedBlock(userId, id);
  if ((patch.card || patch.cardPaid != null) && current.kind !== "expense")
    throw new ApiError("Só tabelas de despesa podem ser cartão de crédito.");
  assertMember(userId, patch.memberId);
  db.transaction(() => {
    if (patch.memberId !== undefined) db.prepare("UPDATE blocks SET member_id = ? WHERE id = ?").run(patch.memberId, id);
    if (patch.source !== undefined) db.prepare("UPDATE blocks SET source = ? WHERE id = ?").run(patch.source, id);
    if (patch.name !== undefined) db.prepare("UPDATE blocks SET name = ? WHERE id = ?").run(patch.name, id);
    if (patch.card !== undefined) {
      db.prepare("UPDATE blocks SET card = ? WHERE id = ?").run(patch.card ? 1 : 0, id);
      if (patch.card) {
        // um cartão não é pago com outro cartão
        db.prepare("UPDATE entries SET pay_with = NULL WHERE block_id = ?").run(id);
      } else {
        // deixou de ser cartão: as despesas pagas com ele voltam a sair do saldo
        db.prepare("UPDATE blocks SET card_paid = NULL WHERE id = ?").run(id);
        db.prepare("UPDATE entries SET pay_with = NULL WHERE pay_with = ?").run(id);
      }
    }
    if (patch.cardPaid !== undefined) db.prepare("UPDATE blocks SET card_paid = ? WHERE id = ?").run(patch.cardPaid, id);
    if (patch.budgetType !== undefined)
      db.prepare("UPDATE blocks SET budget_type = ?, budget_value = ? WHERE id = ?").run(
        patch.budgetType,
        patch.budgetType === "none" ? 0 : (patch.budgetValue ?? 0),
        id,
      );
    if (patch.columns !== undefined) {
      db.prepare("UPDATE blocks SET columns = ? WHERE id = ?").run(JSON.stringify(patch.columns), id);
      // remove das linhas os valores de colunas que deixaram de existir
      const keep = new Set(patch.columns.map((c) => c.id));
      const rows = db.prepare("SELECT id, extra FROM entries WHERE block_id = ?").all(id) as Row[];
      for (const r of rows) {
        const extra = parseJson<Record<string, ExtraValue>>(r.extra, {});
        const cleaned: Record<string, ExtraValue> = {};
        for (const k of Object.keys(extra)) if (keep.has(k)) cleaned[k] = extra[k];
        if (Object.keys(cleaned).length !== Object.keys(extra).length)
          db.prepare("UPDATE entries SET extra = ? WHERE id = ?").run(JSON.stringify(cleaned), r.id);
      }
    }
  })();
}

export function deleteBlock(userId: string, id: string) {
  ownedBlock(userId, id);
  getDb().prepare("DELETE FROM blocks WHERE id = ?").run(id);
}

/** Cartão onde a linha pode ser lançada: do mesmo usuário e mês, e a linha é de uma despesa comum. */
function assertPayWith(userId: string, blockRow: Row, payWith: string | null | undefined) {
  if (!payWith) return;
  if (blockRow.kind !== "expense" || blockRow.card === 1)
    throw new ApiError("Só despesas podem ser pagas com cartão.");
  const c = getDb()
    .prepare("SELECT 1 FROM blocks WHERE id = ? AND user_id = ? AND ym = ? AND card = 1 AND kind = 'expense'")
    .get(payWith, userId, blockRow.ym);
  if (!c) throw new ApiError("Cartão não encontrado neste mês.", 404);
}

export function completeBlock(userId: string, id: string, status: Status) {
  ownedBlock(userId, id);
  getDb().prepare("UPDATE entries SET status = ? WHERE block_id = ?").run(status, id);
}

/* ------------------------------------------------------------------ */
/* Linhas                                                              */
/* ------------------------------------------------------------------ */

function ownedEntry(userId: string, id: string): Row {
  const r = getDb().prepare("SELECT * FROM entries WHERE id = ? AND user_id = ?").get(id, userId) as
    | Row
    | undefined;
  if (!r) throw new ApiError("Lançamento não encontrado.", 404);
  return r;
}

function assertGoal(userId: string, goalId: string | null | undefined) {
  if (!goalId) return;
  const g = getDb().prepare("SELECT 1 FROM goals WHERE id = ? AND user_id = ?").get(goalId, userId);
  if (!g) throw new ApiError("Meta não encontrada.", 404);
}

export function createEntry(
  userId: string,
  blockId: string,
  init: Partial<Pick<Entry, "description" | "amount" | "date" | "status" | "goalId" | "ref" | "sign" | "payWith">> = {},
): Entry {
  const db = getDb();
  const block = ownedBlock(userId, blockId);
  assertGoal(userId, init.goalId);
  assertPayWith(userId, block, init.payWith);
  const pos = (
    db
      .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM entries WHERE block_id = ?")
      .get(blockId) as Row
  ).p as number;
  const id = uid();
  db.prepare(
    `INSERT INTO entries (id, block_id, user_id, description, amount, date, status, goal_id, position, ref, sign, pay_with)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    blockId,
    userId,
    init.description ?? "",
    init.amount ?? 0,
    init.date ?? null,
    init.status ?? "pending",
    init.goalId ?? null,
    pos,
    init.ref ?? null,
    init.sign ?? 1,
    init.payWith ?? null,
  );
  return mapEntry(ownedEntry(userId, id));
}

export function updateEntry(
  userId: string,
  id: string,
  patch: Partial<Pick<Entry, "description" | "amount" | "date" | "status" | "goalId" | "extra" | "ref" | "sign" | "payWith">>,
) {
  const db = getDb();
  const current = ownedEntry(userId, id);
  assertGoal(userId, patch.goalId);
  if (patch.payWith) assertPayWith(userId, ownedBlock(userId, current.block_id), patch.payWith);
  const sets: string[] = [];
  const vals: Bind[] = [];
  const add = (col: string, v: Bind) => {
    sets.push(`${col} = ?`);
    vals.push(v);
  };
  if (patch.description !== undefined) add("description", patch.description);
  if (patch.amount !== undefined) add("amount", patch.amount);
  if (patch.date !== undefined) add("date", patch.date);
  if (patch.status !== undefined) add("status", patch.status);
  if (patch.goalId !== undefined) add("goal_id", patch.goalId);
  if (patch.ref !== undefined) add("ref", patch.ref);
  if (patch.sign !== undefined) add("sign", patch.sign);
  if (patch.payWith !== undefined) add("pay_with", patch.payWith);
  if (patch.extra !== undefined) {
    const block = mapBlock(ownedBlock(userId, current.block_id));
    const allowed = new Set(block.columns.map((c) => c.id));
    const clean: Record<string, ExtraValue> = {};
    for (const [k, v] of Object.entries(patch.extra)) if (allowed.has(k)) clean[k] = v;
    add("extra", JSON.stringify(clean));
  }
  if (!sets.length) return;
  db.prepare(`UPDATE entries SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
}

export function deleteEntry(userId: string, id: string) {
  ownedEntry(userId, id);
  getDb().prepare("DELETE FROM entries WHERE id = ?").run(id);
}

/* ------------------------------------------------------------------ */
/* Metas do cofrinho                                                   */
/* ------------------------------------------------------------------ */

export function createGoal(
  userId: string,
  input: { name: string; targetAmount: number; targetMonth: string | null; color?: string },
) {
  const db = getDb();
  const count = (db.prepare("SELECT COUNT(*) AS c FROM goals WHERE user_id = ?").get(userId) as Row).c;
  const id = uid();
  db.prepare(
    "INSERT INTO goals (id, user_id, name, target_amount, target_month, color) VALUES (?,?,?,?,?,?)",
  ).run(
    id,
    userId,
    input.name,
    input.targetAmount,
    input.targetMonth,
    input.color ?? GOAL_COLORS[count % GOAL_COLORS.length],
  );
  return id;
}

export function updateGoal(
  userId: string,
  id: string,
  patch: { name?: string; targetAmount?: number; targetMonth?: string | null; color?: string },
) {
  const db = getDb();
  if (!db.prepare("SELECT 1 FROM goals WHERE id = ? AND user_id = ?").get(id, userId))
    throw new ApiError("Meta não encontrada.", 404);
  const sets: string[] = [];
  const vals: Bind[] = [];
  if (patch.name !== undefined) (sets.push("name = ?"), vals.push(patch.name));
  if (patch.targetAmount !== undefined) (sets.push("target_amount = ?"), vals.push(patch.targetAmount));
  if (patch.targetMonth !== undefined) (sets.push("target_month = ?"), vals.push(patch.targetMonth));
  if (patch.color !== undefined) (sets.push("color = ?"), vals.push(patch.color));
  if (sets.length) db.prepare(`UPDATE goals SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
}

export function deleteGoal(userId: string, id: string) {
  const r = getDb().prepare("DELETE FROM goals WHERE id = ? AND user_id = ?").run(id, userId);
  if (!r.changes) throw new ApiError("Meta não encontrada.", 404);
}

export function goalStats(userId: string): GoalStat[] {
  const db = getDb();
  const goals = db
    .prepare("SELECT * FROM goals WHERE user_id = ? ORDER BY created_at")
    .all(userId) as Row[];
  const hist = db
    .prepare(
      `SELECT e.goal_id AS goal_id, b.ym AS ym,
              SUM(e.amount) AS total,
              SUM(CASE WHEN e.status = 'done' THEN e.amount ELSE 0 END) AS done
         FROM entries e JOIN blocks b ON b.id = e.block_id
        WHERE e.user_id = ? AND e.goal_id IS NOT NULL
        GROUP BY e.goal_id, b.ym ORDER BY b.ym`,
    )
    .all(userId) as Row[];

  return goals.map((g) => {
    const history = hist
      .filter((h) => h.goal_id === g.id)
      .map((h) => ({ ym: h.ym as string, total: h.total as number, done: h.done as number }));
    const saved = history.reduce((s, h) => s + h.done, 0);
    const planned = history.reduce((s, h) => s + (h.total - h.done), 0);
    const last3 = history.slice(-3);
    const monthlyAvg = last3.length
      ? Math.round(last3.reduce((s, h) => s + h.total, 0) / last3.length)
      : 0;
    return {
      id: g.id,
      name: g.name,
      color: g.color,
      targetAmount: g.target_amount,
      targetMonth: g.target_month,
      saved,
      planned,
      monthlyAvg,
      history,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Visão anual                                                         */
/* ------------------------------------------------------------------ */

export function annual(userId: string, year: number): AnnualPayload {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT b.ym AS ym, b.kind AS kind, COALESCE(SUM(e.amount), 0) AS total
         FROM blocks b LEFT JOIN entries e ON e.block_id = b.id
        WHERE b.user_id = ? AND b.ym LIKE ? AND b.kind != 'total'
        GROUP BY b.ym, b.kind`,
    )
    .all(userId, `${year}-%`) as Row[];
  const months = Array.from({ length: 12 }, (_, i) => ({
    ym: `${year}-${String(i + 1).padStart(2, "0")}`,
    income: 0,
    expense: 0,
    savings: 0,
  }));
  for (const r of rows) {
    const m = months.find((x) => x.ym === r.ym);
    if (m) m[r.kind as EntryKind] += r.total;
  }
  const categories = (
    db
      .prepare(
        `SELECT MIN(b.name) AS name, b.kind AS kind, COALESCE(SUM(e.amount), 0) AS total
           FROM blocks b LEFT JOIN entries e ON e.block_id = b.id
          WHERE b.user_id = ? AND b.ym LIKE ? AND b.kind != 'total'
          GROUP BY lower(b.name), b.kind
          ORDER BY total DESC`,
      )
      .all(userId, `${year}-%`) as Row[]
  ).map((r) => ({ name: r.name as string, kind: r.kind as EntryKind, total: r.total as number }));

  const carry = carryBefore(userId, `${year}-01`);
  return { year, carryIn: carry.planned, months, categories };
}

/* ------------------------------------------------------------------ */
/* Painel                                                              */
/* ------------------------------------------------------------------ */

/** Até 6 meses terminando em `ym` (só os iniciados) e o próximo, se existir. */
export function dashboard(userId: string, ym: string): DashboardPayload {
  const db = getDb();
  const from = addMonths(ym, -5);
  const next = addMonths(ym, 1);
  const rows = db
    .prepare("SELECT ym FROM months WHERE user_id = ? AND ym >= ? AND ym <= ? ORDER BY ym")
    .all(userId, from, next) as Row[];
  const yms = rows.map((r) => r.ym as string);
  const load = (m: string) => ({ ym: m, blocks: getMonth(userId, m).blocks });
  return {
    ym,
    members: listMembers(userId),
    carry: carryBefore(userId, ym),
    months: yms.filter((m) => m <= ym).map(load),
    next: yms.includes(next) ? load(next) : null,
  };
}

/* ------------------------------------------------------------------ */
/* Exportação                                                          */
/* ------------------------------------------------------------------ */

export function exportAll(userId: string) {
  const db = getDb();
  const user = findUserById(userId);
  const months = db
    .prepare("SELECT ym FROM months WHERE user_id = ? ORDER BY ym")
    .all(userId) as Row[];
  return {
    exportedAt: new Date().toISOString(),
    user: { name: user?.name, email: user?.email },
    members: listMembers(userId),
    goals: goalStats(userId).map(({ history: _h, ...g }) => g),
    months: months.map((m) => {
      const p = getMonth(userId, m.ym);
      return { ym: m.ym, blocks: p.blocks };
    }),
  };
}
