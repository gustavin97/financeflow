/** Roda uma vez quando o servidor sobe: alertas por e-mail e backup diário do banco. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startNotifier } = await import("./lib/notify");
  startNotifier();
  // em produção (ou com BACKUP_DIR definido) faz uma cópia do banco por dia
  if (process.env.NODE_ENV === "production" || process.env.BACKUP_DIR) {
    const { runDailyBackup } = await import("./lib/backup");
    const tick = () => {
      try {
        runDailyBackup();
      } catch (err) {
        console.error("Falha no backup do banco:", err);
      }
    };
    setTimeout(tick, 30 * 1000);
    setInterval(tick, 60 * 60 * 1000);
  }
}
