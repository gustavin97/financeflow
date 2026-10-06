/** Roda uma vez quando o servidor sobe: alertas por e-mail e backup diário do banco. */
export async function register() {
  // a condição tem que ser esta (positiva) para o Next não empacotar o pg no runtime edge
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startServerJobs } = await import("./lib/jobs");
    startServerJobs();
  }
}
