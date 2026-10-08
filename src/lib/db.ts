import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";
import { attachDatabasePool } from "@vercel/functions";
import pg from "pg";

// o schema fica em supabase/schema.sql (rode no SQL Editor do Supabase)

// pasta de arquivos locais (segredo da sessão, backups). O caminho não pode ser
// previsível no build: senão o pacote "standalone" leva junto arquivos locais
export const DATA_DIR = path.resolve(process.env.APP_ROOT || process.cwd(), "data");

// SUM/COUNT voltam como bigint (texto no pg); os valores cabem num number.
// Datas ficam como texto, iguais às do SQLite.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (v) => v);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (v) => v);

export type Bind = string | number | boolean | null | string[];

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export interface Stmt {
  run(...params: Bind[]): Promise<{ changes: number }>;
  get(...params: Bind[]): Promise<Row | undefined>;
  all(...params: Bind[]): Promise<Row[]>;
}

export interface Db {
  prepare(sql: string): Stmt;
  /** Roda `fn` numa transação. Tudo que usar getDb() dentro dela entra junto. */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

declare global {
  // eslint-disable-next-line no-var
  var __financeFlowPool: pg.Pool | undefined;
}

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Defina DATABASE_URL no .env (Supabase → Connect → Session pooler).");
  // o sslmode da URL substituiria a configuração de SSL abaixo
  const u = new URL(url);
  u.searchParams.delete("sslmode");
  return u.toString();
}

function pool(): pg.Pool {
  if (!globalThis.__financeFlowPool) {
    const conn = connectionString();
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(conn);
    const vercel = !!process.env.VERCEL;
    const p = new pg.Pool({
      connectionString: conn,
      ssl: local ? false : { rejectUnauthorized: false },
      // na Vercel cada instância tem seu pool: poucas conexões, devolvidas logo
      max: Number(process.env.DATABASE_POOL_MAX) || (vercel ? 2 : 5),
      idleTimeoutMillis: vercel ? 5_000 : 30_000,
    });
    p.on("error", (err) => console.error("Conexão com o banco:", err));
    // fecha as conexões ociosas antes de a instância ser suspensa
    if (vercel) attachDatabasePool(p);
    globalThis.__financeFlowPool = p;
  }
  return globalThis.__financeFlowPool;
}

// "?" -> "$1, $2..." (o código usa o estilo do SQLite); ignora "?" dentro de aspas
const converted = new Map<string, string>();
function toPg(sql: string): string {
  let out = converted.get(sql);
  if (out !== undefined) return out;
  let n = 0;
  let quoted = false;
  out = "";
  for (const ch of sql) {
    if (ch === "'") quoted = !quoted;
    out += ch === "?" && !quoted ? `$${++n}` : ch;
  }
  converted.set(sql, out);
  return out;
}

// cliente da transação em andamento (e a profundidade, para os savepoints)
const tx = new AsyncLocalStorage<{ client: pg.PoolClient; depth: number }>();

const query = (sql: string, params: Bind[]) =>
  (tx.getStore()?.client ?? pool()).query(toPg(sql), params);

const db: Db = {
  prepare(sql) {
    return {
      run: async (...params) => ({ changes: (await query(sql, params)).rowCount ?? 0 }),
      get: async (...params) => (await query(sql, params)).rows[0],
      all: async (...params) => (await query(sql, params)).rows,
    };
  },
  async transaction(fn) {
    const store = tx.getStore();
    if (store) {
      const sp = `sp_${store.depth}`;
      await store.client.query(`SAVEPOINT ${sp}`);
      store.depth += 1;
      try {
        const out = await fn();
        await store.client.query(`RELEASE SAVEPOINT ${sp}`);
        return out;
      } catch (err) {
        await store.client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
        throw err;
      } finally {
        store.depth -= 1;
      }
    }
    const client = await pool().connect();
    try {
      await client.query("BEGIN");
      const out = await tx.run({ client, depth: 0 }, fn);
      await client.query("COMMIT");
      return out;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },
};

export function getDb(): Db {
  return db;
}

/** Fecha as conexões (scripts de linha de comando, para o processo terminar). */
export async function closeDb() {
  const p = globalThis.__financeFlowPool;
  globalThis.__financeFlowPool = undefined;
  await p?.end();
}
