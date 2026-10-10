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
import { addMonths, currentYmIn, daysInMonth, diffMonths, monthRange, MONTHS_LONG, shiftDateToMonth } from "./dates";
import { computeSummary } from "./summary";
import { faturaYm, hasCycle } from "./card";
import { cleanPattern } from "./statement";
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
  SurplusInfo,
  SurplusMode,
} from "./types";

type Bind = string | number | null;

const uid = () => crypto.randomUUID();

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

// colunas jsonb já chegam como objeto
function parseJson<T>(s: unknown, fallback: T): T {
  if (s == null) return fallback;
  if (typeof s !== "string") return s as T;
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
    cardClose: r.card_close ?? null,
    cardDue: r.card_due ?? null,
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
    target: r.target ?? null,
    extra: parseJson<Record<string, ExtraValue>>(r.extra, {}),
    position: r.position,
    ref: r.ref ?? null,
    sign: r.sign === -1 ? -1 : 1,
    payWith: r.pay_with ?? null,
    installment: r.inst_no ? { id: r.inst_id ?? null, no: r.inst_no, count: r.inst_count } : null,
  };
}

/* ------------------------------------------------------------------ */
/* Usuários                                                            */
/* ------------------------------------------------------------------ */

export async function findUserByEmail(email: string) {
  return await getDb().prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
}

export async function findUserById(id: string) {
  return await getDb().prepare("SELECT * FROM users WHERE id = ?").get(id);
}

export async function createUser(name: string, email: string, passwordHash: string) {
  const id = uid();
  await getDb()
    .prepare("INSERT INTO users (id, name, email, password_hash) VALUES (?,?,?,?)")
    .run(id, name, email.toLowerCase(), passwordHash);
  return { id, name, email: email.toLowerCase() };
}

export async function updateUserName(id: string, name: string) {
  await getDb().prepare("UPDATE users SET name = ? WHERE id = ?").run(name, id);
}

export async function updateUserPassword(id: string, hash: string) {
  await getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, id);
}

export async function deleteUser(id: string) {
  await getDb().prepare("DELETE FROM users WHERE id = ?").run(id);
}

/* ------------------------------------------------------------------ */
/* Pessoas da casa                                                     */
/* ------------------------------------------------------------------ */

export async function listMembers(userId: string): Promise<Member[]> {
  return (
    await getDb().prepare("SELECT * FROM members WHERE user_id = ? ORDER BY position, created_at").all(userId)
  ).map((r) => ({ id: r.id, name: r.name, color: r.color, position: r.position }));
}

async function assertMember(userId: string, memberId: string | null | undefined) {
  if (!memberId) return;
  const m = await getDb().prepare("SELECT 1 FROM members WHERE id = ? AND user_id = ?").get(memberId, userId);
  if (!m) throw new ApiError("Pessoa não encontrada.", 404);
}

export async function createMember(userId: string, input: { name: string; color?: string }): Promise<Member> {
  const db = getDb();
  const count = (await db.prepare("SELECT COUNT(*) AS c FROM members WHERE user_id = ?").get(userId))!.c as number;
  if (count >= 8) throw new ApiError("No máximo 8 pessoas por conta.");
  const id = uid();
  const color = input.color ?? MEMBER_COLORS[count % MEMBER_COLORS.length];
  await db.prepare("INSERT INTO members (id, user_id, name, color, position) VALUES (?,?,?,?,?)").run(
    id,
    userId,
    input.name,
    color,
    count,
  );
  return { id, name: input.name, color, position: count };
}

export async function updateMember(userId: string, id: string, patch: { name?: string; color?: string }) {
  await assertMember(userId, id);
  const db = getDb();
  if (patch.name !== undefined) await db.prepare("UPDATE members SET name = ? WHERE id = ?").run(patch.name, id);
  if (patch.color !== undefined) await db.prepare("UPDATE members SET color = ? WHERE id = ?").run(patch.color, id);
}

/** As tabelas da pessoa passam a ser do conjunto; nada é apagado. */
export async function deleteMember(userId: string, id: string) {
  await assertMember(userId, id);
  await getDb().prepare("DELETE FROM members WHERE id = ?").run(id);
}

/* ------------------------------------------------------------------ */
/* Mês                                                                 */
/* ------------------------------------------------------------------ */

/** Saldo acumulado de todos os meses anteriores a `ym`. */
async function carryBefore(userId: string, ym: string): Promise<Carry> {
  const db = getDb();
  // linhas de cartão (na tabela do cartão ou pagas com ele) só viram realizado
  // quando a fatura é paga: aí conta o valor pago (card_paid)
  const rows = await db
    .prepare(
      `SELECT b.kind AS kind,
              COALESCE(SUM(e.amount), 0) AS total,
              COALESCE(SUM(CASE WHEN e.status = 'done' AND b.card = 0 AND c.id IS NULL THEN e.amount ELSE 0 END), 0) AS done
         FROM entries e JOIN blocks b ON b.id = e.block_id
         LEFT JOIN blocks c ON c.id = e.pay_with AND c.card = 1 AND c.kind = 'expense'
        WHERE b.user_id = ? AND b.ym < ? AND b.kind != 'total'
        GROUP BY b.kind`,
    )
    .all(userId, ym);
  const carry: Carry = { planned: 0, realized: 0 };
  for (const r of rows) {
    const sign = r.kind === "income" ? 1 : -1;
    carry.planned += sign * r.total;
    carry.realized += sign * r.done;
  }
  const paid = (await db
    .prepare(
      `SELECT COALESCE(SUM(card_paid), 0) AS p FROM blocks
        WHERE user_id = ? AND ym < ? AND card = 1 AND kind = 'expense'`,
    )
    .get(userId, ym))!;
  carry.realized -= paid.p as number;
  return carry;
}

export async function getMonth(userId: string, ym: string): Promise<MonthPayload> {
  const db = getDb();
  // o banco é remoto: as consultas independentes vão juntas
  const [monthRow, prev, blocks, goals, members, carry] = await Promise.all([
    db.prepare("SELECT auto_from FROM months WHERE user_id = ? AND ym = ?").get(userId, ym),
    db.prepare("SELECT ym FROM months WHERE user_id = ? AND ym < ? ORDER BY ym DESC LIMIT 1").get(userId, ym),
    monthBlocks(userId, ym),
    db.prepare("SELECT id, name, color FROM goals WHERE user_id = ? ORDER BY created_at").all(userId) as Promise<
      GoalLite[]
    >,
    listMembers(userId),
    carryBefore(userId, ym),
  ]);
  const initialized = !!monthRow;

  return {
    ym,
    initialized,
    autoFrom: (monthRow?.auto_from as string | null) ?? null,
    previousYm: prev?.ym ?? null,
    blocks,
    goals,
    members,
    carry,
    // só o mês atual mostra a sobra do mês que fechou
    surplus: initialized && ym === currentYmIn(APP_TIMEZONE) ? await surplusInfo(userId, ym) : null,
  };
}

