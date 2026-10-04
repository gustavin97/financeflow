/** Roda uma vez quando o servidor sobe: liga a verificação dos alertas por e-mail. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startNotifier } = await import("./lib/notify");
  startNotifier();
}
