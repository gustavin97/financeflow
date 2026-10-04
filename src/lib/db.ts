import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(process.cwd(), "data", "financeflow.db");

const BLOCKS_TABLE = (name: string) => `
CREATE TABLE IF NOT EXISTS ${name} (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ym           TEXT NOT NULL,
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('income','expense','savings','total')),
  budget_type  TEXT NOT NULL DEFAULT 'none' CHECK (budget_type IN ('none','amount','percent')),
  budget_value REAL NOT NULL DEFAULT 0,
  columns      TEXT NOT NULL DEFAULT '[]',
  position     INTEGER NOT NULL DEFAULT 0,
  member_id    TEXT REFERENCES members(id) ON DELETE SET NULL,
  source       TEXT,
  card         INTEGER NOT NULL DEFAULT 0,
  card_paid    INTEGER,
  card_close   INTEGER,
  card_due     INTEGER,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);`;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  -- abrir o mês novo sozinho: 'copy', 'structure' ou 'off'
  auto_month    TEXT NOT NULL DEFAULT 'copy',
  -- sobra do mês que fechou vai para o cofrinho: 'ask', 'auto' ou 'off'
  surplus_mode  TEXT NOT NULL DEFAULT 'ask',
  surplus_goal  TEXT,
  surplus_pct   INTEGER NOT NULL DEFAULT 100,
  -- resumo diário de alertas por e-mail (hora no APP_TIMEZONE) e o último dia verificado
  email_alerts  INTEGER NOT NULL DEFAULT 0,
  email_hour    INTEGER NOT NULL DEFAULT 8,
  email_last    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- meses que o usuário já iniciou
CREATE TABLE IF NOT EXISTS months (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ym         TEXT NOT NULL,
  -- mês aberto sozinho a partir deste (aviso na planilha até ser dispensado)
  auto_from  TEXT,
  -- sobra deste mês: NULL (não decidida), 'saved' ou 'skipped'
  surplus_state TEXT,
  surplus_entry TEXT,
  -- aviso da sobra guardada sozinha já visto
  surplus_seen  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, ym)
);

-- metas do cofrinho (apartamento, carro, viagem...)
CREATE TABLE IF NOT EXISTS goals (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  target_amount INTEGER NOT NULL DEFAULT 0,
  target_month  TEXT,
  color         TEXT NOT NULL DEFAULT '#1d5fbf',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);

-- pessoas da casa (ex.: marido e esposa)
CREATE TABLE IF NOT EXISTS members (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#2a78d6',
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_members_user ON members(user_id);

-- compras parceladas: cada parcela vira uma linha no mês dela (ver queries.ts)
CREATE TABLE IF NOT EXISTS installments (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description     TEXT NOT NULL DEFAULT '',
  total_amount    INTEGER NOT NULL,
  count           INTEGER NOT NULL,
  first_no        INTEGER NOT NULL DEFAULT 1,
  start_ym        TEXT NOT NULL,
  day             INTEGER,
  block_name      TEXT NOT NULL,
  block_card      INTEGER NOT NULL DEFAULT 0,
  block_member_id TEXT,
  pay_with_name   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_installments_user ON installments(user_id);

-- importação de extrato: "palavras da descrição -> tabela", aprendidas a cada importação.
-- A tabela é guardada pelo nome (e dono) porque os ids mudam de um mês para o outro.
CREATE TABLE IF NOT EXISTS import_rules (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pattern         TEXT NOT NULL,
  block_name      TEXT NOT NULL,
  block_member_id TEXT,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, pattern)
);

-- lançamentos de extrato já importados (FITID do OFX ou assinatura da linha do CSV)
CREATE TABLE IF NOT EXISTS import_seen (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, key)
);

-- compras de cartão movidas para a fatura de um mês que ainda não foi iniciado:
-- viram linha quando o mês for iniciado (como as parcelas)
CREATE TABLE IF NOT EXISTS deferred_entries (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ym              TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  amount          INTEGER NOT NULL DEFAULT 0,
  date            TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  extra           TEXT NOT NULL DEFAULT '{}',
  block_name      TEXT NOT NULL,
  block_card      INTEGER NOT NULL DEFAULT 0,
  block_member_id TEXT,
  pay_with_name   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_deferred_user_ym ON deferred_entries(user_id, ym);

-- alertas já enviados por e-mail (para não repetir o mesmo aviso todo dia)
CREATE TABLE IF NOT EXISTS alert_sent (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fp      TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, fp)
);