async function insertBlock(
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
    cardClose?: number | null;
    cardDue?: number | null;
  },
): Promise<string> {
  const id = uid();
  const isCard = b.kind === "expense" && !!b.card;
  await getDb()
    .prepare(
      `INSERT INTO blocks (id, user_id, ym, name, kind, budget_type, budget_value, columns, position, member_id, source, card, card_close, card_due)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
      isCard ? 1 : 0,
      isCard ? (b.cardClose ?? null) : null,
      isCard ? (b.cardDue ?? null) : null,
    );
  return id;
}

export type StartMode = "default" | "blank" | "copy" | "structure";

export async function initMonth(userId: string, ym: string, mode: StartMode) {
  const db = getDb();
  const exists = await db.prepare("SELECT 1 FROM months WHERE user_id = ? AND ym = ?").get(userId, ym);
  if (exists) return;

  await db.transaction(async () => {
    if (mode === "default") {
      for (const [i, t] of DEFAULT_BLOCKS.entries())
        await insertBlock(userId, ym, {
          ...t,
          columns: t.columns.map((c) => ({ id: "c_" + uid().slice(0, 8), ...c })),
          position: i,
        });
    } else if (mode === "copy" || mode === "structure") {
      const prev = await db
        .prepare("SELECT ym FROM months WHERE user_id = ? AND ym < ? ORDER BY ym DESC LIMIT 1")
        .get(userId, ym);
      if (!prev) throw new ApiError("Não existe um mês anterior para copiar.");
      const blocks = await db
        .prepare("SELECT * FROM blocks WHERE user_id = ? AND ym = ? ORDER BY position, created_at")
        .all(userId, prev.ym);
      const insertEntry = db.prepare(
        `INSERT INTO entries (id, block_id, user_id, description, amount, date, status, goal_id, target, extra, position, ref, sign, pay_with)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      );
      // compras de cartão com fechamento: a fatura de outubro tem compras de setembro, então
      // a data anda o mesmo número de meses em vez de cair dentro do mês novo
      const cycleCards = new Set(blocks.filter((b) => hasCycle(mapBlock(b))).map((b) => b.id as string));
      const gap = diffMonths(prev.ym, ym);
      const newDate = (date: string | null, cardish: boolean) =>
        cardish && date ? shiftDateToMonth(date, addMonths(date.slice(0, 7), gap)) : shiftDateToMonth(date, ym);
      // 1º cria as tabelas, 2º as linhas: assim dá para trocar os ids das referências
      const ids = new Map<string, string>();
      for (const br of blocks) ids.set(br.id, await insertBlock(userId, ym, mapBlock(br)));
      for (const br of blocks) {
        const nb = mapBlock(br);
        const newId = ids.get(br.id)!;
        if (nb.source) await db.prepare("UPDATE blocks SET source = ? WHERE id = ?").run(remapRef(nb.source, ids), newId);
        // linhas de tabelas de total são estrutura (fórmulas): copiadas nos dois modos
        if (mode === "copy" || nb.kind === "total") {
          // parcelas não são copiadas: cada mês recebe a sua (materializeInstallments)
          const entries = await db
            .prepare("SELECT * FROM entries WHERE block_id = ? AND inst_no IS NULL ORDER BY position, created_at")
            .all(br.id);
          for (const er of entries) {
            const e = mapEntry(er);
            // datas do tipo "data" nas colunas extras também acompanham o novo mês
            const extra = { ...e.extra };
            for (const c of nb.columns) {
              if (c.type === "date" && typeof extra[c.id] === "string") {
                extra[c.id] = shiftDateToMonth(extra[c.id] as string, ym);
              }
            }
            await insertEntry.run(
              uid(),
              newId,
              userId,
              e.description,
              e.amount,
              newDate(e.date, cycleCards.has(br.id) || (!!e.payWith && cycleCards.has(e.payWith))),
              "pending",
              e.goalId,
              e.target,
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
    await db.prepare("INSERT INTO months (user_id, ym) VALUES (?,?)").run(userId, ym);
    await materializeInstallments(userId, ym);
    await materializeDeferred(userId, ym);
  });
}

/* ------------------------------------------------------------------ */
/* Mês novo aberto sozinho                                             */
/* ------------------------------------------------------------------ */

export type AutoMonth = "copy" | "structure" | "off";

/** Fuso usado para decidir quando o mês vira (o servidor pode estar em UTC). */
export const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Sao_Paulo";

export async function getAutoMonth(userId: string): Promise<AutoMonth> {
  const r = await getDb().prepare("SELECT auto_month FROM users WHERE id = ?").get(userId);
  return (r?.auto_month as AutoMonth) ?? "copy";
}

export async function setAutoMonth(userId: string, mode: AutoMonth) {
  await getDb().prepare("UPDATE users SET auto_month = ? WHERE id = ?").run(mode, userId);
}

/**
 * Abre `ym` sozinho, copiando o último mês iniciado, conforme a preferência da conta.
 * Só para quem já usa a planilha: sem mês anterior, a escolha de como começar fica com a pessoa.
 */
export async function autoStartMonth(userId: string, ym: string) {
  const db = getDb();
  if (await db.prepare("SELECT 1 FROM months WHERE user_id = ? AND ym = ?").get(userId, ym)) return;
  const mode = await getAutoMonth(userId);
  if (mode === "off") return;
  const prev = await db
    .prepare("SELECT ym FROM months WHERE user_id = ? AND ym < ? ORDER BY ym DESC LIMIT 1")
    .get(userId, ym);
  if (!prev) return;
  await db.transaction(async () => {
    await initMonth(userId, ym, mode);
    await db.prepare("UPDATE months SET auto_from = ? WHERE user_id = ? AND ym = ?").run(prev.ym, userId, ym);
  });
}

export async function dismissAutoNotice(userId: string, ym: string) {
  await getDb().prepare("UPDATE months SET auto_from = NULL WHERE user_id = ? AND ym = ?").run(userId, ym);
}

/* ------------------------------------------------------------------ */
/* Sobra do mês para o cofrinho                                        */
/* ------------------------------------------------------------------ */

/*
 * Quando um mês fecha no azul, a sobra (saldo previsto do mês) pode virar uma
 * linha de cofrinho naquele mês, apontando para uma meta. Assim ela sai do
 * saldo acumulado e passa a contar no progresso da meta. O estado fica em
 * `months` (surplus_state) para não perguntar nem guardar duas vezes.
 */

export interface SurplusPrefs {
  mode: SurplusMode;
  goalId: string | null;
  pct: number;
}

export async function getSurplusPrefs(userId: string): Promise<SurplusPrefs> {
  const db = getDb();
  const r = await db.prepare("SELECT surplus_mode, surplus_goal, surplus_pct FROM users WHERE id = ?").get(userId);
  // a meta pode ter sido excluída depois de escolhida
  const goal =
    r?.surplus_goal && (await db.prepare("SELECT 1 FROM goals WHERE id = ? AND user_id = ?").get(r.surplus_goal, userId))
      ? (r.surplus_goal as string)
      : null;
  return { mode: (r?.surplus_mode as SurplusMode) ?? "ask", goalId: goal, pct: r?.surplus_pct ?? 100 };
}

export async function setSurplusPrefs(userId: string, patch: Partial<SurplusPrefs>) {
  const db = getDb();
  if (patch.mode !== undefined) await db.prepare("UPDATE users SET surplus_mode = ? WHERE id = ?").run(patch.mode, userId);
  if (patch.goalId !== undefined) {
    await assertGoal(userId, patch.goalId);
    await db.prepare("UPDATE users SET surplus_goal = ? WHERE id = ?").run(patch.goalId, userId);
  }
  if (patch.pct !== undefined) await db.prepare("UPDATE users SET surplus_pct = ? WHERE id = ?").run(patch.pct, userId);
}

/** Último mês iniciado antes de `ym`. */
async function monthBefore(userId: string, ym: string): Promise<Row | undefined> {
  return await getDb()
    .prepare("SELECT * FROM months WHERE user_id = ? AND ym < ? ORDER BY ym DESC LIMIT 1")
    .get(userId, ym);
}

/**
 * Sobra de `ym`: saldo previsto do mês, sem passar do saldo acumulado
 * (se os meses anteriores ficaram no vermelho, a sobra cobre isso primeiro).
 */
export async function surplusAmount(userId: string, ym: string): Promise<number> {
  const m = await getMonth(userId, ym);
  const s = computeSummary(m.blocks, m.carry);
  return Math.max(0, Math.min(s.balance, s.accumulated));
}

/** O que mostrar no mês atual sobre a sobra do mês anterior. */
async function surplusInfo(userId: string, ym: string): Promise<SurplusInfo | null> {
  const prev = await monthBefore(userId, ym);
  if (!prev) return null;
  const prefs = await getSurplusPrefs(userId);
  if (prev.surplus_state === "saved") {
    if (prev.surplus_seen) return null;
    const e = await getDb()
      .prepare("SELECT amount, goal_id FROM entries WHERE id = ? AND user_id = ?")
      .get(prev.surplus_entry, userId);
    return e ? { ym: prev.ym, state: "saved", amount: e.amount, goalId: e.goal_id ?? null, pct: prefs.pct } : null;
  }
  if (prev.surplus_state || prefs.mode !== "ask") return null;
  const amount = await surplusAmount(userId, prev.ym);
  return amount > 0 ? { ym: prev.ym, state: "pending", amount, goalId: prefs.goalId, pct: prefs.pct } : null;
}

/** Guarda `pct`% da sobra de `ym` (mês já fechado) numa tabela de cofrinho do próprio mês. */
export async function saveSurplus(
  userId: string,
  ym: string,
  opts: { goalId: string | null; pct: number },
) {
  const db = getDb();
  if (ym >= currentYmIn(APP_TIMEZONE)) throw new ApiError("Este mês ainda não fechou.");
  await assertGoal(userId, opts.goalId);
  return await db.transaction(async () => {
    // FOR UPDATE: duas abas guardando a sobra ao mesmo tempo não gravam duas vezes
    const month = await db
      .prepare("SELECT surplus_state FROM months WHERE user_id = ? AND ym = ? FOR UPDATE")
      .get(userId, ym);
    if (!month) throw new ApiError("Mês não encontrado.", 404);
    if (month.surplus_state) throw new ApiError("A sobra deste mês já foi decidida.");
    const amount = Math.round(((await surplusAmount(userId, ym)) * opts.pct) / 100);
    if (amount <= 0) throw new ApiError("Este mês não teve sobra.");

    // de preferência uma tabela de cofrinho do conjunto; sem nenhuma, cria "Cofrinho"
    let block = await db
      .prepare(
        `SELECT id FROM blocks WHERE user_id = ? AND ym = ? AND kind = 'savings'
          ORDER BY (member_id IS NULL) DESC, position LIMIT 1`,
      )
      .get(userId, ym);
    if (!block) {
      const pos = (await db
        .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM blocks WHERE user_id = ? AND ym = ?")
        .get(userId, ym))!.p as number;
      block = {
        id: await insertBlock(userId, ym, {
          name: "Cofrinho",
          kind: "savings",
          budgetType: "none",
          budgetValue: 0,
          columns: [],
          position: pos,
        }),
      };
    }
    const pos = (await db
      .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM entries WHERE block_id = ?")
      .get(block.id))!.p as number;
    const id = uid();
    await db.prepare(
      `INSERT INTO entries (id, block_id, user_id, description, amount, date, status, goal_id, position)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      block.id,
      userId,
      `Sobra de ${MONTHS_LONG[Number(ym.slice(5)) - 1]}`,
      amount,
      monthRange(ym).max,
      "done",
      opts.goalId,
      pos,
    );
    await db.prepare(
      "UPDATE months SET surplus_state = 'saved', surplus_entry = ?, surplus_seen = 0 WHERE user_id = ? AND ym = ?",
    ).run(id, userId, ym);
    return { amount };
  });
}

/** Modo "guardar sozinho": na virada, guarda a sobra do último mês fechado. */
export async function autoSaveSurplus(userId: string, currentYm: string) {
  const prefs = await getSurplusPrefs(userId);
  if (prefs.mode !== "auto") return;
  const prev = await monthBefore(userId, currentYm);
  if (!prev || prev.surplus_state || (await surplusAmount(userId, prev.ym)) <= 0) return;
  await saveSurplus(userId, prev.ym, { goalId: prefs.goalId, pct: prefs.pct });
}

export async function skipSurplus(userId: string, ym: string) {
  await getDb()
    .prepare("UPDATE months SET surplus_state = 'skipped' WHERE user_id = ? AND ym = ? AND surplus_state IS NULL")
    .run(userId, ym);
}

/** Desfaz a sobra guardada: apaga a linha do cofrinho e não pergunta de novo. */
export async function undoSurplus(userId: string, ym: string) {
  const db = getDb();
  const m = await db.prepare("SELECT surplus_state, surplus_entry FROM months WHERE user_id = ? AND ym = ?").get(userId, ym);
  if (!m || m.surplus_state !== "saved") return;
  await db.transaction(async () => {
    if (m.surplus_entry) await db.prepare("DELETE FROM entries WHERE id = ? AND user_id = ?").run(m.surplus_entry, userId);
    await db.prepare(
      "UPDATE months SET surplus_state = 'skipped', surplus_entry = NULL, surplus_seen = 1 WHERE user_id = ? AND ym = ?",
    ).run(userId, ym);
  });
}

export async function dismissSurplus(userId: string, ym: string) {
  await getDb().prepare("UPDATE months SET surplus_seen = 1 WHERE user_id = ? AND ym = ?").run(userId, ym);
}

/* ------------------------------------------------------------------ */
/* Tabelas (blocos)                                                    */
/* ------------------------------------------------------------------ */

async function ownedBlock(userId: string, id: string): Promise<Row> {
  const r = await getDb().prepare("SELECT * FROM blocks WHERE id = ? AND user_id = ?").get(id, userId);
  if (!r) throw new ApiError("Tabela não encontrada.", 404);
  return r;
}

export async function createBlock(
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
): Promise<Block> {
  const db = getDb();
  await assertMember(userId, input.memberId);
  const pos = (await db
    .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM blocks WHERE user_id = ? AND ym = ?")
    .get(userId, input.ym))!.p as number;
  // criar uma tabela também "inicia" o mês, caso ainda não exista
  const newMonth =
    (await db.prepare("INSERT INTO months (user_id, ym) VALUES (?,?) ON CONFLICT DO NOTHING").run(userId, input.ym))
      .changes > 0;
  const id = await insertBlock(userId, input.ym, {
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
  const entries: Entry[] = [];
  for (const r of input.rows ?? []) entries.push(await createEntry(userId, id, r));
  if (newMonth) await materializeInstallments(userId, input.ym);
  return { ...mapBlock(await ownedBlock(userId, id)), entries };
}

export async function updateBlock(
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
    cardClose?: number | null;
    cardDue?: number | null;
  },
) {
  const db = getDb();
  const current = await ownedBlock(userId, id);
  if ((patch.card || patch.cardPaid != null) && current.kind !== "expense")
    throw new ApiError("Só tabelas de despesa podem ser cartão de crédito.");
  const cycle = patch.cardClose !== undefined || patch.cardDue !== undefined;
  if (cycle) {
    if (!(patch.card ?? current.card === 1)) throw new ApiError("Fechamento e vencimento são de cartões de crédito.");
    const close = patch.cardClose !== undefined ? patch.cardClose : current.card_close;
    const due = patch.cardDue !== undefined ? patch.cardDue : current.card_due;
    if (close && due && close === due) throw new ApiError("O fechamento e o vencimento não podem ser no mesmo dia.");
  }
  await assertMember(userId, patch.memberId);
  await db.transaction(async () => {
    if (patch.memberId !== undefined)
      await db.prepare("UPDATE blocks SET member_id = ? WHERE id = ?").run(patch.memberId, id);
    if (patch.source !== undefined) await db.prepare("UPDATE blocks SET source = ? WHERE id = ?").run(patch.source, id);
    if (patch.name !== undefined) await db.prepare("UPDATE blocks SET name = ? WHERE id = ?").run(patch.name, id);
    if (patch.card !== undefined) {
      await db.prepare("UPDATE blocks SET card = ? WHERE id = ?").run(patch.card ? 1 : 0, id);
      if (patch.card) {
        // um cartão não é pago com outro cartão
        await db.prepare("UPDATE entries SET pay_with = NULL WHERE block_id = ?").run(id);
      } else {
        // deixou de ser cartão: as despesas pagas com ele voltam a sair do saldo
        await db.prepare("UPDATE blocks SET card_paid = NULL WHERE id = ?").run(id);
        await db.prepare("UPDATE entries SET pay_with = NULL WHERE pay_with = ?").run(id);
      }
    }
    if (patch.cardPaid !== undefined)
      await db.prepare("UPDATE blocks SET card_paid = ? WHERE id = ?").run(patch.cardPaid, id);
    if (cycle) {
      // o cartão é o mesmo nos meses seguintes: eles acompanham a mudança
      const sets = [
        ...(patch.cardClose !== undefined ? ["card_close = ?"] : []),
        ...(patch.cardDue !== undefined ? ["card_due = ?"] : []),
      ];
      const vals = [
        ...(patch.cardClose !== undefined ? [patch.cardClose] : []),
        ...(patch.cardDue !== undefined ? [patch.cardDue] : []),
      ];
      await db.prepare(
        `UPDATE blocks SET ${sets.join(", ")}
          WHERE user_id = ? AND card = 1
            AND (id = ? OR (ym > ? AND lower(name) = lower(?) AND member_id IS NOT DISTINCT FROM ?))`,
      ).run(...vals, userId, id, current.ym, current.name, current.member_id ?? null);
    }
    if (patch.budgetType !== undefined)
      await db.prepare("UPDATE blocks SET budget_type = ?, budget_value = ? WHERE id = ?").run(
        patch.budgetType,
        patch.budgetType === "none" ? 0 : (patch.budgetValue ?? 0),
        id,
      );
    if (patch.columns !== undefined) {
      await db.prepare("UPDATE blocks SET columns = ? WHERE id = ?").run(JSON.stringify(patch.columns), id);
      // remove das linhas os valores de colunas que deixaram de existir
      const keep = new Set(patch.columns.map((c) => c.id));
      const rows = await db.prepare("SELECT id, extra FROM entries WHERE block_id = ?").all(id);
      for (const r of rows) {
        const extra = parseJson<Record<string, ExtraValue>>(r.extra, {});
        const cleaned: Record<string, ExtraValue> = {};
        for (const k of Object.keys(extra)) if (keep.has(k)) cleaned[k] = extra[k];
        if (Object.keys(cleaned).length !== Object.keys(extra).length)
          await db.prepare("UPDATE entries SET extra = ? WHERE id = ?").run(JSON.stringify(cleaned), r.id);
      }
    }
  });
}

export async function deleteBlock(userId: string, id: string) {
  await ownedBlock(userId, id);
  await getDb().prepare("DELETE FROM blocks WHERE id = ?").run(id);
}

/** Cartão onde a linha pode ser lançada: do mesmo usuário e mês, e a linha é de uma despesa comum. */
async function assertPayWith(userId: string, blockRow: Row, payWith: string | null | undefined) {
  if (!payWith) return;
  if (blockRow.kind !== "expense" || blockRow.card === 1)
    throw new ApiError("Só despesas podem ser pagas com cartão.");
  const c = await getDb()
    .prepare("SELECT 1 FROM blocks WHERE id = ? AND user_id = ? AND ym = ? AND card = 1 AND kind = 'expense'")
    .get(payWith, userId, blockRow.ym);
  if (!c) throw new ApiError("Cartão não encontrado neste mês.", 404);
}

/** Nova ordem das tabelas do mês (arrastar e soltar). Ids desconhecidos são ignorados. */
export async function reorderBlocks(userId: string, ym: string, ids: string[]) {
  const db = getDb();
  const st = db.prepare("UPDATE blocks SET position = ? WHERE id = ? AND user_id = ? AND ym = ?");
  await db.transaction(async () => {
    for (const [i, id] of ids.entries()) await st.run(i, id, userId, ym);
  });
}

export async function completeBlock(userId: string, id: string, status: Status) {
  await ownedBlock(userId, id);
  await getDb().prepare("UPDATE entries SET status = ? WHERE block_id = ?").run(status, id);
}

/* ------------------------------------------------------------------ */
/* Linhas                                                              */
/* ------------------------------------------------------------------ */

async function ownedEntry(userId: string, id: string): Promise<Row> {
  const r = await getDb().prepare("SELECT * FROM entries WHERE id = ? AND user_id = ?").get(id, userId);
  if (!r) throw new ApiError("Lançamento não encontrado.", 404);
  return r;
}

async function assertGoal(userId: string, goalId: string | null | undefined) {
  if (!goalId) return;
  const g = await getDb().prepare("SELECT 1 FROM goals WHERE id = ? AND user_id = ?").get(goalId, userId);
  if (!g) throw new ApiError("Meta não encontrada.", 404);
}

export async function createEntry(
  userId: string,
  blockId: string,
  init: Partial<Pick<Entry, "description" | "amount" | "date" | "status" | "goalId" | "target" | "ref" | "sign" | "payWith">> = {},
): Promise<Entry> {
  const db = getDb();
  const block = await ownedBlock(userId, blockId);
  await assertGoal(userId, init.goalId);
  await assertPayWith(userId, block, init.payWith);
  const pos = (await db
    .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM entries WHERE block_id = ?")
    .get(blockId))!.p as number;
  const id = uid();
  await db.prepare(
    `INSERT INTO entries (id, block_id, user_id, description, amount, date, status, goal_id, target, position, ref, sign, pay_with)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    blockId,
    userId,
    init.description ?? "",
    init.amount ?? 0,
    init.date ?? null,
    init.status ?? "pending",
    init.goalId ?? null,
    init.target ?? null,
    pos,
    init.ref ?? null,
    init.sign ?? 1,
    init.payWith ?? null,
  );
  return mapEntry(await ownedEntry(userId, id));
}

export async function updateEntry(
  userId: string,
  id: string,
  patch: Partial<Pick<Entry, "description" | "amount" | "date" | "status" | "goalId" | "target" | "extra" | "ref" | "sign" | "payWith">>,
) {
  const db = getDb();
  const current = await ownedEntry(userId, id);
  await assertGoal(userId, patch.goalId);
  if (patch.payWith) await assertPayWith(userId, await ownedBlock(userId, current.block_id), patch.payWith);
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
  if (patch.target !== undefined) add("target", patch.target);
  if (patch.ref !== undefined) add("ref", patch.ref);
  if (patch.sign !== undefined) add("sign", patch.sign);
  if (patch.payWith !== undefined) add("pay_with", patch.payWith);
  if (patch.extra !== undefined) {
    const block = mapBlock(await ownedBlock(userId, current.block_id));
    const allowed = new Set(block.columns.map((c) => c.id));
    const clean: Record<string, ExtraValue> = {};
    for (const [k, v] of Object.entries(patch.extra)) if (allowed.has(k)) clean[k] = v;
    add("extra", JSON.stringify(clean));
  }
  if (!sets.length) return;
  await db.prepare(`UPDATE entries SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
}

export async function deleteEntry(userId: string, id: string) {
  await ownedEntry(userId, id);
  await getDb().prepare("DELETE FROM entries WHERE id = ?").run(id);
}

/* ------------------------------------------------------------------ */
/* Compras parceladas                                                  */
/* ------------------------------------------------------------------ */

/*
 * Um parcelamento guarda a compra (valor total, nº de parcelas, mês da parcela
 * `first_no`) e a tabela onde as parcelas caem, pelo nome: as tabelas são
 * recriadas a cada mês, então "Nubank" de outubro e de novembro têm ids diferentes.
 * Cada parcela vira uma linha comum no mês dela, criada quando o parcelamento
 * é lançado (meses já iniciados) ou quando o mês é iniciado depois.
 */

/** Valor da parcela `no`: a primeira leva os centavos que sobram da divisão. */
export function installmentAmount(total: number, count: number, no: number): number {
  const each = Math.floor(total / count);
  return no === 1 ? total - each * (count - 1) : each;
}

/**
 * Tabela de despesa do mês com esse nome e dono; criada se ainda não existir.
 * O dono separa nomes parecidos ("Minhas contas" do marido e "Minhas Contas" da
 * esposa); `undefined` aceita qualquer dono. Entre as que servem, vale o nome idêntico.
 */
async function ensureExpenseBlock(
  userId: string,
  ym: string,
  name: string,
  card: boolean,
  memberId: string | null | undefined,
): Promise<string> {
  const db = getDb();
  // pessoa excluída depois do lançamento: as tabelas dela passaram a ser do conjunto
  if (memberId && !(await db.prepare("SELECT 1 FROM members WHERE id = ? AND user_id = ?").get(memberId, userId)))
    memberId = null;
  const found = await db
    .prepare(
      `SELECT id FROM blocks WHERE user_id = ? AND ym = ? AND kind = 'expense' AND card = ? AND lower(name) = lower(?)
          AND (?::int = 1 OR member_id IS NOT DISTINCT FROM ?::text)
        ORDER BY (name = ?) DESC, position LIMIT 1`,
    )
    .get(userId, ym, card ? 1 : 0, name, memberId === undefined ? 1 : 0, memberId ?? null, name);
  if (found) return found.id;
  const pos = (await db
    .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM blocks WHERE user_id = ? AND ym = ?")
    .get(userId, ym))!.p as number;
  // cartão novo no mês: herda limite, fechamento e vencimento da última vez que existiu
  const last = card
    ? await db
        .prepare(
          `SELECT budget_type, budget_value, card_close, card_due FROM blocks
            WHERE user_id = ? AND card = 1 AND lower(name) = lower(?) ORDER BY ym DESC LIMIT 1`,
        )
        .get(userId, name)
    : undefined;
  return await insertBlock(userId, ym, {
    name,
    kind: "expense",
    budgetType: last?.budget_type ?? "none",
    budgetValue: last?.budget_value ?? 0,
    columns: [],
    position: pos,
    memberId: memberId ?? null,
    card,
    cardClose: last?.card_close ?? null,
    cardDue: last?.card_due ?? null,
  });
}

/** Linhas de cartão guardadas para `ym` (movidas para uma fatura de mês ainda não iniciado). */
async function materializeDeferred(userId: string, ym: string) {
  const db = getDb();
  const rows = await db
    .prepare("SELECT * FROM deferred_entries WHERE user_id = ? AND ym = ? ORDER BY created_at")
    .all(userId, ym);
  for (const d of rows) {
    const blockId = await ensureExpenseBlock(userId, ym, d.block_name, d.block_card === 1, d.block_member_id);
    const payWith = d.pay_with_name ? await ensureExpenseBlock(userId, ym, d.pay_with_name, true, undefined) : null;
    const pos = (await db
      .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM entries WHERE block_id = ?")
      .get(blockId))!.p as number;
    await db.prepare(
      `INSERT INTO entries (id, block_id, user_id, description, amount, date, status, extra, position, pay_with)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ).run(uid(), blockId, userId, d.description, d.amount, d.date, d.status, JSON.stringify(d.extra), pos, payWith);
    await db.prepare("DELETE FROM deferred_entries WHERE id = ?").run(d.id);
  }
}

/**
 * Compras do cartão `cardId` que, pela data, são de outra fatura: vão para o
 * cartão (ou a tabela, se paga com o cartão) do mês certo. Se esse mês ainda
 * não foi iniciado, ficam guardadas e entram quando ele for. Parcelas ficam.
 * `entryIds` limita a algumas linhas; sem ele, move todas as que estão fora.
 */
export async function moveToFatura(userId: string, cardId: string, entryIds?: string[]) {
  const db = getDb();
  const cardRow = await ownedBlock(userId, cardId);
  const card = mapBlock(cardRow);
  if (!hasCycle(card)) throw new ApiError("Informe o fechamento e o vencimento do cartão primeiro.");
  const rows = await db
    .prepare(
      `SELECT e.*, b.name AS b_name, b.card AS b_card, b.member_id AS b_member, b.columns AS b_columns
         FROM entries e JOIN blocks b ON b.id = e.block_id
        WHERE e.user_id = ? AND b.ym = ? AND e.inst_no IS NULL AND e.date IS NOT NULL
          AND (e.block_id = ? OR e.pay_with = ?)`,
    )
    .all(userId, card.ym, cardId, cardId);
  const only = entryIds ? new Set(entryIds) : null;
  const moved: { id: string; ym: string; started: boolean }[] = [];
  await db.transaction(async () => {
    for (const r of rows) {
      if (only && !only.has(r.id)) continue;
      const target = faturaYm(r.date, card.cardClose!, card.cardDue!);
      if (target === card.ym) continue;
      const onCard = r.block_id === cardId;
      const started = !!(await db.prepare("SELECT 1 FROM months WHERE user_id = ? AND ym = ?").get(userId, target));
      if (started) {
        const blockId = onCard
          ? await ensureExpenseBlock(userId, target, card.name, true, card.memberId)
          : await ensureExpenseBlock(userId, target, r.b_name, false, r.b_member ?? null);
        const payWith = onCard ? null : await ensureExpenseBlock(userId, target, card.name, true, undefined);
        const pos = (await db
          .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM entries WHERE block_id = ?")
          .get(blockId))!.p as number;
        await db
          .prepare("UPDATE entries SET block_id = ?, pay_with = ?, position = ? WHERE id = ?")
          .run(blockId, payWith, pos, r.id);
      } else {
        await db.prepare(
          `INSERT INTO deferred_entries (id, user_id, ym, description, amount, date, status, extra, block_name, block_card, block_member_id, pay_with_name)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        ).run(
          uid(),
          userId,
          target,
          r.description,
          r.amount,
          r.date,
          r.status,
          JSON.stringify(r.extra),
          onCard ? card.name : r.b_name,
          onCard ? 1 : 0,
          onCard ? card.memberId : (r.b_member ?? null),
          onCard ? null : card.name,
        );
        await db.prepare("DELETE FROM entries WHERE id = ?").run(r.id);
      }
      moved.push({ id: r.id, ym: target, started });
    }
  });
  return { moved };
}

/** Compras guardadas para faturas de meses ainda não iniciados. */
export async function listDeferred(userId: string) {
  return (
    await getDb()
      .prepare("SELECT id, ym, description, amount, date, block_name FROM deferred_entries WHERE user_id = ? ORDER BY ym, date")
      .all(userId)
  ).map((r) => ({ id: r.id, ym: r.ym, description: r.description, amount: r.amount, date: r.date, blockName: r.block_name }));
}

/** Cria as parcelas que caem em `ym` e ainda não existem (só de `onlyId`, se informado). */
async function materializeInstallments(userId: string, ym: string, onlyId?: string) {
  const db = getDb();
  const plans = onlyId
    ? await db.prepare("SELECT * FROM installments WHERE user_id = ? AND start_ym <= ? AND id = ?").all(userId, ym, onlyId)
    : await db.prepare("SELECT * FROM installments WHERE user_id = ? AND start_ym <= ?").all(userId, ym);
  for (const p of plans) {
    const no = p.first_no + diffMonths(p.start_ym, ym);
    if (no > p.count) continue;
    if (await db.prepare("SELECT 1 FROM entries WHERE inst_id = ? AND inst_no = ?").get(p.id, no)) continue;
    const blockId = await ensureExpenseBlock(userId, ym, p.block_name, p.block_card === 1, p.block_member_id);
    const payWith = p.pay_with_name ? await ensureExpenseBlock(userId, ym, p.pay_with_name, true, undefined) : null;
    const pos = (await db
      .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM entries WHERE block_id = ?")
      .get(blockId))!.p as number;
    const day = p.day ? Math.min(p.day, daysInMonth(ym)) : null;
    await db.prepare(
      `INSERT INTO entries (id, block_id, user_id, description, amount, date, status, position, pay_with, inst_id, inst_no, inst_count)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      uid(),
      blockId,
      userId,
      p.description,
      installmentAmount(p.total_amount, p.count, no),
      day ? `${ym}-${String(day).padStart(2, "0")}` : null,
      "pending",
      pos,
      payWith,
      p.id,
      no,
      p.count,
    );
  }
}

/**
 * Lança uma compra parcelada a partir de uma tabela de despesa (cartão ou comum)
 * do mês. A parcela `currentNo` cai no mês da tabela; as seguintes, nos próximos.
 */
export async function createInstallment(
  userId: string,
  input: {
    blockId: string;
    description: string;
    total: number;
    count: number;
    currentNo: number;
    date?: string | null;
    payWith?: string | null;
  },
) {
  const db = getDb();
  const block = await ownedBlock(userId, input.blockId);
  if (block.kind !== "expense") throw new ApiError("Compras parceladas só entram em tabelas de despesa.");
  await assertPayWith(userId, block, input.payWith);
  const payWithName = input.payWith
    ? ((await db.prepare("SELECT name FROM blocks WHERE id = ?").get(input.payWith))!.name as string)
    : null;
  const id = uid();
  await db.transaction(async () => {
    await db.prepare(
      `INSERT INTO installments (id, user_id, description, total_amount, count, first_no, start_ym, day, block_name, block_card, block_member_id, pay_with_name)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      userId,
      input.description,
      input.total,
      input.count,
      input.currentNo,
      block.ym,
      input.date ? Number(input.date.slice(8, 10)) : null,
      block.name,
      block.card,
      block.member_id ?? null,
      payWithName,
    );
    // meses já iniciados recebem as parcelas agora; os outros, quando forem iniciados
    const last = addMonths(block.ym, input.count - input.currentNo);
    const months = await db
      .prepare("SELECT ym FROM months WHERE user_id = ? AND ym >= ? AND ym <= ? ORDER BY ym")
      .all(userId, block.ym, last);
    for (const m of months) await materializeInstallments(userId, m.ym, id);
  });
  return { id };
}

/** Encerra o parcelamento: apaga as parcelas de `fromYm` em diante e mantém as anteriores. */
export async function deleteInstallment(userId: string, id: string, fromYm: string) {
  const db = getDb();
  if (!(await db.prepare("SELECT 1 FROM installments WHERE id = ? AND user_id = ?").get(id, userId)))
    throw new ApiError("Parcelamento não encontrado.", 404);
  await db.transaction(async () => {
    await db.prepare(
      `DELETE FROM entries WHERE inst_id = ? AND user_id = ?
          AND block_id IN (SELECT id FROM blocks WHERE user_id = ? AND ym >= ?)`,
    ).run(id, userId, userId, fromYm);
    await db.prepare("DELETE FROM installments WHERE id = ?").run(id);
  });
}

/* ------------------------------------------------------------------ */
/* Importação de extrato                                               */
/* ------------------------------------------------------------------ */

/*
 * O arquivo é lido no navegador (lib/statement.ts); aqui chegam as linhas já
 * com a tabela escolhida. As regras ("ifood" -> Alimentação) guardam a tabela
 * pelo nome e dono, como os parcelamentos, e valem para qualquer mês.
 */

export interface ImportRule {
  id: string;
  pattern: string;
  blockName: string;
  memberId: string | null;
}

export async function listImportRules(userId: string): Promise<ImportRule[]> {
  return (
    await getDb()
      .prepare(
        "SELECT id, pattern, block_name, block_member_id FROM import_rules WHERE user_id = ? ORDER BY updated_at DESC, pattern",
      )
      .all(userId)
  ).map((r) => ({ id: r.id, pattern: r.pattern, blockName: r.block_name, memberId: r.block_member_id ?? null }));
}

/** Regras com a tabela correspondente no mês (mesmo nome e dono; senão, só o mesmo nome). */
export async function importPreview(userId: string, ym: string, keys: string[]) {
  const db = getDb();
  const [blocks, allRules, seenRows] = await Promise.all([
    db
      .prepare("SELECT id, name, member_id FROM blocks WHERE user_id = ? AND ym = ? AND kind != 'total' ORDER BY position")
      .all(userId, ym),
    listImportRules(userId),
    // uma consulta só para todas as chaves do extrato
    db
      .prepare("SELECT key FROM import_seen WHERE user_id = ? AND key = ANY(?::text[])")
      .all(userId, keys),
  ]);
  const rules = allRules.flatMap((r) => {
    const same = blocks.filter((b) => (b.name as string).trim().toLowerCase() === r.blockName.trim().toLowerCase());
    const b = same.find((x) => (x.member_id ?? null) === r.memberId) ?? same[0];
    return b ? [{ id: r.id, pattern: r.pattern, blockId: b.id as string }] : [];
  });
  const found = new Set(seenRows.map((r) => r.key as string));
  const seen = keys.filter((k) => found.has(k));
  return { rules, seen };
}

export async function importStatement(
  userId: string,
  input: {
    ym: string;
    payWith: string | null;
    rows: { key: string; blockId: string; description: string; amount: number; date: string }[];
    learn: { pattern: string; blockId: string }[];
  },
) {
  const db = getDb();
  const blocks = new Map(
    (
      await db.prepare("SELECT * FROM blocks WHERE user_id = ? AND ym = ? AND kind != 'total'").all(userId, input.ym)
    ).map((b) => [b.id as string, b]),
  );
  const block = (id: string) => {
    const b = blocks.get(id);
    if (!b) throw new ApiError("Uma das tabelas escolhidas não existe mais neste mês. Recarregue a página.", 404);
    return b;
  };
  if (input.payWith) {
    const c = blocks.get(input.payWith);
    if (!c || c.kind !== "expense" || c.card !== 1) throw new ApiError("Cartão não encontrado neste mês.", 404);
  }

  const nextPos = new Map<string, number>();
  const posSt = db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM entries WHERE block_id = ?");
  const insert = db.prepare(
    `INSERT INTO entries (id, block_id, user_id, description, amount, date, status, position, pay_with)
     VALUES (?,?,?,?,?,?,?,?,?)`,
  );
  const markSeen = db.prepare("INSERT INTO import_seen (user_id, key) VALUES (?, ?) ON CONFLICT DO NOTHING");
  const saveRule = db.prepare(
    `INSERT INTO import_rules (id, user_id, pattern, block_name, block_member_id) VALUES (?,?,?,?,?)
     ON CONFLICT (user_id, pattern) DO UPDATE SET
       block_name = excluded.block_name, block_member_id = excluded.block_member_id, updated_at = now()`,
  );

  let learned = 0;
  await db.transaction(async () => {
    for (const r of input.rows) {
      const b = block(r.blockId);
      const pos = nextPos.get(b.id) ?? ((await posSt.get(b.id))!.p as number);
      nextPos.set(b.id, pos + 1);
      // no extrato, saída é negativa; nas tabelas de despesa/cofrinho ela vira valor positivo
      // (uma entrada numa tabela de despesa, como um estorno, fica negativa e abate o total)
      const amount = b.kind === "income" ? r.amount : -r.amount;
      const payWith = input.payWith && b.kind === "expense" && b.card !== 1 ? input.payWith : null;
      await insert.run(uid(), b.id, userId, r.description, amount, r.date, "done", pos, payWith);
      await markSeen.run(userId, r.key);
    }
    for (const l of input.learn) {
      const pattern = cleanPattern(l.pattern);
      if (!pattern) continue;
      const b = block(l.blockId);
      await saveRule.run(uid(), userId, pattern, b.name, b.member_id ?? null);
      learned++;
    }
  });
  return { imported: input.rows.length, learned };
}

export async function updateImportRule(userId: string, id: string, pattern: string) {
  const clean = cleanPattern(pattern);
  if (!clean) throw new ApiError("A regra precisa de pelo menos uma palavra.");
  const db = getDb();
  if (!(await db.prepare("SELECT 1 FROM import_rules WHERE id = ? AND user_id = ?").get(id, userId)))
    throw new ApiError("Regra não encontrada.", 404);
  if (await db.prepare("SELECT 1 FROM import_rules WHERE user_id = ? AND pattern = ? AND id != ?").get(userId, clean, id))
    throw new ApiError("Já existe uma regra com essas palavras.");
  await db.prepare("UPDATE import_rules SET pattern = ? WHERE id = ?").run(clean, id);
  return { pattern: clean };
}

export async function deleteImportRule(userId: string, id: string) {
  await getDb().prepare("DELETE FROM import_rules WHERE id = ? AND user_id = ?").run(id, userId);
}

/* ------------------------------------------------------------------ */
/* Metas do cofrinho                                                   */
/* ------------------------------------------------------------------ */

export async function createGoal(
  userId: string,
  input: { name: string; targetAmount: number; targetMonth: string | null; color?: string },
) {
  const db = getDb();
  const count = (await db.prepare("SELECT COUNT(*) AS c FROM goals WHERE user_id = ?").get(userId))!.c as number;
  const id = uid();
  await db.prepare(
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

export async function updateGoal(
  userId: string,
  id: string,
  patch: { name?: string; targetAmount?: number; targetMonth?: string | null; color?: string },
) {
  const db = getDb();
  if (!(await db.prepare("SELECT 1 FROM goals WHERE id = ? AND user_id = ?").get(id, userId)))
    throw new ApiError("Meta não encontrada.", 404);
  const sets: string[] = [];
  const vals: Bind[] = [];
  if (patch.name !== undefined) (sets.push("name = ?"), vals.push(patch.name));
  if (patch.targetAmount !== undefined) (sets.push("target_amount = ?"), vals.push(patch.targetAmount));
  if (patch.targetMonth !== undefined) (sets.push("target_month = ?"), vals.push(patch.targetMonth));
  if (patch.color !== undefined) (sets.push("color = ?"), vals.push(patch.color));
  if (sets.length) await db.prepare(`UPDATE goals SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
}

export async function deleteGoal(userId: string, id: string) {
  const r = await getDb().prepare("DELETE FROM goals WHERE id = ? AND user_id = ?").run(id, userId);
  if (!r.changes) throw new ApiError("Meta não encontrada.", 404);
}

export async function goalStats(userId: string): Promise<GoalStat[]> {
  const db = getDb();
  const goals = await db.prepare("SELECT * FROM goals WHERE user_id = ? ORDER BY created_at").all(userId);
  const hist = await db
    .prepare(
      `SELECT e.goal_id AS goal_id, b.ym AS ym,
              SUM(e.amount) AS total,
              SUM(CASE WHEN e.status = 'done' THEN e.amount ELSE 0 END) AS done
         FROM entries e JOIN blocks b ON b.id = e.block_id
        WHERE e.user_id = ? AND e.goal_id IS NOT NULL
        GROUP BY e.goal_id, b.ym ORDER BY b.ym`,
    )
    .all(userId);

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

export async function annual(userId: string, year: number): Promise<AnnualPayload> {
  const db = getDb();
  const rows = await db
    .prepare(
      `SELECT b.ym AS ym, b.kind AS kind, COALESCE(SUM(e.amount), 0) AS total
         FROM blocks b LEFT JOIN entries e ON e.block_id = b.id
        WHERE b.user_id = ? AND b.ym LIKE ? AND b.kind != 'total'
        GROUP BY b.ym, b.kind`,
    )
    .all(userId, `${year}-%`);
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
    await db
      .prepare(
        `SELECT MIN(b.name) AS name, b.kind AS kind, COALESCE(SUM(e.amount), 0) AS total
           FROM blocks b LEFT JOIN entries e ON e.block_id = b.id
          WHERE b.user_id = ? AND b.ym LIKE ? AND b.kind != 'total'
          GROUP BY lower(b.name), b.kind
          ORDER BY total DESC`,
      )
      .all(userId, `${year}-%`)
  ).map((r) => ({ name: r.name as string, kind: r.kind as EntryKind, total: r.total as number }));

  const carry = await carryBefore(userId, `${year}-01`);
  return { year, carryIn: carry.planned, months, categories };
}

/* ------------------------------------------------------------------ */
/* Painel                                                              */
/* ------------------------------------------------------------------ */

/** Até 6 meses terminando em `ym` (só os iniciados) e o próximo, se existir. */
/** Tabelas e linhas de um mês, sem o resto do getMonth (sobra, saldo...). */
async function monthBlocks(userId: string, ym: string): Promise<Block[]> {
  const db = getDb();
  const [blockRows, entryRows] = await Promise.all([
    db.prepare("SELECT * FROM blocks WHERE user_id = ? AND ym = ? ORDER BY position, created_at").all(userId, ym),
    db
      .prepare(
        `SELECT e.* FROM entries e JOIN blocks b ON b.id = e.block_id
          WHERE b.user_id = ? AND b.ym = ? ORDER BY e.position, e.created_at`,
      )
      .all(userId, ym),
  ]);
  const byBlock = new Map<string, Entry[]>();
  for (const r of entryRows) {
    const e = mapEntry(r);
    const list = byBlock.get(e.blockId);
    if (list) list.push(e);
    else byBlock.set(e.blockId, [e]);
  }
  return blockRows.map((r) => ({ ...mapBlock(r), entries: byBlock.get(r.id) ?? [] }));
}

/** Até 6 meses terminando em `ym` (só os iniciados) e o próximo, se existir. */
export async function dashboard(userId: string, ym: string): Promise<DashboardPayload> {
  const db = getDb();
  const from = addMonths(ym, -5);
  const next = addMonths(ym, 1);
  const rows = await db
    .prepare("SELECT ym FROM months WHERE user_id = ? AND ym >= ? AND ym <= ? ORDER BY ym")
    .all(userId, from, next);
  const yms = rows.map((r) => r.ym as string);
  const load = async (m: string) => ({ ym: m, blocks: await monthBlocks(userId, m) });
  const [members, carry, months, nextMonth] = await Promise.all([
    listMembers(userId),
    carryBefore(userId, ym),
    Promise.all(yms.filter((m) => m <= ym).map(load)),
    yms.includes(next) ? load(next) : null,
  ]);
  return { ym, members, carry, months, next: nextMonth };
}

/* ------------------------------------------------------------------ */
/* Exportação                                                          */
/* ------------------------------------------------------------------ */

export async function exportAll(userId: string) {
  const db = getDb();
  const [user, months, members, goals, installments, importRules, deferredEntries] = await Promise.all([
    findUserById(userId),
    db.prepare("SELECT ym FROM months WHERE user_id = ? ORDER BY ym").all(userId),
    listMembers(userId),
    goalStats(userId),
    db.prepare("SELECT * FROM installments WHERE user_id = ? ORDER BY created_at").all(userId),
    listImportRules(userId),
    listDeferred(userId),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    user: { name: user?.name, email: user?.email },
    members,
    goals: goals.map(({ history: _h, ...g }) => g),
    installments: installments.map(({ user_id: _u, ...r }) => r),
    importRules,
    deferredEntries,
    months: await Promise.all(months.map(async (m) => ({ ym: m.ym as string, blocks: await monthBlocks(userId, m.ym) }))),
  };
}
