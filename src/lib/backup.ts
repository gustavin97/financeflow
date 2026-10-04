/**
 * Backup automático do banco (somente servidor): uma cópia por dia em
 * BACKUP_DIR (padrão: data/backups), guardando os últimos BACKUP_KEEP dias.
 * `VACUUM INTO` gera uma cópia consistente mesmo com o app em uso (WAL incluído).
 */
import fs from "node:fs";
import path from "node:path";
import { DB_PATH, getDb } from "./db";
import { nowIn } from "./dates";
import { APP_TIMEZONE } from "./queries";

export const BACKUP_DIR = process.env.BACKUP_DIR
  ? path.resolve(process.env.BACKUP_DIR)
  : path.join(path.dirname(DB_PATH), "backups");
const KEEP = Math.max(1, Number(process.env.BACKUP_KEEP) || 14);

/** Faz o backup de hoje, se ainda não existe, e apaga os mais antigos. */
export function runDailyBackup() {
  const { date } = nowIn(APP_TIMEZONE);
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `financeflow-${date}.db`);
  if (!fs.existsSync(file)) {
    const tmp = `${file}.tmp`;
    fs.rmSync(tmp, { force: true });
    getDb().prepare("VACUUM INTO ?").run(tmp);
    fs.renameSync(tmp, file);
    console.log(`Backup do banco: ${file}`);
  }
  const old = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => /^financeflow-\d{4}-\d{2}-\d{2}\.db$/.test(f))
    .sort()
    .slice(0, -KEEP);
  for (const f of old) fs.rmSync(path.join(BACKUP_DIR, f), { force: true });
}