-- tabelas (blocos) de cada mês: Receitas, Contas da casa, Lazer, Cofrinho, Totais...
${BLOCKS_TABLE("blocks")}

-- linhas de cada tabela
CREATE TABLE IF NOT EXISTS entries (
  id          TEXT PRIMARY KEY,
  block_id    TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  amount      INTEGER NOT NULL DEFAULT 0,
  date        TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done')),
  goal_id     TEXT REFERENCES goals(id) ON DELETE SET NULL,
  extra       TEXT NOT NULL DEFAULT '{}',
  position    INTEGER NOT NULL DEFAULT 0,
  ref         TEXT,
  sign        INTEGER NOT NULL DEFAULT 1,
  pay_with    TEXT REFERENCES blocks(id) ON DELETE SET NULL,
  inst_id     TEXT REFERENCES installments(id) ON DELETE SET NULL,
  inst_no     INTEGER,
  inst_count  INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

// índices ficam depois da migração porque alguns usam colunas novas
const INDEXES = `
CREATE INDEX IF NOT EXISTS idx_blocks_user_ym ON blocks(user_id, ym);
CREATE INDEX IF NOT EXISTS idx_entries_block ON entries(block_id);
CREATE INDEX IF NOT EXISTS idx_entries_goal ON entries(goal_id);
CREATE INDEX IF NOT EXISTS idx_entries_pay_with ON entries(pay_with);
CREATE INDEX IF NOT EXISTS idx_entries_inst ON entries(inst_id);
`;

/** Atualiza bancos criados antes das pessoas / tabelas de total / cartões / parcelas. */
function migrate(raw: Pick<DatabaseSync, "exec" | "prepare">) {
  const cols = (table: string) =>
    new Set((raw.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name));

  const entryCols = cols("entries");
  if (!entryCols.has("ref")) raw.exec("ALTER TABLE entries ADD COLUMN ref TEXT");
  if (!entryCols.has("sign")) raw.exec("ALTER TABLE entries ADD COLUMN sign INTEGER NOT NULL DEFAULT 1");

  // o CHECK de `kind` mudou: o SQLite exige recriar a tabela
  if (!cols("blocks").has("member_id")) {
    raw.exec("PRAGMA foreign_keys = OFF");
    raw.exec("BEGIN");
    try {
      raw.exec(BLOCKS_TABLE("blocks_new"));
      raw.exec(
        `INSERT INTO blocks_new (id, user_id, ym, name, kind, budget_type, budget_value, columns, position, created_at)
         SELECT id, user_id, ym, name, kind, budget_type, budget_value, columns, position, created_at FROM blocks`,
      );
      raw.exec("DROP TABLE blocks");
      raw.exec("ALTER TABLE blocks_new RENAME TO blocks");
      raw.exec("COMMIT");
    } catch (err) {
      raw.exec("ROLLBACK");
      throw err;
    } finally {
      raw.exec("PRAGMA foreign_keys = ON");
    }
  }

  // cartão de crédito
  const blockCols = cols("blocks");
  if (!blockCols.has("card")) raw.exec("ALTER TABLE blocks ADD COLUMN card INTEGER NOT NULL DEFAULT 0");
  if (!blockCols.has("card_paid")) raw.exec("ALTER TABLE blocks ADD COLUMN card_paid INTEGER");
  if (!blockCols.has("card_close")) {
    raw.exec("ALTER TABLE blocks ADD COLUMN card_close INTEGER");
    raw.exec("ALTER TABLE blocks ADD COLUMN card_due INTEGER");
  }
  if (!entryCols.has("pay_with"))
    raw.exec("ALTER TABLE entries ADD COLUMN pay_with TEXT REFERENCES blocks(id) ON DELETE SET NULL");

  // mês novo aberto sozinho
  if (!cols("users").has("auto_month"))
    raw.exec("ALTER TABLE users ADD COLUMN auto_month TEXT NOT NULL DEFAULT 'copy'");
  if (!cols("months").has("auto_from")) raw.exec("ALTER TABLE months ADD COLUMN auto_from TEXT");

  // sobra do mês para o cofrinho
  if (!cols("users").has("surplus_mode")) {
    raw.exec("ALTER TABLE users ADD COLUMN surplus_mode TEXT NOT NULL DEFAULT 'ask'");
    raw.exec("ALTER TABLE users ADD COLUMN surplus_goal TEXT");
    raw.exec("ALTER TABLE users ADD COLUMN surplus_pct INTEGER NOT NULL DEFAULT 100");
  }
  if (!cols("months").has("surplus_state")) {
    raw.exec("ALTER TABLE months ADD COLUMN surplus_state TEXT");
    raw.exec("ALTER TABLE months ADD COLUMN surplus_entry TEXT");
    raw.exec("ALTER TABLE months ADD COLUMN surplus_seen INTEGER NOT NULL DEFAULT 0");
  }

  // alertas por e-mail
  if (!cols("users").has("email_alerts")) {
    raw.exec("ALTER TABLE users ADD COLUMN email_alerts INTEGER NOT NULL DEFAULT 0");
    raw.exec("ALTER TABLE users ADD COLUMN email_hour INTEGER NOT NULL DEFAULT 8");
    raw.exec("ALTER TABLE users ADD COLUMN email_last TEXT");
  }

  // compras parceladas
  if (!entryCols.has("inst_id")) {
    raw.exec("ALTER TABLE entries ADD COLUMN inst_id TEXT REFERENCES installments(id) ON DELETE SET NULL");
    raw.exec("ALTER TABLE entries ADD COLUMN inst_no INTEGER");
    raw.exec("ALTER TABLE entries ADD COLUMN inst_count INTEGER");
  }
}

export type Bind = string | number | bigint | null | Uint8Array;

export interface Stmt {
  run(...params: Bind[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: Bind[]): Record<string, unknown> | undefined;
  all(...params: Bind[]): Record<string, unknown>[];
}

export interface Db {
  prepare(sql: string): Stmt;
  exec(sql: string): void;
  transaction<T extends (...args: never[]) => unknown>(fn: T): T;
}

declare global {
  // eslint-disable-next-line no-var
  var __financeFlowDb: Db | undefined;
  // eslint-disable-next-line no-var
  var __financeFlowSchema: string | undefined;
}

// node:sqlite devolve linhas com prototype nulo; o React não aceita isso ao
// cruzar a fronteira Server -> Client Component. Copiamos para objeto comum.
const plain = (row: unknown) => Object.assign({}, row as Record<string, unknown>);

function open(): Db {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const raw = new DatabaseSync(DB_PATH);
  raw.exec("PRAGMA journal_mode = WAL");
  raw.exec("PRAGMA foreign_keys = ON");
  ensureSchema(raw);

  // node:sqlite não tem transaction(); controlamos a profundidade à mão.
  let depth = 0;

  const db: Db = {
    exec: (sql) => raw.exec(sql),
    prepare(sql) {
      const st = raw.prepare(sql);
      return {
        run: (...params) => st.run(...params) as { changes: number | bigint; lastInsertRowid: number | bigint },
        get: (...params) => {
          const row = st.get(...params);
          return row === undefined ? undefined : plain(row);
        },
        all: (...params) => (st.all(...params) as unknown[]).map(plain),
      };
    },
    transaction(fn) {
      const wrapped = (...args: never[]) => {
        const sp = `sp_${depth}`;
        raw.exec(depth === 0 ? "BEGIN" : `SAVEPOINT ${sp}`);
        depth += 1;
        try {
          const out = fn(...args);
          depth -= 1;
          raw.exec(depth === 0 ? "COMMIT" : `RELEASE ${sp}`);
          return out;
        } catch (err) {
          depth -= 1;
          if (depth === 0) raw.exec("ROLLBACK");
          else raw.exec(`ROLLBACK TO ${sp}`), raw.exec(`RELEASE ${sp}`);
          throw err;
        }
      };
      return wrapped as unknown as typeof fn;
    },
  };

  return db;
}

function ensureSchema(raw: Pick<DatabaseSync, "exec" | "prepare">) {
  raw.exec(SCHEMA);
  migrate(raw);
  raw.exec(INDEXES);
}

// em desenvolvimento a conexão sobrevive às recargas do código: se o schema
// mudou desde que ela foi aberta, roda a migração de novo (é idempotente)
const SCHEMA_SIG = SCHEMA + INDEXES + migrate.toString();

export function getDb(): Db {
  if (!globalThis.__financeFlowDb) {
    globalThis.__financeFlowDb = open();
  } else if (globalThis.__financeFlowSchema !== SCHEMA_SIG) {
    ensureSchema(globalThis.__financeFlowDb as unknown as Pick<DatabaseSync, "exec" | "prepare">);
  }
  globalThis.__financeFlowSchema = SCHEMA_SIG;
  return globalThis.__financeFlowDb;
}
