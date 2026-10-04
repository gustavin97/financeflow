/**
 * Alertas por e-mail (somente servidor): uma vez por dia, no horário escolhido,
 * cada conta com o aviso ligado recebe os sinalizadores do mês atual, os mesmos
 * da planilha. Só sai e-mail quando há aviso novo ou que mudou desde o último.
 */
import { monthAlerts, type FinAlert } from "./alerts";
import { buildCalc } from "./calc";
import { nowIn, ymLabel } from "./dates";
import { getDb } from "./db";
import { mailConfigured, sendMail } from "./mailer";
import { APP_TIMEZONE, getMonth } from "./queries";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

// contas vencidas/vencendo e falta de caixa voltam a avisar a cada dia
const DAILY = new Set(["overdue", "due-soon", "cash"]);

/** Alertas (perigo e atenção) do mês atual, cada um com a sua "impressão digital". */
export function currentAlerts(userId: string) {
  const { date: today } = nowIn(APP_TIMEZONE);
  const ym = today.slice(0, 7);
  const m = getMonth(userId, ym);
  if (!m.initialized) return { ym, alerts: [] as (FinAlert & { fp: string })[] };
  const calc = buildCalc(m.blocks, m.members, m.carry);
  const alerts = monthAlerts({ ym, blocks: m.blocks, members: m.members, carry: m.carry, calc, today })
    .filter((a) => a.level !== "ok")
    .map((a) => ({ ...a, fp: [ym, a.id, a.title, DAILY.has(a.id) ? today : ""].join("|").slice(0, 400) }));
  return { ym, alerts };
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function render(name: string, ym: string, alerts: (FinAlert & { fresh: boolean })[]) {
  const url = `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/planilha/${ym}`;
  const month = ymLabel(ym);
  const danger = alerts.filter((a) => a.level === "danger").length;
  const subject = alerts.length
    ? `Finance Flow: ${alerts.length} ${alerts.length === 1 ? "aviso" : "avisos"} sobre ${month}${danger ? " (atenção)" : ""}`
    : `Finance Flow: tudo certo em ${month}`;
  const color = { danger: "#c4361f", warning: "#b7791f", ok: "#107c41" };
  const items = alerts
    .map(
      (a) => `<tr><td style="padding:10px 12px;border-left:4px solid ${color[a.level]};background:#f7f9fa">
        <div style="font-weight:600;color:#1c2024">${esc(a.title)}${
          a.fresh ? ' <span style="font-size:12px;font-weight:600;color:#107c41;background:#e7f3ec;padding:1px 6px;border-radius:4px">novo</span>' : ""
        }</div>
        ${a.detail ? `<div style="color:#5f6b76;font-size:14px;margin-top:2px">${esc(a.detail)}</div>` : ""}
      </td></tr><tr><td style="height:8px"></td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f1f4f7;font-family:Segoe UI,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #dfe4ea;border-radius:12px">
      <tr><td style="padding:18px 20px;border-bottom:1px solid #e2e6eb">
        <div style="font-size:13px;color:#107c41;font-weight:700;letter-spacing:.04em">FINANCE FLOW</div>
        <div style="font-size:19px;font-weight:600;color:#1c2024;margin-top:4px">Olá, ${esc(name)}! Como está ${esc(month)}:</div>
      </td></tr>
      <tr><td style="padding:16px 20px 8px">
        ${alerts.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>` : '<p style="color:#1c2024">Nenhum aviso: o mês está sob controle.</p>'}
      </td></tr>
      <tr><td style="padding:4px 20px 22px">
        <a href="${url}" style="display:inline-block;background:#107c41;color:#fff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px">Abrir a planilha</a>
        <p style="color:#8a949e;font-size:12.5px;margin:16px 0 0">Você recebe este e-mail porque ligou os alertas em Conta → Alertas por e-mail.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
  const text = [
    `Olá, ${name}! Como está ${month}:`,
    "",
    ...(alerts.length
      ? alerts.map((a) => `${a.level === "danger" ? "[!]" : "[i]"} ${a.title}${a.fresh ? " (novo)" : ""}${a.detail ? `\n    ${a.detail}` : ""}`)
      : ["Nenhum aviso: o mês está sob controle."]),
    "",
    `Abrir a planilha: ${url}`,
  ].join("\n");
  return { subject, html, text };
}

/**
 * Manda o resumo para o e-mail da conta. Sem `force`, só envia se houver aviso
 * novo; com `force` (botão de teste), envia mesmo sem nada novo.
 */
export async function sendDigest(userId: string, opts: { force?: boolean } = {}) {
  const db = getDb();
  const user = db.prepare("SELECT name, email FROM users WHERE id = ?").get(userId) as Row | undefined;
  if (!user) return { sent: false, count: 0 };
  const { ym, alerts } = currentAlerts(userId);
  const seenSt = db.prepare("SELECT 1 FROM alert_sent WHERE user_id = ? AND fp = ?");
  const list = alerts.map((a) => ({ ...a, fresh: !seenSt.get(userId, a.fp) }));
  if (!opts.force && !list.some((a) => a.fresh)) return { sent: false, count: alerts.length };

  await sendMail({ to: user.email, ...render(user.name, ym, list) });

  const mark = db.prepare("INSERT OR IGNORE INTO alert_sent (user_id, fp) VALUES (?, ?)");
  db.transaction(() => {
    for (const a of list) mark.run(userId, a.fp);
    db.prepare("DELETE FROM alert_sent WHERE user_id = ? AND sent_at < datetime('now', '-120 days')").run(userId);
  })();
  return { sent: true, count: alerts.length };
}

/** Contas com alerta ligado cujo horário já passou hoje e que ainda não foram verificadas. */
export async function runDueDigests() {
  if (!mailConfigured()) return;
  const { date, hour } = nowIn(APP_TIMEZONE);
  const db = getDb();
  const due = db
    .prepare("SELECT id FROM users WHERE email_alerts = 1 AND email_hour <= ? AND (email_last IS NULL OR email_last < ?)")
    .all(hour, date) as Row[];
  for (const u of due) {
    // marca antes de enviar: se o SMTP falhar, não fica tentando a cada poucos minutos
    db.prepare("UPDATE users SET email_last = ? WHERE id = ?").run(date, u.id);
    try {
      await sendDigest(u.id);
    } catch (err) {
      console.error("Falha ao enviar os alertas por e-mail:", err);
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __financeFlowNotify: ReturnType<typeof setInterval> | undefined;
}

/** Verifica a cada 5 minutos enquanto o servidor estiver rodando. */
export function startNotifier() {
  if (globalThis.__financeFlowNotify) return;
  const tick = () => runDueDigests().catch((err) => console.error("Alertas por e-mail:", err));
  globalThis.__financeFlowNotify = setInterval(tick, 5 * 60 * 1000);
  setTimeout(tick, 20 * 1000);
}
