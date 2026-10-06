/**
 * Copia os dados do banco SQLite antigo (data/financeflow.db) para o Postgres
 * do Supabase. Rode uma vez, depois de criar as tabelas com supabase/schema.sql:
 *   npm run migrate:sqlite
 * Pode rodar de novo: linhas que já existem no Supabase são mantidas.
 * Caminho de outro arquivo: npm run migrate:sqlite -- caminho/do/banco.db
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { closeDb, getDb } from "../src/lib/db";
import { TABLES } from "../src/lib/backup";

const file = path.resolve(process.argv[2] || "data/financeflow.db");

// o SQLite guarda "2026-10-04 12:00:00" em UTC, sem fuso
const TIME_COLS = new Set(["created_at", "updated_at", "sent_at"]);
const toTime = (v: unknown) => (typeof v === "string" && !/[zZ]|[+-]\d\d(:?\d\d)?$/.test(v) ? `${v}Z` : v);

async function main() {
  if (!fs.existsSync(file)) throw new Error(`Arquivo não encontrado: ${file}`);
  const lite = new DatabaseSync(file, { readOnly: true });
  const db = getDb();

  await db.transaction(async () => {
    for (const table of TABLES) {
      const pgCols = new Set(
        (
          await db
            .prepare("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ?")
            .all(table)
        ).map((r) => r.column_name as string),
      );
      if (!pgCols.size) throw new Error(`A tabela "${table}" não existe no Supabase. Rode supabase/schema.sql primeiro.`);
      const exists = lite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
      if (!exists) continue;

      const rows = lite.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
      if (!rows.length) {
        console.log(`${table}: vazia`);
        continue;
      }
      const cols = Object.keys(rows[0]).filter((c) => pgCols.has(c));
      const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")}) ON CONFLICT DO NOTHING`;
      const st = db.prepare(sql);
      let added = 0;
      for (const r of rows) {
        const vals = cols.map((c) => {
          const v = r[c];
          if (TIME_COLS.has(c)) return toTime(v) as string;
          return typeof v === "bigint" ? Number(v) : (v as string | number | null);
        });
        added += (await st.run(...vals)).changes;
      }
      console.log(`${table}: ${added} de ${rows.length} linhas copiadas`);
    }
  });
  lite.close();
  console.log("\nPronto: os dados estão no Supabase.");
}

main()
  .then(() => closeDb())
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
