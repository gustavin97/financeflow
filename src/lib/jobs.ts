/** Tarefas em segundo plano do servidor (somente Node): backup diário. */
import { runDailyBackup } from "./backup";

export function startServerJobs() {
  // na Vercel o disco é só leitura e o servidor não fica rodando: sem backup em arquivo
  if (process.env.VERCEL) return;
  // em produção (ou com BACKUP_DIR definido) faz uma cópia do banco por dia
  if (process.env.NODE_ENV === "production" || process.env.BACKUP_DIR) {
    const tick = () => runDailyBackup().catch((err) => console.error("Falha no backup do banco:", err));
    setTimeout(tick, 30 * 1000);
    setInterval(tick, 60 * 60 * 1000);
  }
}
