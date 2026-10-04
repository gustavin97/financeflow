import { ApiError, route } from "@/lib/api";
import { mailConfigured } from "@/lib/mailer";
import { sendDigest } from "@/lib/notify";

/** Envia agora o resumo de alertas para o e-mail da conta (botão de teste). */
export const POST = route(async ({ user }) => {
  if (!mailConfigured()) throw new ApiError("O envio de e-mail ainda não está configurado no servidor.");
  try {
    return await sendDigest(user.id, { force: true });
  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : "";
    throw new ApiError(
      /auth|535|534|Invalid login|Username and Password/i.test(msg)
        ? "O servidor de e-mail recusou o usuário/senha. No Gmail, use uma senha de app em SMTP_PASS."
        : `Não consegui enviar o e-mail: ${msg || "erro desconhecido"}`,
      502,
    );
  }
});
