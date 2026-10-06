/** Tarefas em segundo plano do servidor (somente Node): alertas por e-mail e backup diário. */
import { runDailyBackup } from "./backup";
import { startNotifier } from "./notify";

export function startServerJobs() {
  startNotifier();
  // em produção (ou com BACKUP_DIR definido) faz uma cópia do banco por dia
  if (process.env.NODE_ENV === "production" || process.env.BACKUP_DIR) {
    const tick = () => runDailyBackup().catch((err) => console.error("Falha no backup do banco:", err));
    setTimeout(tick, 30 * 1000);
    setInterval(tick, 60 * 60 * 1000);
  }
}
