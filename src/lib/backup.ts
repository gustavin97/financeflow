/**
 * Backup automático do banco (somente servidor): uma cópia por dia em
 * BACKUP_DIR (padrão: data/backups), guardando os últimos BACKUP_KEEP dias.
 * O banco fica no Supabase; a cópia é um JSON com todas as linhas de cada tabela.
 */
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, getDb } from "./db";
import { nowIn } from "./dates";
import { APP_TIMEZONE } from "./queries";

export const BACKUP_DIR = process.env.BACKUP_DIR
  ? path.resolve(process.env.BACKUP_DIR)
  : path.join(DATA_DIR, "backups");
const KEEP = Math.max(1, Number(process.env.BACKUP_KEEP) || 14);

// na ordem em que precisam ser restauradas (as referenciadas primeiro)
export const TABLES = [
  "users",
  "members",
  "months",
  "goals",
  "installments",
  "import_rules",
  "import_seen",
  "deferred_entries",
  "alert_sent",
  "blocks",
  "entries",
] as const;

/** Faz o backup de hoje, se ainda não existe, e apaga os mais antigos. */
export async function runDailyBackup() {
  const { date } = nowIn(APP_TIMEZONE);
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `financeflow-${date}.json`);
  if (!fs.existsSync(file)) {
    const db = getDb();
    // numa transação só, para a cópia ser consistente
    const data = await db.transaction(async () => {
      await db.prepare("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ").run();
      const out: Record<string, unknown[]> = {};
      for (const t of TABLES) out[t] = await db.prepare(`SELECT * FROM ${t}`).all();
      return out;
    });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ createdAt: new Date().toISOString(), tables: data }));
    fs.renameSync(tmp, file);
    console.log(`Backup do banco: ${file}`);
  }
  const old = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => /^financeflow-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .slice(0, -KEEP);
  for (const f of old) fs.rmSync(path.join(BACKUP_DIR, f), { force: true });
}
