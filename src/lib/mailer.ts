/**
 * Envio de e-mail por SMTP (somente servidor). Configurado pelas variáveis
 * SMTP_* do .env; no Gmail, use uma "senha de app" em SMTP_PASS.
 */
import nodemailer, { type Transporter } from "nodemailer";

declare global {
  // eslint-disable-next-line no-var
  var __financeFlowMail: { sig: string; t: Transporter } | undefined;
}

export function mailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transport(): Transporter {
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465;
  const opts = {
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  };
  // o .env pode mudar com o servidor rodando: recria quando a configuração muda
  const sig = JSON.stringify(opts);
  if (globalThis.__financeFlowMail?.sig !== sig)
    globalThis.__financeFlowMail = { sig, t: nodemailer.createTransport(opts) };
  return globalThis.__financeFlowMail.t;
}

export async function sendMail(msg: { to: string; subject: string; html: string; text: string }) {
  if (!mailConfigured()) throw new Error("O envio de e-mail não está configurado (SMTP_HOST, SMTP_USER e SMTP_PASS no .env).");
  const from = process.env.MAIL_FROM || `Finance Flow <${process.env.SMTP_USER}>`;
  await transport().sendMail({ from, ...msg });
}
